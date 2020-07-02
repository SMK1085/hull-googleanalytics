import { Request, Response, RequestHandler } from "express";
import { AwilixContainer } from "awilix";
import { SyncAgent } from "../core/sync-agent";

export const statusActionFactory = (
  container: AwilixContainer,
): RequestHandler => {
  return async (req: Request, res: Response): Promise<unknown> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { client, ship, metric } = (req as any).hull;
      const syncAgent = new SyncAgent(client, ship, metric, container);
      const status = await syncAgent.determineConnectorStatus();
      res.status(200).json(status);
      return Promise.resolve(true);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Unknown error", error: { message: error.message } });
      return Promise.resolve(false);
    }
  };
};
