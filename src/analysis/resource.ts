import { compareStableStrings } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import {
  ZERO,
  absolute,
  add,
  compare,
  divide,
  isZero,
  multiply,
  rational,
  subtract,
} from "../model/rational.js";
import type { RequirementValue } from "../model/syntax.js";
import type { AnalysisEdge, ResidualGraph, TaskStatus } from "./graph.js";
import type { EdgeTiming, PrecedenceResult } from "./precedence.js";

export interface ScheduledTask {
  readonly id: string;
  readonly status: TaskStatus;
  readonly expected: Rational;
  readonly variance: Rational;
  readonly eligibleTime: Rational;
  readonly start: Rational;
  readonly finish: Rational;
  readonly resourceWait: Rational;
  readonly requirements: readonly RequirementValue[];
  readonly priorityKey: {
    readonly priority: number;
    readonly precedenceTotalFloat: Rational;
    readonly expected: Rational;
    readonly taskId: string;
  };
  readonly conditionalBlocked: boolean;
}

export interface ResourceCapacity {
  readonly id: string;
  readonly declared: number;
  readonly override: number | null;
  readonly effective: number;
}

export interface ResourceTimelineEntry {
  readonly taskId: string;
  readonly start: Rational;
  readonly finish: Rational;
  readonly units: number;
}

export interface ResourceStatistic {
  readonly id: string;
  readonly capacity: number;
  readonly amountTime: Rational;
  readonly utilization: Rational;
  readonly peakUsage: number;
  readonly lastRelease: Rational;
  readonly timeline: readonly ResourceTimelineEntry[];
}

interface ResourceArcBase {
  readonly id: string;
  readonly fromTaskId: string;
  readonly toTaskId: string;
  readonly atTime: Rational;
  readonly waitFrom: Rational;
  readonly resources: ReadonlyMap<string, number>;
}

export interface ResourceArc {
  readonly id: string;
  readonly fromTaskId: string;
  readonly toTaskId: string;
  readonly atTime: Rational;
  readonly waitFrom: Rational;
  readonly resources: ReadonlyMap<string, number>;
  readonly scheduleFloat: Rational;
  readonly isCritical: boolean;
  readonly isDriving: boolean;
}

export type ScheduleConstraintKind = "precedence" | "gate" | "resource";

export interface SchedulePath {
  readonly taskIds: readonly string[];
  readonly constraints: readonly {
    readonly fromTaskId: string;
    readonly toTaskId: string;
    readonly kind: ScheduleConstraintKind;
    readonly resourceArcId: string | null;
  }[];
  readonly connectorIds: readonly string[];
}

export interface ScheduleCriticalResult {
  readonly taskIds: readonly string[];
  readonly resourceArcIds: readonly string[];
  readonly drivingConstraintIds: readonly string[];
  readonly representativePath: SchedulePath;
  readonly pathCount: bigint;
  readonly paths: readonly SchedulePath[];
  readonly pathsTruncated: boolean;
}

export interface ResourceScheduleResult {
  readonly algorithm: {
    readonly id: "parallel-sgs";
    readonly version: 1;
    readonly optimal: false;
  };
  readonly conditionalOnBlocksResolved: boolean;
  readonly blockedTaskIds: readonly string[];
  readonly capacities: readonly ResourceCapacity[];
  readonly precedenceLowerBound: Rational;
  readonly makespan: Rational;
  readonly resourceDelay: Rational;
  readonly tasks: readonly ScheduledTask[];
  readonly resources: readonly ResourceStatistic[];
  readonly resourceArcs: readonly ResourceArc[];
  readonly constraintGraphReplay: { readonly ok: true };
  readonly scheduleCritical: ScheduleCriticalResult;
}

interface RunningTask {
  readonly edge: AnalysisEdge;
  readonly start: Rational;
  readonly finish: Rational;
}

interface ConstraintArc {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly weight: Rational;
  readonly kind:
    | "frontier"
    | "task-start"
    | "task-duration"
    | "task-finish"
    | "gate"
    | "resource"
    | "project-finish";
  readonly entityId: string | null;
  readonly resourceArcId: string | null;
}

