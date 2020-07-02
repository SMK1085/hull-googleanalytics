import {
  GoogleAnalyticsUserActivityRequestData,
  OutgoingOperationEnvelopesFiltered,
} from "../core/service-objects";
import { PrivateSettings } from "../core/connector";
import { Logger } from "winston";
import IHullUserUpdateMessage from "../types/user-update-message";
import { intersection, forEach } from "lodash";
import IHullSegment from "../types/hull-segment";
import {
  DATAFLOW_BATCHOP_SKIPFILTER,
  VALIDATION_SKIP_HULLOBJECT_NOTINANYSEGMENT,
} from "../core/messages";

export class FilterUtil {
  readonly privateSettings: PrivateSettings;
  readonly logger: Logger;

  constructor(options: any) {
    this.privateSettings = options.privateSettings;
    this.logger = options.logger;
  }

  public filterUserMessagesInitial(
    messages: IHullUserUpdateMessage[],
    isBatch = false,
  ): OutgoingOperationEnvelopesFiltered<
    IHullUserUpdateMessage,
    GoogleAnalyticsUserActivityRequestData
  > {
    const result: OutgoingOperationEnvelopesFiltered<
      IHullUserUpdateMessage,
      GoogleAnalyticsUserActivityRequestData
    > = {
      enrichs: [],
      skips: [],
    };

    if (isBatch) {
      forEach(messages, (msg: IHullUserUpdateMessage) => {
        result.enrichs.push({
          message: msg,
          objectType: "user",
          operation: "enrich",
          notes: [DATAFLOW_BATCHOP_SKIPFILTER("user")],
        });
      });
    } else {
      forEach(messages, (msg: IHullUserUpdateMessage) => {
        if (
          !FilterUtil.isInAnySegment(
            msg.segments,
            this.privateSettings.user_synchronized_segments,
          )
        ) {
          result.skips.push({
            message: msg,
            objectType: "user",
            operation: "skip",
            notes: [VALIDATION_SKIP_HULLOBJECT_NOTINANYSEGMENT("user")],
          });
        } else {
          result.enrichs.push({
            message: msg,
            objectType: "user",
            operation: "enrich",
          });
        }
      });
    }

    return result;
  }

  private static isInAnySegment(
    actualSegments: IHullSegment[],
    whitelistedSegments: string[],
  ): boolean {
    const actualIds = actualSegments.map((s) => s.id);
    if (
      intersection(actualIds, whitelistedSegments).length === 0 &&
      !whitelistedSegments.includes("ALL")
    ) {
      return false;
    }

    return true;
  }
}
