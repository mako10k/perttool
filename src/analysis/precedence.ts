import { compareStableStrings } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import {
  ZERO,
  absolute,
  add,
  compare,
  isZero,
  subtract,
} from "../model/rational.js";
import type { AnalysisEdge, ResidualGraph, TaskStatus } from "./graph.js";

export interface MilestoneTiming {
  readonly id: string;
  readonly earliest: Rational;
  readonly latest: Rational;
  readonly slack: Rational;
}

export interface EdgeTiming {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: "task" | "gate";
  readonly status: TaskStatus | null;
  readonly expected: Rational;
  readonly variance: Rational;
  readonly es: Rational;
  readonly ef: Rational;
  readonly ls: Rational;
  readonly lf: Rational;
  readonly totalFloat: Rational;
  readonly freeFloat: Rational;
  readonly isCritical: boolean;
  readonly isDriving: boolean;
  readonly edge: AnalysisEdge;
}

export interface CriticalPath {
  readonly edgeIds: readonly string[];
  readonly taskIds: readonly string[];
  readonly gateIds: readonly string[];
  readonly variance: Rational;
}

export interface CriticalResult {
  readonly milestoneIds: readonly string[];
  readonly taskIds: readonly string[];
  readonly gateIds: readonly string[];
  readonly drivingEdgeIds: readonly string[];
  readonly representativePath: CriticalPath;
  readonly pathCount: bigint;
  readonly paths: readonly CriticalPath[];
  readonly pathsTruncated: boolean;
}

export interface PrecedenceResult {
  readonly makespan: Rational;
  readonly conditionalOnBlocksResolved: boolean;
  readonly blockedTaskIds: readonly string[];
  readonly milestones: readonly MilestoneTiming[];
  readonly edges: readonly EdgeTiming[];
  readonly critical: CriticalResult;
}

function pathFromEdges(edges: readonly EdgeTiming[]): CriticalPath {
  return {
    edgeIds: edges.map((edge) => edge.id),
    taskIds: edges.filter((edge) => edge.kind === "task").map((edge) => edge.id),
    gateIds: edges.filter((edge) => edge.kind === "gate").map((edge) => edge.id),
    variance: edges.reduce((sum, edge) => add(sum, edge.variance), ZERO),
  };
}

function criticalPaths(
  graph: ResidualGraph,
  edgeTimings: readonly EdgeTiming[],
  maxPaths: number,
): Pick<CriticalResult, "representativePath" | "pathCount" | "paths" | "pathsTruncated"> {
  const drivingOutgoing = new Map(
    [...graph.vertices.keys()].map((id) => [id, [] as EdgeTiming[]]),
  );
  for (const edge of edgeTimings) {
    if (edge.isDriving) drivingOutgoing.get(edge.source)!.push(edge);
  }
  for (const list of drivingOutgoing.values()) {
    list.sort((left, right) => compareStableStrings(left.id, right.id));
  }
  const counts = new Map<string, bigint>([[graph.finish, 1n]]);
  for (const vertex of [...graph.topologicalOrder].reverse()) {
    if (vertex === graph.finish) continue;
    const count = drivingOutgoing
      .get(vertex)!
      .reduce((sum, edge) => sum + (counts.get(edge.target) ?? 0n), 0n);
    counts.set(vertex, count);
  }
  const viableFrontier = graph.frontier
    .filter((id) => (counts.get(id) ?? 0n) > 0n)
    .sort(compareStableStrings);
  const pathCount = viableFrontier.reduce((sum, id) => sum + (counts.get(id) ?? 0n), 0n);
  if (pathCount === 0n) throw new Error("precedence critical path invariant failed");

  const emitted: CriticalPath[] = [];
  const visit = (vertex: string, current: EdgeTiming[]): void => {
    if (emitted.length >= maxPaths) return;
    if (vertex === graph.finish) {
      emitted.push(pathFromEdges(current));
      return;
    }
    for (const edge of drivingOutgoing.get(vertex)!) {
      if ((counts.get(edge.target) ?? 0n) === 0n) continue;
      visit(edge.target, [...current, edge]);
      if (emitted.length >= maxPaths) return;
    }
  };
  for (const frontier of viableFrontier) {
    visit(frontier, []);
    if (emitted.length >= maxPaths) break;
  }

  let representative: CriticalPath | undefined;
  const representativeEdges: EdgeTiming[] = [];
  let vertex = viableFrontier[0];
  while (vertex !== undefined && vertex !== graph.finish) {
    const next = drivingOutgoing
      .get(vertex)!
      .find((edge) => (counts.get(edge.target) ?? 0n) > 0n);
    if (next === undefined) throw new Error("precedence representative path invariant failed");
    representativeEdges.push(next);
    vertex = next.target;
  }
  representative = pathFromEdges(representativeEdges);
  return {
    representativePath: representative,
    pathCount,
    paths: emitted,
    pathsTruncated: pathCount > BigInt(emitted.length),
  };
}