interface ConstraintTiming extends ConstraintArc {
  readonly scheduleFloat: Rational;
  readonly isCritical: boolean;
  readonly isDriving: boolean;
}

function maximum(values: readonly Rational[]): Rational {
  if (values.length === 0) throw new Error("maximum requires at least one value");
  return values.reduce((result, value) => (compare(value, result) > 0 ? value : result));
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
  return byDuration !== 0 ? byDuration : compareStableStrings(left.id, right.id);
}

function requirementMap(edge: AnalysisEdge): ReadonlyMap<string, number> {
  return new Map(edge.requirements.map((requirement) => [requirement.resourceId, requirement.units]));
}

function buildResourceArc(
  arcs: Map<string, ResourceArcBase>,
  fromTaskId: string,
  toTaskId: string,
  atTime: Rational,
  waitFrom: Rational,
  resourceId: string,
  contribution: number,
): void {
  const id = `resource:${fromTaskId}:${toTaskId}`;
  const existing = arcs.get(id);
  const resources = new Map(existing?.resources ?? []);
  resources.set(resourceId, (resources.get(resourceId) ?? 0) + contribution);
  arcs.set(id, { id, fromTaskId, toTaskId, atTime, waitFrom, resources });
}

function scheduleTasks(
  graph: ResidualGraph,
  precedence: PrecedenceResult,
  capacities: ReadonlyMap<string, number>,
): {
  readonly tasks: readonly ScheduledTask[];
  readonly reachedTimes: ReadonlyMap<string, Rational>;
  readonly makespan: Rational;
  readonly resourceArcs: readonly ResourceArcBase[];
} {
  const tasks = graph.edges.filter((edge) => edge.kind === "task");
  const timingById = new Map(precedence.edges.map((timing) => [timing.id, timing]));
  const satisfaction = new Map<string, Rational>();
  const reachedTimes = new Map<string, Rational>(graph.frontier.map((id) => [id, ZERO]));
  const scheduled = new Map<string, ScheduledTask>();
  const running = new Map<string, RunningTask>();
  const unscheduled = new Set(
    tasks
      .filter((task) => task.status === "planned" || task.status === "blocked")
      .map((task) => task.id),
  );
  const usage = new Map([...capacities.keys()].map((id) => [id, 0]));
  const resourceArcs = new Map<string, ResourceArcBase>();

  const propagate = (): void => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of graph.edges) {
        if (edge.kind !== "gate" || satisfaction.has(edge.id)) continue;
        const sourceTime = reachedTimes.get(edge.source);
        if (sourceTime !== undefined) {
          satisfaction.set(edge.id, sourceTime);
          changed = true;
        }
      }
      for (const vertex of graph.topologicalOrder) {
        if (reachedTimes.has(vertex)) continue;
        const incoming = graph.incoming.get(vertex)!;
        const times = incoming.map((edge) => satisfaction.get(edge.id));
        if (times.length > 0 && times.every((time) => time !== undefined)) {
          reachedTimes.set(vertex, maximum(times as Rational[]));
          changed = true;
        }
      }
    }
  };

  for (const task of tasks.filter((edge) => edge.status === "done")) {
    satisfaction.set(task.id, ZERO);
    const timing = timingById.get(task.id)!;
    scheduled.set(task.id, {
      id: task.id,
      status: "done",
      expected: task.expected,
      variance: task.variance,
      eligibleTime: ZERO,
      start: ZERO,
      finish: ZERO,
      resourceWait: ZERO,
      requirements: task.requirements,
      priorityKey: {
        priority: task.priority,
        precedenceTotalFloat: timing.totalFloat,
        expected: task.expected,
        taskId: task.id,
      },
      conditionalBlocked: false,
    });
  }
  propagate();

  for (const task of tasks.filter((edge) => edge.status === "active").sort((left, right) => compareStableStrings(left.id, right.id))) {
    const finish = add(ZERO, task.expected);
    running.set(task.id, { edge: task, start: ZERO, finish });
    for (const requirement of task.requirements) {
      usage.set(requirement.resourceId, usage.get(requirement.resourceId)! + requirement.units);
    }
    const timing = timingById.get(task.id)!;
    scheduled.set(task.id, {
      id: task.id,
      status: "active",
      expected: task.expected,
      variance: task.variance,
      eligibleTime: ZERO,
      start: ZERO,
      finish,
      resourceWait: ZERO,
      requirements: task.requirements,
      priorityKey: {
        priority: task.priority,
        precedenceTotalFloat: timing.totalFloat,
        expected: task.expected,
        taskId: task.id,
      },
      conditionalBlocked: false,
    });
  }

  let current = ZERO;
  while (!reachedTimes.has(graph.finish)) {
    const completed = [...running.values()]
      .filter((entry) => compare(entry.finish, current) === 0)
      .sort((left, right) => compareStableStrings(left.edge.id, right.edge.id));
    for (const entry of completed) {
      running.delete(entry.edge.id);
      for (const requirement of entry.edge.requirements) {
        usage.set(requirement.resourceId, usage.get(requirement.resourceId)! - requirement.units);
      }
      satisfaction.set(entry.edge.id, current);
    }
    propagate();

    const candidates = tasks
      .filter(
        (task) =>
          unscheduled.has(task.id) && reachedTimes.has(task.source),
      )
      .sort((left, right) => taskOrder(left, right, timingById));
    for (const task of candidates) {
      const fits = task.requirements.every(
        (requirement) =>
          usage.get(requirement.resourceId)! + requirement.units <=
          capacities.get(requirement.resourceId)!,
      );
      if (!fits) continue;
      const eligibleTime = reachedTimes.get(task.source)!;
      const resourceWait = subtract(current, eligibleTime);
      if (compare(resourceWait, ZERO) < 0) {
        throw new Error(`negative resource wait for ${task.id}`);
      }
      if (compare(resourceWait, ZERO) > 0) {
        for (const requirement of [...task.requirements].sort((left, right) => compareStableStrings(left.resourceId, right.resourceId))) {
          const released = completed
            .map((entry) => ({
              taskId: entry.edge.id,
              units: requirementMap(entry.edge).get(requirement.resourceId) ?? 0,
            }))
            .filter(({ units }) => units > 0)
            .sort((left, right) =>
              right.units !== left.units
                ? right.units - left.units
                : compareStableStrings(left.taskId, right.taskId),
            );
          const releasedUnits = released.reduce((sum, item) => sum + item.units, 0);
          const needed = Math.max(
            0,
            usage.get(requirement.resourceId)! +
              releasedUnits +
              requirement.units -
              capacities.get(requirement.resourceId)!,
          );
          let remaining = needed;
          for (const item of released) {
            if (remaining === 0) break;
            const contribution = Math.min(item.units, remaining);
            buildResourceArc(
              resourceArcs,
              item.taskId,
              task.id,
              current,
              eligibleTime,
              requirement.resourceId,
              contribution,
            );
            remaining -= contribution;
          }
          if (remaining !== 0) {
            throw new Error(`resource witness for ${task.id}/${requirement.resourceId} is incomplete`);
          }
        }
      }
      unscheduled.delete(task.id);
      for (const requirement of task.requirements) {
        usage.set(requirement.resourceId, usage.get(requirement.resourceId)! + requirement.units);
      }
      const finish = add(current, task.expected);
      running.set(task.id, { edge: task, start: current, finish });
      const timing = timingById.get(task.id)!;
      scheduled.set(task.id, {
        id: task.id,
        status: task.status!,
        expected: task.expected,
        variance: task.variance,
        eligibleTime,
        start: current,
        finish,
        resourceWait,
        requirements: task.requirements,
        priorityKey: {
          priority: task.priority,
          precedenceTotalFloat: timing.totalFloat,
          expected: task.expected,
          taskId: task.id,
        },
        conditionalBlocked: task.status === "blocked",
      });
    }
    if (reachedTimes.has(graph.finish)) break;
    if (running.size === 0) {
      throw new Error(`PTRES-301: ${unscheduled.size} unfinished tasks cannot produce a next event`);
    }
    current = [...running.values()].reduce<Rational>((minimum, entry, index) =>
      index === 0 || compare(entry.finish, minimum) < 0 ? entry.finish : minimum,
    ZERO);
  }

  const makespan = reachedTimes.get(graph.finish)!;
  const orderedTasks = [...scheduled.values()].sort((left, right) => {
    const byStart = compare(left.start, right.start);
    if (byStart !== 0) return byStart;
    const byFinish = compare(left.finish, right.finish);
    return byFinish !== 0 ? byFinish : compareStableStrings(left.id, right.id);
  });
  if (orderedTasks.some((task) => task === undefined)) {
    throw new Error("resource scheduler did not emit every residual task");
  }
  return {
    tasks: orderedTasks,
    reachedTimes,
    makespan,
    resourceArcs: [...resourceArcs.values()].sort((left, right) => compareStableStrings(left.id, right.id)),
  };
}

