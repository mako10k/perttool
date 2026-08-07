import { buildResidualGraph } from "../analysis/graph.js";
import { formatDecimal, type Rational } from "../model/rational.js";
import { fieldNamed, type DocumentNode } from "../model/syntax.js";
import {
  convertWithVelocity,
  type CalendarUnit,
  type DurationUnit,
} from "../model/units.js";
import {
  analyzeDocument,
  selectNextTasks,
} from "./contract7-assurance.js";

export interface EditorDagExactValueV1 {
  readonly numerator: string;
  readonly denominator: string;
  readonly unit: DurationUnit;
  readonly display: string;
}

export interface EditorDagDisplayEntityV1 {
  readonly kind: "milestone" | "task" | "gate";
  readonly id: string;
  readonly compactId: string;
  readonly title: string;
  readonly description: string | null;
}

export interface EditorDagTaskTimeV1 {
  readonly taskId: string;
  readonly taskTime: EditorDagExactValueV1;
  readonly pointForecast: EditorDagExactValueV1 | null;
}

export interface EditorDagTimeSummaryV1 {
  readonly residualTime: EditorDagExactValueV1;
  readonly remainingTime: EditorDagExactValueV1;
  readonly taskTimes: readonly EditorDagTaskTimeV1[];
  readonly pointConversion: {
    readonly status: "available" | "unavailable" | "not_applicable";
    readonly targetUnit: CalendarUnit | null;
    readonly residualTime: EditorDagExactValueV1 | null;
    readonly remainingTime: EditorDagExactValueV1 | null;
    readonly reason: string | null;
  };
}

export interface EditorDagFocusProjectionV1 {
  readonly frontierMilestoneIds: readonly string[];
  readonly activeTaskIds: readonly string[];
  readonly readyTaskIds: readonly string[];
  readonly recommendedTaskIds: readonly string[];
  readonly startableTaskIds: readonly string[];
  readonly safeStopReasons: readonly string[];
  readonly entities: readonly EditorDagDisplayEntityV1[];
  readonly timeSummary: EditorDagTimeSummaryV1;
}

export interface EditorDagFocusInspectionV1 {
  readonly status: "current" | "unavailable";
  readonly reason: string | null;
  readonly focus: EditorDagFocusProjectionV1 | null;
}

function unavailable(reason: string): EditorDagFocusInspectionV1 {
  return Object.freeze({ status: "unavailable", reason, focus: null });
}

function exactValue(
  value: Rational,
  unit: DurationUnit,
  precision: number,
): EditorDagExactValueV1 {
  return Object.freeze({
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
    unit,
    display: formatDecimal(value, precision),
  });
}

function compactEntities(
  document: DocumentNode,
  residual: ReturnType<typeof buildResidualGraph>,
): readonly EditorDagDisplayEntityV1[] {
  const residualEdgeIds = new Set(residual.edges.map(({ id }) => id));
  const declarations = document.declarations.filter((declaration) =>
    (declaration.kind === "milestone" && residual.vertices.has(declaration.id)) ||
    ((declaration.kind === "task" || declaration.kind === "gate") &&
      residualEdgeIds.has(declaration.id))
  );
  const totals = {
    milestone: declarations.filter(({ kind }) => kind === "milestone").length,
    task: declarations.filter(({ kind }) => kind === "task").length,
    gate: declarations.filter(({ kind }) => kind === "gate").length,
  };
  const ordinals = { milestone: 0, task: 0, gate: 0 };
  const prefixes = { milestone: "M", task: "T", gate: "G" } as const;
  return Object.freeze(declarations.map((declaration) => {
    const kind = declaration.kind as "milestone" | "task" | "gate";
    const ordinal = ++ordinals[kind];
    const width = Math.max(2, String(totals[kind]).length);
    const title = fieldNamed(declaration, "title")?.value ??
      fieldNamed(declaration, "reason")?.value ?? declaration.id;
    const description = fieldNamed(declaration, "description")?.value;
    return Object.freeze({
      kind,
      id: declaration.id,
      compactId: `${prefixes[kind]}${String(ordinal).padStart(width, "0")}`,
      title: typeof title === "string" ? title : declaration.id,
      description: typeof description === "string" ? description : null,
    });
  }));
}

