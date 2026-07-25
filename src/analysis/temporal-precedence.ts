import type {
  TargetTemporalCause,
  TargetTemporalInputProjection,
} from "../application/target-temporal-input.js";
import type { Rational } from "../model/rational.js";
import { ZERO, add, maximum } from "../model/rational.js";
import type {
  TargetGrammar3ValidatedDocument,
} from "../semantic/target-validator.js";
import {
  buildResidualGraph,
  type ResidualGraph,
  type TaskStatus,
} from "./graph.js";

export const TEMPORAL_PRECEDENCE_PROJECTION_IDENTITY = Object.freeze({
  id: "perttool.temporal-precedence-earliest" as const,
  version: 1 as const,
  optimal: null,
});

export interface TemporalPrecedenceTask {
  readonly id: string;
  readonly status: TaskStatus;
  readonly expected: Rational;
  readonly sourceReached: Rational;
  readonly releaseBound: Rational | null;
  readonly start: Rational;
  readonly finish: Rational;
  readonly conditionalBlocked: boolean;
}

export interface TemporalPrecedenceMilestone {
  readonly id: string;
  readonly reach: Rational;
}

interface TemporalPrecedenceCommon {
  readonly algorithm: typeof TEMPORAL_PRECEDENCE_PROJECTION_IDENTITY;
  readonly conditionalOnBlocksResolved: boolean;
  readonly blockedTaskIds: readonly string[];
  readonly unavailableCauses: readonly TargetTemporalCause[];
}

export interface AvailableTemporalPrecedenceSchedule
  extends TemporalPrecedenceCommon {
  readonly state: "available";
  readonly makespan: Rational;
  readonly tasks: readonly TemporalPrecedenceTask[];
  readonly milestones: readonly TemporalPrecedenceMilestone[];
}

export interface UnavailableTemporalPrecedenceSchedule
  extends TemporalPrecedenceCommon {
  readonly state: "unavailable";
  readonly makespan: null;
  readonly tasks: readonly TemporalPrecedenceTask[];
  readonly milestones: readonly TemporalPrecedenceMilestone[];
}

export type TemporalPrecedenceSchedule =
  | AvailableTemporalPrecedenceSchedule
  | UnavailableTemporalPrecedenceSchedule;

function releaseInputs(
  graph: ResidualGraph,
  inputs: TargetTemporalInputProjection,
): {
  readonly bounds: ReadonlyMap<string, Rational>;
  readonly unavailableCauses: readonly TargetTemporalCause[];
} {
  const inputById = new Map(inputs.tasks.map((task) => [task.taskId, task]));
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
    const input = inputById.get(edge.id);
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

function schedule(
  graph: ResidualGraph,
  releaseBounds: ReadonlyMap<string, Rational>,
): {
  readonly makespan: Rational;
  readonly tasks: readonly TemporalPrecedenceTask[];
  readonly milestones: readonly TemporalPrecedenceMilestone[];
} {
  const milestoneTimes = new Map<string, Rational>();
  const satisfaction = new Map<string, Rational>();
  const taskRecords = new Map<string, TemporalPrecedenceTask>();

  for (const vertex of graph.topologicalOrder) {
    let reach: Rational;
    if (graph.frontier.includes(vertex)) {
      reach = ZERO;
    } else {
      const incoming = graph.incoming.get(vertex)!;
      if (incoming.length === 0) {
        throw new Error(`temporal precedence root ${vertex} is not frontier`);
      }
      reach = incoming.reduce(
        (result, edge) => maximum(result, satisfaction.get(edge.id)!),
        ZERO,
      );
    }
    milestoneTimes.set(vertex, reach);

    for (const edge of graph.outgoing.get(vertex)!) {
      if (edge.kind === "gate") {
        satisfaction.set(edge.id, reach);
        continue;
      }
      const status = edge.status!;
      const releaseBound =
        status === "planned" || status === "blocked"
          ? releaseBounds.get(edge.id)!
          : null;
      const start =
        status === "active" || status === "done"
          ? ZERO
          : maximum(reach, releaseBound!);
      const finish = status === "done" ? ZERO : add(start, edge.expected);
      satisfaction.set(edge.id, finish);
      taskRecords.set(edge.id, Object.freeze({
        id: edge.id,
        status,
        expected: edge.expected,
        sourceReached: reach,
        releaseBound,
        start,
        finish,
        conditionalBlocked: status === "blocked",
      }));
    }
  }

  return {
    makespan: milestoneTimes.get(graph.finish)!,
    tasks: Object.freeze(
      graph.topologicalOrder.flatMap((vertex) =>
        graph.outgoing.get(vertex)!
          .filter(({ kind }) => kind === "task")
          .map((edge) => taskRecords.get(edge.id)!)
      ),
    ),
    milestones: Object.freeze(
      graph.topologicalOrder.map((id) =>
        Object.freeze({ id, reach: milestoneTimes.get(id)! })
      ),
    ),
  };
}

export function analyzeTemporalPrecedenceSchedule(
  validated: TargetGrammar3ValidatedDocument,
  inputs: TargetTemporalInputProjection,
): TemporalPrecedenceSchedule {
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
  const releases = releaseInputs(graph, inputs);
  const common = {
    algorithm: TEMPORAL_PRECEDENCE_PROJECTION_IDENTITY,
    conditionalOnBlocksResolved: graph.blockedTaskIds.length > 0,
    blockedTaskIds: Object.freeze([...graph.blockedTaskIds]),
  };
  if (releases.unavailableCauses.length > 0) {
    return Object.freeze({
      ...common,
      state: "unavailable",
      makespan: null,
      tasks: Object.freeze([]),
      milestones: Object.freeze([]),
      unavailableCauses: releases.unavailableCauses,
    });
  }
  const result = schedule(graph, releases.bounds);
  return Object.freeze({
    ...common,
    state: "available",
    makespan: result.makespan,
    tasks: result.tasks,
    milestones: result.milestones,
    unavailableCauses: Object.freeze([]),
  });
}
