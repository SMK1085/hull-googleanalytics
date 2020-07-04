import { Request, Response, RequestHandler } from "express";
import { AwilixContainer } from "awilix";
import { IncomingForm } from "formidable";
import { Logger } from "winston";
import { ConnectorRedisClient } from "../utils/redis-client";
import { forIn, isNil } from "lodash";
import { GoogleAnalyticsInboundParseFileInfo } from "../core/service-objects";
import Hull from "hull";
import { SyncAgent } from "../core/sync-agent";

export const userExplorerExportFactory = (
  container: AwilixContainer,
): RequestHandler => {
  return async (req: Request, res: Response): Promise<unknown> => {
    const logger = container.resolve<Logger>("logger");
    let hasSentResponse = false;

    try {
      const form = new IncomingForm();
      form.uploadDir = "./temp";
      form.parse(req, async (err, fields, files) => {
        if (err) {
          res.status(500);
          return Promise.resolve(false);
        }

        const redisClient = container.resolve<ConnectorRedisClient>(
          "redisClient",
        );

        logger.debug("Received form data", fields);
        const toField = fields["to"] as string;
        const cid = toField.split("@")[0];
        const ibpConfig = await redisClient.get(`${cid}__inboundparse`);

        if (isNil(ibpConfig)) {
          res.status(403).json({ ok: false });
          return Promise.resolve(false);
        }

        const fileInfos: GoogleAnalyticsInboundParseFileInfo[] = [];
        forIn(files, (v, k) => {
          fileInfos.push({
            path: v.path,
            name: v.name,
            type: v.type,
          });
        });

        if (fileInfos.length !== 0) {
          const redisFileResult = await redisClient.set(
            `${cid}__inboundparse_files`,
            fileInfos,
            60 * 60,
          );
          logger.debug(
            `Persisted received files for connector with id '${cid}' in Redis with result: ${redisFileResult}`,
          );
        }

        const hull: any = new Hull(ibpConfig);
        const connectorInfo = await hull.get((ibpConfig as any).id);

        const agent = new SyncAgent(hull, connectorInfo, null, container);
        res.status(200).json({ ok: true });
        hasSentResponse = true;
        await agent.processUserExplorerExportFiles();

        return Promise.resolve(true);
      });
    } catch (error) {
      logger.error("Failed to handle user explorer export", { details: error });
      if (!hasSentResponse) {
        res.status(500).send({
          message: "Unknown error",
          error: { message: error.message },
        });
      }
      return Promise.resolve(false);
    }
  };
};
