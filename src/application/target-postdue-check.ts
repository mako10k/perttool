import type { CheckResultV5 } from "./contract8-milestone-acceptance.js";
import { projectTargetScheduleAlerts, type TargetScheduleAlertProjection } from "./target-postdue-projection.js";
import type { ScheduleAlertResult } from "../temporal-schedule/alert-types.js";

export const TARGET_POSTDUE_CHECK_RESULT = "Perttool.CheckResult.v6" as const;

export type TargetPostdueCheckResultV6 = Omit<CheckResultV5, "schemaVersion"> & {
  readonly schemaVersion: typeof TARGET_POSTDUE_CHECK_RESULT;
  readonly scheduleAlerts: TargetScheduleAlertProjection | null;
};

export function projectTargetPostdueCheck(
  base: CheckResultV5,
  alerts: ScheduleAlertResult | null,
): TargetPostdueCheckResultV6 {
  if (!base.ok && alerts !== null) throw new TypeError("invalid Check cannot carry schedule alerts");
  if (alerts !== null && base.documentId !== alerts.documentId) {
    throw new TypeError("Check and schedule-alert document identities differ");
  }
  if (alerts !== null && alerts.occurrences.some(({ driver }) =>
    driver.state === "available" && driver.steps.length > 64)) {
    throw new TypeError("Check schedule-alert driver exceeds the compact limit");
  }
  return Object.freeze({
    ...base,
    schemaVersion: TARGET_POSTDUE_CHECK_RESULT,
    scheduleAlerts: alerts === null ? null : projectTargetScheduleAlerts(alerts),
  });
}
