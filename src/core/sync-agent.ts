import IHullClient from "../types/hull-client";
import { AwilixContainer, asValue, asClass } from "awilix";
import { PrivateSettings } from "./connector";
import _ from "lodash";
import { ConnectorStatusResponse } from "../types/connector-status";
import { ServiceClient } from "./service-client";
import IHullUserUpdateMessage from "../types/user-update-message";
import { Logger } from "winston";
import { FilterUtil } from "../utils/filter-util";
import { MappingUtil } from "../utils/mapping-util";
import {
  OutgoingOperationEnvelope,
  GoogleAnalyticsUserActivityRequestData,
  GoogleAnalyticsInboundParseFileInfo,
} from "./service-objects";
import {
  VALIDATION_SKIP_HULLUSER_NOCLIENTIDS,
  VALIDATION_SKIP_HULLUSER_RECENTUAS,
} from "./messages";
import asyncForEach from "../utils/async-foreach";
import {
  isDirAsync,
  mkDirAsync,
  saveFileToDisk,
  pathExistsAsync,
  readStringFromDisk,
  deleteFileFromDisk,
} from "../utils/filesystem";
import { ConnectorRedisClient } from "../utils/redis-client";
import { DateTime } from "luxon";
import csv from "csvtojson";

export class SyncAgent {
  readonly hullClient: IHullClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly metricsClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly hullConnector: any;

  readonly diContainer: AwilixContainer;

  readonly privateSettings: PrivateSettings;

  constructor(
    client: IHullClient,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connector: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metricsClient: any,
    container: AwilixContainer,
  ) {
    this.diContainer = container;
    this.diContainer.register("hullClient", asValue(client));
    this.hullClient = client;
    this.metricsClient = metricsClient;
    this.hullConnector = connector;
    // Obtain the private settings
    this.privateSettings = _.get(
      connector,
      "private_settings",
    ) as PrivateSettings;
    this.diContainer.register("privateSettings", asValue(this.privateSettings));
    this.diContainer.register("connectorId", asValue(this.hullConnector.id));
    // Register the utils
    this.diContainer.register("filterUtil", asClass(FilterUtil));
    this.diContainer.register("mappingUtil", asClass(MappingUtil));
    // Register the service client
    this.diContainer.register("serviceClient", asClass(ServiceClient));
  }