/**
 * Projects the current planning frontier and exact NextResult.v6 start authority
 * for read-only editor presentation. Layout remains an adapter concern.
 */
export function inspectEditorDagFocus(
  text: string,
  expectedSourceDigest: `sha256:${string}`,
): EditorDagFocusInspectionV1 {
  const next = selectNextTasks(text, { sourceDigest: expectedSourceDigest });
  const analysis = analyzeDocument(text, { mode: "both" });
  if (
    !next.ok ||
    next.recommendation === null ||
    next.temporal === null ||
    next.assurance === null ||
    !next.temporal.authority.complete ||
    next.diagnosticsTruncated ||
    !analysis.ok ||
    analysis.precedence === null ||
    analysis.resource === null ||
    analysis.durationUnit === null ||
    analysis.diagnosticsTruncated
  ) {
    return unavailable(
      "Complete NextResult.v6 start authority and exact DAG time summaries are unavailable.",
    );
  }
  const residual = buildResidualGraph(next.document as unknown as DocumentNode);
  const frontier = residual.topologicalOrder.filter((milestoneId) =>
    residual.effectiveReached.has(milestoneId) &&
    (residual.outgoing.get(milestoneId) ?? []).some((edge) =>
      edge.status !== "done" && !residual.effectiveReached.has(edge.target)
    )
  );
  if (frontier.length === 0 && residual.effectiveReached.has(residual.finish)) {
    frontier.push(residual.finish);
  }
  const durationUnit = analysis.durationUnit;
  const residualTime = exactValue(
    analysis.precedence.makespan,
    durationUnit,
    analysis.precision,
  );
  const remainingTime = exactValue(
    analysis.resource.makespan,
    durationUnit,
    analysis.precision,
  );
  const pointConversion = durationUnit !== "point"
    ? Object.freeze({
        status: "not_applicable" as const,
        targetUnit: null,
        residualTime: null,
        remainingTime: null,
        reason: null,
      })
    : next.velocityForecast === null
      ? Object.freeze({
          status: "unavailable" as const,
          targetUnit: null,
          residualTime: null,
          remainingTime: null,
          reason: "Point conversion is unavailable because no exact project velocity is declared.",
        })
      : Object.freeze({
          status: "available" as const,
          targetUnit: next.velocityForecast.targetUnit as CalendarUnit,
          residualTime: exactValue(
            convertWithVelocity(analysis.precedence.makespan, next.velocityForecast),
            next.velocityForecast.targetUnit,
            analysis.precision,
          ),
          remainingTime: exactValue(
            convertWithVelocity(analysis.resource.makespan, next.velocityForecast),
            next.velocityForecast.targetUnit,
            analysis.precision,
          ),
          reason: null,
        });
  const taskTimes = Object.freeze(next.tasks.map((task) =>
    Object.freeze({
      taskId: task.id,
      taskTime: exactValue(task.expected, durationUnit, analysis.precision),
      pointForecast:
        durationUnit === "point" &&
          next.velocityForecast !== null &&
          task.forecastExpected !== null
          ? exactValue(
              task.forecastExpected,
              next.velocityForecast.targetUnit,
              analysis.precision,
            )
          : null,
    })
  ));
  return Object.freeze({
    status: "current",
    reason: null,
    focus: Object.freeze({
      frontierMilestoneIds: Object.freeze(frontier),
      activeTaskIds: Object.freeze([...next.groups.active]),
      readyTaskIds: Object.freeze([...next.groups.ready]),
      recommendedTaskIds: Object.freeze([
        ...next.recommendation.recommendedTaskIds,
      ]),
      startableTaskIds: Object.freeze([
        ...next.temporal.authority.startableRecommendedTaskIds,
      ]),
      safeStopReasons: Object.freeze([
        ...next.temporal.authority.safeStopReasons,
      ]),
      entities: compactEntities(next.document as unknown as DocumentNode, residual),
      timeSummary: Object.freeze({
        residualTime,
        remainingTime,
        taskTimes,
        pointConversion,
      }),
    }),
  });
}
