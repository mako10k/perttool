import {
  canonicalizeEventDateTimeSourceToken,
  type DeclaredCalendarValue,
} from "../model/calendar.js";
import { canonicalizeExactDurationSourceToken } from "../model/exact-duration-source.js";
import { canonicalizeExactVelocitySourceToken } from "../model/exact-velocity-source.js";
import { compareStableStrings } from "../model/diagnostics.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { rfc8785Json } from "../model/rfc8785.js";
import {
  fieldNamed,
  type DeclarationNode,
  type TargetDeclarationKind,
} from "../model/syntax.js";
import { evaluatePlanAssurance } from "../assurance/evaluate.js";
import { calendarRecord, timingRecord } from "../assurance/canonical.js";
import { projectPlanAssuranceInput } from "../assurance/source.js";
import type {
  PlanningActivitySource,
  PlanningDurationSource,
  PlanningEstimateSource,
  PlanningPoolSourceModel,
} from "../planning-pool/source-types.js";
import { canonicalPlanningCalendar } from "../planning-pool/source-values.js";
import { canonicalInstant } from "../temporal-schedule/source-values.js";
import type {
  EventBoundSource,
  TemporalCalendarProfileSource,
} from "../temporal-schedule/source-types.js";
import type { PlanReviewSourceModel } from "./source-types.js";

export const PLAN_REVIEW_BASIS_MODEL_VERSION = 1 as const;
export const PLAN_REVIEW_BASIS_ID = "Perttool.PlanReviewBasis.v1" as const;

export interface PlanReviewBasisV1 {
  readonly model_version: 1;
  readonly project: {
    readonly id: string;
    readonly finish_milestone_id: string;
    readonly duration_unit: string;
    readonly velocity: string | null;
    readonly target_duration: string | null;
    readonly critical_epsilon: string;
  };
  readonly calendars: readonly unknown[];
  readonly resources: readonly unknown[];
  readonly milestones: readonly unknown[];
  readonly tasks: readonly unknown[];
  readonly gates: readonly unknown[];
  readonly assurance_relations: readonly unknown[];
  readonly planning_pool: Readonly<Record<string, unknown>> | null;
}

function requiredDeclaration(
  declarations: readonly DeclarationNode<TargetDeclarationKind>[],
  kind: TargetDeclarationKind,
): DeclarationNode<TargetDeclarationKind> {
  const value = declarations.find((declaration) => declaration.kind === kind);
  if (value === undefined) throw new Error(`validated document has no ${kind}`);
  return value;
}

function stringField(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): string | null {
  const value = fieldNamed(declaration, name)?.value;
  if (value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`validated ${declaration.kind}.${name} is not a string`);
  }
  return value;
}

function integerField(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
  fallback: number,
): number {
  const value = fieldNamed(declaration, name)?.value ?? fallback;
  if (!Number.isSafeInteger(value)) {
    throw new Error(`validated ${declaration.kind}.${name} is not an integer`);
  }
  return value as number;
}

function exactScalar(fieldText: string | undefined, fallback: string | null): string | null {
  if (fieldText === undefined) return fallback;
  const value = canonicalizeExactDurationSourceToken(fieldText);
  if (value === null) throw new Error("validated exact duration lost canonical form");
  return value.token;
}

function calendarValue(value: DeclaredCalendarValue | null): string | null {
  if (value === null) return null;
  if (value.kind === "date") return value.sourceText;
  const canonical = canonicalizeEventDateTimeSourceToken(value.sourceText);
  if (canonical === null) throw new Error("validated date-time lost canonical form");
  return canonical;
}

function temporalBounds(
  bounds: readonly EventBoundSource[],
  entityId: string,
): readonly unknown[] {
  return bounds.filter(({ entityId: id }) => id === entityId).map((bound) => ({
    event: bound.event,
    direction: bound.direction,
    value: canonicalInstant(bound.value),
  }));
}

function calendarProfile(profile: TemporalCalendarProfileSource): unknown {
  return profile.kind === "continuous_fixed_offset"
    ? { kind: "continuous_fixed_offset" }
    : {
        kind: "named_zone",
        zone_id: profile.zoneId,
        tzdb_release: profile.tzdbRelease,
        calendar_id: profile.calendarId,
        workday_hours: profile.workdayHours === null
          ? null
          : {
              numerator: profile.workdayHours.numerator.toString(),
              denominator: profile.workdayHours.denominator.toString(),
            },
      };
}

