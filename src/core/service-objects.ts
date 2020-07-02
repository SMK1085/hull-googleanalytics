import { DateTime } from "luxon";

export type OutgoingOperationType = "enrich" | "skip";
export type OutgoingOperationObjectType = "user";

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
  startDate: DateTime;
  endDate: DateTime;
}