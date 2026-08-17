import { buildResidualGraph } from "../analysis/graph.js";
import { fieldNamed, type DocumentNode, type TargetDeclarationKind } from "../model/syntax.js";
import { parseDeclaredCalendarValue } from "../model/calendar.js";
import { add, divide, multiply, rational, type Rational } from "../model/rational.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { analyzeTemporalConstraints, TEMPORAL_CONSTRAINT_CAPABILITY } from "../temporal-schedule/constraint.js";
import { analyzeRequiredSchedule, REQUIRED_SCHEDULE_CAPABILITY } from "../temporal-schedule/required.js";
import { analyzeCalendarSchedule, TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY } from "../temporal-schedule/scheduler.js";
import { evaluateScheduleAlerts, SCHEDULE_ALERT_CAPABILITY } from "../temporal-schedule/alert.js";
import type { ScheduleAlertEventState, ScheduleAlertTarget } from "../temporal-schedule/alert-types.js";
import type { CalendarSchedulerInput } from "../temporal-schedule/scheduler-types.js";
import { parseTemporalScheduleSource, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../temporal-schedule/source.js";
import type { TemporalScheduleSourceResult } from "../temporal-schedule/source-types.js";

export type Contract9DriverLevel = "none" | "compact" | "full";

function instant(value: ReturnType<typeof parseDeclaredCalendarValue>): Rational | null {
  if (value === undefined || value.kind === "date") return null;
  const whole = Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, 0) / 1000
    - value.offsetMinutes * 60;
  return add(rational(BigInt(whole)), value.second);
}

function workSeconds(expected: Rational, graph: ReturnType<typeof buildResidualGraph>, source: TemporalScheduleSourceResult): Rational | null {
  if (graph.durationUnit === "hour") return multiply(expected, rational(3600n));
  const model = source.model!;
  const workday = model.profile.kind === "named_zone" ? model.profile.workdayHours : null;
  if (graph.durationUnit === "day") return workday === null ? null : multiply(multiply(expected, workday), rational(3600n));
  if (graph.velocity === null) return null;
  const periodSeconds = graph.velocity.periodUnit === "hour"
    ? multiply(graph.velocity.period, rational(3600n))
    : workday === null ? null : multiply(multiply(graph.velocity.period, workday), rational(3600n));
  return periodSeconds === null ? null : multiply(divide(expected, graph.velocity.points), periodSeconds);
}

function schedulerInput(
  document: DocumentNode<TargetDeclarationKind>,
  source: TemporalScheduleSourceResult,
  capacityOverrides: ReadonlyMap<string, number>,
): CalendarSchedulerInput | null {
  const graph = buildResidualGraph(document as DocumentNode);
  const asOf = source.model?.asOf?.instantSeconds;
  if (asOf === undefined) return null;
  const edges = graph.edges.map((edge) => {
    if (edge.kind === "gate") return Object.freeze({ kind: "gate" as const, id: edge.id, source: edge.source, target: edge.target });
    const expectedWorkSeconds = workSeconds(edge.expected, graph, source);
    return expectedWorkSeconds === null ? null : Object.freeze({
      kind: "task" as const, id: edge.id, source: edge.source, target: edge.target,
      status: edge.status!, expectedWorkSeconds, priority: edge.priority, totalFloat: rational(0n),
      requirements: Object.freeze(edge.requirements.map(({ resourceId, units }) => Object.freeze({ resourceId, units }))),
    });
  });
  if (edges.some((edge) => edge === null)) return null;
  return Object.freeze({
    documentId: source.documentId!, asOf, horizonEnd: rational(4102444800n), finishMilestoneId: graph.finish,
    frontierMilestoneIds: Object.freeze([...graph.frontier]), milestoneIds: Object.freeze([...graph.vertices.keys()]),
    resources: Object.freeze([...graph.resources.values()].map(({ id, capacity }) => Object.freeze({ id, capacity }))),
    edges: Object.freeze(edges as NonNullable<(typeof edges)[number]>[]), capacityOverrides,
  });
}

