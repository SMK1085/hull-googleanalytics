import { Application } from "express";
import { smartNotifierHandler } from "hull/lib/utils";
import { createContainer, asValue, asClass } from "awilix";
import { createLogger, LoggerOptions, format, transports } from "winston";
import actions from "./actions";
import cors from "cors";
import _ from "lodash";
import { ClientOpts } from "redis";
import { ConnectorRedisClient } from "./utils/redis-client";
// import { CachingUtil } from "./utils/caching-util";

export const server = (app: Application): Application => {
  // DI Container
  const container = createContainer();

  // Instantiate the global logger
  const loggerOptions: LoggerOptions = {
    level: process.env.LOG_LEVEL || "error",
    format: format.combine(
      format.colorize({ all: true }),
      format.timestamp(),
      format.align(),
    ),
    defaultMeta: {
      service: process.env.LOG_SERVICENAME || "hull-googleanalytics",
    },
  };
  // Add console as transport since we don't use a dedicated transport
  // but rely on the OS to ship logs
  loggerOptions.transports = [
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        format.timestamp(),
        format.align(),
        format.printf((info) => {
          const { timestamp, level, message, ...args } = info;
          const { meta } = info;
          let metaStructured = "";

          if (meta) {
            metaStructured = `${meta.component}#${meta.method}`;
            delete args.meta;
          }

          let appInfo = "";

          if (args.service) {
            appInfo = args.service;
            delete args.service;
          }

          return `[${appInfo}]  ${timestamp} | ${level} | ${metaStructured} |${message} ${
            Object.keys(args).length > 0 ? JSON.stringify(args, null, 2) : ""
          }`;
        }),
      ),
    }),
  ];

  const globalLogger = createLogger(loggerOptions);

  // DI for Redis
  const redisClientOpts: ClientOpts = {
    url: process.env.REDIS_URL,
  };

  container.register({
    redisClient: asClass(ConnectorRedisClient).singleton(),
    redisClientOpts: asValue(redisClientOpts),
    logger: asValue(globalLogger),
    // cachingUtil: asClass(CachingUtil).singleton(),
  });

  // Set the view engine to ejs
  app.set("view engine", "ejs");

  // Hull platform handler endpoints
  app.post(
    "/smart-notifier",
    smartNotifierHandler({
      handlers: {
        "user:update": actions.userUpdate({
          flowControl: {
            type: "next",
            size: parseInt(_.get(process.env.FLOW_CONTROL_SIZE, "30"), 10),
            in: parseInt(_.get(process.env.FLOW_CONTROL_IN, "5"), 10),
            in_time: parseInt(
              _.get(process.env.FLOW_CONTROL_IN_TIME, "60000"),
              10,
            ),
          },
          container,
        }),
      },
    }),
  );

  app.post(
    "/batch",
    smartNotifierHandler({
      userHandlerOptions: {
        groupTraits: false,
      },
      handlers: {
        "user:update": actions.userUpdate({ isBatch: true, container }),
      },
    }),
  );

  // CORS enabled endpoints
  // app.use("/meta/fields/:type", cors(), actions.metaFields(container));
  // app.use("/fetch/:type/:jobType", cors(), actions.fetch(container));

  // OAuth handler endpoints
  //app.get("/auth", actions.authInitializerFactory(container));
  //app.get("/auth/callback", actions.authCallbackFactory(container));

  // Fetch endpoints

  // Status endpoints
  app.use("/status", actions.status(container));
  // app.use("/auth/status", cors(), actions.authStatusFactory(container));

  // Dispose the container when the server closes
  app.on("close", () => {
    globalLogger.debug("Shutting down application on CLOSE...");
    container.dispose();
  });

  process.on("SIGINT", () => {
    globalLogger.debug("Shutting down application on SIGINT...");
    if (!container) {
      return;
    }
    container.dispose();
  });

  return app;
};