function resourceStatistics(
  graph: ResidualGraph,
  tasks: readonly ScheduledTask[],
  capacities: ReadonlyMap<string, number>,
  makespan: Rational,
): readonly ResourceStatistic[] {
  return [...graph.resources.keys()].map((resourceId) => {
    const timeline = tasks
      .flatMap((task) => {
        const requirement = task.requirements.find((candidate) => candidate.resourceId === resourceId);
        return requirement === undefined || task.status === "done"
          ? []
          : [{ taskId: task.id, start: task.start, finish: task.finish, units: requirement.units }];
      })
      .sort((left, right) => {
        const byStart = compare(left.start, right.start);
        if (byStart !== 0) return byStart;
        const byFinish = compare(left.finish, right.finish);
        return byFinish !== 0 ? byFinish : compareStableStrings(left.taskId, right.taskId);
      });
    const amountTime = timeline.reduce(
      (sum, entry) => add(sum, multiply(rational(BigInt(entry.units)), subtract(entry.finish, entry.start))),
      ZERO,
    );
    const utilization = isZero(makespan)
      ? ZERO
      : divide(amountTime, multiply(rational(BigInt(capacities.get(resourceId)!)), makespan));
    const eventTimes = [...new Map(
      timeline.flatMap((entry) => [entry.start, entry.finish]).map((time) => [`${time.numerator}/${time.denominator}`, time]),
    ).values()].sort(compare);
    let usage = 0;
    let peakUsage = 0;
    for (const time of eventTimes) {
      for (const entry of timeline) {
        if (compare(entry.finish, time) === 0) usage -= entry.units;
      }
      for (const entry of timeline) {
        if (compare(entry.start, time) === 0) usage += entry.units;
      }
      peakUsage = Math.max(peakUsage, usage);
    }
    const lastRelease = timeline.length === 0
      ? ZERO
      : timeline.map((entry) => entry.finish).reduce((result, value) => compare(value, result) > 0 ? value : result);
    return {
      id: resourceId,
      capacity: capacities.get(resourceId)!,
      amountTime,
      utilization,
      peakUsage,
      lastRelease,
      timeline,
    };
  });
}