function targets(document: DocumentNode<TargetDeclarationKind>, source: TemporalScheduleSourceResult): readonly ScheduleAlertTarget[] {
  const result: ScheduleAlertTarget[] = [];
  for (const declaration of document.declarations) {
    if (declaration.kind !== "task" && declaration.kind !== "milestone") continue;
    const deadline = fieldNamed(declaration, "deadline");
    if (deadline !== undefined) {
      const parsed = typeof deadline.value === "string" ? parseDeclaredCalendarValue(deadline.value) : deadline.value as ReturnType<typeof parseDeclaredCalendarValue>;
      result.push(Object.freeze({
        subjectKind: declaration.kind, subjectId: declaration.id,
        event: declaration.kind === "task" ? "finish" : "reach", targetKind: "deadline",
        temporalKind: parsed?.kind === "date_time" ? "instant" : "date", instant: instant(parsed),
        sourceText: parsed?.sourceText ?? "", sourceRange: deadline.valueSpan,
      }));
    }
  }
  for (const bound of [...source.model!.taskBounds, ...source.model!.milestoneBounds]) {
    if (bound.direction !== "latest") continue;
    result.push(Object.freeze({
      subjectKind: bound.entityKind, subjectId: bound.entityId, event: bound.event,
      targetKind: "latest", temporalKind: "instant", instant: bound.value.instantSeconds,
      sourceText: bound.value.sourceText, sourceRange: bound.span,
    }));
  }
  return Object.freeze(result);
}

function eventStates(document: DocumentNode<TargetDeclarationKind>): readonly ScheduleAlertEventState[] {
  const graph = buildResidualGraph(document as DocumentNode);
  const result: ScheduleAlertEventState[] = [];
  for (const declaration of document.declarations) {
    if (declaration.kind === "task") {
      const status = (fieldNamed(declaration, "status")?.value ?? "planned") as string;
      result.push(Object.freeze({ subjectKind: "task", subjectId: declaration.id, event: "start",
        complete: status === "active" || status === "done", actualInstant: null }));
      result.push(Object.freeze({ subjectKind: "task", subjectId: declaration.id, event: "finish",
        complete: status === "done", actualInstant: null }));
    } else if (declaration.kind === "milestone") {
      result.push(Object.freeze({ subjectKind: "milestone", subjectId: declaration.id, event: "reach",
        complete: graph.effectiveReached.has(declaration.id), actualInstant: null }));
    }
  }
  return Object.freeze(result);
}

export function composeContract9TemporalContext(
  text: string,
  document: DocumentNode<TargetDeclarationKind>,
  operand: string,
  driverLevel: Contract9DriverLevel,
  capacityOverrides: ReadonlyMap<string, number> = new Map(),
) {
  const source = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  if (!source.ok || source.model === null || source.grammarVersion !== 8) return Object.freeze({ source, scheduler: null, required: null, alerts: null });
  const schedule = schedulerInput(document, source, capacityOverrides);
  if (schedule === null) return Object.freeze({ source, scheduler: null, required: null, alerts: null });
  const scheduler = analyzeCalendarSchedule(source, schedule, TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  const constraints = analyzeTemporalConstraints(source, schedule, TEMPORAL_CONSTRAINT_CAPABILITY);
  const graph = buildResidualGraph(document as DocumentNode);
  const finishDeclaration = document.declarations.find(({ kind, id }) => kind === "milestone" && id === graph.finish);
  const deadlineField = finishDeclaration === undefined ? undefined : fieldNamed(finishDeclaration, "deadline");
  const deadlineValue = deadlineField === undefined ? undefined
    : typeof deadlineField.value === "string" ? parseDeclaredCalendarValue(deadlineField.value)
      : deadlineField.value as ReturnType<typeof parseDeclaredCalendarValue>;
  const required = analyzeRequiredSchedule(source, {
    schedule, horizonStart: rational(0n), finishDeadline: instant(deadlineValue),
    precedenceForward: constraints.precedence, resourceForward: scheduler.resource,
  }, REQUIRED_SCHEDULE_CAPABILITY);
  const alerts = evaluateScheduleAlerts({
    source, sourceDigest: sha256DigestUtf8(text), operand, schedule, targets: targets(document, source),
    eventStates: eventStates(document), precedenceForward: constraints.precedence,
    resourceForward: scheduler.resource, requiredSchedule: required, driverLevel,
  }, SCHEDULE_ALERT_CAPABILITY);
  return Object.freeze({ source, scheduler, required, alerts });
}
