// R: Validate a dispatch snapshot and project its exact selection and tied boundary budgets.
import { compareStableStrings } from "../model/diagnostics.js";
import { solveMaximumCount } from "./maximum-count-search.js";
import type {
  DispatchActiveTask,
  DispatchBoundaryGroup,
  DispatchCandidate,
  DispatchResourceBudget,
  MaximumCountInput,
  MaximumCountSelection,
} from "./maximum-count-types.js";

function integer(value: number, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error("dispatch units and rank groups must be nonnegative safe integers");
  }
}

function freezeTask<T extends DispatchActiveTask>(task: T): T {
  return Object.freeze({
    ...task,
    requirements: Object.freeze(task.requirements.map((item) => Object.freeze({ ...item }))),
  });
}

function validateInput(input: MaximumCountInput): void {
  if (!/^sha256:[0-9a-f]{64}$/u.test(input.sourceDigest)) {
    throw new Error("dispatch requires an exact source digest");
  }
  const capacities = new Set<string>();
  for (const item of input.capacities) {
    integer(item.units, 0);
    if (item.resourceId.length === 0 || capacities.has(item.resourceId)) {
      throw new Error("dispatch resource IDs must be nonempty and unique");
    }
    capacities.add(item.resourceId);
  }
  const ids = new Set<string>();
  for (const task of [...input.activeTasks, ...input.candidates]) {
    if (task.taskId.length === 0 || ids.has(task.taskId)) {
      throw new Error("dispatch active and candidate task IDs must be disjoint and unique");
    }
    ids.add(task.taskId);
    const requirements = new Set<string>();
    for (const item of task.requirements) {
      integer(item.units, 1);
      if (!capacities.has(item.resourceId) || requirements.has(item.resourceId)) {
        throw new Error("dispatch requirements must name distinct known resources");
      }
      requirements.add(item.resourceId);
    }
  }
  for (const candidate of input.candidates) {
    integer(candidate.rankGroup, 0);
    if (!["eligible", "time_withheld", "assurance_withheld"].includes(candidate.eligibility)) {
      throw new Error("dispatch eligibility is unknown");
    }
  }
}

function subtractUsage(tasks: readonly DispatchActiveTask[], resourceId: string, units: number): number {
  let remaining = units;
  for (const task of tasks) {
    const demand = task.requirements.find((item) => item.resourceId === resourceId)?.units ?? 0;
    if (demand > remaining) throw new Error("dispatch allocation exceeds resource capacity");
    remaining -= demand;
  }
  return remaining;
}

function budgets(
  input: MaximumCountInput,
  selected: readonly DispatchCandidate[],
  group?: number,
): readonly DispatchResourceBudget[] {
  return Object.freeze([...input.capacities]
    .sort((a, b) => compareStableStrings(a.resourceId, b.resourceId))
    .map(({ resourceId, units }): DispatchResourceBudget => {
      const afterActive = subtractUsage(input.activeTasks, resourceId, units);
      const outside = group === undefined ? [] : selected.filter((task) => task.rankGroup !== group);
      const inside = group === undefined ? selected : selected.filter((task) => task.rankGroup === group);
      const allocatable = subtractUsage(outside, resourceId, afterActive);
      const remaining = subtractUsage(inside, resourceId, allocatable);
      return Object.freeze({
        resourceId, capacity: units, activeUsage: units - afterActive,
        outsideGroupUsage: afterActive - allocatable, allocatableUnits: allocatable,
        selectedUsage: allocatable - remaining, remainingUnits: remaining,
      });
    }));
}

function boundaryGroups(
  input: MaximumCountInput,
  eligible: readonly DispatchCandidate[],
  selected: readonly DispatchCandidate[],
): readonly DispatchBoundaryGroup[] {
  const selectedIds = new Set(selected.map((task) => task.taskId));
  const groups = new Map<number, DispatchCandidate[]>();
  for (const candidate of eligible) {
    const members = groups.get(candidate.rankGroup) ?? [];
    members.push(candidate);
    groups.set(candidate.rankGroup, members);
  }
  return Object.freeze([...groups].sort(([a], [b]) => a - b).flatMap(([rankGroup, members]) => {
    const alternatives = members.filter((task) => !selectedIds.has(task.taskId));
    if (members.length < 2 || alternatives.length === 0) return [];
    return [Object.freeze({
      rankGroup,
      candidates: Object.freeze(members.map((task) => freezeTask({
        taskId: task.taskId, requirements: task.requirements,
      }))),
      selectedTaskIds: Object.freeze(members.filter((task) => selectedIds.has(task.taskId)).map((task) => task.taskId)),
      unselectedTaskIds: Object.freeze(alternatives.map((task) => task.taskId)),
      resources: budgets(input, selected, rankGroup),
    })];
  }));
}

/** Internal producer contract: candidates must already be classified as ready;
 * source-bound temporal and assurance producers supply eligibility. This pure
 * function neither grants user permission nor reads, writes or migrates plans.
 */
export function selectMaximumCountTasks(input: MaximumCountInput): MaximumCountSelection {
  validateInput(input);
  const candidates = input.candidates.map(freezeTask).sort((a, b) =>
    a.rankGroup - b.rankGroup || compareStableStrings(a.taskId, b.taskId));
  const eligible = candidates.filter((task) => task.eligibility === "eligible");
  const resources = [...input.capacities].sort((a, b) => compareStableStrings(a.resourceId, b.resourceId));
  const selected = solveMaximumCount(eligible, resources.map((item) => item.resourceId),
    resources.map((item) => subtractUsage(input.activeTasks, item.resourceId, item.units)));
  const ids = new Set(selected.map((task) => task.taskId));
  return Object.freeze({
    modelVersion: 1,
    algorithm: Object.freeze({ id: "perttool.dispatch.maximum-count", version: 1, optimalTaskCount: true }),
    sourceDigest: input.sourceDigest,
    selectedTaskIds: Object.freeze(selected.map((task) => task.taskId)),
    maximumTaskCount: selected.length,
    excludedTasks: Object.freeze(candidates.filter((task) => !ids.has(task.taskId)).map((task) => Object.freeze({
      taskId: task.taskId,
      reason: task.eligibility === "eligible" ? "resource_contention" as const : task.eligibility,
    }))),
    resources: budgets(input, selected),
    boundaryGroups: boundaryGroups(input, eligible, selected),
  });
}
