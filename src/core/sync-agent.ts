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
} from "./service-objects";
import {
  VALIDATION_SKIP_HULLUSER_NOCLIENTIDS,
  VALIDATION_SKIP_HULLUSER_RECENTUAS,
} from "./messages";
import asyncForEach from "../utils/async-foreach";
import path from "path";
import { isDirAsync, mkDirAsync, saveFileToDisk } from "../utils/filesystem";
import { writeFile } from "fs";
import { ConnectorRedisClient } from "../utils/redis-client";
import { DateTime } from "luxon";

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
        console.log(
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
          if (lastUserActivitySearch) {
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
                const mappedEvents = mappingUtil.mapAnalyticsAcitivityResponseDataToHullEvents(
                  result,
                );
                console.log(mappedEvents);

                const eventPromises = _.map(mappedEvents, (me) => {
                  return this.hullClient
                    .asUser(envelope.message.user)
                    .track(me.event, me.properties, me.context);
                });

                const ingestionResult = await Promise.all(eventPromises);
                console.log(ingestionResult);
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
    if (
      this.privateSettings.account_id &&
      this.privateSettings.webproperty_id
    ) {
      try {
        await this.ensureKeyFile();

        const serviceClient = this.diContainer.resolve<ServiceClient>(
          "serviceClient",
        );

        const customDimensions = await serviceClient.listProfiles(
          "34606920",
          "UA-34606920-1",
        );
        logger.debug("Retrieved profiles", customDimensions);
      } catch (error) {
        console.log(error);
        logger.error("Failed to retrieve profiles", { error });
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
