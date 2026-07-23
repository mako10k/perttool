import { createHash } from "node:crypto";
import { analyzeDocument } from "./analyze.js";
import type { Diagnostic } from "../model/diagnostics.js";
import { compareStableStrings, hasErrors, sortDiagnostics } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import { compare } from "../model/rational.js";
import type { DeclarationNode, DocumentNode, RequirementValue } from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import { buildResidualGraph } from "../analysis/graph.js";
import type { TaskStatus } from "../analysis/graph.js";
import type { EdgeTiming } from "../analysis/precedence.js";
import type { DurationUnit, Velocity, VelocityConversion } from "../model/units.js";
import { convertWithVelocity } from "../model/units.js";
import { buildRecommendationExplanation } from "../recommendation/explanation.js";
import type { RecommendationAnalysis } from "../recommendation/explanation-types.js";
import { rankRecommendationCandidates } from "../recommendation/ranking.js";

export type TaskClassification = "active" | "ready" | "blocked_now" | "upcoming";

export interface ResourceRejection {
  readonly resourceId: string;
  readonly capacity: number;
  readonly activeUsage: number;
  readonly earlierSelectedUsage: number;
  readonly usedBeforeDecision: number;
  readonly required: number;
  readonly available: number;
  readonly deficit: number;
  readonly activeTaskIds: readonly string[];
  readonly earlierSelectedTaskIds: readonly string[];
}

export interface UnsatisfiedEdgeExplanation {
  readonly edgeId: string;
  readonly kind: "task" | "gate";
  readonly status: TaskStatus | null;
  readonly sourceMilestoneId: string;
  readonly sourceReached: boolean;
}

export interface ExplanationNode {
  readonly milestoneId: string;
  readonly reached: boolean;
  readonly unsatisfiedEdges: readonly UnsatisfiedEdgeExplanation[];
  readonly children: readonly ExplanationNode[];
  readonly truncated: boolean;
}

export interface NextTask {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly classification: TaskClassification;
  readonly runnableNow: boolean;
  readonly priority: number;
  readonly owner: string | null;
  readonly blockedReason: string | null;
  readonly expected: Rational;
  readonly totalFloat: Rational;
  readonly earliestStart: Rational;
  readonly forecastExpected: Rational | null;
  readonly forecastTotalFloat: Rational | null;
  readonly forecastEarliestStart: Rational | null;
  readonly precedenceCritical: boolean;
  readonly scheduleCritical: boolean;
  readonly requirements: readonly RequirementValue[];
  readonly resourceRejections: readonly ResourceRejection[];
  readonly explanation: readonly ExplanationNode[];
}

export interface NextGroups {
  readonly active: readonly string[];
  readonly ready: readonly string[];
  readonly runnableNow: readonly string[];
  readonly blockedNow: readonly string[];
  readonly upcoming: readonly string[];
}

export interface NextOptions {
  readonly capacityOverrides?: ReadonlyMap<string, number>;
  readonly explainDepth?: number;
  readonly precision?: number;
  readonly maxDiagnostics?: number;
  readonly sourceDigest?: string;
}

export interface NextResultV3 {
  readonly ok: boolean;
  readonly document: DocumentNode;
  readonly documentId: string | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
  readonly precision: number;
  readonly durationUnit: DurationUnit | null;
  readonly velocity: Velocity | null;
  readonly velocityForecast: VelocityConversion | null;
  readonly capacityOverrides: ReadonlyMap<string, number>;
  readonly groups: NextGroups;
  readonly tasks: readonly NextTask[];
  readonly recommendation: RecommendationAnalysis | null;
}

export type NextResult = NextResultV3;

interface ClassifiedTask {
  readonly declaration: DeclarationNode;
  readonly timing: EdgeTiming;
  readonly status: TaskStatus;
  readonly classification: TaskClassification;
  readonly requirements: readonly RequirementValue[];
}

const emptyGroups: NextGroups = {
  active: [],
  ready: [],
  runnableNow: [],
  blockedNow: [],
  upcoming: [],
};

function classifyTask(status: TaskStatus, sourceReached: boolean): TaskClassification | null {
  if (status === "done") return null;
  if (status === "active") return "active";
  if (status === "planned" && sourceReached) return "ready";
  if (status === "blocked" && sourceReached) return "blocked_now";
  return "upcoming";
}

