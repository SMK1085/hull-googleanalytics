import { google, analyticsreporting_v4 } from "googleapis";
import { PrivateSettings } from "./connector";
import { Logger } from "winston";
import { DateTime } from "luxon";

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
  ): Promise<analyticsreporting_v4.Schema$SearchUserActivityResponse> {
    const auth = new google.auth.GoogleAuth({
      keyFile: `./temp/${this.connectorId}.auth.json`,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    google.options({ auth });

    const result = await google.analyticsreporting("v4").userActivity.search({
      requestBody: {
        viewId: this.privateSettings.view_id,
        user: {
          type: "CLIENT_ID",
          userId,
        },
        dateRange: {
          endDate: endDate.toFormat("yyyy-MM-dd"),
          startDate: startDate.toFormat("yyyy-MM-dd"),
        },
      },
    });

    this.logger.debug("Retrieved data from user activity search", result.data);
    return result.data;
  }
}
