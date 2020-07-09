import { Logger } from "winston";
import { ConnectorRedisClient } from "./redis-client";
import { ApiResultObject, CacheScenarioType } from "../core/service-objects";
import { isNil } from "lodash";

export class CachingUtil {
  readonly redisClient: ConnectorRedisClient;
  readonly logger: Logger;

  constructor(options: any) {
    this.redisClient = options.redisClient;
    this.logger = options.logger;
  }

  public async getCachedApiResponse<T, U>(
    cacheKey: string,
    fn: () => Promise<ApiResultObject<T, U>>,
    expiresSecs?: number,
  ): Promise<ApiResultObject<T, U>> {
    this.logger.debug(
      `Reading API result from cache with key '${cacheKey}'...`,
    );
    let result: ApiResultObject<T, U> | undefined;
    try {
      result = await this.redisClient.get<ApiResultObject<T, U>>(cacheKey);
    } catch (error) {
      this.logger.error(
        `Failed to retrieve API result from cache with key '${cacheKey}'.`,
        { error },
      );
    }

    if (isNil(result)) {
      this.logger.debug(
        `Reading API result from cache with key '${cacheKey}' didn't yield a result. Executing API call.`,
      );
      result = await fn();
      if (result.success) {
        this.logger.debug(
          `Storing API result in cache with key '${cacheKey}' with expiration ${expiresSecs} seconds`,
        );

        try {
          const cacheResult = await this.redisClient.set(
            cacheKey,
            result,
            expiresSecs,
          );
          this.logger.debug(
            `Storing API result in cache with key '${cacheKey}' yielded result ${cacheResult}.`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to store API result in cache with key '${cacheKey}'.`,
            { error },
          );
        }
      } else {
        this.logger.error(
          `API call failed. Storing API result in cache with key '${cacheKey}' has been omitted.`,
        );
      }
    } else {
      this.logger.debug(
        `Reading API result from cache with key '${cacheKey}' yielded a result, serving cached data.`,
      );
    }

    return result;
  }

  public static getCacheKey(
    connectorId: string,
    scenario: CacheScenarioType,
    subId?: string,
  ): string {
    if (isNil(subId)) {
      return `${connectorId}__${scenario}`;
    }

    return `${connectorId}__${subId}__${scenario}`;
  }
}
