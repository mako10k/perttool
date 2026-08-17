import type { SourceSpan } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import type { RequiredScheduleResult } from "./required-types.js";
import type { CalendarScheduleProfile, CalendarSchedulerInput } from "./scheduler-types.js";
import type { TemporalConstraintProfile } from "./constraint-types.js";
import type { TemporalScheduleSourceResult } from "./source-types.js";

export interface ScheduleAlertCapability {
  readonly id: "perttool.schedule-alert";
  readonly version: 1;
}

export type AlertEvent = "start" | "finish" | "reach";
export type AlertKind = "POSTDUE" | "POSTDUE_FORECAST";
export type AlertTargetKind = "deadline" | "latest";

export interface ScheduleAlertTarget {
  readonly subjectKind: "task" | "milestone";
  readonly subjectId: string;
  readonly event: AlertEvent;
  readonly targetKind: AlertTargetKind;
  readonly temporalKind: "instant" | "date";
  readonly instant: Rational | null;
  readonly sourceText: string;
  readonly sourceRange: SourceSpan;
}

export interface ScheduleAlertEventState {
  readonly subjectKind: "task" | "milestone";
  readonly subjectId: string;
  readonly event: AlertEvent;
  readonly complete: boolean;
  readonly actualInstant: Rational | null;
}

export interface ScheduleAlertInput {
  readonly source: TemporalScheduleSourceResult;
  readonly sourceDigest: string;
  readonly operand: string;
  readonly schedule: CalendarSchedulerInput;
  readonly targets: readonly ScheduleAlertTarget[];
  readonly eventStates: readonly ScheduleAlertEventState[];
  readonly precedenceForward: CalendarScheduleProfile | TemporalConstraintProfile;
  readonly resourceForward: CalendarScheduleProfile;
  readonly requiredSchedule: RequiredScheduleResult;
  readonly driverLevel: "none" | "compact" | "full";
  readonly maxAlerts?: number;
  readonly maxDriverSteps?: number;
}

export interface ScheduleAlertDriverStep {
  readonly kind: "task" | "gate" | "resource_wait";
  readonly id: string;
  readonly sourceMilestoneId: string | null;
  readonly targetMilestoneId: string | null;
}

export interface ScheduleAlertDriver {
  readonly state: "available" | "not_computed" | "unavailable";
  readonly pathId: string | null;
  readonly scope: "project_finish" | "target";
  readonly steps: readonly ScheduleAlertDriverStep[];
  readonly truncated: boolean;
  readonly totalSteps: number | null;
  readonly analysisArgv: readonly string[] | null;
  readonly cause: "driver_not_computed" | "driver_unavailable" | null;
}

export interface ScheduleAlertOccurrence {
  readonly alertId: string;
  readonly kind: AlertKind;
  readonly subject: Readonly<{ kind: "task" | "milestone"; id: string }>;
  readonly event: AlertEvent;
  readonly target: ScheduleAlertTarget;
  readonly comparison: Readonly<{
    snapshotOrProjection: Rational;
    signedDifferenceSeconds: Rational;
    relation: "after";
  }>;
  readonly proof: Readonly<{
    kind: "current_snapshot" | "precedence_infeasible" | "resource_heuristic_late";
    optimal: false | null;
  }>;
  readonly driver: ScheduleAlertDriver;
  readonly sourceDigest: string;
  readonly sourceRange: SourceSpan;
}

export interface ScheduleAlertResult {
  readonly modelVersion: 1;
  readonly documentId: string;
  readonly evaluator: Readonly<{ id: "perttool.schedule-alert"; version: 1; optimal: null }>;
  readonly state: "available" | "unavailable" | "not_applicable";
  readonly summary: Readonly<{ postdue: number; postdueForecast: number; total: number }>;
  readonly occurrences: readonly ScheduleAlertOccurrence[];
  readonly truncation: Readonly<{ truncated: boolean; emitted: number; total: number | null; totalKnown: boolean }>;
  readonly unavailableCauses: readonly Readonly<{ code: string; entityIds: readonly string[] }>[];
}