function schedulerOrder(left: ClassifiedTask, right: ClassifiedTask): number {
  const leftPriority = (fieldNamed(left.declaration, "priority")?.value ?? 0) as number;
  const rightPriority = (fieldNamed(right.declaration, "priority")?.value ?? 0) as number;
  if (leftPriority !== rightPriority) return rightPriority - leftPriority;
  const byFloat = compare(left.timing.totalFloat, right.timing.totalFloat);
  if (byFloat !== 0) return byFloat;
  const byExpected = compare(right.timing.expected, left.timing.expected);
  return byExpected !== 0
    ? byExpected
    : compareStableStrings(left.declaration.id, right.declaration.id);
}

function presentationOrder(left: ClassifiedTask, right: ClassifiedTask): number {
  const leftPriority = (fieldNamed(left.declaration, "priority")?.value ?? 0) as number;
  const rightPriority = (fieldNamed(right.declaration, "priority")?.value ?? 0) as number;
  if (leftPriority !== rightPriority) return rightPriority - leftPriority;
  if (left.timing.isCritical !== right.timing.isCritical) {
    return left.timing.isCritical ? -1 : 1;
  }
  const byFloat = compare(left.timing.totalFloat, right.timing.totalFloat);
  if (byFloat !== 0) return byFloat;
  const byEarliest = compare(left.timing.es, right.timing.es);
  return byEarliest !== 0
    ? byEarliest
    : compareStableStrings(left.declaration.id, right.declaration.id);
}

function selectRunnable(
  ready: readonly ClassifiedTask[],
  active: readonly ClassifiedTask[],
  capacities: ReadonlyMap<string, number>,
): {
  readonly selected: ReadonlySet<string>;
  readonly rejections: ReadonlyMap<string, readonly ResourceRejection[]>;
} {
  const activeUsage = new Map([...capacities.keys()].map((id) => [id, 0]));
  const activeOccupants = new Map([...capacities.keys()].map((id) => [id, [] as string[]]));
  for (const task of active) {
    for (const requirement of task.requirements) {
      activeUsage.set(
        requirement.resourceId,
        activeUsage.get(requirement.resourceId)! + requirement.units,
      );
      activeOccupants.get(requirement.resourceId)!.push(task.declaration.id);
    }
  }
  for (const occupants of activeOccupants.values()) occupants.sort(compareStableStrings);

  const selected = new Set<string>();
  const selectedUsage = new Map([...capacities.keys()].map((id) => [id, 0]));
  const selectedOccupants = new Map([...capacities.keys()].map((id) => [id, [] as string[]]));
  const rejections = new Map<string, readonly ResourceRejection[]>();
  for (const task of [...ready].sort(schedulerOrder)) {
    const rejected: ResourceRejection[] = [];
    for (const requirement of [...task.requirements].sort((left, right) =>
      compareStableStrings(left.resourceId, right.resourceId),
    )) {
      const capacity = capacities.get(requirement.resourceId)!;
      const active = activeUsage.get(requirement.resourceId)!;
      const earlier = selectedUsage.get(requirement.resourceId)!;
      const used = active + earlier;
      const available = Math.max(0, capacity - used);
      if (requirement.units > available) {
        rejected.push({
          resourceId: requirement.resourceId,
          capacity,
          activeUsage: active,
          earlierSelectedUsage: earlier,
          usedBeforeDecision: used,
          required: requirement.units,
          available,
          deficit: requirement.units - available,
          activeTaskIds: [...activeOccupants.get(requirement.resourceId)!],
          earlierSelectedTaskIds: [...selectedOccupants.get(requirement.resourceId)!],
        });
      }
    }
    if (rejected.length > 0) {
      rejections.set(task.declaration.id, rejected);
      continue;
    }
    selected.add(task.declaration.id);
    for (const requirement of task.requirements) {
      selectedUsage.set(
        requirement.resourceId,
        selectedUsage.get(requirement.resourceId)! + requirement.units,
      );
      selectedOccupants.get(requirement.resourceId)!.push(task.declaration.id);
    }
  }
  return { selected, rejections };
}

