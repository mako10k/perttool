import type {
  TargetTemporalCause,
  TargetTemporalInputProjection,
} from "../application/target-temporal-input.js";
import { compareStableStrings } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import {
  ZERO,
  add,
  compare,
  maximum,
  subtract,
} from "../model/rational.js";
import type { RequirementValue } from "../model/syntax.js";
import type {
  TargetGrammar3ValidatedDocument,
  TargetGrammar4ValidatedDocument,
} from "../semantic/target-validator.js";
import {
  buildResidualGraph,
  type AnalysisEdge,
  type ResidualGraph,
  type TaskStatus,
} from "./graph.js";
import {
  analyzePrecedence,
  type EdgeTiming,
  type PrecedenceResult,
} from "./precedence.js";

export const TEMPORAL_RESOURCE_PROJECTION_IDENTITY = Object.freeze({
  id: "perttool.temporal-parallel-sgs" as const,
  version: 1 as const,
  optimal: false as const,
});

export interface TemporalResourceCapacity {
  readonly id: string;
  readonly declared: number;
  readonly override: number | null;
  readonly effective: number;
}

export interface TemporalResourceTask {
  readonly id: string;
  readonly status: TaskStatus;
  readonly expected: Rational;
  readonly sourceReached: Rational;
  readonly releaseBound: Rational | null;
  readonly eligibleTime: Rational;
  readonly start: Rational;
  readonly finish: Rational;
  readonly resourceWait: Rational;
  readonly requirements: readonly RequirementValue[];
  readonly conditionalBlocked: boolean;
}

export interface TemporalResourceMilestone {
  readonly id: string;
  readonly reach: Rational;
}

interface TemporalResourceCommon {
  readonly algorithm: typeof TEMPORAL_RESOURCE_PROJECTION_IDENTITY;
  readonly scheduler: {
    readonly id: "parallel-sgs";
    readonly version: 1;
    readonly optimal: false;
  };
  readonly conditionalOnBlocksResolved: boolean;
  readonly blockedTaskIds: readonly string[];
  readonly unavailableCauses: readonly TargetTemporalCause[];
}

export interface AvailableTemporalResourceSchedule
  extends TemporalResourceCommon {
  readonly state: "available";
  readonly capacities: readonly TemporalResourceCapacity[];
  readonly makespan: Rational;
  readonly tasks: readonly TemporalResourceTask[];
  readonly milestones: readonly TemporalResourceMilestone[];
}

export interface UnavailableTemporalResourceSchedule
  extends TemporalResourceCommon {
  readonly state: "unavailable";
  readonly capacities: readonly TemporalResourceCapacity[];
  readonly makespan: null;
  readonly tasks: readonly TemporalResourceTask[];
  readonly milestones: readonly TemporalResourceMilestone[];
}

export type TemporalResourceSchedule =
  | AvailableTemporalResourceSchedule
  | UnavailableTemporalResourceSchedule;

export interface TemporalResourceOptions {
  readonly capacityOverrides?: ReadonlyMap<string, number>;
  readonly maxPaths?: number;
}

interface RunningTask {
  readonly edge: AnalysisEdge;
  readonly start: Rational;
  readonly finish: Rational;
}

function taskOrder(
  left: AnalysisEdge,
  right: AnalysisEdge,
  timingById: ReadonlyMap<string, EdgeTiming>,
): number {
  if (left.priority !== right.priority) return right.priority - left.priority;
  const byFloat = compare(
    timingById.get(left.id)!.totalFloat,
    timingById.get(right.id)!.totalFloat,
  );
  if (byFloat !== 0) return byFloat;
  const byDuration = compare(right.expected, left.expected);
  return byDuration !== 0
    ? byDuration
    : compareStableStrings(left.id, right.id);
}