function addConstraint(
  arcs: ConstraintArc[],
  id: string,
  from: string,
  to: string,
  weight: Rational,
  kind: ConstraintArc["kind"],
  entityId: string | null,
  resourceArcId: string | null = null,
): void {
  arcs.push({ id, from, to, weight, kind, entityId, resourceArcId });
}

function constraintGraph(
  graph: ResidualGraph,
  tasks: readonly ScheduledTask[],
  resourceArcs: readonly ResourceArcBase[],
): { readonly nodes: readonly string[]; readonly arcs: readonly ConstraintArc[] } {
  const nodes = new Set<string>(["@START", "@FINISH"]);
  const arcs: ConstraintArc[] = [];
  for (const vertex of graph.vertices.keys()) nodes.add(`M:${vertex}`);
  for (const frontier of graph.frontier) {
    addConstraint(arcs, `frontier:${frontier}`, "@START", `M:${frontier}`, ZERO, "frontier", frontier);
  }
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  for (const edge of graph.edges) {
    if (edge.kind === "gate") {
      addConstraint(arcs, `gate:${edge.id}`, `M:${edge.source}`, `M:${edge.target}`, ZERO, "gate", edge.id);
      continue;
    }
    const task = taskById.get(edge.id)!;
    nodes.add(`S:${edge.id}`);
    nodes.add(`F:${edge.id}`);
    addConstraint(arcs, `task-start:${edge.id}`, `M:${edge.source}`, `S:${edge.id}`, ZERO, "task-start", edge.id);
    addConstraint(arcs, `task-duration:${edge.id}`, `S:${edge.id}`, `F:${edge.id}`, task.expected, "task-duration", edge.id);
    addConstraint(arcs, `task-finish:${edge.id}`, `F:${edge.id}`, `M:${edge.target}`, ZERO, "task-finish", edge.id);
  }
  for (const arc of resourceArcs) {
    addConstraint(arcs, arc.id, `F:${arc.fromTaskId}`, `S:${arc.toTaskId}`, ZERO, "resource", null, arc.id);
  }
  addConstraint(arcs, "project-finish", `M:${graph.finish}`, "@FINISH", ZERO, "project-finish", graph.finish);
  return {
    nodes: [...nodes].sort(compareStableStrings),
    arcs: arcs.sort((left, right) => compareStableStrings(left.id, right.id)),
  };
}

