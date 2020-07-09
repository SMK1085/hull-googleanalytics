import { Request, Response, RequestHandler } from "express";
import { AwilixContainer } from "awilix";
import { SyncAgent } from "../core/sync-agent";
import { GoogleAnalyticsMetadataType } from "../core/service-objects";
import { FieldsSchema } from "../types/fields-schema";
import { Logger } from "winston";

export const metaFieldsHandlerFactory = (
  container: AwilixContainer,
): RequestHandler => {
  return async (req: Request, res: Response): Promise<unknown> => {
    const objectType = req.params.type as GoogleAnalyticsMetadataType;

    if (objectType === undefined) {
      const payload: FieldsSchema = {
        ok: false,
        error: `Unknown object type: '${req.params.type}'`,
        options: [],
      };

      res.status(200).json(payload);
      return Promise.resolve(false);
    }

    let logger = undefined;

    try {
      const { client, ship, metric } = (req as any).hull;
      const syncAgent = new SyncAgent(client, ship, metric, container);
      logger = container.resolve<Logger>("logger");
      logger.debug(`Retrieving fields for '${objectType}'...`);
      const fieldsSchema = await syncAgent.getMetadataFields(objectType);
      logger.debug(`Retrieved fields for '${objectType}'.`, fieldsSchema);
      res.status(200).json(fieldsSchema);
      return Promise.resolve(true);
    } catch (error) {
      if (logger !== undefined) {
        (logger as Logger).error(error);
      }
      const payload: FieldsSchema = {
        ok: false,
        error: `An unhandled error occured.`,
        options: [],
      };

      res.status(200).json(payload);
      return Promise.resolve(false);
    }
  };
};