  /**
   * Processes outgoing notifications for user:update lane.
   *
   * @param {IHullUserUpdateMessage[]} messages The notification messages.
   * @param {boolean} [isBatch=false] `True` if it is a batch; otherwise `false`.
   * @returns {Promise<unknown>} An awaitable Promise.
   * @memberof SyncAgent
   */
  public async sendUserMessages(
    messages: IHullUserUpdateMessage[],
    isBatch = false,
  ): Promise<unknown> {
    const logger = this.diContainer.resolve<Logger>("logger");

    try {
      logger.debug(
        `Start processing user messages for connector with id '${this.hullConnector.id}'`,
      );

      const keyFilePresent = await this.ensureKeyFile();

      if (keyFilePresent) {
        logger.debug(
          `Key file for connector with id '${this.hullConnector.id}' is on disk.`,
        );
      } else {
        logger.warn(
          `Key file couldn't be persisted on disk for connector with id '${this.hullConnector.id}'.`,
        );
        return Promise.resolve(false);
      }
      const filterUtil = this.diContainer.resolve<FilterUtil>("filterUtil");
      const envelopesFiltered = filterUtil.filterUserMessagesInitial(
        messages,
        isBatch,
      );

      envelopesFiltered.skips.forEach((envelope) => {
        this.hullClient
          .asUser(envelope.message.user)
          .logger.info(
            `outgoing.${envelope.objectType}.${envelope.operation}`,
            {
              details: envelope.notes,
            },
          );
      });

      if (envelopesFiltered.enrichs.length === 0) {
        logger.debug(
          `No messages containing user profiles to enrich from Google Analytics. Skipping further processing.`,
        );
        return Promise.resolve(true);
      }

      const mappingUtil = this.diContainer.resolve<MappingUtil>("mappingUtil");
      const redisClient = this.diContainer.resolve<ConnectorRedisClient>(
        "redisClient",
      );

      const envelopesNotProcessable: OutgoingOperationEnvelope<
        IHullUserUpdateMessage,
        GoogleAnalyticsUserActivityRequestData
      >[] = [];

      const envelopesToEnrich: OutgoingOperationEnvelope<
        IHullUserUpdateMessage,
        GoogleAnalyticsUserActivityRequestData
      >[] = [];

      await asyncForEach(
        envelopesFiltered.enrichs,
        async (
          envelope: OutgoingOperationEnvelope<
            IHullUserUpdateMessage,
            GoogleAnalyticsUserActivityRequestData
          >,
        ) => {
          const serviceData = mappingUtil.mapHullUserToGoogleAnalyticsAcitivityRequestData(
            envelope.message.user,
          );
          const lastUserActivitySearch = await redisClient.get<string>(
            `${this.hullConnector.id}__${envelope.message.user.id}__uas`,
          );

          let isSkippedRecentSearch = false;
          if (lastUserActivitySearch && isBatch === false) {
            if (
              DateTime.fromISO(lastUserActivitySearch) >=
              DateTime.utc().minus({ minutes: 30 })
            ) {
              envelopesNotProcessable.push({
                ...envelope,
                operation: "skip",
                notes: [VALIDATION_SKIP_HULLUSER_RECENTUAS],
              });
              isSkippedRecentSearch = true;
            }
          }
          if (serviceData && !isSkippedRecentSearch) {
            envelopesToEnrich.push({
              ...envelope,
              serviceObject: serviceData,
            });
          } else if (!isSkippedRecentSearch) {
            envelopesNotProcessable.push({
              ...envelope,
              operation: "skip",
              notes: [VALIDATION_SKIP_HULLUSER_NOCLIENTIDS],
            });
          }
        },
      );

      envelopesNotProcessable.forEach((envelope) => {
        this.hullClient
          .asUser(envelope.message.user)
          .logger.info(
            `outgoing.${envelope.objectType}.${envelope.operation}`,
            {
              details: envelope.notes,
            },
          );
      });

      if (envelopesToEnrich.length === 0) {
        logger.debug(
          `No messages containing any client identifiers to enrich from Google Analytics or all users have been enriched within the past 30 minutes. Skipping further processing.`,
        );
        return Promise.resolve(true);
      }

      const serviceClient = this.diContainer.resolve<ServiceClient>(
        "serviceClient",
      );

      await asyncForEach(
        envelopesToEnrich,
        async (
          envelope: OutgoingOperationEnvelope<
            IHullUserUpdateMessage,
            GoogleAnalyticsUserActivityRequestData
          >,
        ) => {
          if (envelope.serviceObject !== undefined) {
            await asyncForEach(
              envelope.serviceObject.clientIdentifiers,
              async (cid: string) => {
                const result = await serviceClient.fetchGoogleAnalyticsReport(
                  cid,
                  (envelope.serviceObject as GoogleAnalyticsUserActivityRequestData)
                    .startDate,
                  (envelope.serviceObject as GoogleAnalyticsUserActivityRequestData)
                    .endDate,
                );
                if (result.success && result.data) {
                  const mappedEvents = mappingUtil.mapAnalyticsAcitivityResponseDataToHullEvents(
                    result.data,
                  );

                  const eventPromises = _.map(mappedEvents, (me) => {
                    return this.hullClient
                      .asUser(envelope.message.user)
                      .track(me.event, me.properties, me.context);
                  });

                  const ingestionResult = await Promise.all(eventPromises);
                  logger.debug(
                    `Successfully retrieved events for CLIENT_ID '${cid}'.`,
                    { ingestionResult },
                  );
                } else if (result.success === false) {
                  logger.error(
                    `Failed to retrieve user activity for CLIENT_ID '${cid}'`,
                    { error: result.error, details: result.errorDetails },
                  );
                  this.hullClient
                    .asUser(envelope.message.user)
                    .logger.error("outgoing.user.error", {
                      details: result.error,
                    });
                }
              },
            );

            await asyncForEach(
              envelope.serviceObject.userIdentifiers,
              async (cid: string) => {
                const result = await serviceClient.fetchGoogleAnalyticsReport(
                  cid,
                  (envelope.serviceObject as GoogleAnalyticsUserActivityRequestData)
                    .startDate,
                  (envelope.serviceObject as GoogleAnalyticsUserActivityRequestData)
                    .endDate,
                  "USER_ID",
                );
                if (result.success && result.data) {
                  const mappedEvents = mappingUtil.mapAnalyticsAcitivityResponseDataToHullEvents(
                    result.data,
                  );

                  const eventPromises = _.map(mappedEvents, (me) => {
                    return this.hullClient
                      .asUser(envelope.message.user)
                      .track(me.event, me.properties, me.context);
                  });

                  const ingestionResult = await Promise.all(eventPromises);
                  logger.debug(
                    `Successfully retrieved events for USER_ID '${cid}'.`,
                    { ingestionResult },
                  );
                } else if (result.success === false) {
                  logger.error(
                    `Failed to retrieve user activity for USER_ID '${cid}'`,
                    { error: result.error, details: result.errorDetails },
                  );
                  this.hullClient
                    .asUser(envelope.message.user)
                    .logger.error("outgoing.user.error", {
                      details: result.error,
                    });
                }
              },
            );

            // Store in REDIS the last time the user was queried
            await redisClient.set(
              `${this.hullConnector.id}__${envelope.message.user.id}__uas`,
              DateTime.utc().toISO(),
              30 * 60,
            );
          }
        },
      );
    } catch (error) {
      logger.error("Failed to process user", { error });
    }

    return Promise.resolve(true);
  }