function calendars(model: PlanningPoolSourceModel): readonly unknown[] {
  return model.base.calendars.map((calendar) => ({
    id: calendar.id,
    profile: calendarProfile(model.base.profile),
    weekdays: calendar.weekdays.map((day) => ({
      weekday: day.weekday,
      windows: day.windows.map((window) => ({
        start_minute: window.startMinute,
        end_minute: window.endMinute,
      })),
    })),
    exceptions: calendar.exceptions.map((item) => ({
      date: item.date,
      windows: item.windows.map((window) => ({
        start_minute: window.startMinute,
        end_minute: window.endMinute,
      })),
    })),
  }));
}

function resources(
  model: PlanReviewSourceModel,
  declarations: readonly DeclarationNode<TargetDeclarationKind>[],
): readonly unknown[] {
  const availability = new Map(model.base.base.resources.map((item) => [item.resourceId, item]));
  return declarations.filter(({ kind }) => kind === "resource").map((resource) => {
    const temporal = availability.get(resource.id);
    return {
      id: resource.id,
      capacity: integerField(resource, "capacity", 1),
      calendar_id: temporal?.calendarId ?? null,
      available_from: temporal?.availableFrom === null || temporal?.availableFrom === undefined
        ? null
        : canonicalInstant(temporal.availableFrom),
      available_until: temporal?.availableUntil === null || temporal?.availableUntil === undefined
        ? null
        : canonicalInstant(temporal.availableUntil),
      overrides: (temporal?.overrides ?? []).map((override) => ({
        start: canonicalInstant(override.start),
        end: canonicalInstant(override.end),
        capacity: override.capacity,
      })),
    };
  });
}

function milestones(
  model: PlanReviewSourceModel,
  declarations: readonly DeclarationNode<TargetDeclarationKind>[],
): readonly unknown[] {
  return declarations.filter(({ kind }) => kind === "milestone").map((milestone) => ({
    id: milestone.id,
    deadline: calendarValue((fieldNamed(milestone, "deadline")?.value as DeclaredCalendarValue | undefined) ?? null),
    temporal_constraints: temporalBounds(model.base.base.milestoneBounds, milestone.id),
  }));
}

function tasks(model: PlanReviewSourceModel): readonly unknown[] {
  const input = projectPlanAssuranceInput(model.baseDocument);
  return input.tasks.map(({ contract }) => ({
    id: contract.taskId,
    from_milestone_id: contract.fromMilestoneId,
    to_milestone_id: contract.toMilestoneId,
    description: contract.description,
    timing: timingRecord(contract.durationOrEstimate),
    not_before: "notBefore" in contract
      ? contract.notBefore === null ? null : calendarRecord(contract.notBefore)
      : null,
    deadline: contract.deadline === null ? null : calendarRecord(contract.deadline),
    priority: contract.priority,
    requirements: [...contract.requirements]
      .sort((left, right) => compareStableStrings(left.resourceId, right.resourceId))
      .map(({ resourceId, units }) => ({ resource_id: resourceId, units })),
    owner: contract.owner,
    tags: [...contract.tags].sort(compareStableStrings),
    source: contract.source,
    temporal_constraints: temporalBounds(model.base.base.taskBounds, contract.taskId),
  }));
}

function gates(
  declarations: readonly DeclarationNode<TargetDeclarationKind>[],
): readonly unknown[] {
  return declarations.filter(({ kind }) => kind === "gate").map((gate) => ({
    id: gate.id,
    from_milestone_id: gate.from!,
    to_milestone_id: gate.to!,
    reason: stringField(gate, "reason") ?? "",
  }));
}

function assuranceRelations(model: PlanReviewSourceModel): readonly unknown[] {
  const evaluation = evaluatePlanAssurance(projectPlanAssuranceInput(model.baseDocument));
  if (!evaluation.ok) throw new Error("validated plan lost effective assurance relations");
  return evaluation.effectiveDependencies.map((relation) => ({
    relation_id: relation.relationId,
    predecessor_task_id: relation.predecessorTaskId,
    successor_task_id: relation.successorTaskId,
    mode: relation.mode,
    explicit: relation.explicit,
  }));
}

function planningTiming(
  duration: PlanningDurationSource | null,
  estimate: PlanningEstimateSource | null,
): unknown {
  const exact = (value: PlanningDurationSource) => ({
    numerator: value.value.numerator.toString(),
    denominator: value.value.denominator.toString(),
    unit: value.unit,
  });
  if (duration !== null) return { kind: "duration", value: exact(duration) };
  if (estimate === null) return null;
  return {
    kind: "estimate",
    optimistic: exact(estimate.optimistic),
    most_likely: exact(estimate.mostLikely),
    pessimistic: exact(estimate.pessimistic),
  };
}