function explanationForMilestone(
  milestoneId: string,
  document: DocumentNode,
  reached: ReadonlySet<string>,
  maximumDepth: number,
  depth = 0,
  path: ReadonlySet<string> = new Set(),
): ExplanationNode {
  const incoming = document.declarations
    .filter(
      (declaration) =>
        (declaration.kind === "task" || declaration.kind === "gate") &&
        declaration.to === milestoneId,
    )
    .sort((left, right) => compareStableStrings(left.id, right.id));
  const isSatisfied = (edge: DeclarationNode): boolean =>
    reached.has(edge.from!) &&
    (edge.kind === "gate" || fieldNamed(edge, "status")?.value === "done");
  const unsatisfied = incoming.filter((edge) => !isSatisfied(edge));
  const unsatisfiedEdges: UnsatisfiedEdgeExplanation[] = unsatisfied.map((edge) => ({
    edgeId: edge.id,
    kind: edge.kind as "task" | "gate",
    status:
      edge.kind === "task"
        ? ((fieldNamed(edge, "status")?.value ?? "planned") as TaskStatus)
        : null,
    sourceMilestoneId: edge.from!,
    sourceReached: reached.has(edge.from!),
  }));
  const childIds = [...new Set(
    unsatisfied
      .map((edge) => edge.from!)
      .filter((id) => !reached.has(id) && !path.has(id)),
  )].sort(compareStableStrings);
  const nextPath = new Set(path);
  nextPath.add(milestoneId);
  const children =
    depth >= maximumDepth
      ? []
      : childIds.map((id) =>
          explanationForMilestone(id, document, reached, maximumDepth, depth + 1, nextPath),
        );
  return {
    milestoneId,
    reached: reached.has(milestoneId),
    unsatisfiedEdges,
    children,
    truncated: depth >= maximumDepth && childIds.length > 0,
  };
}

