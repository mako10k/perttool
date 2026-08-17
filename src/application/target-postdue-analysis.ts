import type { AnalysisResultV6 } from "./contract8-milestone-acceptance.js";
import { projectTargetScheduleAlerts, type TargetScheduleAlertProjection } from "./target-postdue-projection.js";
import type { ScheduleAlertResult } from "../temporal-schedule/alert-types.js";
import type { RequiredScheduleResult } from "../temporal-schedule/required-types.js";
import type { CalendarSchedulerResult } from "../temporal-schedule/scheduler-types.js";

export const TARGET_POSTDUE_ANALYSIS_RESULT = "Perttool.AnalysisResult.v7" as const;

export interface TargetPostdueScheduleAnalysis {
  readonly precedence: CalendarSchedulerResult["precedence"];
  readonly resource: CalendarSchedulerResult["resource"];
  readonly required: RequiredScheduleResult;
}

export type TargetPostdueAnalysisResultV7 = Omit<AnalysisResultV6, "schemaVersion"> & {
  readonly schemaVersion: typeof TARGET_POSTDUE_ANALYSIS_RESULT;
  readonly temporalSchedule: TargetPostdueScheduleAnalysis | null;
  readonly scheduleAlerts: TargetScheduleAlertProjection | null;
};

export function projectTargetPostdueAnalysis(
  base: AnalysisResultV6,
  scheduler: CalendarSchedulerResult | null,
  required: RequiredScheduleResult | null,
  alerts: ScheduleAlertResult | null,
): TargetPostdueAnalysisResultV7 {
  const identities = [scheduler?.documentId, required?.documentId, alerts?.documentId]
    .filter((value): value is string => value !== undefined);
  if (identities.some((value) => value !== base.documentId)) {
    throw new TypeError("Analysis and temporal schedule document identities differ");
  }
  if ((scheduler === null) !== (required === null) || (required === null) !== (alerts === null)) {
    throw new TypeError("Analysis temporal schedule inputs must be complete");
  }
  if (alerts !== null && alerts.occurrences.some(({ driver }) => driver.state === "not_computed")) {
    throw new TypeError("Analysis requires computed or unavailable full driver evidence");
  }
  return Object.freeze({
    ...base,
    schemaVersion: TARGET_POSTDUE_ANALYSIS_RESULT,
    temporalSchedule: scheduler === null || required === null ? null : Object.freeze({
      precedence: scheduler.precedence,
      resource: scheduler.resource,
      required,
    }),
    scheduleAlerts: alerts === null ? null : projectTargetScheduleAlerts(alerts),
  });
}
