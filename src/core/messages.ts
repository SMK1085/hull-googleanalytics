export const VALIDATION_SKIP_HULLOBJECT_NOTINANYSEGMENT = (
  objectType: "user" | "account",
) => {
  return `Hull ${objectType} won't be synchronized since it is not matching any of the filtered segments.`;
};

export const VALIDATION_SKIP_HULLUSER_NOCLIENTIDS =
  "Hull user doesn't have any Client IDs to search activity report for.";

export const VALIDATION_SKIP_HULLUSER_RECENTUAS =
  "A User Activity Search has been carried out for this Hull user within the past 30 minutes.";

export const DATAFLOW_BATCHOP_SKIPFILTER = (objectType: "user" | "account") => {
  return `Hull ${objectType} synchronized in batch operation. Segment filters not applied.`;
};
