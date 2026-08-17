import { compareStableStrings } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import { compare, minimum, subtract } from "../model/rational.js";
import {
  addCalendarWorkingTime,
  subtractCalendarWorkingTime,
  TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY,
} from "./scheduler.js";
import type { CalendarScheduleProfile, SchedulerTaskInput } from "./scheduler-types.js";
import type { TemporalConstraintProfile } from "./constraint-types.js";
import { temporalScheduleGraph, type TemporalScheduleGraph } from "./schedule-graph.js";
import { temporalScheduleSourceModel } from "./source.js";
import type { EventBoundSource, TemporalScheduleSourceResult } from "./source-types.js";
import type {
  RequiredAnchor,
  RequiredEventComparison,
  RequiredForwardComparison,
  RequiredMilestone,
  RequiredScheduleCapability,
  RequiredScheduleCause,
  RequiredScheduleInput,
  RequiredScheduleResult,
  RequiredTask,
} from "./required-types.js";

export const REQUIRED_SCHEDULE_CAPABILITY: RequiredScheduleCapability = Object.freeze({
  id: "perttool.required-precedence-backward",
  version: 1,
});

const ALGORITHM = Object.freeze({
  id: "perttool.required-precedence-backward" as const,
  version: 1 as const,
  optimal: null,
});

function latest(
  bounds: readonly EventBoundSource[], entityId: string, event: "start" | "finish" | "reach",
): Rational | null {
  return bounds.find((item) => item.entityId === entityId && item.event === event && item.direction === "latest")
    ?.value.instantSeconds ?? null;
}

function selectAnchor(
  latestBound: Rational | null,
  deadline: Rational | null,
): RequiredAnchor | null {
  if (latestBound === null && deadline === null) return null;
  if (latestBound === null) return Object.freeze({ source: "advisory_deadline", instant: deadline! });
  if (deadline === null) return Object.freeze({ source: "latest_bound", instant: latestBound });
  const ordering = compare(latestBound, deadline);
  let source: RequiredAnchor["source"] = "advisory_deadline";
  if (ordering === 0) source = "coincident";
  if (ordering < 0) source = "latest_bound";
  return Object.freeze({ source, instant: minimum(latestBound, deadline) });
}

function emptyComparison(): RequiredForwardComparison {
  return Object.freeze({
    state: "unavailable", classification: null, optimal: null, events: Object.freeze([]),
  });
}

function emptyResult(
  documentId: string,
  source: TemporalScheduleSourceResult,
  state: "absent" | "unavailable" | "not_applicable",
  cause: RequiredScheduleCause | null,
): RequiredScheduleResult {
  return Object.freeze({
    modelVersion: 1, documentId, source, state, algorithm: ALGORITHM, anchor: null,
    tasks: Object.freeze([]), milestones: Object.freeze([]),
    precedenceComparison: emptyComparison(), resourceComparison: emptyComparison(),
    unavailableCauses: cause === null ? Object.freeze([]) : Object.freeze([cause]),
  });
}

function setEarlier(
  values: Map<string, Rational>, drivers: Map<string, string[]>, id: string, value: Rational, driver: string,
): void {
  const existing = values.get(id);
  if (existing === undefined || compare(value, existing) < 0) {
    values.set(id, value);
    drivers.set(id, [driver]);
  } else if (compare(value, existing) === 0) {
    const merged = new Set([...(drivers.get(id) ?? []), driver]);
    drivers.set(id, [...merged].sort(compareStableStrings));
  }
}

interface BackwardState {
  readonly source: TemporalScheduleSourceResult;
  readonly input: RequiredScheduleInput;
  readonly model: ReturnType<typeof temporalScheduleSourceModel>;
  readonly graph: TemporalScheduleGraph;
  readonly requiredMilestones: Map<string, Rational>;
  readonly milestoneDrivers: Map<string, string[]>;
  readonly tasks: RequiredTask[];
}

