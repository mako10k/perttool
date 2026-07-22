import type { CheckOptions } from "../application/check.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { TextEdit } from "./text-edits.js";

export type TaskMutationStatus = "planned" | "active" | "blocked" | "done";

export interface TaskEstimateInput {
  readonly optimistic: string;
  readonly mostLikely: string;
  readonly pessimistic: string;
}

export interface TaskRequirementInput {
  readonly resourceId: string;
  readonly units: number;
}

interface TaskDefinitionBase {
  readonly title: string;
  readonly description?: string;
  readonly status?: TaskMutationStatus;
  readonly priority?: number;
  readonly requirements?: readonly TaskRequirementInput[];
  readonly owner?: string;
  readonly tags?: readonly string[];
  readonly blockedReason?: string;
  readonly source?: string;
}

export type TaskDefinition = TaskDefinitionBase &
  (
    | { readonly duration: string; readonly estimate?: never }
    | { readonly duration?: never; readonly estimate: TaskEstimateInput }
  );

export interface TaskFieldSet {
  readonly title?: string;
  readonly description?: string;
  readonly duration?: string;
  readonly estimate?: TaskEstimateInput;
  readonly status?: TaskMutationStatus;
  readonly priority?: number;
  readonly owner?: string;
  readonly blockedReason?: string;
  readonly source?: string;
}

export type TaskClearableField =
  | "description"
  | "status"
  | "priority"
  | "owner"
  | "blocked_reason"
  | "source"
  | "tags"
  | "requires";

export interface AddTaskMutation {
  readonly kind: "task.add";
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly task: TaskDefinition;
}

export interface SetTaskMutation {
  readonly kind: "task.set";
  readonly id: string;
  readonly from?: string;
  readonly to?: string;
  readonly set?: TaskFieldSet;
  readonly clear?: readonly TaskClearableField[];
  readonly addTags?: readonly string[];
  readonly removeTags?: readonly string[];
  readonly upsertRequirements?: readonly TaskRequirementInput[];
  readonly removeRequirements?: readonly string[];
}

export interface RemoveTaskMutation {
  readonly kind: "task.remove";
  readonly id: string;
}

export interface FinishTaskMutation {
  readonly kind: "task.finish";
  readonly id: string;
}

export type TaskMutation =
  | AddTaskMutation
  | SetTaskMutation
  | RemoveTaskMutation
  | FinishTaskMutation;

export interface MutationOptions extends CheckOptions {
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
}

export interface MutationResult {
  readonly ok: boolean;
  readonly changed: boolean;
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}
