import type { CheckOptions } from "../application/check.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { TextEdit } from "./text-edits.js";

export type TaskMutationStatus = "planned" | "active" | "blocked" | "done";

export type ProjectDurationUnit = "day" | "hour" | "point";

export interface ProjectFieldSet {
  readonly id?: string;
  readonly version?: number;
  readonly title?: string;
  readonly description?: string;
  readonly asOf?: string;
  readonly durationUnit?: ProjectDurationUnit;
  readonly velocity?: string;
  readonly finish?: string;
  readonly criticalEpsilon?: string;
  readonly targetDuration?: string;
}

export type ProjectClearableField =
  | "description"
  | "as_of"
  | "velocity"
  | "critical_epsilon"
  | "target_duration";

export interface SetProjectMutation {
  readonly kind: "project.set";
  readonly set?: ProjectFieldSet;
  readonly clear?: readonly ProjectClearableField[];
}

export type ProjectMutation = SetProjectMutation;

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
  readonly notBefore?: string;
  readonly deadline?: string;
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
  readonly notBefore?: string;
  readonly deadline?: string;
  readonly status?: TaskMutationStatus;
  readonly priority?: number;
  readonly owner?: string;
  readonly blockedReason?: string;
  readonly source?: string;
}

export type TaskClearableField =
  | "description"
  | "not_before"
  | "deadline"
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

export interface GateDefinition {
  readonly reason: string;
}

export interface GateFieldSet {
  readonly reason?: string;
}

export interface AddGateMutation {
  readonly kind: "gate.add";
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly gate: GateDefinition;
}

export interface SetGateMutation {
  readonly kind: "gate.set";
  readonly id: string;
  readonly from?: string;
  readonly to?: string;
  readonly set?: GateFieldSet;
}

export interface RemoveGateMutation {
  readonly kind: "gate.remove";
  readonly id: string;
}

export type GateMutation =
  | AddGateMutation
  | SetGateMutation
  | RemoveGateMutation;

export type MilestoneMutationState = "planned" | "reached";

export interface MilestoneDefinition {
  readonly title: string;
  readonly description?: string;
  readonly state?: MilestoneMutationState;
  readonly deadline?: string;
  readonly tags?: readonly string[];
}

export interface MilestoneFieldSet {
  readonly title?: string;
  readonly description?: string;
  readonly state?: MilestoneMutationState;
  readonly deadline?: string;
}

export type MilestoneClearableField =
  | "description"
  | "state"
  | "deadline"
  | "tags";

export interface AddMilestoneMutation {
  readonly kind: "milestone.add";
  readonly id: string;
  readonly milestone: MilestoneDefinition;
}

export interface SetMilestoneMutation {
  readonly kind: "milestone.set";
  readonly id: string;
  readonly set?: MilestoneFieldSet;
  readonly clear?: readonly MilestoneClearableField[];
  readonly addTags?: readonly string[];
  readonly removeTags?: readonly string[];
}

export interface RemoveMilestoneMutation {
  readonly kind: "milestone.remove";
  readonly id: string;
}

export type MilestoneMutation =
  | AddMilestoneMutation
  | SetMilestoneMutation
  | RemoveMilestoneMutation;

export interface ResourceDefinition {
  readonly title: string;
  readonly capacity: number;
  readonly description?: string;
}

export interface ResourceFieldSet {
  readonly title?: string;
  readonly description?: string;
  readonly capacity?: number;
}

export type ResourceClearableField = "description";

export interface AddResourceMutation {
  readonly kind: "resource.add";
  readonly id: string;
  readonly resource: ResourceDefinition;
}

export interface SetResourceMutation {
  readonly kind: "resource.set";
  readonly id: string;
  readonly set?: ResourceFieldSet;
  readonly clear?: readonly ResourceClearableField[];
}

export interface RemoveResourceMutation {
  readonly kind: "resource.remove";
  readonly id: string;
}

export type ResourceMutation =
  | AddResourceMutation
  | SetResourceMutation
  | RemoveResourceMutation;

export type AtomicMutation =
  | ProjectMutation
  | TaskMutation
  | GateMutation
  | MilestoneMutation
  | ResourceMutation;

export interface BatchMutation {
  readonly kind: "batch";
  readonly mutations: readonly AtomicMutation[];
}

export type Mutation = AtomicMutation | BatchMutation;

export interface MutationOptions extends CheckOptions {
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
}

export interface MutationResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}
