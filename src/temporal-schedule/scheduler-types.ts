import type { Rational } from "../model/rational.js";
import type { TemporalScheduleSourceResult } from "./source-types.js";

export interface TemporalScheduleSchedulerCapability {
  readonly id: "perttool.target-grammar-8-calendar-scheduler";
  readonly version: 1;
}

export type SchedulerTaskStatus = "planned" | "active" | "blocked" | "done";

export interface SchedulerRequirement {
  readonly resourceId: string;
  readonly units: number;
}

export interface SchedulerResourceInput {
  readonly id: string;
  readonly capacity: number;
}

export interface SchedulerTaskInput {
  readonly kind: "task";
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly status: SchedulerTaskStatus;
  readonly expectedWorkSeconds: Rational;
  readonly remainingWorkSeconds?: Rational;
  readonly priority: number;
  readonly totalFloat: Rational;
  readonly requirements: readonly SchedulerRequirement[];
}

export interface SchedulerGateInput {
  readonly kind: "gate";
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

export type SchedulerEdgeInput = SchedulerTaskInput | SchedulerGateInput;

export interface CalendarSchedulerInput {
  readonly documentId: string;
  readonly asOf: Rational;
  readonly horizonEnd: Rational;
  readonly finishMilestoneId: string;
  readonly frontierMilestoneIds: readonly string[];
  readonly milestoneIds: readonly string[];
  readonly resources: readonly SchedulerResourceInput[];
  readonly edges: readonly SchedulerEdgeInput[];
  readonly capacityOverrides?: ReadonlyMap<string, number>;
}

export interface WorkSegment {
  readonly start: Rational;
  readonly end: Rational;
}

export interface ScheduledTask {
  readonly id: string;
  readonly status: SchedulerTaskStatus;
  readonly expectedWorkSeconds: Rational;
  readonly remainingWorkSeconds: Rational;
  readonly start: Rational;
  readonly finish: Rational;
  readonly segments: readonly WorkSegment[];
  readonly requirements: readonly SchedulerRequirement[];
  readonly resourceWaitSeconds: Rational;
  readonly conditionalBlocked: boolean;
}

export interface ScheduledMilestone {
  readonly id: string;
  readonly reach: Rational;
}

export interface ResourceUtilization {
  readonly resourceId: string;
  readonly allocatedUnitSeconds: Rational;
  readonly availableUnitSeconds: Rational;
  readonly utilization: Rational | null;
}

export type CalendarScheduleCauseCode =
  | "calendar_profile_absent"
  | "zone_range_exceeded"
  | "workday_relationship_missing"
  | "no_feasible_window"
  | "calendar_search_limit"
  | "active_capacity_conflict";

export interface CalendarScheduleCause {
  readonly code: CalendarScheduleCauseCode;
  readonly taskIds: readonly string[];
  readonly resourceIds: readonly string[];
  readonly limit: number | null;
}

export interface CalendarScheduleProfile {
  readonly state: "available" | "unavailable" | "not_applicable";
  readonly algorithm: Readonly<{
    id: "perttool.temporal-precedence-earliest" | "perttool.temporal-parallel-sgs";
    version: 2;
    optimal: false | null;
  }>;
  readonly makespanSeconds: Rational | null;
  readonly tasks: readonly ScheduledTask[];
  readonly milestones: readonly ScheduledMilestone[];
  readonly utilization: readonly ResourceUtilization[];
  readonly unavailableCauses: readonly CalendarScheduleCause[];
}

export interface CalendarSchedulerResult {
  readonly modelVersion: 1;
  readonly documentId: string;
  readonly source: TemporalScheduleSourceResult;
  readonly precedence: CalendarScheduleProfile;
  readonly resource: CalendarScheduleProfile;
}

export interface WorkingTimeResult {
  readonly state: "available" | "unavailable";
  readonly value: Rational | null;
  readonly segments: readonly WorkSegment[];
  readonly unavailableCauses: readonly CalendarScheduleCause[];
}

export interface CalendarVelocityInput {
  readonly points: Rational;
  readonly period: Rational;
  readonly periodUnit: "hour" | "day";
}

export interface WorkSecondsResult {
  readonly state: "available" | "unavailable";
  readonly seconds: Rational | null;
  readonly unavailableCauses: readonly CalendarScheduleCause[];
}