  public async processUserExplorerExportFiles(): Promise<unknown> {
    const logger = this.diContainer.resolve<Logger>("logger");
    if (this.privateSettings.enable_inboundparse !== true) {
      logger.debug(
        `Connector with id '${this.hullConnector.id}' doesn't have inbound parsing enabled. Skipping processing.`,
      );
      return Promise.resolve(false);
    }

    const redisClient = this.diContainer.resolve<ConnectorRedisClient>(
      "redisClient",
    );
    const fileInfos = await redisClient.get<
      GoogleAnalyticsInboundParseFileInfo[]
    >(`${this.hullConnector.id}__inboundparse_files`);

    if (_.isNil(fileInfos)) {
      logger.debug(
        `Connector with id '${this.hullConnector.id}' doesn't have any pending jobs stored in Redis. Skipping processing.`,
      );
      return Promise.resolve(true);
    }

    const serviceClient = this.diContainer.resolve<ServiceClient>(
      "serviceClient",
    );
    const mappingUtil = this.diContainer.resolve<MappingUtil>("mappingUtil");

    let hasErrors = false;

    try {
      await asyncForEach(
        fileInfos,
        async (fileInfo: GoogleAnalyticsInboundParseFileInfo) => {
          const fileExists = await pathExistsAsync(fileInfo.path);
          if (fileExists === true && fileInfo.type === "text/csv") {
            let csvContent = await readStringFromDisk(fileInfo.path);
            csvContent = csvContent
              .replace(/^#.*\n?/gm, "")
              .replace(/^\s*[\r\n]/gm, "");

            const rawData = await csv().fromString(csvContent);

            await asyncForEach(rawData, async (raw: any) => {
              logger.debug("Raw line", raw);
              let clientId = _.get(raw, "Client Id", undefined);
              let clientIdArtificial: string | undefined = undefined;
              if (clientId && !_.startsWith(clientId, "GA")) {
                clientIdArtificial = `GA1.2.${clientId}`;
              }

              if (clientId) {
                const now = DateTime.utc();
                const result = await serviceClient.fetchGoogleAnalyticsReport(
                  clientId,
                  now.minus({ days: 2 }),
                  now,
                  "CLIENT_ID",
                );
                if (result.success && result.data) {
                  const mappedEvents = mappingUtil.mapAnalyticsAcitivityResponseDataToHullEvents(
                    result.data,
                  );

                  const eventPromises = _.map(mappedEvents, (me) => {
                    return this.hullClient
                      .asUser({ anonymous_id: `ga:${clientId}` })
                      .track(me.event, me.properties, me.context);
                  });

                  const ingestionResult = await Promise.all(eventPromises);
                  logger.debug(
                    `Successfully retrieved events for CLIENT_ID '${clientId}'.`,
                    { ingestionResult },
                  );
                } else if (result.success === false) {
                  hasErrors = true;
                  logger.error(
                    `Failed to retrieve user activity for CLIENT_ID '${clientId}'`,
                    { error: result.error, details: result.errorDetails },
                  );
                  this.hullClient
                    .asUser({ anonymous_id: `ga:${clientId}` })
                    .logger.error("incoming.user.error", {
                      details: result.error,
                    });
                }
              } else {
                logger.debug(`Couldn't find 'Client Id' in CSV data`, {
                  rawData: raw,
                });
              }
            });
          } else if (fileExists === true) {
            logger.debug(
              `File ${fileInfo.path} is not a CSV file but of type '${fileInfo.type}'. Skipping processing.`,
            );
          } else {
            logger.debug(
              `File '${fileInfo.path}' doesn't exist, skipping processing.`,
            );
          }
        },
      );
    } catch (error) {
      hasErrors = true;
      logger.error("Failed to process files", { details: error });
    }

    if (hasErrors) {
      return Promise.resolve(false);
    }

    const delResult = await redisClient.delete(
      `${this.hullConnector.id}__inboundparse_files`,
    );
    logger.debug(
      `Removed pending jobs from Redis with result: ${delResult} deleted`,
    );

    try {
      await asyncForEach(
        fileInfos,
        async (fileInfo: GoogleAnalyticsInboundParseFileInfo) => {
          logger.debug(
            `Attempting to remove file '${fileInfo.path}' from disk...`,
          );
          await deleteFileFromDisk(fileInfo.path);
          logger.debug(
            `Successfully removed file '${fileInfo.path}' from disk.`,
          );
        },
      );

      logger.debug(`Successfully cleanded up files for connector.`);
    } catch (error) {
      logger.error(
        `Failed to clean up files from disk for connector with id '${this.hullConnector.id}'.`,
        { details: error },
      );
    }

    return Promise.resolve(true);
  }

  /**
   * Determines the overall status of the connector.
   *
   * @returns {Promise<ConnectorStatusResponse>} The status response.
   * @memberof SyncAgent
   */
  public async determineConnectorStatus(): Promise<ConnectorStatusResponse> {
    const statusResult: ConnectorStatusResponse = {
      status: "ok",
      messages: [],
    };

    const logger = this.diContainer.resolve<Logger>("logger");
    if (this.privateSettings.webproperty_id) {
      try {
        await this.ensureKeyFile();

        if (this.privateSettings.enable_inboundparse === true) {
          const redisClient = this.diContainer.resolve<ConnectorRedisClient>(
            "redisClient",
          );
          const connectorConfig = (this.hullClient as any).configuration();
          // Ensure we have the necessary stuff in Redis
          const redisResult = await redisClient.set(
            `${this.hullConnector.id}__inboundparse`,
            {
              id: connectorConfig.id,
              secret: connectorConfig.secret,
              organization: connectorConfig.organization,
            },
            60 * 35,
          );
          logger.debug(
            `Stored inbound parse config for connector with id '${this.hullConnector.id}': ${redisResult}`,
          );
        }
      } catch (error) {
        logger.error("Failed to ensure status being propagated", { error });
      }
    }

    return Promise.resolve(statusResult);
  }

  private async ensureKeyFile(): Promise<boolean> {
    if (
      _.isNil(this.privateSettings.json_key) ||
      this.privateSettings.json_key.length === 0
    ) {
      return Promise.resolve(false);
    }

    const workingDirPath = "./temp";

    let directoryExists = false;
    try {
      directoryExists = await isDirAsync(workingDirPath);
    } catch (error) {
      directoryExists = false;
      // TODO: Log it as warning
    }
    if (!directoryExists) {
      await mkDirAsync(workingDirPath);
    }

    const connectorFilePath = `./temp/${this.hullConnector.id}.auth.json`;

    const persistenceResult = await saveFileToDisk(
      connectorFilePath,
      this.privateSettings.json_key,
    );

    return persistenceResult;
  }
}
