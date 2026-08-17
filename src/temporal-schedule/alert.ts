import { compareStableStrings } from "../model/diagnostics.js";
import { compare, subtract } from "../model/rational.js";
import { temporalScheduleGraph } from "./schedule-graph.js";
import type { CalendarScheduleProfile, ScheduledTask, SchedulerEdgeInput } from "./scheduler-types.js";
import type { TemporalConstraintProfile } from "./constraint-types.js";
import type {
  AlertKind,
  ScheduleAlertCapability,
  ScheduleAlertDriver,
  ScheduleAlertDriverStep,
  ScheduleAlertInput,
  ScheduleAlertOccurrence,
  ScheduleAlertResult,
  ScheduleAlertTarget,
} from "./alert-types.js";

export const SCHEDULE_ALERT_CAPABILITY: ScheduleAlertCapability = Object.freeze({
  id: "perttool.schedule-alert",
  version: 1,
});

const EVALUATOR = Object.freeze({ id: "perttool.schedule-alert" as const, version: 1 as const, optimal: null });
const DEFAULT_ALERT_LIMIT = 10_000;
const COMPACT_DRIVER_LIMIT = 64;
const FULL_DRIVER_LIMIT = 100_000;

function spanStart(target: ScheduleAlertTarget): number {
  return target.sourceRange.start.offset;
}

function targetKey(target: ScheduleAlertTarget): string {
  return [target.subjectKind, target.subjectId, target.event, target.targetKind,
    `${target.sourceRange.start.offset}:${target.sourceRange.end.offset}`].join(":");
}

function alertId(sourceDigest: string, kind: AlertKind, target: ScheduleAlertTarget): string {
  return `alert:${sourceDigest}:${kind}:${targetKey(target)}`;
}

function projection(
  profile: CalendarScheduleProfile | TemporalConstraintProfile,
  target: ScheduleAlertTarget,
) {
  if (profile.state !== "available" && profile.state !== "infeasible") return null;
  if (target.subjectKind === "milestone") {
    return profile.milestones.find(({ id }) => id === target.subjectId)?.reach ?? null;
  }
  const task = profile.tasks.find(({ id }) => id === target.subjectId);
  return target.event === "start" ? task?.start ?? null : task?.finish ?? null;
}

function analysisArgv(operand: string): readonly string[] {
  return Object.freeze(["perttool", "dag", "analyze", operand, "--schedule", "both", "--format", "json"]);
}

function edgeStep(edge: SchedulerEdgeInput): ScheduleAlertDriverStep {
  return Object.freeze({ kind: edge.kind, id: edge.id, sourceMilestoneId: edge.source, targetMilestoneId: edge.target });
}

function selectedIncoming(
  input: ScheduleAlertInput,
  milestoneId: string,
  profile: CalendarScheduleProfile | TemporalConstraintProfile,
): SchedulerEdgeInput | null {
  const graph = temporalScheduleGraph(input.schedule);
  const reach = profile.milestones.find(({ id }) => id === milestoneId)?.reach;
  if (reach === undefined) return null;
  const exact = graph.incoming.get(milestoneId)!.filter((edge) => {
    if (edge.kind === "gate") {
      const source = profile.milestones.find(({ id }) => id === edge.source)?.reach;
      return source !== undefined && compare(source, reach) === 0;
    }
    const task = profile.tasks.find(({ id }) => id === edge.id);
    return task !== undefined && compare(task.finish, reach) === 0;
  });
  return [...exact].sort((left, right) => compareStableStrings(left.id, right.id))[0] ?? null;
}