export function selectNextTasks(
  text: string,
  options: NextOptions = {},
): NextResultV3 {
  const precision = options.precision ?? 3;
  const explainDepth = options.explainDepth ?? 1;
  const capacityOverrides = options.capacityOverrides ?? new Map<string, number>();
  const sourceDigest = options.sourceDigest ??
    `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
  const analysis = analyzeDocument(text, {
    mode: "both",
    capacityOverrides,
    precision,
    maxPaths: 0,
    ...(options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics }),
  });
  const diagnostics = analysis.diagnostics.filter((diagnostic) => diagnostic.code !== "PTDAG-302");
  if (!analysis.ok || analysis.precedence === null || analysis.resource === null) {
    return {
      ok: false,
      document: analysis.document,
      documentId: analysis.documentId,
      diagnostics: sortDiagnostics(diagnostics),
      diagnosticsTruncated: analysis.diagnosticsTruncated,
      precision,
      durationUnit: analysis.durationUnit,
      velocity: analysis.velocity,
      velocityForecast: analysis.velocityForecast,
      capacityOverrides,
      groups: emptyGroups,
      tasks: [],
      recommendation: null,
    };
  }
  const graph = buildResidualGraph(analysis.document);
  let recommendation: RecommendationAnalysis;
  try {
    const ranking = rankRecommendationCandidates({
      graph,
      precedence: analysis.precedence,
      appliedCapacities: capacityOverrides,
    });
    const explanation = buildRecommendationExplanation({
      graph,
      ranking,
      sourceDigest,
    });
    if (!explanation.ok) {
      return {
        ok: false,
        document: analysis.document,
        documentId: analysis.documentId,
        diagnostics: sortDiagnostics([...diagnostics, ...explanation.diagnostics]),
        diagnosticsTruncated: analysis.diagnosticsTruncated,
        precision,
        durationUnit: graph.durationUnit,
        velocity: graph.velocity,
        velocityForecast: analysis.velocityForecast,
        capacityOverrides,
        groups: emptyGroups,
        tasks: [],
        recommendation: null,
      };
    }
    recommendation = explanation.analysis;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      document: analysis.document,
      documentId: analysis.documentId,
      diagnostics: sortDiagnostics([
        ...diagnostics,
        {
          code: "PTREC-301",
          severity: "error",
          message: `recommendation ranking invariant failure: ${message}`,
        },
      ]),
      diagnosticsTruncated: analysis.diagnosticsTruncated,
      precision,
      durationUnit: graph.durationUnit,
      velocity: graph.velocity,
      velocityForecast: analysis.velocityForecast,
      capacityOverrides,
      groups: emptyGroups,
      tasks: [],
      recommendation: null,
    };
  }
  const timingById = new Map(analysis.precedence.edges.map((timing) => [timing.id, timing]));
  const classified: ClassifiedTask[] = analysis.document.declarations
    .filter((declaration) => declaration.kind === "task")
    .flatMap((declaration) => {
      const status = (fieldNamed(declaration, "status")?.value ?? "planned") as TaskStatus;
      const classification = classifyTask(status, graph.effectiveReached.has(declaration.from!));
      if (classification === null) return [];
      const timing = timingById.get(declaration.id);
      if (timing === undefined) throw new Error(`unfinished task ${declaration.id} is absent from residual analysis`);
      return [{
        declaration,
        timing,
        status,
        classification,
        requirements: [...((fieldNamed(declaration, "requires")?.value ?? []) as readonly RequirementValue[])]
          .sort((left, right) => compareStableStrings(left.resourceId, right.resourceId)),
      }];
    });
  const ready = classified.filter((task) => task.classification === "ready");
  const active = classified.filter((task) => task.classification === "active");
  const capacities = new Map(
    analysis.resource.capacities.map((capacity) => [capacity.id, capacity.effective]),
  );
  const runnable = selectRunnable(ready, active, capacities);
  const scheduleCritical = new Set(analysis.resource.scheduleCritical.taskIds);
  const ordered = [...classified].sort(presentationOrder);
  const tasks: NextTask[] = ordered.map((task) => ({
    id: task.declaration.id,
    title: fieldNamed(task.declaration, "title")!.value as string,
    status: task.status,
    classification: task.classification,
    runnableNow: runnable.selected.has(task.declaration.id),
    priority: (fieldNamed(task.declaration, "priority")?.value ?? 0) as number,
    owner: (fieldNamed(task.declaration, "owner")?.value as string | undefined) ?? null,
    blockedReason:
      (fieldNamed(task.declaration, "blocked_reason")?.value as string | undefined) ?? null,
    expected: task.timing.expected,
    totalFloat: task.timing.totalFloat,
    earliestStart: task.timing.es,
    forecastExpected:
      analysis.velocityForecast === null
        ? null
        : convertWithVelocity(task.timing.expected, analysis.velocityForecast),
    forecastTotalFloat:
      analysis.velocityForecast === null
        ? null
        : convertWithVelocity(task.timing.totalFloat, analysis.velocityForecast),
    forecastEarliestStart:
      analysis.velocityForecast === null
        ? null
        : convertWithVelocity(task.timing.es, analysis.velocityForecast),
    precedenceCritical: task.timing.isCritical,
    scheduleCritical: scheduleCritical.has(task.declaration.id),
    requirements: task.requirements,
    resourceRejections: runnable.rejections.get(task.declaration.id) ?? [],
    explanation:
      task.classification === "upcoming"
        ? [
            explanationForMilestone(
              task.declaration.from!,
              analysis.document,
              graph.effectiveReached,
              explainDepth,
            ),
          ]
        : [],
  }));
  const ids = (classification: TaskClassification): readonly string[] =>
    tasks.filter((task) => task.classification === classification).map((task) => task.id);
  return {
    ok: !hasErrors(diagnostics),
    document: analysis.document,
    documentId: analysis.documentId,
    diagnostics: sortDiagnostics(diagnostics),
    diagnosticsTruncated: analysis.diagnosticsTruncated,
    precision,
    durationUnit: graph.durationUnit,
    velocity: graph.velocity,
    velocityForecast: analysis.velocityForecast,
    capacityOverrides,
    groups: {
      active: ids("active"),
      ready: ids("ready"),
      runnableNow: tasks.filter((task) => task.runnableNow).map((task) => task.id),
      blockedNow: ids("blocked_now"),
      upcoming: ids("upcoming"),
    },
    tasks,
    recommendation,
  };
}
