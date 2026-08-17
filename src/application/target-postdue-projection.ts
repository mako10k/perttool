import type { ScheduleAlertOccurrence, ScheduleAlertResult } from "../temporal-schedule/alert-types.js";

export interface TargetScheduleAlertProjection {
  readonly evaluator: ScheduleAlertResult["evaluator"];
  readonly state: ScheduleAlertResult["state"];
  readonly summary: ScheduleAlertResult["summary"];
  readonly occurrences: readonly ScheduleAlertOccurrence[];
  readonly truncation: ScheduleAlertResult["truncation"];
  readonly unavailableCauses: ScheduleAlertResult["unavailableCauses"];
}

export function projectTargetScheduleAlerts(alerts: ScheduleAlertResult): TargetScheduleAlertProjection {
  if (alerts.evaluator.id !== "perttool.schedule-alert" || alerts.evaluator.version !== 1) {
    throw new TypeError("unsupported schedule-alert evaluator");
  }
  if (alerts.truncation.emitted !== alerts.occurrences.length || alerts.summary.total < alerts.occurrences.length) {
    throw new TypeError("inconsistent schedule-alert projection");
  }
  return Object.freeze({
    evaluator: alerts.evaluator,
    state: alerts.state,
    summary: alerts.summary,
    occurrences: alerts.occurrences,
    truncation: alerts.truncation,
    unavailableCauses: alerts.unavailableCauses,
  });
}