function targetDriverSteps(
  input: ScheduleAlertInput,
  target: ScheduleAlertTarget,
  profile: CalendarScheduleProfile | TemporalConstraintProfile,
  resourceProof: boolean,
): readonly ScheduleAlertDriverStep[] | null {
  if (profile.state !== "available" && profile.state !== "infeasible") return null;
  const reversed: ScheduleAlertDriverStep[] = [];
  let milestoneId: string;
  if (target.subjectKind === "task") {
    const edge = input.schedule.edges.find((candidate) => candidate.kind === "task" && candidate.id === target.subjectId);
    if (edge === undefined) return null;
    if (target.event === "finish") reversed.push(edgeStep(edge));
    milestoneId = edge.source;
  } else {
    milestoneId = target.subjectId;
  }
  const visited = new Set<string>();
  while (!input.schedule.frontierMilestoneIds.includes(milestoneId)) {
    if (visited.has(milestoneId)) return null;
    visited.add(milestoneId);
    const edge = selectedIncoming(input, milestoneId, profile);
    if (edge === null) return null;
    reversed.push(edgeStep(edge));
    milestoneId = edge.source;
  }
  const steps = reversed.reverse();
  if (resourceProof) {
    const withWaits: ScheduleAlertDriverStep[] = [];
    for (const step of steps) {
      const task = profile.tasks.find(({ id }) => id === step.id) as ScheduledTask | undefined;
      if (task !== undefined && compare(task.resourceWaitSeconds, { numerator: 0n, denominator: 1n }) > 0) {
        withWaits.push(Object.freeze({ kind: "resource_wait", id: `resource-wait:${task.id}`,
          sourceMilestoneId: step.sourceMilestoneId, targetMilestoneId: step.sourceMilestoneId }));
      }
      withWaits.push(step);
    }
    return Object.freeze(withWaits);
  }
  return Object.freeze(steps);
}

function driver(
  input: ScheduleAlertInput,
  target: ScheduleAlertTarget,
  proof: "current_snapshot" | "precedence_infeasible" | "resource_heuristic_late",
): ScheduleAlertDriver {
  const scope = target.subjectKind === "milestone" && target.subjectId === input.schedule.finishMilestoneId
    ? "project_finish" as const : "target" as const;
  if (input.driverLevel === "none") return Object.freeze({
    state: "not_computed", pathId: null, scope, steps: Object.freeze([]), truncated: false, totalSteps: null,
    analysisArgv: analysisArgv(input.operand), cause: "driver_not_computed",
  });
  const resourceProof = proof === "resource_heuristic_late";
  const profile = resourceProof ? input.resourceForward : input.precedenceForward;
  const steps = targetDriverSteps(input, target, profile, resourceProof);
  if (steps === null) return Object.freeze({
    state: "unavailable", pathId: null, scope, steps: Object.freeze([]), truncated: false, totalSteps: null,
    analysisArgv: analysisArgv(input.operand), cause: "driver_unavailable",
  });
  const limit = input.maxDriverSteps ?? (input.driverLevel === "compact" ? COMPACT_DRIVER_LIMIT : FULL_DRIVER_LIMIT);
  const emitted = Object.freeze(steps.slice(0, limit));
  const truncated = emitted.length < steps.length;
  return Object.freeze({
    state: "available", pathId: `driver:${proof}:${targetKey(target)}`, scope, steps: emitted, truncated,
    totalSteps: steps.length, analysisArgv: truncated ? analysisArgv(input.operand) : null, cause: null,
  });
}

function occurrence(
  input: ScheduleAlertInput,
  target: ScheduleAlertTarget,
): ScheduleAlertOccurrence | null {
  if (target.temporalKind !== "instant" || target.instant === null) return null;
  const event = input.eventStates.find((candidate) => candidate.subjectKind === target.subjectKind
    && candidate.subjectId === target.subjectId && candidate.event === target.event);
  if (event?.complete === true) return null;
  let kind: AlertKind;
  let value;
  let proof: "current_snapshot" | "precedence_infeasible" | "resource_heuristic_late";
  if (compare(input.schedule.asOf, target.instant) > 0) {
    kind = "POSTDUE";
    value = input.schedule.asOf;
    proof = "current_snapshot";
  } else {
    const precedence = projection(input.precedenceForward, target);
    const resource = projection(input.resourceForward, target);
    if (precedence !== null && compare(precedence, target.instant) > 0) {
      kind = "POSTDUE_FORECAST";
      value = precedence;
      proof = "precedence_infeasible";
    } else if (resource !== null && compare(resource, target.instant) > 0) {
      kind = "POSTDUE_FORECAST";
      value = resource;
      proof = "resource_heuristic_late";
    } else return null;
  }
  return Object.freeze({
    alertId: alertId(input.sourceDigest, kind, target), kind,
    subject: Object.freeze({ kind: target.subjectKind, id: target.subjectId }), event: target.event, target,
    comparison: Object.freeze({ snapshotOrProjection: value, signedDifferenceSeconds: subtract(value, target.instant), relation: "after" }),
    proof: Object.freeze({ kind: proof, optimal: proof === "resource_heuristic_late" ? false : null }),
    driver: driver(input, target, proof), sourceDigest: input.sourceDigest, sourceRange: target.sourceRange,
  });
}

