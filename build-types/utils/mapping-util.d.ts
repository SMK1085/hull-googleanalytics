import { PrivateSettings } from "../core/connector";
import { Logger } from "winston";
import { GoogleAnalyticsUserActivityRequestData, GoogleAnalyticsDimensionFilter } from "../core/service-objects";
import IHullUser, { IHullUserClaims } from "../types/user";
import { analyticsreporting_v4 } from "googleapis";
import IHullUserEvent from "../types/user-event";
export declare class MappingUtil {
    readonly privateSettings: PrivateSettings;
    readonly logger: Logger;
    constructor(options: any);
    mapHullUserToGoogleAnalyticsAcitivityRequestData(user: IHullUser): GoogleAnalyticsUserActivityRequestData | undefined;
    mapAnalyticsAcitivityResponseDataToHullEvents(data: analyticsreporting_v4.Schema$SearchUserActivityResponse): IHullUserEvent[];
    static mapDimensionFilterToGoogleAnalytics(dimensionId: string, filter: GoogleAnalyticsDimensionFilter): analyticsreporting_v4.Schema$DimensionFilter;
    mapAnalyticsRowsToHullEvents(timeframe: analyticsreporting_v4.Schema$DateRange, rows: analyticsreporting_v4.Schema$ReportRow[] | undefined): {
        event: IHullUserEvent;
        userIdent: IHullUserClaims;
    }[];
    private handleActivityPageView;
    private handleActivityScreenView;
    private handleActivityGoal;
    private handleActivityEcommerce;
    private handleActivityEvent;
    private extractClientId;
}