export function analyzePrecedence(
  graph: ResidualGraph,
  maxPaths: number,
): PrecedenceResult {
  const earliest = new Map<string, Rational>();
  const edgeEarly = new Map<string, { readonly es: Rational; readonly ef: Rational }>();
  for (const vertex of graph.topologicalOrder) {
    let value: Rational;
    if (graph.frontier.includes(vertex)) {
      value = ZERO;
    } else {
      const incoming = graph.incoming.get(vertex)!;
      if (incoming.length === 0) throw new Error(`residual root ${vertex} is not frontier`);
      value = incoming.reduce<Rational>((maximum, edge, index) => {
        const candidate = edgeEarly.get(edge.id)!.ef;
        return index === 0 || compare(candidate, maximum) > 0 ? candidate : maximum;
      }, ZERO);
    }
    earliest.set(vertex, value);
    for (const edge of graph.outgoing.get(vertex)!) {
      edgeEarly.set(edge.id, { es: value, ef: add(value, edge.expected) });
    }
  }
  const makespan = earliest.get(graph.finish);
  if (makespan === undefined) throw new Error("finish earliest time is missing");

  const latest = new Map<string, Rational>([[graph.finish, makespan]]);
  const edgeLate = new Map<string, { readonly ls: Rational; readonly lf: Rational }>();
  for (const vertex of [...graph.topologicalOrder].reverse()) {
    if (vertex !== graph.finish) {
      const outgoing = graph.outgoing.get(vertex)!;
      if (outgoing.length === 0) throw new Error(`non-finish ${vertex} has no outgoing edge`);
      let value: Rational | undefined;
      for (const edge of outgoing) {
        const targetLatest = latest.get(edge.target);
        if (targetLatest === undefined) throw new Error(`latest time for ${edge.target} is missing`);
        const candidate = subtract(targetLatest, edge.expected);
        edgeLate.set(edge.id, { ls: candidate, lf: targetLatest });
        if (value === undefined || compare(candidate, value) < 0) value = candidate;
      }
      latest.set(vertex, value!);
    }
    const vertexLatest = latest.get(vertex)!;
    for (const edge of graph.incoming.get(vertex)!) {
      edgeLate.set(edge.id, {
        ls: subtract(vertexLatest, edge.expected),
        lf: vertexLatest,
      });
    }
  }

  const position = new Map(graph.topologicalOrder.map((id, index) => [id, index]));
  const edges = graph.edges
    .map((edge): EdgeTiming => {
      const early = edgeEarly.get(edge.id)!;
      const late = edgeLate.get(edge.id)!;
      const totalFloat = subtract(late.ls, early.es);
      const freeFloat = subtract(earliest.get(edge.target)!, early.ef);
      if (compare(totalFloat, ZERO) < 0 || compare(freeFloat, ZERO) < 0) {
        throw new Error(`negative float for edge ${edge.id}`);
      }
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        kind: edge.kind,
        status: edge.status,
        expected: edge.expected,
        variance: edge.variance,
        es: early.es,
        ef: early.ef,
        ls: late.ls,
        lf: late.lf,
        totalFloat,
        freeFloat,
        isCritical: compare(absolute(totalFloat), graph.criticalEpsilon) <= 0,
        isDriving: isZero(totalFloat),
        edge,
      };
    })
    .sort((left, right) => {
      const byPosition = position.get(left.source)! - position.get(right.source)!;
      return byPosition !== 0 ? byPosition : compareStableStrings(left.id, right.id);
    });
  const milestones = graph.topologicalOrder.map((id): MilestoneTiming => {
    const milestoneEarliest = earliest.get(id)!;
    const milestoneLatest = latest.get(id)!;
    const slack = subtract(milestoneLatest, milestoneEarliest);
    if (compare(slack, ZERO) < 0) throw new Error(`negative milestone slack for ${id}`);
    return { id, earliest: milestoneEarliest, latest: milestoneLatest, slack };
  });
  const pathResult = criticalPaths(graph, edges, maxPaths);
  return {
    makespan,
    conditionalOnBlocksResolved: graph.blockedTaskIds.length > 0,
    blockedTaskIds: graph.blockedTaskIds,
    milestones,
    edges,
    critical: {
      milestoneIds: milestones
        .filter((milestone) => compare(absolute(milestone.slack), graph.criticalEpsilon) <= 0)
        .map((milestone) => milestone.id),
      taskIds: edges.filter((edge) => edge.kind === "task" && edge.isCritical).map((edge) => edge.id),
      gateIds: edges.filter((edge) => edge.kind === "gate" && edge.isCritical).map((edge) => edge.id),
      drivingEdgeIds: edges.filter((edge) => edge.isDriving).map((edge) => edge.id),
      ...pathResult,
    },
  };
}
