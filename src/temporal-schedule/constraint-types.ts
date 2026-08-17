import type { Rational } from "../model/rational.js";
import type { CalendarScheduleCause, CalendarSchedulerInput, ScheduledMilestone, ScheduledTask } from "./scheduler-types.js";
import type { TemporalScheduleSourceResult } from "./source-types.js";

export interface TemporalConstraintCapability {
  readonly id: "perttool.target-grammar-8-temporal-constraints";
  readonly version: 1;
}

export type ConstraintEvent = "start" | "finish" | "reach";

export interface TemporalConstraintViolation {
  readonly entityKind: "task" | "milestone";
  readonly entityId: string;
  readonly event: ConstraintEvent;
  readonly bound: "latest";
  readonly required: Rational;
  readonly projected: Rational;
  readonly signedSlackSeconds: Rational;
}

export interface TemporalConstraintProfile {
  readonly state: "available" | "infeasible" | "unavailable" | "not_applicable";
  readonly algorithm: Readonly<{
    readonly id: "perttool.temporal-precedence-earliest";
    readonly version: 2;
    readonly optimal: null;
  }>;
  readonly tasks: readonly ScheduledTask[];
  readonly milestones: readonly ScheduledMilestone[];
  readonly violations: readonly TemporalConstraintViolation[];
  readonly unavailableCauses: readonly CalendarScheduleCause[];
}

export interface TemporalConstraintResult {
  readonly modelVersion: 1;
  readonly documentId: string;
  readonly source: TemporalScheduleSourceResult;
  readonly input: CalendarSchedulerInput;
  readonly precedence: TemporalConstraintProfile;
}

export interface TemporalConstraintMigrationResult {
  readonly ok: boolean;
  readonly changed: boolean;
  readonly updatedText: string | null;
  readonly migratedTaskIds: readonly string[];
  readonly source: TemporalScheduleSourceResult | null;
}
