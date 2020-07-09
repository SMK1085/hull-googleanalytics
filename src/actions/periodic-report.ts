import { Request, Response, RequestHandler } from "express";
import { AwilixContainer } from "awilix";
import { SyncAgent } from "../core/sync-agent";
import { PeriodicReportType } from "../core/service-objects";

export const periodReportActionFactory = (
  container: AwilixContainer,
): RequestHandler => {
  return async (req: Request, res: Response): Promise<unknown> => {
    try {
      const reportType = req.params.type as PeriodicReportType;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { client, ship, metric } = (req as any).hull;
      const syncAgent = new SyncAgent(client, ship, metric, container);
      res.status(200).json({ queued: true });
      await syncAgent.executePeriodicReport(reportType);
      return Promise.resolve(true);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Unknown error", error: { message: error.message } });
      return Promise.resolve(false);
    }
  };
};
