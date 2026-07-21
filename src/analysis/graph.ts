import type {
  DeclarationNode,
  DocumentNode,
  DurationValue,
  RequirementValue,
  VelocityValue,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import { compareStableStrings } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import {
  ZERO,
  add,
  divide,
  multiply,
  rational,
  rationalFromDuration,
  square,
  subtract,
} from "../model/rational.js";
import type { DurationUnit, Velocity } from "../model/units.js";

export type TaskStatus = "planned" | "active" | "blocked" | "done";

export interface AnalysisResource {
  readonly declaration: DeclarationNode;
  readonly id: string;
  readonly capacity: number;
}

export interface AnalysisEdge {
  readonly declaration: DeclarationNode;
  readonly id: string;
  readonly kind: "task" | "gate";
  readonly source: string;
  readonly target: string;
  readonly status: TaskStatus | null;
  readonly expected: Rational;
  readonly variance: Rational;
  readonly priority: number;
  readonly requirements: readonly RequirementValue[];
}

export interface ResidualGraph {
  readonly document: DocumentNode;
  readonly project: DeclarationNode;
  readonly finish: string;
  readonly durationUnit: DurationUnit;
  readonly velocity: Velocity | null;
  readonly criticalEpsilon: Rational;
  readonly vertices: ReadonlyMap<string, DeclarationNode>;
  readonly resources: ReadonlyMap<string, AnalysisResource>;
  readonly edges: readonly AnalysisEdge[];
  readonly incoming: ReadonlyMap<string, readonly AnalysisEdge[]>;
  readonly outgoing: ReadonlyMap<string, readonly AnalysisEdge[]>;
  readonly topologicalOrder: readonly string[];
  readonly effectiveReached: ReadonlySet<string>;
  readonly frontier: readonly string[];
  readonly blockedTaskIds: readonly string[];
}

function durationFieldValue(declaration: DeclarationNode, name: string): Rational {
  const field = fieldNamed(declaration, name);
  if (field === undefined || typeof field.value !== "object" || field.value === null) {
    throw new Error(`validated ${declaration.id} is missing duration field ${name}`);
  }
  return rationalFromDuration(field.value as DurationValue);
}

function edgeNumbers(declaration: DeclarationNode): {
  readonly expected: Rational;
  readonly variance: Rational;
} {
  if (declaration.kind === "gate") return { expected: ZERO, variance: ZERO };
  const status = (fieldNamed(declaration, "status")?.value ?? "planned") as TaskStatus;
  if (status === "done") return { expected: ZERO, variance: ZERO };
  const estimate = fieldNamed(declaration, "estimate");
  if (estimate === undefined) {
    return { expected: durationFieldValue(declaration, "duration"), variance: ZERO };
  }
  const children = estimate.children ?? [];
  const optimistic = durationFieldValueFromChild(declaration, children, "optimistic");
  const mostLikely = durationFieldValueFromChild(declaration, children, "most_likely");
  const pessimistic = durationFieldValueFromChild(declaration, children, "pessimistic");
  const expected = divide(
    add(add(optimistic, multiply(rational(4n), mostLikely)), pessimistic),
    rational(6n),
  );
  const variance = square(divide(subtract(pessimistic, optimistic), rational(6n)));
  return { expected, variance };
}

function durationFieldValueFromChild(
  declaration: DeclarationNode,
  children: readonly { readonly name: string; readonly value: unknown }[],
  name: string,
): Rational {
  const child = children.find((candidate) => candidate.name === name);
  if (child === undefined || typeof child.value !== "object" || child.value === null) {
    throw new Error(`validated estimate ${declaration.id} is missing ${name}`);
  }
  return rationalFromDuration(child.value as DurationValue);
}

export function computeEffectiveReached(document: DocumentNode): ReadonlySet<string> {
  const milestones = document.declarations.filter((declaration) => declaration.kind === "milestone");
  const edges = document.declarations.filter(
    (declaration) => declaration.kind === "task" || declaration.kind === "gate",
  );
  const incoming = new Map<string, DeclarationNode[]>(
    milestones.map((milestone) => [milestone.id, []]),
  );
  for (const edge of edges) incoming.get(edge.to!)!.push(edge);
  for (const list of incoming.values()) {
    list.sort((left, right) => compareStableStrings(left.id, right.id));
  }
  const reached = new Set(
    milestones
      .filter((milestone) => fieldNamed(milestone, "state")?.value === "reached")
      .map((milestone) => milestone.id),
  );
  const satisfied = (edge: DeclarationNode): boolean => {
    if (!reached.has(edge.from!)) return false;
    return edge.kind === "gate" || fieldNamed(edge, "status")?.value === "done";
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const milestone of milestones) {
      if (reached.has(milestone.id)) continue;
      const edgesIn = incoming.get(milestone.id)!;
      if (edgesIn.length > 0 && edgesIn.every(satisfied)) {
        reached.add(milestone.id);
        changed = true;
      }
    }
  }
  return reached;
}

