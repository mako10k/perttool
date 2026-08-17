import { compareStableStrings } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import { ZERO, compare, maximum, subtract } from "../model/rational.js";
import {
  addCalendarWorkingTime,
  subtractCalendarWorkingTime,
  TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY,
} from "./scheduler.js";
import type {
  CalendarScheduleCause,
  CalendarSchedulerInput,
  ScheduledMilestone,
  ScheduledTask,
  SchedulerTaskInput,
  WorkSegment,
} from "./scheduler-types.js";
import { temporalScheduleGraph, type TemporalScheduleGraph } from "./schedule-graph.js";
import { parseTemporalScheduleSource, temporalScheduleSourceModel, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "./source.js";
import type { EventBoundSource, TemporalScheduleSourceResult } from "./source-types.js";
import type {
  TemporalConstraintCapability,
  TemporalConstraintMigrationResult,
  TemporalConstraintProfile,
  TemporalConstraintResult,
  TemporalConstraintViolation,
} from "./constraint-types.js";

export const TEMPORAL_CONSTRAINT_CAPABILITY: TemporalConstraintCapability = Object.freeze({
  id: "perttool.target-grammar-8-temporal-constraints",
  version: 1,
});

const IDENTITY = Object.freeze({
  id: "perttool.temporal-precedence-earliest" as const,
  version: 2 as const,
  optimal: null,
});

function bound(
  values: readonly EventBoundSource[],
  entityId: string,
  event: "start" | "finish" | "reach",
  direction: "earliest" | "latest",
): Rational | null {
  return values.find((value) => value.entityId === entityId && value.event === event && value.direction === direction)
    ?.value.instantSeconds ?? null;
}

function unavailable(causes: readonly CalendarScheduleCause[]): TemporalConstraintProfile {
  return Object.freeze({
    state: "unavailable",
    algorithm: IDENTITY,
    tasks: Object.freeze([]),
    milestones: Object.freeze([]),
    violations: Object.freeze([]),
    unavailableCauses: Object.freeze(causes),
  });
}

function taskRecord(
  edge: SchedulerTaskInput,
  start: Rational,
  finish: Rational,
  segments: readonly WorkSegment[],
  eligible: Rational,
): ScheduledTask {
  const remaining = edge.status === "done" ? ZERO : edge.remainingWorkSeconds ?? edge.expectedWorkSeconds;
  return Object.freeze({
    id: edge.id,
    status: edge.status,
    expectedWorkSeconds: edge.expectedWorkSeconds,
    remainingWorkSeconds: remaining,
    start,
    finish,
    segments: Object.freeze([...segments]),
    requirements: Object.freeze([...edge.requirements]),
    resourceWaitSeconds: subtract(start, eligible),
    conditionalBlocked: edge.status === "blocked",
  });
}

function violation(
  entityKind: "task" | "milestone",
  entityId: string,
  event: "start" | "finish" | "reach",
  required: Rational | null,
  projected: Rational,
): TemporalConstraintViolation | null {
  if (required === null || compare(projected, required) <= 0) return null;
  return Object.freeze({
    entityKind,
    entityId,
    event,
    bound: "latest",
    required,
    projected,
    signedSlackSeconds: subtract(required, projected),
  });
}

interface AnalysisState {
  readonly source: TemporalScheduleSourceResult;
  readonly input: CalendarSchedulerInput;
  readonly model: ReturnType<typeof temporalScheduleSourceModel>;
  readonly graph: TemporalScheduleGraph;
  readonly reached: Map<string, Rational>;
  readonly satisfied: Map<string, Rational>;
  readonly tasks: ScheduledTask[];
  readonly violations: TemporalConstraintViolation[];
}

function milestoneReach(state: AnalysisState, milestoneId: string): Rational | null {
  const existing = state.reached.get(milestoneId);
  if (existing !== undefined) return existing;
  const values = state.graph.incoming.get(milestoneId)!.map((edge) => state.satisfied.get(edge.id));
  const complete = values.filter((value): value is Rational => value !== undefined);
  if (values.length === 0 || complete.length !== values.length) return null;
  return complete.reduce((result, value) => maximum(result, value), state.input.asOf);
}

function constrainedWork(
  state: AnalysisState,
  edge: SchedulerTaskInput,
  eligible: Rational,
  work: Rational,
): ReturnType<typeof addCalendarWorkingTime> {
  let projected = addCalendarWorkingTime(state.source, edge.requirements, state.input.resources, eligible, work,
    state.input.horizonEnd, TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY, state.input.capacityOverrides);
  const finishEarliest = bound(state.model.taskBounds, edge.id, "finish", "earliest");
  if (projected.state !== "available" || finishEarliest === null || compare(projected.value!, finishEarliest) >= 0) {
    return projected;
  }
  const delayedStart = subtractCalendarWorkingTime(state.source, edge.requirements, state.input.resources,
    finishEarliest, work, state.input.asOf, TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY,
    state.input.capacityOverrides);
  if (delayedStart.state === "unavailable") return delayedStart;
  const constrainedStart = maximum(eligible, delayedStart.value!);
  projected = addCalendarWorkingTime(state.source, edge.requirements, state.input.resources,
    constrainedStart, work, state.input.horizonEnd, TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY,
    state.input.capacityOverrides);
  return projected;
}

function appendTaskViolations(
  state: AnalysisState,
  edge: SchedulerTaskInput,
  record: ScheduledTask,
): void {
  const candidates = [
    violation("task", edge.id, "start", bound(state.model.taskBounds, edge.id, "start", "latest"), record.start),
    violation("task", edge.id, "finish", bound(state.model.taskBounds, edge.id, "finish", "latest"), record.finish),
  ];
  state.violations.push(...candidates.filter((value): value is TemporalConstraintViolation => value !== null));
}

function projectTask(
  state: AnalysisState,
  edge: SchedulerTaskInput,
  reach: Rational,
): readonly CalendarScheduleCause[] {
  if (edge.status === "done") {
    state.satisfied.set(edge.id, state.input.asOf);
    state.tasks.push(taskRecord(edge, state.input.asOf, state.input.asOf, [], state.input.asOf));
    return Object.freeze([]);
  }
  const startEarliest = bound(state.model.taskBounds, edge.id, "start", "earliest");
  const eligible = maximum(reach, edge.status === "active" ? state.input.asOf : startEarliest ?? reach);
  const work = edge.status === "active" ? edge.remainingWorkSeconds ?? edge.expectedWorkSeconds : edge.expectedWorkSeconds;
  const projected = constrainedWork(state, edge, eligible, work);
  if (projected.state === "unavailable") return projected.unavailableCauses;
  const record = taskRecord(edge, projected.segments[0]!.start, projected.value!, projected.segments, eligible);
  state.tasks.push(record);
  state.satisfied.set(edge.id, record.finish);
  appendTaskViolations(state, edge, record);
  return Object.freeze([]);
}

function projectMilestone(
  state: AnalysisState,
  milestoneId: string,
): readonly CalendarScheduleCause[] {
  const base = milestoneReach(state, milestoneId);
  if (base === null) return Object.freeze([]);
  const earliest = bound(state.model.milestoneBounds, milestoneId, "reach", "earliest");
  const reach = earliest === null ? base : maximum(base, earliest);
  state.reached.set(milestoneId, reach);
  const latestViolation = violation("milestone", milestoneId, "reach",
    bound(state.model.milestoneBounds, milestoneId, "reach", "latest"), reach);
  if (latestViolation !== null) state.violations.push(latestViolation);
  for (const edge of state.graph.outgoing.get(milestoneId)!) {
    if (edge.kind === "gate") state.satisfied.set(edge.id, reach);
    else {
      const causes = projectTask(state, edge, reach);
      if (causes.length > 0) return causes;
    }
  }
  return Object.freeze([]);
}

function analyze(
  source: TemporalScheduleSourceResult,
  input: CalendarSchedulerInput,
): TemporalConstraintProfile {
  const model = temporalScheduleSourceModel(source);
  if (model.profile.kind === "continuous_fixed_offset") {
    return Object.freeze({
      state: "not_applicable",
      algorithm: IDENTITY,
      tasks: Object.freeze([]),
      milestones: Object.freeze([]),
      violations: Object.freeze([]),
      unavailableCauses: Object.freeze([]),
    });
  }
  if (model.documentId !== input.documentId || model.asOf === null || compare(model.asOf.instantSeconds, input.asOf) !== 0) {
    throw new TypeError("temporal constraint input does not match the source");
  }
  const indexed = temporalScheduleGraph(input);
  const state: AnalysisState = {
    source, input, model, graph: indexed,
    reached: new Map(input.frontierMilestoneIds.map((id) => [id, input.asOf])),
    satisfied: new Map(), tasks: [], violations: [],
  };
  for (const milestoneId of indexed.order) {
    const causes = projectMilestone(state, milestoneId);
    if (causes.length > 0) return unavailable(causes);
  }
  return Object.freeze({
    state: state.violations.length === 0 ? "available" : "infeasible",
    algorithm: IDENTITY,
    tasks: Object.freeze(state.tasks),
    milestones: Object.freeze(indexed.order.flatMap((id): ScheduledMilestone[] => {
      const reach = state.reached.get(id);
      return reach === undefined ? [] : [Object.freeze({ id, reach })];
    })),
    violations: Object.freeze(state.violations),
    unavailableCauses: Object.freeze([]),
  });
}

export function analyzeTemporalConstraints(
  source: TemporalScheduleSourceResult,
  input: CalendarSchedulerInput,
  capability: TemporalConstraintCapability,
): TemporalConstraintResult {
  if (capability !== TEMPORAL_CONSTRAINT_CAPABILITY) throw new TypeError("the temporal constraint capability is required");
  const model = temporalScheduleSourceModel(source);
  return Object.freeze({ modelVersion: 1, documentId: model.documentId, source, input, precedence: analyze(source, input) });
}

export function planTemporalConstraintMigration(
  text: string,
  capability: TemporalConstraintCapability,
): TemporalConstraintMigrationResult {
  if (capability !== TEMPORAL_CONSTRAINT_CAPABILITY) throw new TypeError("the temporal constraint capability is required");
  const original = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  if (!original.ok || original.grammarVersion === null) {
    return Object.freeze({ ok: false, changed: false, sourceGrammarVersion: original.grammarVersion,
      targetGrammarVersion: null, updatedText: null, migratedTaskIds: Object.freeze([]), requiredAction: null, source: original });
  }
  if (original.grammarVersion === 8) {
    return Object.freeze({ ok: true, changed: false, sourceGrammarVersion: 8, targetGrammarVersion: 8,
      updatedText: text, migratedTaskIds: Object.freeze([]), requiredAction: null, source: original });
  }
  if (original.grammarVersion !== 7) {
    return Object.freeze({ ok: false, changed: false, sourceGrammarVersion: original.grammarVersion,
      targetGrammarVersion: null, updatedText: null, migratedTaskIds: Object.freeze([]), requiredAction: null, source: original });
  }
  const assuranceEnabled = /^  plan_assurance_model /mu.test(text) || /^  plan_assurance_hash_model /mu.test(text);
  if (assuranceEnabled) {
    return Object.freeze({ ok: false, changed: false, sourceGrammarVersion: 7, targetGrammarVersion: null,
      updatedText: null, migratedTaskIds: Object.freeze([]), requiredAction: "initialize_plan_assurance_hash_model_2", source: original });
  }
  const migratedTaskIds: string[] = [];
  let currentTask: string | null = null;
  let changed = false;
  const updatedText = text.split(/(?<=\n)/u).map((line) => {
    const declaration = /^task ([A-Za-z][A-Za-z0-9_-]*)\b/u.exec(line);
    if (declaration !== null) currentTask = declaration[1]!;
    else if (/^[a-z_]+ |^milestone |^resource |^calendar |^gate |^project /u.test(line)) currentTask = null;
    if (/^  version 7\s*$/u.test(line.trimEnd())) {
      changed = true;
      return line.replace("version 7", "version 8");
    }
    const legacy = /^(  )not_before (\S+)(\r?\n)?$/u.exec(line);
    if (legacy === null) return line;
    changed = true;
    if (currentTask !== null) migratedTaskIds.push(currentTask);
    return `${legacy[1]}when start earliest ${legacy[2]}${legacy[3] ?? ""}`;
  }).join("");
  const source = parseTemporalScheduleSource(updatedText, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  return Object.freeze({
    ok: source.ok && source.model !== null,
    changed,
    sourceGrammarVersion: 7,
    targetGrammarVersion: source.ok && source.model !== null ? 8 : null,
    updatedText: source.ok && source.model !== null ? updatedText : null,
    migratedTaskIds: Object.freeze([...new Set(migratedTaskIds)].sort(compareStableStrings)),
    requiredAction: null,
    source,
  });
}
