import type {
  TargetCalendarDifference,
  TargetDeadlineInput,
  TargetEffectiveProjection,
  TargetTemporalExactValue,
  TargetTemporalInputProjection,
} from "./target-temporal-input.js";
import {
  projectRelativeCalendarValue,
  subtractCalendarValues,
  type CalendarDifference,
  type CalendarUnavailableCause,
} from "../model/calendar-arithmetic.js";
import type { DeclaredCalendarValue } from "../model/calendar.js";
import type { Rational } from "../model/rational.js";
import {
  ZERO,
  compare,
  divide,
  maximum,
  multiply,
  rational,
} from "../model/rational.js";
import type {
  DeclarationNode,
  TargetDeclarationKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type { TargetCalendarValue } from "../model/target-calendar.js";
import type { DurationUnit, Velocity } from "../model/units.js";
import type {
  TargetGrammar3ValidatedDocument,
  TargetGrammar4ValidatedDocument,
  TargetGrammar5ValidatedDocument,
} from "../semantic/target-validator.js";
import type {
  TemporalPrecedenceSchedule,
} from "./temporal-precedence.js";
import type {
  TemporalResourceSchedule,
} from "./temporal-resource.js";

export const DEADLINE_EVALUATION_IDENTITY = Object.freeze({
  id: "perttool.deadline-evaluation" as const,
  version: 1 as const,
});

export type DeadlineCause =
  | CalendarUnavailableCause
  | "complete_actual_time_unavailable"
  | "release_bound_unavailable"
  | "precedence_projection_unavailable"
  | "resource_projection_unavailable"
  | "margin_unit_unavailable";

export interface DeadlineUnavailableCause {
  readonly cause: DeadlineCause;
  readonly underlyingCause: string | null;
  readonly subjectKind: "task" | "milestone" | null;
  readonly subjectId: string | null;
  readonly taskId: string | null;
}

export interface DeadlineCurrentState {
  readonly state:
    | "not_due"
    | "due_now"
    | "overdue"
    | "not_applicable"
    | "unavailable";
  readonly signedWindow: TargetCalendarDifference | null;
  readonly baseUnitWindow: TargetTemporalExactValue | null;
  readonly unavailableCauses: readonly DeadlineUnavailableCause[];
}

export interface DeadlineView {
  readonly state: "not_applicable" | "unavailable" | "available";
  readonly projectedCompletion: TargetCalendarValue | null;
  readonly forecastRelation:
    | "before_deadline"
    | "on_deadline"
    | "after_deadline"
    | null;
  readonly signedMargin: TargetCalendarDifference | null;
  readonly baseUnitMargin: TargetTemporalExactValue | null;
  readonly remainingMargin: TargetTemporalExactValue | null;
  readonly lateness: TargetTemporalExactValue | null;
  readonly assessment:
    | "lower_bound_on_time"
    | "lower_bound_late"
    | "heuristic_on_time"
    | "heuristic_late"
    | null;
  readonly optimal: boolean | null;
  readonly conditionalOnBlocksResolved: boolean;
  readonly blockedTaskIds: readonly string[];
  readonly unavailableCauses: readonly DeadlineUnavailableCause[];
}

export interface DeadlineEvaluation {
  readonly subject: {
    readonly kind: "task" | "milestone";
    readonly id: string;
    readonly roles: readonly ("task" | "milestone" | "project_finish")[];
  };
  readonly deadline: TargetCalendarValue;
  readonly completionState:
    | "incomplete"
    | "complete_actual_time_unavailable";
  readonly current: DeadlineCurrentState;
  readonly precedence: DeadlineView;
  readonly resource: DeadlineView;
  readonly combinedAssessment:
    | "overdue"
    | "forecast_infeasible"
    | "at_risk"
    | "forecast_on_time"
    | "not_proven_late"
    | "not_applicable"
    | "unavailable";
  readonly conditionalOnBlocksResolved: boolean;
  readonly blockedTaskIds: readonly string[];
  readonly destinationRelationship: {
    readonly milestoneId: string;
    readonly relation:
      | "task_deadline_before_milestone"
      | "same_deadline"
      | "task_deadline_after_milestone"
      | "unavailable"
      | "deadline_absent";
  } | null;
}

interface DeadlineSubject {
  readonly declaration: DeclarationNode<TargetDeclarationKind>;
  readonly kind: "task" | "milestone";
  readonly id: string;
  readonly input: TargetDeadlineInput;
}

function exactValue(
  value: Rational,
  unit: DurationUnit,
): TargetTemporalExactValue {
  return Object.freeze({
    numerator: value.numerator,
    denominator: value.denominator,
    unit,
  });
}

function differenceValue(
  value: CalendarDifference,
): TargetCalendarDifference {
  return Object.freeze({
    kind: value.kind,
    exact: Object.freeze({
      numerator: value.exact.numerator,
      denominator: value.exact.denominator,
    }),
  });
}

function deadlineCause(
  cause: DeadlineCause,
  underlyingCause: string | null,
  subject: DeadlineSubject,
  taskId: string | null = null,
): DeadlineUnavailableCause {
  return Object.freeze({
    cause,
    underlyingCause,
    subjectKind: subject.kind,
    subjectId: subject.id,
    taskId,
  });
}

function declaredCalendar(
  value: TargetCalendarValue,
): DeclaredCalendarValue {
  if (value.kind === "date") {
    return {
      kind: "date",
      sourceText: value.sourceText ?? "",
      year: value.year,
      month: value.month,
      day: value.day,
    };
  }
  return {
    kind: "date_time",
    sourceText: value.sourceText ?? "",
    year: value.year,
    month: value.month,
    day: value.day,
    hour: value.hour,
    minute: value.minute,
    second: rational(
      BigInt(value.second.numerator),
      BigInt(value.second.denominator),
    ),
    offsetMinutes: value.offsetMinutes,
  };
}

function velocityFromProjection(
  projection: TargetEffectiveProjection,
): Velocity | null {
  const value = projection.velocity;
  return value === null
    ? null
    : {
        points: {
          numerator: value.points.numerator,
          denominator: value.points.denominator,
        },
        period: {
          numerator: value.period.numerator,
          denominator: value.period.denominator,
        },
        periodUnit: value.period.unit,
      };
}

function baseUnitValue(
  difference: CalendarDifference,
  projection: TargetEffectiveProjection,
): { readonly value: Rational | null; readonly cause: CalendarUnavailableCause | null } {
  if (projection.baseUnit === "point" && projection.velocity === null) {
    return { value: null, cause: "missing_velocity" };
  }
  if (
    difference.kind === "calendar_days" &&
    projection.effectiveUnit === "hour"
  ) {
    return { value: null, cause: "date_anchor_has_no_clock" };
  }
  const effective = difference.kind === "calendar_days"
    ? difference.exact
    : divide(
        difference.exact,
        rational(projection.effectiveUnit === "day" ? 86_400n : 3_600n),
      );
  const velocity = velocityFromProjection(projection);
  return {
    value: projection.baseUnit === "point"
      ? multiply(effective, divide(velocity!.points, velocity!.period))
      : effective,
    cause: null,
  };
}

function effectiveRelative(
  relative: Rational,
  projection: TargetEffectiveProjection,
): Rational {
  if (projection.baseUnit !== "point") return relative;
  const velocity = velocityFromProjection(projection)!;
  return multiply(relative, divide(velocity.period, velocity.points));
}

function currentState(
  subject: DeadlineSubject,
  anchor: TargetCalendarValue | null,
  projection: TargetEffectiveProjection,
): DeadlineCurrentState {
  if (subject.input.completionState === "complete_actual_time_unavailable") {
    return Object.freeze({
      state: "not_applicable",
      signedWindow: null,
      baseUnitWindow: null,
      unavailableCauses: Object.freeze([
        deadlineCause(
          "complete_actual_time_unavailable",
          null,
          subject,
          subject.kind === "task" ? subject.id : null,
        ),
      ]),
    });
  }
  if (anchor === null) {
    return Object.freeze({
      state: "unavailable",
      signedWindow: null,
      baseUnitWindow: null,
      unavailableCauses: Object.freeze([
        deadlineCause(
          "missing_temporal_anchor",
          null,
          subject,
          subject.kind === "task" ? subject.id : null,
        ),
      ]),
    });
  }
  const relationship = subtractCalendarValues(
    declaredCalendar(subject.input.deadline),
    declaredCalendar(anchor),
  );
  if (relationship.state === "unavailable") {
    return Object.freeze({
      state: "unavailable",
      signedWindow: null,
      baseUnitWindow: null,
      unavailableCauses: Object.freeze([
        deadlineCause(
          relationship.cause,
          null,
          subject,
          subject.kind === "task" ? subject.id : null,
        ),
      ]),
    });
  }
  const conversion = baseUnitValue(relationship.difference, projection);
  const order = compare(relationship.difference.exact, ZERO);
  return Object.freeze({
    state: order > 0 ? "not_due" : order < 0 ? "overdue" : "due_now",
    signedWindow: differenceValue(relationship.difference),
    baseUnitWindow: conversion.value === null
      ? null
      : exactValue(conversion.value, projection.baseUnit),
    unavailableCauses: conversion.cause === null
      ? Object.freeze([])
      : Object.freeze([
          deadlineCause(
            "margin_unit_unavailable",
            conversion.cause,
            subject,
            subject.kind === "task" ? subject.id : null,
          ),
        ]),
  });
}

function notApplicableView(
  subject: DeadlineSubject,
  blockedTaskIds: readonly string[],
  optimal: boolean | null,
): DeadlineView {
  return Object.freeze({
    state: "not_applicable",
    projectedCompletion: null,
    forecastRelation: null,
    signedMargin: null,
    baseUnitMargin: null,
    remainingMargin: null,
    lateness: null,
    assessment: null,
    optimal,
    conditionalOnBlocksResolved: blockedTaskIds.length > 0,
    blockedTaskIds,
    unavailableCauses: Object.freeze([
      deadlineCause(
        "complete_actual_time_unavailable",
        null,
        subject,
        subject.kind === "task" ? subject.id : null,
      ),
    ]),
  });
}

function unavailableView(
  subject: DeadlineSubject,
  blockedTaskIds: readonly string[],
  view: "precedence" | "resource",
  underlyingCause: string | null,
): DeadlineView {
  return Object.freeze({
    state: "unavailable",
    projectedCompletion: null,
    forecastRelation: null,
    signedMargin: null,
    baseUnitMargin: null,
    remainingMargin: null,
    lateness: null,
    assessment: null,
    optimal: view === "resource" ? false : null,
    conditionalOnBlocksResolved: blockedTaskIds.length > 0,
    blockedTaskIds,
    unavailableCauses: Object.freeze([
      deadlineCause(
        view === "precedence"
          ? "precedence_projection_unavailable"
          : "resource_projection_unavailable",
        underlyingCause,
        subject,
        subject.kind === "task" ? subject.id : null,
      ),
    ]),
  });
}

function deadlineView(
  subject: DeadlineSubject,
  relative: Rational | null,
  schedule: TemporalPrecedenceSchedule | TemporalResourceSchedule,
  view: "precedence" | "resource",
  anchor: TargetCalendarValue | null,
  projection: TargetEffectiveProjection,
  blockedTaskIds: readonly string[],
): DeadlineView {
  if (subject.input.completionState === "complete_actual_time_unavailable") {
    return notApplicableView(
      subject,
      blockedTaskIds,
      view === "resource" ? false : null,
    );
  }
  if (schedule.state === "unavailable" || relative === null || anchor === null) {
    return unavailableView(
      subject,
      blockedTaskIds,
      view,
      schedule.unavailableCauses[0]?.cause ??
        (anchor === null ? "missing_temporal_anchor" : null),
    );
  }
  if (projection.effectiveUnit === null) {
    return unavailableView(
      subject,
      blockedTaskIds,
      view,
      "missing_velocity",
    );
  }
  const projected = projectRelativeCalendarValue(
    declaredCalendar(anchor),
    projection.effectiveUnit,
    effectiveRelative(relative, projection),
  );
  if (projected.state === "unavailable") {
    return unavailableView(
      subject,
      blockedTaskIds,
      view,
      projected.unavailableCauses[0] ?? null,
    );
  }
  const margin = subtractCalendarValues(
    declaredCalendar(subject.input.deadline),
    declaredCalendar(projected.value),
  );
  if (margin.state === "unavailable") {
    return unavailableView(
      subject,
      blockedTaskIds,
      view,
      margin.cause,
    );
  }
  const conversion = baseUnitValue(margin.difference, projection);
  const sign = compare(margin.difference.exact, ZERO);
  const relation = sign > 0
    ? "before_deadline"
    : sign < 0
      ? "after_deadline"
      : "on_deadline";
  const base = conversion.value;
  const causes: DeadlineUnavailableCause[] = [];
  for (const cause of projected.unavailableCauses) {
    causes.push(
      deadlineCause(
        cause,
        null,
        subject,
        subject.kind === "task" ? subject.id : null,
      ),
    );
  }
  if (conversion.cause !== null) {
    causes.push(
      deadlineCause(
        "margin_unit_unavailable",
        conversion.cause,
        subject,
        subject.kind === "task" ? subject.id : null,
      ),
    );
  }
  return Object.freeze({
    state: "available",
    projectedCompletion: projected.value,
    forecastRelation: relation,
    signedMargin: differenceValue(margin.difference),
    baseUnitMargin: base === null
      ? null
      : exactValue(base, projection.baseUnit),
    remainingMargin: base === null
      ? null
      : exactValue(maximum(base, ZERO), projection.baseUnit),
    lateness: base === null
      ? null
      : exactValue(
          maximum(
            {
              numerator: -base.numerator,
              denominator: base.denominator,
            },
            ZERO,
          ),
          projection.baseUnit,
        ),
    assessment: view === "precedence"
      ? sign < 0
        ? "lower_bound_late"
        : "lower_bound_on_time"
      : sign < 0
        ? "heuristic_late"
        : "heuristic_on_time",
    optimal: view === "resource" ? false : null,
    conditionalOnBlocksResolved: blockedTaskIds.length > 0,
    blockedTaskIds,
    unavailableCauses: Object.freeze(causes),
  });
}

function predecessorBlockedTaskIds(
  document:
    | TargetGrammar3ValidatedDocument["document"]
    | TargetGrammar4ValidatedDocument["document"]
    | TargetGrammar5ValidatedDocument["document"],
  subject: DeadlineSubject,
): readonly string[] {
  const incoming = new Map<
    string,
    DeclarationNode<TargetDeclarationKind>[]
  >();
  for (const declaration of document.declarations) {
    if (declaration.kind === "task" || declaration.kind === "gate") {
      const list = incoming.get(declaration.to!) ?? [];
      list.push(declaration);
      incoming.set(declaration.to!, list);
    }
  }
  const blocked = new Set<string>();
  const visited = new Set<string>();
  const visit = (milestoneId: string): void => {
    if (visited.has(milestoneId)) return;
    visited.add(milestoneId);
    for (const edge of incoming.get(milestoneId) ?? []) {
      if (
        edge.kind === "task" &&
        fieldNamed(edge, "status")?.value === "blocked"
      ) {
        blocked.add(edge.id);
      }
      visit(edge.from!);
    }
  };
  if (subject.kind === "task") {
    if (fieldNamed(subject.declaration, "status")?.value === "blocked") {
      blocked.add(subject.id);
    }
    visit(subject.declaration.from!);
  } else {
    visit(subject.id);
  }
  return Object.freeze([...blocked].sort());
}

function completionRelative(
  subject: DeadlineSubject,
  schedule: TemporalPrecedenceSchedule | TemporalResourceSchedule,
): Rational | null {
  if (schedule.state !== "available") return null;
  if (subject.kind === "task") {
    return schedule.tasks.find(({ id }) => id === subject.id)?.finish ?? null;
  }
  return schedule.milestones.find(({ id }) => id === subject.id)?.reach ?? null;
}

function destinationRelationship(
  subject: DeadlineSubject,
  milestoneDeadlineById: ReadonlyMap<string, TargetDeadlineInput>,
): DeadlineEvaluation["destinationRelationship"] {
  if (subject.kind !== "task") return null;
  const milestoneId = subject.declaration.to!;
  const destination = milestoneDeadlineById.get(milestoneId);
  if (destination === undefined) {
    return Object.freeze({ milestoneId, relation: "deadline_absent" });
  }
  const relationship = subtractCalendarValues(
    declaredCalendar(subject.input.deadline),
    declaredCalendar(destination.deadline),
  );
  if (relationship.state === "unavailable") {
    return Object.freeze({ milestoneId, relation: "unavailable" });
  }
  const order = compare(relationship.difference.exact, ZERO);
  return Object.freeze({
    milestoneId,
    relation: order < 0
      ? "task_deadline_before_milestone"
      : order > 0
        ? "task_deadline_after_milestone"
        : "same_deadline",
  });
}

function combined(
  completionState: DeadlineEvaluation["completionState"],
  current: DeadlineCurrentState,
  precedence: DeadlineView,
  resource: DeadlineView,
): DeadlineEvaluation["combinedAssessment"] {
  if (completionState === "complete_actual_time_unavailable") {
    return "not_applicable";
  }
  if (current.state === "overdue") return "overdue";
  if (precedence.assessment === "lower_bound_late") {
    return "forecast_infeasible";
  }
  if (resource.assessment === "heuristic_late") return "at_risk";
  if (resource.assessment === "heuristic_on_time") {
    return "forecast_on_time";
  }
  if (precedence.assessment === "lower_bound_on_time") {
    return "not_proven_late";
  }
  return "unavailable";
}

export function evaluateTemporalDeadlines(
  validated:
    | TargetGrammar3ValidatedDocument
    | TargetGrammar4ValidatedDocument
    | TargetGrammar5ValidatedDocument,
  inputs: TargetTemporalInputProjection,
  precedenceSchedule: TemporalPrecedenceSchedule,
  resourceSchedule: TemporalResourceSchedule,
): readonly DeadlineEvaluation[] {
  if (
    validated.document.declarations.find(({ kind }) => kind === "project")
      ?.id !== inputs.documentId ||
    validated.grammarVersion !== inputs.grammarVersion
  ) {
    throw new TypeError(
      "temporal input projection does not match the validated document",
    );
  }
  const declarationById = new Map(
    validated.document.declarations.map((declaration) => [
      `${declaration.kind}:${declaration.id}`,
      declaration,
    ]),
  );
  const subjects: DeadlineSubject[] = [
    ...inputs.tasks.flatMap((task) => {
      if (task.deadline === null) return [];
      return [{
        declaration: declarationById.get(`task:${task.taskId}`)!,
        kind: "task" as const,
        id: task.taskId,
        input: task.deadline,
      }];
    }),
    ...inputs.milestoneDeadlines.map((milestone) => ({
      declaration: declarationById.get(
        `milestone:${milestone.milestoneId}`,
      )!,
      kind: "milestone" as const,
      id: milestone.milestoneId,
      input: milestone.deadline,
    })),
  ];
  const project = validated.document.declarations.find(
    ({ kind }) => kind === "project",
  )!;
  const finishId = fieldNamed(project, "finish")!.value as string;
  const milestoneDeadlineById = new Map(
    inputs.milestoneDeadlines.map((item) => [
      item.milestoneId,
      item.deadline,
    ]),
  );

  return Object.freeze(subjects.map((subject): DeadlineEvaluation => {
    const blockedTaskIds = predecessorBlockedTaskIds(
      validated.document,
      subject,
    );
    const current = currentState(
      subject,
      inputs.anchor,
      inputs.effectiveProjection,
    );
    const precedence = deadlineView(
      subject,
      completionRelative(subject, precedenceSchedule),
      precedenceSchedule,
      "precedence",
      inputs.anchor,
      inputs.effectiveProjection,
      blockedTaskIds,
    );
    const resource = deadlineView(
      subject,
      completionRelative(subject, resourceSchedule),
      resourceSchedule,
      "resource",
      inputs.anchor,
      inputs.effectiveProjection,
      blockedTaskIds,
    );
    const roles = subject.kind === "task"
      ? ["task" as const]
      : [
          "milestone" as const,
          ...(subject.id === finishId
            ? ["project_finish" as const]
            : []),
        ];
    return Object.freeze({
      subject: Object.freeze({
        kind: subject.kind,
        id: subject.id,
        roles: Object.freeze(roles),
      }),
      deadline: subject.input.deadline,
      completionState: subject.input.completionState,
      current,
      precedence,
      resource,
      combinedAssessment: combined(
        subject.input.completionState,
        current,
        precedence,
        resource,
      ),
      conditionalOnBlocksResolved: blockedTaskIds.length > 0,
      blockedTaskIds,
      destinationRelationship: destinationRelationship(
        subject,
        milestoneDeadlineById,
      ),
    });
  }));
}