function effectiveCapacities(
  graph: ResidualGraph,
  overrides: ReadonlyMap<string, number>,
): ReadonlyMap<string, number> {
  for (const [id, capacity] of overrides) {
    if (!graph.resources.has(id)) {
      throw new TypeError(`unknown temporal resource capacity override ${id}`);
    }
    if (!Number.isSafeInteger(capacity) || capacity < 0) {
      throw new TypeError(
        `temporal resource capacity override ${id} must be a nonnegative safe integer`,
      );
    }
  }
  const capacities = new Map(
    [...graph.resources].map(([id, resource]) => [
      id,
      overrides.get(id) ?? resource.capacity,
    ]),
  );
  for (const edge of graph.edges.filter(({ kind }) => kind === "task")) {
    for (const requirement of edge.requirements) {
      if (requirement.units > capacities.get(requirement.resourceId)!) {
        throw new TypeError(
          `temporal resource requirement ${edge.id}/${requirement.resourceId} exceeds capacity`,
        );
      }
    }
  }
  return capacities;
}

function projectionCapacities(
  graph: ResidualGraph,
  capacities: ReadonlyMap<string, number>,
  overrides: ReadonlyMap<string, number>,
): readonly TemporalResourceCapacity[] {
  return Object.freeze(
    [...graph.resources].map(([id, resource]) =>
      Object.freeze({
        id,
        declared: resource.capacity,
        override: overrides.get(id) ?? null,
        effective: capacities.get(id)!,
      }),
    ),
  );
}

function releaseInputs(
  graph: ResidualGraph,
  inputs: TargetTemporalInputProjection,
): {
  readonly bounds: ReadonlyMap<string, Rational>;
  readonly unavailableCauses: readonly TargetTemporalCause[];
} {
  const byId = new Map(inputs.tasks.map((task) => [task.taskId, task]));
  const bounds = new Map<string, Rational>();
  const unavailableCauses: TargetTemporalCause[] = [];
  for (const edge of graph.edges) {
    if (
      edge.kind !== "task" ||
      edge.status === "active" ||
      edge.status === "done"
    ) {
      continue;
    }
    const input = byId.get(edge.id);
    if (input === undefined) {
      throw new Error(`temporal input projection omitted task ${edge.id}`);
    }
    if (input.release.state === "unavailable") {
      unavailableCauses.push(...input.release.unavailableCauses);
      continue;
    }
    if (input.release.state !== "available" || input.release.bound === null) {
      throw new Error(`unfinished task ${edge.id} has no temporal release bound`);
    }
    bounds.set(edge.id, {
      numerator: input.release.bound.numerator,
      denominator: input.release.bound.denominator,
    });
  }
  return {
    bounds,
    unavailableCauses: Object.freeze(unavailableCauses),
  };
}

function minimumEvent(values: readonly Rational[]): Rational | null {
  if (values.length === 0) return null;
  return values.reduce((result, value) =>
    compare(value, result) < 0 ? value : result
  );
}

