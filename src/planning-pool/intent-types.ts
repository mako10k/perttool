import type { PlanningReshapeRequest } from "./reshape-types.js";
import type {
  PlanningCarryOverTarget,
  PlanningWindowMutationRequest,
} from "./window-types.js";
import type { PlanningPoolSourceDiagnostic } from "./source-types.js";

export interface PlanningCreateWorkIntent {
  readonly kind: "create_work";
  readonly work_id: string;
  readonly title: string;
  readonly description: string;
  readonly insert_after_work_id: string | null;
}

export interface PlanningUpdateWorkIntent {
  readonly kind: "update_work";
  readonly work_id: string;
  readonly title: string | null;
  readonly description: string | null;
}

export interface PlanningMoveWorkIntent {
  readonly kind: "move_work";
  readonly work_id: string;
  readonly insert_after_work_id: string | null;
}

export interface PlanningSetDependencyIntent {
  readonly kind: "set_dependency";
  readonly dependent_work_id: string;
  readonly prerequisite_work_id: string;
  readonly present: boolean;
}

export interface PlanningArchiveWorkIntent {
  readonly kind: "archive_work";
  readonly work_id: string;
}

export interface PlanningProjectIntent {
  readonly kind: "project";
  readonly event_ids: readonly string[];
  readonly activity_ids: readonly string[];
}

export interface PlanningDeferIntent {
  readonly kind: "defer";
  readonly task_ids: readonly string[];
  readonly milestone_ids: readonly string[];
}

export interface PlanningCreateWindowIntent {
  readonly kind: "create_window";
  readonly window_id: string;
  readonly title: string;
  readonly objective: string;
  readonly start: string | null;
  readonly end: string | null;
  readonly work_ids: readonly string[];
}

export interface PlanningSetWindowMembershipIntent {
  readonly kind: "set_window_membership";
  readonly window_id: string;
  readonly work_id: string;
  readonly selected: boolean;
}

export interface PlanningCloseWindowIntent {
  readonly kind: "close_window";
  readonly window_id: string;
  readonly carry_over_work_ids: readonly string[];
  readonly carry_over_target: PlanningCarryOverTarget | null;
}

export type PlanningIntentAction =
  | PlanningCreateWorkIntent
  | PlanningUpdateWorkIntent
  | PlanningMoveWorkIntent
  | PlanningSetDependencyIntent
  | PlanningArchiveWorkIntent
  | PlanningProjectIntent
  | PlanningDeferIntent
  | PlanningCreateWindowIntent
  | PlanningSetWindowMembershipIntent
  | PlanningCloseWindowIntent;

export interface PlanningIntentRequest {
  readonly request_schema_version: "Perttool.PlanningIntentRequest.v1";
  readonly source_digest: string;
  readonly action: PlanningIntentAction;
}

export interface PlanningIntentCompilationResult {
  readonly ok: boolean;
  readonly normalizedIntent: PlanningIntentRequest | null;
  readonly reshapeRequest: PlanningReshapeRequest | null;
  readonly windowRequest: PlanningWindowMutationRequest | null;
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
}
