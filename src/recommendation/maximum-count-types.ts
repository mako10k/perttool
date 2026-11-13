// R: Define the immutable input and output contract for exact concurrent-task selection.

export interface DispatchRequirement {
  readonly resourceId: string;
  readonly units: number;
}

export interface DispatchCandidate {
  readonly taskId: string;
  /** Equal values identify semantic ties, independently of task IDs. */
  readonly rankGroup: number;
  readonly requirements: readonly DispatchRequirement[];
  readonly eligibility: "eligible" | "time_withheld" | "assurance_withheld";
}

export interface DispatchActiveTask {
  readonly taskId: string;
  readonly requirements: readonly DispatchRequirement[];
}

export interface MaximumCountInput {
  readonly sourceDigest: string;
  readonly capacities: readonly { readonly resourceId: string; readonly units: number }[];
  readonly activeTasks: readonly DispatchActiveTask[];
  readonly candidates: readonly DispatchCandidate[];
}

export interface DispatchResourceBudget {
  readonly resourceId: string;
  readonly capacity: number;
  readonly activeUsage: number;
  readonly outsideGroupUsage: number;
  readonly allocatableUnits: number;
  readonly selectedUsage: number;
  readonly remainingUnits: number;
}

export interface DispatchBoundaryGroup {
  readonly rankGroup: number;
  readonly candidates: readonly DispatchActiveTask[];
  readonly selectedTaskIds: readonly string[];
  /** Unselected members are not necessarily feasible replacement alternatives. */
  readonly unselectedTaskIds: readonly string[];
  /** Conditional on the returned selection outside this group. */
  readonly resources: readonly DispatchResourceBudget[];
}

export interface MaximumCountSelection {
  readonly modelVersion: 1;
  readonly algorithm: {
    readonly id: "perttool.dispatch.maximum-count";
    readonly version: 1;
    readonly optimalTaskCount: true;
  };
  readonly sourceDigest: string;
  readonly selectedTaskIds: readonly string[];
  readonly maximumTaskCount: number;
  readonly excludedTasks: readonly {
    readonly taskId: string;
    readonly reason: "time_withheld" | "assurance_withheld" | "resource_contention";
  }[];
  readonly resources: readonly DispatchResourceBudget[];
  readonly boundaryGroups: readonly DispatchBoundaryGroup[];
}
