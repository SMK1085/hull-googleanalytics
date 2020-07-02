import { GoogleAnalyticsUserActivityRequestData, OutgoingOperationEnvelopesFiltered } from "../core/service-objects";
import { PrivateSettings } from "../core/connector";
import { Logger } from "winston";
import IHullUserUpdateMessage from "../types/user-update-message";
export declare class FilterUtil {
    readonly privateSettings: PrivateSettings;
    readonly logger: Logger;
    constructor(options: any);
    filterUserMessagesInitial(messages: IHullUserUpdateMessage[], isBatch?: boolean): OutgoingOperationEnvelopesFiltered<IHullUserUpdateMessage, GoogleAnalyticsUserActivityRequestData>;
    private static isInAnySegment;
}