function planningActivity(activity: PlanningActivitySource): unknown {
  return {
    id: activity.id,
    from_id: activity.from.id,
    to_id: activity.to.id,
    title: activity.title,
    description: activity.description?.value ?? null,
    timing: planningTiming(activity.duration, activity.estimate),
    priority: activity.priority,
    requirements: [...activity.requirements]
      .sort((left, right) => compareStableStrings(left.resourceId, right.resourceId))
      .map(({ resourceId, units }) => ({ resource_id: resourceId, units })),
    owner: activity.owner,
    tags: [...activity.tags].sort(compareStableStrings),
    source: activity.source,
    calendar_id: activity.calendarId,
    when: activity.when.map((item) => ({
      event: item.event,
      direction: item.direction,
      value: canonicalInstant(item.value),
    })),
    deadline: activity.deadline === null ? null : canonicalPlanningCalendar(activity.deadline.sourceText),
  };
}

function planningPool(model: PlanningPoolSourceModel): Readonly<Record<string, unknown>> | null {
  if (
    model.works.length === 0 &&
    model.events.length === 0 &&
    model.activities.length === 0 &&
    model.windows.length === 0
  ) return null;
  return {
    works: model.works.map((work) => ({
      id: work.id,
      title: work.title,
      description: work.description?.value ?? null,
      event_ids: work.events.map(({ id }) => id).sort(compareStableStrings),
      activity_ids: work.activities.map(({ id }) => id).sort(compareStableStrings),
      milestone_link_ids: work.milestoneLinks.map(({ id }) => id).sort(compareStableStrings),
      task_link_ids: work.taskLinks.map(({ id }) => id).sort(compareStableStrings),
      depends_on_ids: work.dependsOn.map(({ id }) => id).sort(compareStableStrings),
    })),
    events: model.events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description?.value ?? null,
      tags: [...event.tags].sort(compareStableStrings),
      source: event.source,
    })),
    activities: model.activities.map(planningActivity),
    windows: model.windows.map((window) => ({
      id: window.id,
      title: window.title,
      objective: window.objective,
      start: calendarValue(window.start),
      end: calendarValue(window.end),
      work_ids: window.works.map(({ id }) => id).sort(compareStableStrings),
    })),
    work_order: model.workOrder.map(({ id }) => id),
  };
}

export function projectPlanReviewBasis(model: PlanReviewSourceModel): PlanReviewBasisV1 {
  const declarations = model.baseDocument.document.declarations;
  const project = requiredDeclaration(declarations, "project");
  const finish = stringField(project, "finish");
  const durationUnit = stringField(project, "duration_unit");
  if (finish === null || durationUnit === null) {
    throw new Error("validated project lost its planning identity");
  }
  const velocitySource = fieldNamed(project, "velocity")?.rawValue;
  const velocity = velocitySource === undefined
    ? null
    : canonicalizeExactVelocitySourceToken(velocitySource);
  if (velocitySource !== undefined && velocity === null) {
    throw new Error("validated velocity lost canonical form");
  }
  return Object.freeze({
    model_version: PLAN_REVIEW_BASIS_MODEL_VERSION,
    project: Object.freeze({
      id: project.id,
      finish_milestone_id: finish,
      duration_unit: durationUnit,
      velocity,
      target_duration: exactScalar(fieldNamed(project, "target_duration")?.rawValue, null),
      critical_epsilon: exactScalar(
        fieldNamed(project, "critical_epsilon")?.rawValue,
        `0${durationUnit === "day" ? "d" : durationUnit === "hour" ? "h" : "p"}`,
      )!,
    }),
    calendars: Object.freeze(calendars(model.base)),
    resources: Object.freeze(resources(model, declarations)),
    milestones: Object.freeze(milestones(model, declarations)),
    tasks: Object.freeze(tasks(model)),
    gates: Object.freeze(gates(declarations)),
    assurance_relations: Object.freeze(assuranceRelations(model)),
    planning_pool: planningPool(model.base),
  });
}

export function canonicalPlanReviewBasisJson(value: PlanReviewBasisV1): string {
  return rfc8785Json(value);
}

export function digestPlanReviewBasis(value: PlanReviewBasisV1): `sha256:${string}` {
  return sha256DigestUtf8(canonicalPlanReviewBasisJson(value));
}
