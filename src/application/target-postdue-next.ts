import type { NextResultV7 } from "./contract8-milestone-acceptance.js";
import { projectTargetScheduleAlerts, type TargetScheduleAlertProjection } from "./target-postdue-projection.js";
import type { ScheduleAlertResult } from "../temporal-schedule/alert-types.js";

export const TARGET_POSTDUE_NEXT_RESULT = "Perttool.NextResult.v8" as const;

export type TargetPostdueNextResultV8 = Omit<NextResultV7, "schemaVersion"> & {
  readonly schemaVersion: typeof TARGET_POSTDUE_NEXT_RESULT;
  readonly scheduleAlerts: TargetScheduleAlertProjection | null;
};

export function projectTargetPostdueNext(
  base: NextResultV7,
  alerts: ScheduleAlertResult | null,
): TargetPostdueNextResultV8 {
  if (alerts !== null && base.documentId !== alerts.documentId) {
    throw new TypeError("Next and schedule-alert document identities differ");
  }
  return Object.freeze({
    ...base,
    schemaVersion: TARGET_POSTDUE_NEXT_RESULT,
    scheduleAlerts: alerts === null ? null : projectTargetScheduleAlerts(alerts),
  });
}
