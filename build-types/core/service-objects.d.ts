import { DateTime } from "luxon";
import { GaxiosError } from "gaxios";
export declare type OutgoingOperationType = "enrich" | "skip";
export declare type OutgoingOperationObjectType = "user";
export interface OutgoingOperationEnvelope<T, U> {
    message: T;
    serviceObject?: U;
    operation: OutgoingOperationType;
    objectType: OutgoingOperationObjectType;
    notes?: string[];
}
export interface OutgoingOperationEnvelopesFiltered<T, U> {
    enrichs: OutgoingOperationEnvelope<T, U>[];
    skips: OutgoingOperationEnvelope<T, U>[];
}
export interface GoogleAnalyticsUserActivityRequestData {
    clientIdentifiers: string[];
    userIdentifiers: string[];
    startDate: DateTime;
    endDate: DateTime;
}
export declare type GoogleAnalyticsUserIdType = "CLIENT_ID" | "USER_ID";
export declare type ApiMethod = "query";
export interface ApiResultObject<T, U> {
    endpoint: string;
    method: ApiMethod;
    record: T | undefined;
    data: U | undefined;
    success: boolean;
    error?: string | string[];
    errorDetails?: GaxiosError;
}
export interface GoogleAnalyticsInboundParseFileInfo {
    path: string;
    name: string;
    type: string;
}
