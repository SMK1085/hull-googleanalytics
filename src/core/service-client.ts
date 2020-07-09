import { google, analyticsreporting_v4, analytics_v3 } from "googleapis";
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
  ): Promise<
    ApiResultObject<
      analytics_v3.Params$Resource$Management$Customdimensions$List,
      analytics_v3.Schema$CustomDimensions | undefined
    >
  > {
    const url = `https://www.googleapis.com/analytics/v3/management/accounts/${accountId}/webproperties/${webPropertyId}/customDimensionsh`;
    const method: ApiMethod = "query";
    const payload: analytics_v3.Params$Resource$Management$Customdimensions$List = {
      accountId,
      webPropertyId,
    };
    const auth = new google.auth.GoogleAuth({
      keyFile: `./temp/${this.connectorId}.auth.json`,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    google.options({ auth });

    try {
      const response = await google
        .analytics("v3")
        .management.customDimensions.list(payload);

      this.logger.debug("Retrieved data for custom dimensions", response.data);
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

  public async listColumns(): Promise<
    ApiResultObject<
      analytics_v3.Params$Resource$Metadata$Columns$List,
      analytics_v3.Schema$Columns | undefined
    >
  > {
    const url = `https://www.googleapis.com/analytics/v3/metadata/ga/columns`;
    const method: ApiMethod = "query";
    const payload: analytics_v3.Params$Resource$Metadata$Columns$List = {
      reportType: "ga",
    };

    const auth = new google.auth.GoogleAuth({
      keyFile: `./temp/${this.connectorId}.auth.json`,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    google.options({ auth });

    try {
      const response = await google
        .analytics("v3")
        .metadata.columns.list(payload);

      this.logger.debug("Retrieved metadata for columns", response.data);
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

  public async runReport(
    viewId: string,
    dimensions: analyticsreporting_v4.Schema$Dimension[],
    dimensionFilterClauses:
      | analyticsreporting_v4.Schema$DimensionFilterClause[]
      | undefined,
    metrics: analyticsreporting_v4.Schema$Metric[],
    dateRange: analyticsreporting_v4.Schema$DateRange,
    pageToken?: string | null,
  ): Promise<
    ApiResultObject<
      analyticsreporting_v4.Params$Resource$Reports$Batchget,
      analyticsreporting_v4.Schema$GetReportsResponse | undefined
    >
  > {
    const url = `https://analyticsreporting.googleapis.com/v4/reports:batchGet`;
    const method: ApiMethod = "query";
    const payload: analyticsreporting_v4.Params$Resource$Reports$Batchget = {
      requestBody: {
        reportRequests: [
          {
            viewId,
            dateRanges: [dateRange],
            dimensions,
            dimensionFilterClauses,
            metrics,
            pageToken,
          },
        ],
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
        .reports.batchGet(payload);

      this.logger.debug("Retrieved reporting data", {
        stats: {
          reports_count: response.data.reports
            ? response.data.reports.length
            : 0,
          query_cost: response.data.queryCost,
          resource_quotas_remaining: response.data.resourceQuotasRemaining,
        },
        reports_stats: response.data.reports
          ? response.data.reports.map((r, i) => {
              return {
                row_count: r.data ? r.data.rowCount : 0,
                data_last_refreshed: r.data
                  ? r.data.dataLastRefreshed
                  : undefined,
              };
            })
          : [],
      });
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
}
