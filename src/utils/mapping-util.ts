import { PrivateSettings } from "../core/connector";
import { Logger } from "winston";
import { GoogleAnalyticsUserActivityRequestData } from "../core/service-objects";
import IHullUser from "../types/user";
import { DateTime } from "luxon";
import { analyticsreporting_v4 } from "googleapis";
import IHullUserEvent from "../types/user-event";
import {
  forIn,
  isObject,
  set,
  snakeCase,
  sortBy,
  first,
  get,
  isArray,
  isString,
} from "lodash";

export class MappingUtil {
  readonly privateSettings: PrivateSettings;
  readonly logger: Logger;

  constructor(options: any) {
    this.privateSettings = options.privateSettings;
    this.logger = options.logger;
  }

  public mapHullUserToGoogleAnalyticsAcitivityRequestData(
    user: IHullUser,
  ): GoogleAnalyticsUserActivityRequestData | undefined {
    const clientIdRegex = /^GA\d\.\d\.\d*\.\d*/;
    const result: GoogleAnalyticsUserActivityRequestData = {
      clientIdentifiers: [],
      userIdentifiers: [],
      startDate: DateTime.utc().minus({ days: 2 }),
      endDate: DateTime.utc(),
    };
    if (this.privateSettings.lookup_anonymous_ids_enabled) {
      if (user.anonymous_ids) {
        (user.anonymous_ids as string[]).forEach((aid: string) => {
          if (this.privateSettings.lookup_anonymous_ids_prefix) {
            if (
              aid.startsWith(this.privateSettings.lookup_anonymous_ids_prefix)
            ) {
              const aidSanitized = aid.replace(
                this.privateSettings.lookup_anonymous_ids_prefix,
                "",
              );
              if (clientIdRegex.test(aidSanitized)) {
                const clientId = this.extractClientId(aidSanitized);
                if (clientId) {
                  result.clientIdentifiers.push(clientId);
                }
              }
            }
          } else {
            // assume we have a raw identifier
            if (clientIdRegex.test(aid)) {
              const clientId = this.extractClientId(aid);
              if (clientId) {
                result.clientIdentifiers.push(clientId);
              }
            }
          }
        });
      }
    }

    if (this.privateSettings.lookup_attribute) {
      const rawValue = get(
        user,
        this.privateSettings.lookup_attribute,
        undefined,
      );
      if (rawValue !== undefined) {
        if (isArray(rawValue)) {
          rawValue.forEach((r) => {
            if (isString(r)) {
              if (clientIdRegex.test(r)) {
                if (result.clientIdentifiers.includes(r) === false) {
                  result.clientIdentifiers.push(r);
                }
              }
            }
          });
        } else if (isString(rawValue)) {
          if (clientIdRegex.test(rawValue)) {
            if (result.clientIdentifiers.includes(rawValue) === false) {
              result.clientIdentifiers.push(rawValue);
            }
          }
        }
      }
    }

    if (this.privateSettings.lookup_attribute_userid) {
      const rawValue = get(
        user,
        this.privateSettings.lookup_attribute_userid,
        undefined,
      );
      if (rawValue !== undefined) {
        if (isArray(rawValue)) {
          rawValue.forEach((r) => {
            if (isString(r)) {
              result.userIdentifiers.push(r);
            }
          });
        } else if (isString(rawValue)) {
          result.userIdentifiers.push(rawValue);
        }
      }
    }

    if (
      result.clientIdentifiers.length !== 0 ||
      result.userIdentifiers.length !== 0
    ) {
      return result;
    }

    return undefined;
  }