function stableTopologicalOrder(
  vertices: ReadonlyMap<string, DeclarationNode>,
  edges: readonly AnalysisEdge[],
): readonly string[] {
  const indegree = new Map([...vertices.keys()].map((id) => [id, 0]));
  const outgoing = new Map([...vertices.keys()].map((id) => [id, [] as AnalysisEdge[]]));
  for (const edge of edges) {
    indegree.set(edge.target, indegree.get(edge.target)! + 1);
    outgoing.get(edge.source)!.push(edge);
  }
  for (const list of outgoing.values()) {
    list.sort((left, right) => compareStableStrings(left.id, right.id));
  }
  const available = [...indegree]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id)
    .sort(compareStableStrings);
  const order: string[] = [];
  while (available.length > 0) {
    const current = available.shift()!;
    order.push(current);
    for (const edge of outgoing.get(current)!) {
      const degree = indegree.get(edge.target)! - 1;
      indegree.set(edge.target, degree);
      if (degree === 0) {
        available.push(edge.target);
        available.sort(compareStableStrings);
      }
    }
  }
  if (order.length !== vertices.size) throw new Error("validated residual graph contains a cycle");
  return order;
}

export function buildResidualGraph(document: DocumentNode): ResidualGraph {
  const project = document.declarations.find((declaration) => declaration.kind === "project");
  if (project === undefined) throw new Error("validated document has no project");
  const finish = fieldNamed(project, "finish")!.value as string;
  const durationUnit = fieldNamed(project, "duration_unit")!.value as DurationUnit;
  const velocityField = fieldNamed(project, "velocity");
  const velocityValue = velocityField?.value as VelocityValue | undefined;
  const velocity: Velocity | null =
    velocityValue === undefined
      ? null
      : {
          points: rationalFromDuration(velocityValue.points),
          period: rationalFromDuration(velocityValue.period),
          periodUnit: velocityValue.period.suffix === "d" ? "day" : "hour",
        };
  const epsilonField = fieldNamed(project, "critical_epsilon");
  const criticalEpsilon =
    epsilonField === undefined
      ? ZERO
      : rationalFromDuration(epsilonField.value as DurationValue);
  const effectiveReached = computeEffectiveReached(document);
  const allMilestones = new Map(
    document.declarations
      .filter((declaration) => declaration.kind === "milestone")
      .map((declaration) => [declaration.id, declaration]),
  );
  const edges: AnalysisEdge[] = document.declarations
    .filter((declaration) =>
      (declaration.kind === "task" || declaration.kind === "gate") &&
      !effectiveReached.has(declaration.to!),
    )
    .map((declaration) => {
      const numbers = edgeNumbers(declaration);
      return {
        declaration,
        id: declaration.id,
        kind: declaration.kind as "task" | "gate",
        source: declaration.from!,
        target: declaration.to!,
        status:
          declaration.kind === "task"
            ? ((fieldNamed(declaration, "status")?.value ?? "planned") as TaskStatus)
            : null,
        expected: numbers.expected,
        variance: numbers.variance,
        priority:
          declaration.kind === "task"
            ? ((fieldNamed(declaration, "priority")?.value ?? 0) as number)
            : 0,
        requirements:
          declaration.kind === "task"
            ? ((fieldNamed(declaration, "requires")?.value ?? []) as readonly RequirementValue[])
            : [],
      };
    });
  edges.sort((left, right) => compareStableStrings(left.id, right.id));
  const vertexIds = new Set<string>([finish]);
  for (const edge of edges) {
    vertexIds.add(edge.source);
    vertexIds.add(edge.target);
  }
  const vertices = new Map(
    [...vertexIds]
      .sort(compareStableStrings)
      .map((id) => [id, allMilestones.get(id)!]),
  );
  const incomingMutable = new Map([...vertices.keys()].map((id) => [id, [] as AnalysisEdge[]]));
  const outgoingMutable = new Map([...vertices.keys()].map((id) => [id, [] as AnalysisEdge[]]));
  for (const edge of edges) {
    incomingMutable.get(edge.target)!.push(edge);
    outgoingMutable.get(edge.source)!.push(edge);
  }
  for (const list of [...incomingMutable.values(), ...outgoingMutable.values()]) {
    list.sort((left, right) => compareStableStrings(left.id, right.id));
  }
  const resources = new Map(
    document.declarations
      .filter((declaration) => declaration.kind === "resource")
      .sort((left, right) => compareStableStrings(left.id, right.id))
      .map((declaration) => [
        declaration.id,
        {
          declaration,
          id: declaration.id,
          capacity: fieldNamed(declaration, "capacity")!.value as number,
        },
      ]),
  );
  const frontier = [...vertices.keys()]
    .filter((id) => effectiveReached.has(id))
    .sort(compareStableStrings);
  return {
    document,
    project,
    finish,
    durationUnit,
    velocity,
    criticalEpsilon,
    vertices,
    resources,
    edges,
    incoming: incomingMutable,
    outgoing: outgoingMutable,
    topologicalOrder: stableTopologicalOrder(vertices, edges),
    effectiveReached,
    frontier,
    blockedTaskIds: edges
      .filter((edge) => edge.status === "blocked")
      .map((edge) => edge.id)
      .sort(compareStableStrings),
  };
}
