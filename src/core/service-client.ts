import { google, analyticsreporting_v4 } from "googleapis";
import { PrivateSettings } from "./connector";
import { Logger } from "winston";
import { DateTime } from "luxon";
import {
  GoogleAnalyticsUserIdType,
  ApiMethod,
  ApiResultObject,
} from "./service-objects";
import { ApiUtil } from "../utils/api-util";
import { GaxiosError } from "gaxios";

export class ServiceClient {
  readonly privateSettings: PrivateSettings;
  readonly logger: Logger;
  readonly connectorId: string;

  constructor(options: any) {
    this.privateSettings = options.privateSettings;
    this.logger = options.logger;
    this.connectorId = options.connectorId;
  }

  public async fetchGoogleAnalyticsReport(
    userId: string,
    startDate: DateTime,
    endDate: DateTime,
    userIdType: GoogleAnalyticsUserIdType = "CLIENT_ID",
  ): Promise<
    ApiResultObject<
      analyticsreporting_v4.Params$Resource$Useractivity$Search,
      analyticsreporting_v4.Schema$SearchUserActivityResponse | undefined
    >
  > {
    const url = `https://analyticsreporting.googleapis.com/v4/userActivity:search`;
    const method: ApiMethod = "query";
    const payload: analyticsreporting_v4.Params$Resource$Useractivity$Search = {
      requestBody: {
        viewId: this.privateSettings.view_id,
        user: {
          type: userIdType,
          userId,
        },
        dateRange: {
          endDate: endDate.toFormat("yyyy-MM-dd"),
          startDate: startDate.toFormat("yyyy-MM-dd"),
        },
      },
    };

    const auth = new google.auth.GoogleAuth({
      keyFile: `./temp/${this.connectorId}.auth.json`,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    google.options({ auth });

    try {
      const response = await google
        .analyticsreporting("v4")
        .userActivity.search(payload);

      this.logger.debug(
        "Retrieved data from user activity search",
        response.data,
      );

      return ApiUtil.handleApiResultSuccess(url, method, payload, response);
    } catch (error) {
      return ApiUtil.handleApiResultError(
        url,
        method,
        payload,
        error as GaxiosError,
      );
    }
  }

  public async listCustomDimensions(
    accountId: string,
    webPropertyId: string,
  ): Promise<unknown> {
    const auth = new google.auth.GoogleAuth({
      keyFile: `./temp/${this.connectorId}.auth.json`,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    google.options({ auth });

    const result = await google
      .analytics("v3")
      .management.customDimensions.list({
        accountId,
        webPropertyId,
      });
    this.logger.debug("Retrieved data for custom dimensions", result.data);
    return result.data;
  }

  public async listProfiles(
    accountId: string,
    webPropertyId: string,
  ): Promise<unknown> {
    const auth = new google.auth.GoogleAuth({
      keyFile: `./temp/${this.connectorId}.auth.json`,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    google.options({ auth });

    const result = await google.analytics("v3").management.profiles.list({
      accountId,
      webPropertyId,
    });

    this.logger.debug("Retrieved data for profiles", result.data);
    return result.data;
  }
}