function requiredTask(
  state: BackwardState,
  edge: SchedulerTaskInput,
  targetRequired: Rational,
): RequiredScheduleCause | null {
  const finishBound = latest(state.model.taskBounds, edge.id, "finish");
  let requiredFinish = finishBound === null ? targetRequired : minimum(targetRequired, finishBound);
  let subtracted = subtractCalendarWorkingTime(state.source, edge.requirements, state.input.schedule.resources,
    requiredFinish, edge.expectedWorkSeconds, state.input.horizonStart,
    TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY, state.input.schedule.capacityOverrides);
  if (subtracted.state === "unavailable") {
    return Object.freeze({ code: "calendar_subtraction_unavailable", entityIds: Object.freeze([edge.id]) });
  }
  const startBound = latest(state.model.taskBounds, edge.id, "start");
  let requiredStart = subtracted.value!;
  if (startBound !== null && compare(startBound, requiredStart) < 0) {
    requiredStart = startBound;
    const forwarded = addCalendarWorkingTime(state.source, edge.requirements, state.input.schedule.resources,
      requiredStart, edge.expectedWorkSeconds, requiredFinish,
      TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY, state.input.schedule.capacityOverrides);
    if (forwarded.state === "unavailable") {
      return Object.freeze({ code: "calendar_subtraction_unavailable", entityIds: Object.freeze([edge.id]) });
    }
    requiredFinish = forwarded.value!;
    subtracted = Object.freeze({ ...subtracted, segments: forwarded.segments });
  }
  const drivers = [
    finishBound !== null && compare(requiredFinish, finishBound) === 0 ? `task:${edge.id}:finish:latest` : `milestone:${edge.target}:required`,
    ...(startBound !== null && compare(requiredStart, startBound) === 0 ? [`task:${edge.id}:start:latest`] : []),
  ].sort(compareStableStrings);
  state.tasks.push(Object.freeze({
    id: edge.id, requiredStart, requiredFinish,
    segments: Object.freeze([...subtracted.segments]), driverIds: Object.freeze(drivers),
  }));
  setEarlier(state.requiredMilestones, state.milestoneDrivers, edge.source, requiredStart, `task:${edge.id}:required_start`);
  return null;
}

function propagateBackward(state: BackwardState): RequiredScheduleCause | null {
  for (const milestoneId of [...state.graph.order].reverse()) {
    const inherited = state.requiredMilestones.get(milestoneId);
    const ownLatest = latest(state.model.milestoneBounds, milestoneId, "reach");
    if (inherited === undefined && ownLatest === null) continue;
    const required = inherited === undefined ? ownLatest! : ownLatest === null ? inherited : minimum(inherited, ownLatest);
    state.requiredMilestones.set(milestoneId, required);
    if (ownLatest !== null && compare(required, ownLatest) === 0) {
      setEarlier(state.requiredMilestones, state.milestoneDrivers, milestoneId, required,
        `milestone:${milestoneId}:reach:latest`);
    }
    for (const edge of state.graph.incoming.get(milestoneId)!) {
      if (edge.kind === "gate") {
        setEarlier(state.requiredMilestones, state.milestoneDrivers, edge.source, required,
          `gate:${edge.id}:target_required`);
      } else {
        const cause = requiredTask(state, edge, required);
        if (cause !== null) return cause;
      }
    }
  }
  return null;
}

