import type { Rational } from "../model/rational.js";
import type { CalendarScheduleProfile, CalendarSchedulerInput, WorkSegment } from "./scheduler-types.js";
import type { TemporalScheduleSourceResult } from "./source-types.js";
import type { TemporalConstraintProfile } from "./constraint-types.js";

export interface RequiredScheduleCapability {
  readonly id: "perttool.required-precedence-backward";
  readonly version: 1;
}

export type RequiredAnchorSource = "latest_bound" | "advisory_deadline" | "coincident";

export interface RequiredAnchor {
  readonly source: RequiredAnchorSource;
  readonly instant: Rational;
}

export interface RequiredScheduleInput {
  readonly schedule: CalendarSchedulerInput;
  readonly horizonStart: Rational;
  readonly finishDeadline: Rational | null;
  readonly precedenceForward: CalendarScheduleProfile | TemporalConstraintProfile;
  readonly resourceForward: CalendarScheduleProfile;
}

export interface RequiredTask {
  readonly id: string;
  readonly requiredStart: Rational;
  readonly requiredFinish: Rational;
  readonly segments: readonly WorkSegment[];
  readonly driverIds: readonly string[];
}

export interface RequiredMilestone {
  readonly id: string;
  readonly requiredReach: Rational;
  readonly driverIds: readonly string[];
}

export interface RequiredEventComparison {
  readonly entityKind: "task" | "milestone";
  readonly entityId: string;
  readonly event: "start" | "finish" | "reach";
  readonly required: Rational;
  readonly projected: Rational;
  readonly signedSlackSeconds: Rational;
}

export interface RequiredForwardComparison {
  readonly state: "available" | "unavailable";
  readonly classification: "feasible" | "precedence_infeasible" | "resource_heuristic_late" | null;
  readonly optimal: false | null;
  readonly events: readonly RequiredEventComparison[];
}

export interface RequiredScheduleCause {
  readonly code: "required_anchor_absent" | "forward_schedule_unavailable" | "calendar_subtraction_unavailable";
  readonly entityIds: readonly string[];
}

export interface RequiredScheduleResult {
  readonly modelVersion: 1;
  readonly documentId: string;
  readonly source: TemporalScheduleSourceResult;
  readonly state: "available" | "absent" | "unavailable" | "not_applicable";
  readonly algorithm: Readonly<{
    readonly id: "perttool.required-precedence-backward";
    readonly version: 1;
    readonly optimal: null;
  }>;
  readonly anchor: RequiredAnchor | null;
  readonly tasks: readonly RequiredTask[];
  readonly milestones: readonly RequiredMilestone[];
  readonly precedenceComparison: RequiredForwardComparison;
  readonly resourceComparison: RequiredForwardComparison;
  readonly unavailableCauses: readonly RequiredScheduleCause[];
}