  public mapAnalyticsAcitivityResponseDataToHullEvents(
    data: analyticsreporting_v4.Schema$SearchUserActivityResponse,
  ): IHullUserEvent[] {
    const result: IHullUserEvent[] = [];

    if (data.sessions) {
      data.sessions.forEach((session) => {
        const sessionEvent: IHullUserEvent = {
          event: "Session started",
          context: {
            event_id: `ga-${this.privateSettings.view_id}-${session.sessionId}`,
            source: "google-analytics",
            _sid: session.sessionId,
            type: "session",
            created_at: DateTime.fromFormat(
              session.sessionDate as string,
              "yyyy-MM-dd",
            ).toISO(),
          },
          properties: {
            device_category: session.deviceCategory,
            platform: session.platform,
            session_id: session.sessionId,
            data_source: session.dataSource,
            num_activities: session.activities ? session.activities.length : 0,
          },
          created_at: DateTime.fromFormat(
            session.sessionDate as string,
            "yyyy-MM-dd",
          ).toISO(),
          session_id: session.sessionId as string,
        };

        if (session.activities) {
          const firstActivity = first(
            sortBy(session.activities, ["activityTime"]),
          );
          sessionEvent.created_at = DateTime.fromISO(
            firstActivity?.activityTime as string,
          ).toISO();
          sessionEvent.context.created_at = DateTime.fromISO(
            firstActivity?.activityTime as string,
          ).toISO();
        }

        result.push(sessionEvent);

        if (session.activities) {
          session.activities.forEach((activity) => {
            let activityEvent: IHullUserEvent | undefined = undefined;
            switch (activity.activityType) {
              case "PAGEVIEW":
                activityEvent = this.handleActivityPageView(activity, session);
                break;
              case "SCREENVIEW":
                activityEvent = this.handleActivityScreenView(
                  activity,
                  session,
                );
                break;
              case "GOAL":
                activityEvent = this.handleActivityGoal(activity, session);
                break;
              case "ECOMMERCE":
                activityEvent = this.handleActivityEcommerce(activity, session);
                break;
              default:
                activityEvent = this.handleActivityEvent(activity, session);
                break;
            }

            if (activityEvent) {
              result.push(activityEvent);
            }
          });
        }
      });
    }

    return result;
  }

  private handleActivityPageView(
    activity: analyticsreporting_v4.Schema$Activity,
    session: analyticsreporting_v4.Schema$UserActivitySession,
  ): IHullUserEvent {
    const activityEvent: IHullUserEvent = {
      event: "page",
      context: {
        event_id: `ga-${this.privateSettings.view_id}-${session.sessionId}-${activity.activityTime}`,
        source: "google-analytics",
        _sid: session.sessionId,
        type: "page",
        created_at: DateTime.fromISO(activity.activityTime as string).toISO(),
      },
      properties: {
        url: `https://${activity.hostname}${
          (activity.pageview as any).pagePath as string
        }`,
        title: (activity.pageview as any).pageTitle as string,
        session_id: session.sessionId,
      },
      created_at: DateTime.fromISO(activity.activityTime as string).toISO(),
      session_id: session.sessionId as string,
    };

    forIn(activity, (v, k) => {
      if (isObject(v)) {
        forIn(v, (v2, k2) => {
          if (isObject(v2)) {
            set(
              activityEvent,
              `properties.${snakeCase(k)}__${snakeCase(k2)}`,
              JSON.stringify(v2),
            );
          } else {
            set(
              activityEvent,
              `properties.${snakeCase(k)}__${snakeCase(k2)}`,
              v2,
            );
          }
        });
      } else {
        set(activityEvent, `properties.${snakeCase(k)}`, v);
      }
    });

    return activityEvent;
  }

  private handleActivityScreenView(
    activity: analyticsreporting_v4.Schema$Activity,
    session: analyticsreporting_v4.Schema$UserActivitySession,
  ): IHullUserEvent {
    const activityEvent: IHullUserEvent = {
      event: "Screen viewed",
      context: {
        event_id: `ga-${this.privateSettings.view_id}-${session.sessionId}-${activity.activityTime}`,
        source: "google-analytics",
        _sid: session.sessionId,
        type: "screen",
        created_at: DateTime.fromISO(activity.activityTime as string).toISO(),
      },
      properties: {
        session_id: session.sessionId,
      },
      created_at: DateTime.fromISO(activity.activityTime as string).toISO(),
      session_id: session.sessionId as string,
    };

    forIn(activity, (v, k) => {
      if (isObject(v)) {
        forIn(v, (v2, k2) => {
          if (isObject(v2)) {
            set(
              activityEvent,
              `properties.${snakeCase(k)}__${snakeCase(k2)}`,
              JSON.stringify(v2),
            );
          } else {
            set(
              activityEvent,
              `properties.${snakeCase(k)}__${snakeCase(k2)}`,
              v2,
            );
          }
        });
      } else {
        set(activityEvent, `properties.${snakeCase(k)}`, v);
      }
    });

    return activityEvent;
  }