function comparisonEvents(
  tasks: readonly RequiredTask[],
  milestones: readonly RequiredMilestone[],
  forward: CalendarScheduleProfile | TemporalConstraintProfile,
): readonly RequiredEventComparison[] | null {
  if (forward.state !== "available" && forward.state !== "infeasible") return null;
  const events: RequiredEventComparison[] = [];
  for (const required of tasks) {
    const projected = forward.tasks.find(({ id }) => id === required.id);
    if (projected === undefined) continue;
    events.push(Object.freeze({ entityKind: "task", entityId: required.id, event: "start",
      required: required.requiredStart, projected: projected.start,
      signedSlackSeconds: subtract(required.requiredStart, projected.start) }));
    events.push(Object.freeze({ entityKind: "task", entityId: required.id, event: "finish",
      required: required.requiredFinish, projected: projected.finish,
      signedSlackSeconds: subtract(required.requiredFinish, projected.finish) }));
  }
  for (const required of milestones) {
    const projected = forward.milestones.find(({ id }) => id === required.id);
    if (projected === undefined) continue;
    events.push(Object.freeze({ entityKind: "milestone", entityId: required.id, event: "reach",
      required: required.requiredReach, projected: projected.reach,
      signedSlackSeconds: subtract(required.requiredReach, projected.reach) }));
  }
  return Object.freeze(events);
}

function compareForward(
  tasks: readonly RequiredTask[], milestones: readonly RequiredMilestone[],
  forward: CalendarScheduleProfile | TemporalConstraintProfile, kind: "precedence" | "resource",
): RequiredForwardComparison {
  const events = comparisonEvents(tasks, milestones, forward);
  if (events === null) return emptyComparison();
  const late = events.some(({ signedSlackSeconds }) => compare(signedSlackSeconds, { numerator: 0n, denominator: 1n }) < 0);
  return Object.freeze({
    state: "available",
    classification: !late ? "feasible" : kind === "precedence" ? "precedence_infeasible" : "resource_heuristic_late",
    optimal: kind === "resource" ? false : null,
    events,
  });
}

export function analyzeRequiredSchedule(
  source: TemporalScheduleSourceResult,
  input: RequiredScheduleInput,
  capability: RequiredScheduleCapability,
): RequiredScheduleResult {
  if (capability !== REQUIRED_SCHEDULE_CAPABILITY) throw new TypeError("the required-schedule capability is required");
  const model = temporalScheduleSourceModel(source);
  if (model.documentId !== input.schedule.documentId || compare(input.horizonStart, input.schedule.asOf) >= 0) {
    throw new TypeError("required-schedule input does not match the source or horizon");
  }
  if (model.profile.kind === "continuous_fixed_offset") return emptyResult(model.documentId, source, "not_applicable", null);
  const finishLatest = latest(model.milestoneBounds, input.schedule.finishMilestoneId, "reach");
  const anchor = selectAnchor(finishLatest, input.finishDeadline);
  if (anchor === null) return emptyResult(model.documentId, source, "absent",
    Object.freeze({ code: "required_anchor_absent", entityIds: Object.freeze([input.schedule.finishMilestoneId]) }));
  const indexed = temporalScheduleGraph(input.schedule);
  const requiredMilestones = new Map<string, Rational>([[input.schedule.finishMilestoneId, anchor.instant]]);
  const milestoneDrivers = new Map<string, string[]>([[input.schedule.finishMilestoneId, [`anchor:${anchor.source}`]]]);
  const state: BackwardState = { source, input, model, graph: indexed, requiredMilestones, milestoneDrivers, tasks: [] };
  const cause = propagateBackward(state);
  if (cause !== null) return emptyResult(model.documentId, source, "unavailable", cause);
  const tasks = Object.freeze(state.tasks.sort((left, right) => compareStableStrings(left.id, right.id)));
  const milestones = Object.freeze(indexed.order.flatMap((id): RequiredMilestone[] => {
    const requiredReach = requiredMilestones.get(id);
    return requiredReach === undefined ? [] : [Object.freeze({
      id, requiredReach, driverIds: Object.freeze(milestoneDrivers.get(id) ?? []),
    })];
  }));
  return Object.freeze({
    modelVersion: 1, documentId: model.documentId, source, state: "available", algorithm: ALGORITHM, anchor,
    tasks, milestones,
    precedenceComparison: compareForward(tasks, milestones, input.precedenceForward, "precedence"),
    resourceComparison: compareForward(tasks, milestones, input.resourceForward, "resource"),
    unavailableCauses: Object.freeze([]),
  });
}