function topologicalConstraints(
  nodes: readonly string[],
  arcs: readonly ConstraintArc[],
): {
  readonly order: readonly string[];
  readonly incoming: ReadonlyMap<string, readonly ConstraintArc[]>;
  readonly outgoing: ReadonlyMap<string, readonly ConstraintArc[]>;
} {
  const incoming = new Map(nodes.map((node) => [node, [] as ConstraintArc[]]));
  const outgoing = new Map(nodes.map((node) => [node, [] as ConstraintArc[]]));
  const indegree = new Map(nodes.map((node) => [node, 0]));
  for (const arc of arcs) {
    incoming.get(arc.to)!.push(arc);
    outgoing.get(arc.from)!.push(arc);
    indegree.set(arc.to, indegree.get(arc.to)! + 1);
  }
  for (const list of [...incoming.values(), ...outgoing.values()]) {
    list.sort((left, right) => compareStableStrings(left.id, right.id));
  }
  const available = [...indegree]
    .filter(([, degree]) => degree === 0)
    .map(([node]) => node)
    .sort(compareStableStrings);
  const order: string[] = [];
  while (available.length > 0) {
    const node = available.shift()!;
    order.push(node);
    for (const arc of outgoing.get(node)!) {
      const degree = indegree.get(arc.to)! - 1;
      indegree.set(arc.to, degree);
      if (degree === 0) {
        available.push(arc.to);
        available.sort(compareStableStrings);
      }
    }
  }
  if (order.length !== nodes.length) throw new Error("resource constraint graph contains a cycle");
  return { order, incoming, outgoing };
}

function pathFromConstraints(arcs: readonly ConstraintTiming[]): SchedulePath {
  const taskIds: string[] = [];
  const connectorIds: string[] = [];
  const constraints: {
    fromTaskId: string;
    toTaskId: string;
    kind: ScheduleConstraintKind;
    resourceArcId: string | null;
  }[] = [];
  let previousTask: string | undefined;
  let segmentKind: ScheduleConstraintKind = "precedence";
  let segmentResource: string | null = null;
  for (const arc of arcs) {
    if (arc.kind === "resource") {
      segmentKind = "resource";
      segmentResource = arc.resourceArcId;
    } else if (arc.kind === "gate" && segmentKind !== "resource") {
      segmentKind = "gate";
      if (arc.entityId !== null) connectorIds.push(arc.entityId);
    }
    if (arc.kind === "task-duration" && arc.entityId !== null) {
      if (isZero(arc.weight)) {
        connectorIds.push(arc.entityId);
        continue;
      }
      const currentTask = arc.entityId;
      if (previousTask !== undefined) {
        constraints.push({
          fromTaskId: previousTask,
          toTaskId: currentTask,
          kind: segmentKind,
          resourceArcId: segmentKind === "resource" ? segmentResource : null,
        });
      }
      taskIds.push(currentTask);
      previousTask = currentTask;
      segmentKind = "precedence";
      segmentResource = null;
    }
  }
  return { taskIds, constraints, connectorIds: [...new Set(connectorIds)] };
}

