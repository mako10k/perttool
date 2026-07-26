import type {
  AddMilestoneMutation,
  AddTaskMutation,
  AtomicMutation,
  FinishTaskMutation,
  MilestoneDefinition,
  MilestoneFieldSet,
  MilestoneMutation,
  ProjectFieldSet,
  ProjectMutation,
  RemoveMilestoneMutation,
  RemoveTaskMutation,
  SetMilestoneMutation,
  SetProjectMutation,
  SetTaskMutation,
  TaskDefinition,
  TaskFieldSet,
  TaskMutation,
} from "./types.js";

export type TargetTaskDefinition = TaskDefinition & {
  readonly notBefore?: string;
  readonly deadline?: string;
};

export type TargetTaskFieldSet = TaskFieldSet & {
  readonly notBefore?: string;
  readonly deadline?: string;
};

export type TargetTaskClearableField =
  | NonNullable<SetTaskMutation["clear"]>[number]
  | "not_before"
  | "deadline";

export interface TargetAddTaskMutation
  extends Omit<AddTaskMutation, "task"> {
  readonly task: TargetTaskDefinition;
}

export interface TargetSetTaskMutation
  extends Omit<SetTaskMutation, "set" | "clear"> {
  readonly set?: TargetTaskFieldSet;
  readonly clear?: readonly TargetTaskClearableField[];
}

export type TargetTaskMutation =
  | TargetAddTaskMutation
  | TargetSetTaskMutation
  | RemoveTaskMutation
  | FinishTaskMutation;

export type TargetMilestoneDefinition = MilestoneDefinition & {
  readonly deadline?: string;
};

export type TargetMilestoneFieldSet = MilestoneFieldSet & {
  readonly deadline?: string;
};

export type TargetMilestoneClearableField =
  | NonNullable<SetMilestoneMutation["clear"]>[number]
  | "deadline";

export interface TargetAddMilestoneMutation
  extends Omit<AddMilestoneMutation, "milestone"> {
  readonly milestone: TargetMilestoneDefinition;
}

export interface TargetSetMilestoneMutation
  extends Omit<SetMilestoneMutation, "set" | "clear"> {
  readonly set?: TargetMilestoneFieldSet;
  readonly clear?: readonly TargetMilestoneClearableField[];
}

export type TargetMilestoneMutation =
  | TargetAddMilestoneMutation
  | TargetSetMilestoneMutation
  | RemoveMilestoneMutation;

type NonTemporalAtomicMutation = Exclude<
  AtomicMutation,
  TaskMutation | MilestoneMutation
>;

export type TargetAtomicMutation =
  | NonTemporalAtomicMutation
  | TargetTaskMutation
  | TargetMilestoneMutation;

export interface TargetBatchMutation {
  readonly kind: "batch";
  readonly mutations: readonly TargetAtomicMutation[];
}

export type TargetMutation = TargetAtomicMutation | TargetBatchMutation;

export interface TargetGovernanceProjectFieldSet extends ProjectFieldSet {
  readonly goalOwner?: string;
  readonly goalDelegates?: readonly string[];
  readonly dagOwner?: string;
  readonly dagDelegates?: readonly string[];
}

export type TargetGovernanceProjectClearableField =
  | NonNullable<SetProjectMutation["clear"]>[number]
  | "goal_owner"
  | "goal_delegates"
  | "dag_owner"
  | "dag_delegates";

export interface TargetGovernanceSetProjectMutation
  extends Omit<SetProjectMutation, "set" | "clear"> {
  readonly set?: TargetGovernanceProjectFieldSet;
  readonly clear?: readonly TargetGovernanceProjectClearableField[];
}

export type TargetGovernanceAtomicMutation =
  | Exclude<TargetAtomicMutation, ProjectMutation>
  | TargetGovernanceSetProjectMutation;

export interface TargetGovernanceBatchMutation {
  readonly kind: "batch";
  readonly mutations: readonly TargetGovernanceAtomicMutation[];
}

export type TargetGovernanceMutation =
  | TargetGovernanceAtomicMutation
  | TargetGovernanceBatchMutation;