function schedule(
  graph: ResidualGraph,
  precedence: PrecedenceResult,
  releaseBounds: ReadonlyMap<string, Rational>,
  capacities: ReadonlyMap<string, number>,
): {
  readonly makespan: Rational;
  readonly tasks: readonly TemporalResourceTask[];
  readonly milestones: readonly TemporalResourceMilestone[];
} {
  const tasks = graph.edges.filter((edge) => edge.kind === "task");
  const timingById = new Map(
    precedence.edges.map((timing) => [timing.id, timing]),
  );
  const satisfaction = new Map<string, Rational>();
  const reached = new Map<string, Rational>(
    graph.frontier.map((id) => [id, ZERO]),
  );
  const scheduled = new Map<string, TemporalResourceTask>();
  const running = new Map<string, RunningTask>();
  const unscheduled = new Set(
    tasks
      .filter(({ status }) => status === "planned" || status === "blocked")
      .map(({ id }) => id),
  );
  const usage = new Map([...capacities.keys()].map((id) => [id, 0]));

  const propagate = (): void => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of graph.edges) {
        if (edge.kind !== "gate" || satisfaction.has(edge.id)) continue;
        const sourceTime = reached.get(edge.source);
        if (sourceTime === undefined) continue;
        satisfaction.set(edge.id, sourceTime);
        changed = true;
      }
      for (const vertex of graph.topologicalOrder) {
        if (reached.has(vertex)) continue;
        const incoming = graph.incoming.get(vertex)!;
        const values = incoming.map((edge) => satisfaction.get(edge.id));
        const satisfiedValues = values.filter(
          (value): value is Rational => value !== undefined,
        );
        if (
          values.length === 0 ||
          satisfiedValues.length !== values.length
        ) {
          continue;
        }
        reached.set(vertex, satisfiedValues.reduce(
          (result, value) => maximum(result, value),
          ZERO,
        ));
        changed = true;
      }
    }
  };

  for (const task of tasks.filter(({ status }) => status === "done")) {
    satisfaction.set(task.id, ZERO);
    scheduled.set(task.id, Object.freeze({
      id: task.id,
      status: "done",
      expected: task.expected,
      sourceReached: ZERO,
      releaseBound: null,
      eligibleTime: ZERO,
      start: ZERO,
      finish: ZERO,
      resourceWait: ZERO,
      requirements: task.requirements,
      conditionalBlocked: false,
    }));
  }
  propagate();

  for (const task of tasks
    .filter(({ status }) => status === "active")
    .sort((left, right) => compareStableStrings(left.id, right.id))) {
    const finish = add(ZERO, task.expected);
    running.set(task.id, { edge: task, start: ZERO, finish });
    for (const requirement of task.requirements) {
      usage.set(
        requirement.resourceId,
        usage.get(requirement.resourceId)! + requirement.units,
      );
    }
    scheduled.set(task.id, Object.freeze({
      id: task.id,
      status: "active",
      expected: task.expected,
      sourceReached: ZERO,
      releaseBound: null,
      eligibleTime: ZERO,
      start: ZERO,
      finish,
      resourceWait: ZERO,
      requirements: task.requirements,
      conditionalBlocked: false,
    }));
  }

  let current = ZERO;
  while (!reached.has(graph.finish)) {
    const completed = [...running.values()]
      .filter(({ finish }) => compare(finish, current) === 0)
      .sort((left, right) => compareStableStrings(left.edge.id, right.edge.id));
    for (const entry of completed) {
      running.delete(entry.edge.id);
      for (const requirement of entry.edge.requirements) {
        usage.set(
          requirement.resourceId,
          usage.get(requirement.resourceId)! - requirement.units,
        );
      }
      satisfaction.set(entry.edge.id, current);
    }
    propagate();

    const candidates = tasks
      .filter((task) =>
        unscheduled.has(task.id) &&
        reached.has(task.source) &&
        compare(releaseBounds.get(task.id)!, current) <= 0
      )
      .sort((left, right) => taskOrder(left, right, timingById));
    for (const task of candidates) {
      const fits = task.requirements.every((requirement) =>
        usage.get(requirement.resourceId)! + requirement.units <=
          capacities.get(requirement.resourceId)!
      );
      if (!fits) continue;
      const sourceReached = reached.get(task.source)!;
      const releaseBound = releaseBounds.get(task.id)!;
      const eligibleTime = maximum(sourceReached, releaseBound);
      const resourceWait = subtract(current, eligibleTime);
      if (compare(resourceWait, ZERO) < 0) {
        throw new Error(`negative temporal resource wait for ${task.id}`);
      }
      unscheduled.delete(task.id);
      for (const requirement of task.requirements) {
        usage.set(
          requirement.resourceId,
          usage.get(requirement.resourceId)! + requirement.units,
        );
      }
      const finish = add(current, task.expected);
      running.set(task.id, { edge: task, start: current, finish });
      scheduled.set(task.id, Object.freeze({
        id: task.id,
        status: task.status!,
        expected: task.expected,
        sourceReached,
        releaseBound,
        eligibleTime,
        start: current,
        finish,
        resourceWait,
        requirements: task.requirements,
        conditionalBlocked: task.status === "blocked",
      }));
    }
    if (reached.has(graph.finish)) break;

    const completion = minimumEvent(
      [...running.values()].map(({ finish }) => finish),
    );
    const release = minimumEvent(
      tasks
        .filter((task) =>
          unscheduled.has(task.id) &&
          reached.has(task.source) &&
          compare(releaseBounds.get(task.id)!, current) > 0
        )
        .map((task) => releaseBounds.get(task.id)!),
    );
    const next = minimumEvent(
      [completion, release].filter((value): value is Rational => value !== null),
    );
    if (next === null || compare(next, current) <= 0) {
      throw new Error(
        `PTRES-301: ${unscheduled.size} temporal unfinished tasks cannot produce a next event`,
      );
    }
    current = next;
  }

  const orderedTasks = [...scheduled.values()].sort((left, right) => {
    const byStart = compare(left.start, right.start);
    if (byStart !== 0) return byStart;
    const byFinish = compare(left.finish, right.finish);
    return byFinish !== 0
      ? byFinish
      : compareStableStrings(left.id, right.id);
  });
  return {
    makespan: reached.get(graph.finish)!,
    tasks: Object.freeze(orderedTasks),
    milestones: Object.freeze(
      graph.topologicalOrder.map((id) =>
        Object.freeze({ id, reach: reached.get(id)! })
      ),
    ),
  };
}