function scheduleCritical(
  graph: ResidualGraph,
  tasks: readonly ScheduledTask[],
  resourceArcBases: readonly ResourceArcBase[],
  reachedTimes: ReadonlyMap<string, Rational>,
  makespan: Rational,
  maxPaths: number,
): {
  readonly resourceArcs: readonly ResourceArc[];
  readonly result: ScheduleCriticalResult;
} {
  const built = constraintGraph(graph, tasks, resourceArcBases);
  const topology = topologicalConstraints(built.nodes, built.arcs);
  const earliest = new Map<string, Rational>([["@START", ZERO]]);
  for (const node of topology.order) {
    if (node !== "@START") {
      const candidates = topology.incoming.get(node)!.map((arc) => add(earliest.get(arc.from)!, arc.weight));
      if (candidates.length === 0) throw new Error(`constraint node ${node} is unreachable`);
      earliest.set(node, maximum(candidates));
    }
  }
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    if (
      compare(earliest.get(`S:${task.id}`)!, task.start) !== 0 ||
      compare(earliest.get(`F:${task.id}`)!, task.finish) !== 0
    ) {
      throw new Error(`PTRES-302: constraint replay differs for task ${task.id}`);
    }
  }
  for (const [id, time] of reachedTimes) {
    if (compare(earliest.get(`M:${id}`)!, time) !== 0) {
      throw new Error(`PTRES-302: constraint replay differs for milestone ${id}`);
    }
  }
  if (compare(earliest.get("@FINISH")!, makespan) !== 0) {
    throw new Error("PTRES-302: constraint replay differs for project finish");
  }

  const latest = new Map<string, Rational>([["@FINISH", makespan]]);
  for (const node of [...topology.order].reverse()) {
    if (node === "@FINISH") continue;
    const outgoing = topology.outgoing.get(node)!;
    if (outgoing.length === 0) throw new Error(`constraint node ${node} cannot reach finish`);
    const values = outgoing.map((arc) => subtract(latest.get(arc.to)!, arc.weight));
    latest.set(node, values.reduce((result, value) => compare(value, result) < 0 ? value : result));
  }
  const timings: ConstraintTiming[] = built.arcs.map((arc) => {
    const scheduleFloat = subtract(subtract(latest.get(arc.to)!, earliest.get(arc.from)!), arc.weight);
    if (compare(scheduleFloat, ZERO) < 0) throw new Error(`negative schedule float for ${arc.id}`);
    return {
      ...arc,
      scheduleFloat,
      isCritical: compare(absolute(scheduleFloat), graph.criticalEpsilon) <= 0,
      isDriving: isZero(scheduleFloat),
    };
  });
  const timingById = new Map(timings.map((timing) => [timing.id, timing]));
  const resourceArcs: ResourceArc[] = resourceArcBases.map((arc) => {
    const timing = timingById.get(arc.id)!;
    return {
      ...arc,
      scheduleFloat: timing.scheduleFloat,
      isCritical: timing.isCritical,
      isDriving: timing.isDriving,
    };
  });

  const drivingOutgoing = new Map(built.nodes.map((node) => [node, [] as ConstraintTiming[]]));
  for (const timing of timings) {
    if (timing.isDriving) drivingOutgoing.get(timing.from)!.push(timing);
  }
  for (const list of drivingOutgoing.values()) {
    list.sort((left, right) => compareStableStrings(left.id, right.id));
  }
  const counts = new Map<string, bigint>([["@FINISH", 1n]]);
  for (const node of [...topology.order].reverse()) {
    if (node === "@FINISH") continue;
    counts.set(node, drivingOutgoing.get(node)!.reduce((sum, arc) => sum + (counts.get(arc.to) ?? 0n), 0n));
  }
  const pathCount = counts.get("@START") ?? 0n;
  if (pathCount === 0n) throw new Error("schedule critical path invariant failed");
  const paths: SchedulePath[] = [];
  const visit = (node: string, path: ConstraintTiming[]): void => {
    if (paths.length >= maxPaths) return;
    if (node === "@FINISH") {
      paths.push(pathFromConstraints(path));
      return;
    }
    for (const arc of drivingOutgoing.get(node)!) {
      if ((counts.get(arc.to) ?? 0n) === 0n) continue;
      visit(arc.to, [...path, arc]);
      if (paths.length >= maxPaths) return;
    }
  };
  visit("@START", []);
  const representativeArcs: ConstraintTiming[] = [];
  let node = "@START";
  while (node !== "@FINISH") {
    const arc = drivingOutgoing.get(node)!.find((candidate) => (counts.get(candidate.to) ?? 0n) > 0n);
    if (arc === undefined) throw new Error("schedule representative path invariant failed");
    representativeArcs.push(arc);
    node = arc.to;
  }
  const criticalTaskIds = new Set(
    timings
      .filter(
        (timing) =>
          timing.kind === "task-duration" &&
          timing.isCritical &&
          !isZero(timing.weight) &&
          taskById.get(timing.entityId!)?.status !== "done",
      )
      .map((timing) => timing.entityId!),
  );
  const positiveTaskIds = tasks
    .filter((task) => criticalTaskIds.has(task.id))
    .map((task) => task.id);
  return {
    resourceArcs,
    result: {
      taskIds: positiveTaskIds,
      resourceArcIds: resourceArcs.filter((arc) => arc.isCritical).map((arc) => arc.id),
      drivingConstraintIds: timings.filter((timing) => timing.isDriving).map((timing) => timing.id),
      representativePath: pathFromConstraints(representativeArcs),
      pathCount,
      paths,
      pathsTruncated: pathCount > BigInt(paths.length),
    },
  };
}