function occurrenceOrder(left: ScheduleAlertOccurrence, right: ScheduleAlertOccurrence): number {
  const instant = compare(left.target.instant!, right.target.instant!);
  if (instant !== 0) return instant;
  for (const [a, b] of [[left.subject.kind, right.subject.kind], [left.subject.id, right.subject.id],
    [left.event, right.event], [left.target.targetKind, right.target.targetKind]] as const) {
    const ordered = compareStableStrings(a, b);
    if (ordered !== 0) return ordered;
  }
  return spanStart(left.target) - spanStart(right.target) || compareStableStrings(left.kind, right.kind);
}

export function evaluateScheduleAlerts(
  input: ScheduleAlertInput,
  capability: ScheduleAlertCapability,
): ScheduleAlertResult {
  if (capability !== SCHEDULE_ALERT_CAPABILITY) throw new TypeError("the schedule-alert capability is required");
  if (!input.source.ok || input.source.documentId !== input.schedule.documentId
    || input.requiredSchedule.documentId !== input.schedule.documentId || input.requiredSchedule.source !== input.source) {
    throw new TypeError("schedule-alert input does not match the accepted source");
  }
  if (input.source.model?.profile.kind === "continuous_fixed_offset") return Object.freeze({
    modelVersion: 1, documentId: input.schedule.documentId, evaluator: EVALUATOR, state: "not_applicable",
    summary: Object.freeze({ postdue: 0, postdueForecast: 0, total: 0 }), occurrences: Object.freeze([]),
    truncation: Object.freeze({ truncated: false, emitted: 0, total: 0, totalKnown: true }), unavailableCauses: Object.freeze([]),
  });
  const uniqueTargets = [...new Map(input.targets.map((target) => [targetKey(target), target])).values()];
  const unavailableEntityIds = uniqueTargets.filter((target) => {
    if (target.temporalKind !== "instant" || target.instant === null || compare(input.schedule.asOf, target.instant) > 0) return false;
    const event = input.eventStates.find((candidate) => candidate.subjectKind === target.subjectKind
      && candidate.subjectId === target.subjectId && candidate.event === target.event);
    return event?.complete !== true && projection(input.precedenceForward, target) === null
      && projection(input.resourceForward, target) === null;
  }).map(({ subjectId }) => subjectId).sort(compareStableStrings);
  const all = uniqueTargets.flatMap((target) => {
    const item = occurrence(input, target);
    return item === null ? [] : [item];
  }).sort(occurrenceOrder);
  const maxAlerts = input.maxAlerts ?? DEFAULT_ALERT_LIMIT;
  if (!Number.isInteger(maxAlerts) || maxAlerts < 0 || maxAlerts > DEFAULT_ALERT_LIMIT) throw new TypeError("invalid schedule-alert limit");
  const occurrences = Object.freeze(all.slice(0, maxAlerts));
  return Object.freeze({
    modelVersion: 1, documentId: input.schedule.documentId, evaluator: EVALUATOR,
    state: unavailableEntityIds.length === 0 ? "available" : "unavailable",
    summary: Object.freeze({
      postdue: all.filter(({ kind }) => kind === "POSTDUE").length,
      postdueForecast: all.filter(({ kind }) => kind === "POSTDUE_FORECAST").length,
      total: all.length,
    }),
    occurrences,
    truncation: Object.freeze({ truncated: occurrences.length < all.length, emitted: occurrences.length, total: all.length, totalKnown: true }),
    unavailableCauses: unavailableEntityIds.length === 0 ? Object.freeze([]) : Object.freeze([
      Object.freeze({ code: "forward_schedule_unavailable", entityIds: Object.freeze([...new Set(unavailableEntityIds)]) }),
    ]),
  });
}
