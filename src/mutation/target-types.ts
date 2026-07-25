import type {
  AddMilestoneMutation,
  AddTaskMutation,
  AtomicMutation,
  FinishTaskMutation,
  MilestoneDefinition,
  MilestoneFieldSet,
  MilestoneMutation,
  RemoveMilestoneMutation,
  RemoveTaskMutation,
  SetMilestoneMutation,
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