export function analyzeTemporalResourceSchedule(
  validated:
    | TargetGrammar3ValidatedDocument
    | TargetGrammar4ValidatedDocument,
  inputs: TargetTemporalInputProjection,
  options: TemporalResourceOptions = {},
): TemporalResourceSchedule {
  if (
    validated.document.declarations.find(({ kind }) => kind === "project")
      ?.id !== inputs.documentId ||
    validated.grammarVersion !== inputs.grammarVersion
  ) {
    throw new TypeError(
      "temporal input projection does not match the validated document",
    );
  }
  const graph = buildResidualGraph(validated.document);
  const maxPaths = options.maxPaths ?? 100;
  if (!Number.isSafeInteger(maxPaths) || maxPaths < 1) {
    throw new TypeError("temporal resource maxPaths must be a positive integer");
  }
  const precedence = analyzePrecedence(graph, maxPaths);
  const overrides = options.capacityOverrides ?? new Map();
  const capacities = effectiveCapacities(graph, overrides);
  const projectedCapacities = projectionCapacities(
    graph,
    capacities,
    overrides,
  );
  const releases = releaseInputs(graph, inputs);
  const common = {
    algorithm: TEMPORAL_RESOURCE_PROJECTION_IDENTITY,
    scheduler: Object.freeze({
      id: "parallel-sgs" as const,
      version: 1 as const,
      optimal: false as const,
    }),
    conditionalOnBlocksResolved: graph.blockedTaskIds.length > 0,
    blockedTaskIds: Object.freeze([...graph.blockedTaskIds]),
  };
  if (releases.unavailableCauses.length > 0) {
    return Object.freeze({
      ...common,
      state: "unavailable",
      capacities: projectedCapacities,
      makespan: null,
      tasks: Object.freeze([]),
      milestones: Object.freeze([]),
      unavailableCauses: releases.unavailableCauses,
    });
  }
  const result = schedule(
    graph,
    precedence,
    releases.bounds,
    capacities,
  );
  return Object.freeze({
    ...common,
    state: "available",
    capacities: projectedCapacities,
    makespan: result.makespan,
    tasks: result.tasks,
    milestones: result.milestones,
    unavailableCauses: Object.freeze([]),
  });
}
