import IHullClient from "../types/hull-client";
import { AwilixContainer } from "awilix";
import { PrivateSettings } from "./connector";
import { ConnectorStatusResponse } from "../types/connector-status";
import IHullUserUpdateMessage from "../types/user-update-message";
export declare class SyncAgent {
    readonly hullClient: IHullClient;
    readonly metricsClient: any;
    readonly hullConnector: any;
    readonly diContainer: AwilixContainer;
    readonly privateSettings: PrivateSettings;
    constructor(client: IHullClient, connector: any, metricsClient: any, container: AwilixContainer);
    /**
     * Processes outgoing notifications for user:update lane.
     *
     * @param {IHullUserUpdateMessage[]} messages The notification messages.
     * @param {boolean} [isBatch=false] `True` if it is a batch; otherwise `false`.
     * @returns {Promise<unknown>} An awaitable Promise.
     * @memberof SyncAgent
     */
    sendUserMessages(messages: IHullUserUpdateMessage[], isBatch?: boolean): Promise<unknown>;
    /**
     * Determines the overall status of the connector.
     *
     * @returns {Promise<ConnectorStatusResponse>} The status response.
     * @memberof SyncAgent
     */
    determineConnectorStatus(): Promise<ConnectorStatusResponse>;
    private ensureKeyFile;
}