  private handleActivityGoal(
    activity: analyticsreporting_v4.Schema$Activity,
    session: analyticsreporting_v4.Schema$UserActivitySession,
  ): IHullUserEvent {
    const activityEvent: IHullUserEvent = {
      event: "Google Analytics Goal tracked",
      context: {
        event_id: `ga-${this.privateSettings.view_id}-${session.sessionId}-${activity.activityTime}`,
        source: "google-analytics",
        _sid: session.sessionId,
        type: "goal",
        created_at: DateTime.fromISO(activity.activityTime as string).toISO(),
      },
      properties: {
        session_id: session.sessionId,
      },
      created_at: DateTime.fromISO(activity.activityTime as string).toISO(),
      session_id: session.sessionId as string,
    };

    forIn(activity, (v, k) => {
      if (isObject(v)) {
        forIn(v, (v2, k2) => {
          if (isObject(v2)) {
            set(
              activityEvent,
              `properties.${snakeCase(k)}__${snakeCase(k2)}`,
              JSON.stringify(v2),
            );
          } else {
            set(
              activityEvent,
              `properties.${snakeCase(k)}__${snakeCase(k2)}`,
              v2,
            );
          }
        });
      } else {
        set(activityEvent, `properties.${snakeCase(k)}`, v);
      }
    });

    return activityEvent;
  }

  private handleActivityEcommerce(
    activity: analyticsreporting_v4.Schema$Activity,
    session: analyticsreporting_v4.Schema$UserActivitySession,
  ): IHullUserEvent {
    const activityEvent: IHullUserEvent = {
      event: "E-Commerce Transaction performed",
      context: {
        event_id: `ga-${this.privateSettings.view_id}-${session.sessionId}-${activity.activityTime}`,
        source: "google-analytics",
        _sid: session.sessionId,
        type: "ecommerce",
        created_at: DateTime.fromISO(activity.activityTime as string).toISO(),
      },
      properties: {
        session_id: session.sessionId,
      },
      created_at: DateTime.fromISO(activity.activityTime as string).toISO(),
      session_id: session.sessionId as string,
    };

    forIn(activity, (v, k) => {
      if (isObject(v)) {
        forIn(v, (v2, k2) => {
          if (isObject(v2)) {
            set(
              activityEvent,
              `properties.${snakeCase(k)}__${snakeCase(k2)}`,
              JSON.stringify(v2),
            );
          } else {
            set(
              activityEvent,
              `properties.${snakeCase(k)}__${snakeCase(k2)}`,
              v2,
            );
          }
        });
      } else {
        set(activityEvent, `properties.${snakeCase(k)}`, v);
      }
    });

    return activityEvent;
  }

  private handleActivityEvent(
    activity: analyticsreporting_v4.Schema$Activity,
    session: analyticsreporting_v4.Schema$UserActivitySession,
  ): IHullUserEvent {
    const activityEvent: IHullUserEvent = {
      event: "Google Analytics Event tracked",
      context: {
        event_id: `ga-${this.privateSettings.view_id}-${session.sessionId}-${activity.activityTime}`,
        source: "google-analytics",
        _sid: session.sessionId,
        type: "event",
        created_at: DateTime.fromISO(activity.activityTime as string).toISO(),
      },
      properties: {
        session_id: session.sessionId,
      },
      created_at: DateTime.fromISO(activity.activityTime as string).toISO(),
      session_id: session.sessionId as string,
    };

    forIn(activity, (v, k) => {
      if (isObject(v)) {
        forIn(v, (v2, k2) => {
          if (isObject(v2)) {
            set(
              activityEvent,
              `properties.${snakeCase(k)}__${snakeCase(k2)}`,
              JSON.stringify(v2),
            );
          } else {
            set(
              activityEvent,
              `properties.${snakeCase(k)}__${snakeCase(k2)}`,
              v2,
            );
          }
        });
      } else {
        set(activityEvent, `properties.${snakeCase(k)}`, v);
      }
    });

    return activityEvent;
  }

  private extractClientId(gaId: string): string | undefined {
    const splits = gaId.split(".");
    if (splits.length !== 4) {
      return undefined;
    }

    return `${splits[2]}.${splits[3]}`;
  }
}
