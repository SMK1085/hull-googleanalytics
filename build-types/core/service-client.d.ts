import { analyticsreporting_v4 } from "googleapis";
import { PrivateSettings } from "./connector";
import { Logger } from "winston";
import { DateTime } from "luxon";
import { GoogleAnalyticsUserIdType, ApiResultObject } from "./service-objects";
export declare class ServiceClient {
    readonly privateSettings: PrivateSettings;
    readonly logger: Logger;
    readonly connectorId: string;
    constructor(options: any);
    fetchGoogleAnalyticsReport(userId: string, startDate: DateTime, endDate: DateTime, userIdType?: GoogleAnalyticsUserIdType): Promise<ApiResultObject<analyticsreporting_v4.Params$Resource$Useractivity$Search, analyticsreporting_v4.Schema$SearchUserActivityResponse | undefined>>;
    listCustomDimensions(accountId: string, webPropertyId: string): Promise<unknown>;
    listProfiles(accountId: string, webPropertyId: string): Promise<unknown>;
}