export function analyzeResources(
  graph: ResidualGraph,
  precedence: PrecedenceResult,
  overrides: ReadonlyMap<string, number>,
  maxPaths: number,
): ResourceScheduleResult {
  const capacities = new Map(
    [...graph.resources].map(([id, resource]) => [id, overrides.get(id) ?? resource.capacity]),
  );
  const scheduled = scheduleTasks(graph, precedence, capacities);
  const resourceDelay = subtract(scheduled.makespan, precedence.makespan);
  if (compare(resourceDelay, ZERO) < 0) throw new Error("resource schedule is shorter than precedence lower bound");
  const critical = scheduleCritical(
    graph,
    scheduled.tasks,
    scheduled.resourceArcs,
    scheduled.reachedTimes,
    scheduled.makespan,
    maxPaths,
  );
  return {
    algorithm: { id: "parallel-sgs", version: 1, optimal: false },
    conditionalOnBlocksResolved: graph.blockedTaskIds.length > 0,
    blockedTaskIds: graph.blockedTaskIds,
    capacities: [...graph.resources].map(([id, resource]) => ({
      id,
      declared: resource.capacity,
      override: overrides.get(id) ?? null,
      effective: capacities.get(id)!,
    })),
    precedenceLowerBound: precedence.makespan,
    makespan: scheduled.makespan,
    resourceDelay,
    tasks: scheduled.tasks,
    resources: resourceStatistics(graph, scheduled.tasks, capacities, scheduled.makespan),
    resourceArcs: critical.resourceArcs,
    constraintGraphReplay: { ok: true },
    scheduleCritical: critical.result,
  };
}
