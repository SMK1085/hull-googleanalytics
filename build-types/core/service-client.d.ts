import { analyticsreporting_v4 } from "googleapis";
import { PrivateSettings } from "./connector";
import { Logger } from "winston";
import { DateTime } from "luxon";
export declare class ServiceClient {
    readonly privateSettings: PrivateSettings;
    readonly logger: Logger;
    readonly connectorId: string;
    constructor(options: any);
    fetchGoogleAnalyticsReport(userId: string, startDate: DateTime, endDate: DateTime): Promise<analyticsreporting_v4.Schema$SearchUserActivityResponse>;
}
