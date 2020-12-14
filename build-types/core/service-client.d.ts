import { analyticsreporting_v4, analytics_v3 } from "googleapis";
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
    listCustomDimensions(accountId: string, webPropertyId: string): Promise<ApiResultObject<analytics_v3.Params$Resource$Management$Customdimensions$List, analytics_v3.Schema$CustomDimensions | undefined>>;
    listColumns(): Promise<ApiResultObject<analytics_v3.Params$Resource$Metadata$Columns$List, analytics_v3.Schema$Columns | undefined>>;
    listProfiles(accountId: string, webPropertyId: string): Promise<unknown>;
    runReport(viewId: string, dimensions: analyticsreporting_v4.Schema$Dimension[], dimensionFilterClauses: analyticsreporting_v4.Schema$DimensionFilterClause[] | undefined, metrics: analyticsreporting_v4.Schema$Metric[], dateRange: analyticsreporting_v4.Schema$DateRange, pageToken?: string | null): Promise<ApiResultObject<analyticsreporting_v4.Params$Resource$Reports$Batchget, analyticsreporting_v4.Schema$GetReportsResponse | undefined>>;
}
