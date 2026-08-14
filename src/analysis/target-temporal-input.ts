import type { Diagnostic } from "../model/diagnostics.js";
import type {
  DeclarationNode,
  DocumentNode,
  ExactDurationValue,
  TargetDeclarationKind,
  VelocityValue,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  CALENDAR_ARITHMETIC_IDENTITY,
  subtractCalendarValues,
  type CalendarDifference,
  type CalendarUnavailableCause,
} from "../model/calendar-arithmetic.js";
import type { DeclaredCalendarValue } from "../model/calendar.js";
import {
  parseDeclaredCalendarValue,
} from "../model/calendar.js";
import type { Rational } from "../model/rational.js";
import {
  ZERO,
  compare,
  divide,
  multiply,
  rational,
  rationalFromDuration,
} from "../model/rational.js";
import {
  projectDeclaredCalendarValue,
  type TargetCalendarValue,
} from "../model/target-calendar.js";
import type {
  CalendarUnit,
  DurationUnit,
  Velocity,
} from "../model/units.js";
import type {
  TargetGrammar3Capability,
  TargetGrammar4Capability,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar4Document,
  validateTargetGrammar3Document,
  type TargetGrammar3ValidatedDocument,
  type TargetGrammar4ValidatedDocument,
  type TargetGrammar5ValidatedDocument,
  type TargetValidationOptions,
} from "../semantic/target-validator.js";

export interface TargetTemporalCause {
  readonly cause: CalendarUnavailableCause;
  readonly underlyingCause: null;
  readonly subjectKind: "project" | "milestone" | "task" | null;
  readonly subjectId: string | null;
  readonly taskId: string | null;
}

export interface TargetTemporalExactValue {
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly unit: DurationUnit;
}

export interface TargetCalendarDifference {
  readonly kind: CalendarDifference["kind"];
  readonly exact: {
    readonly numerator: bigint;
    readonly denominator: bigint;
  };
}

export interface TargetEffectiveProjection {
  readonly baseUnit: DurationUnit;
  readonly effectiveUnit: CalendarUnit | null;
  readonly qualifier: "base_unit" | "velocity_forecast";
  readonly velocity: {
    readonly points: TargetTemporalExactValue & { readonly unit: "point" };
    readonly period: TargetTemporalExactValue & {
      readonly unit: CalendarUnit;
    };
  } | null;
}

export interface TargetTemporalRelationship {
  readonly state: "unavailable" | "available";
  readonly calendarDifference: TargetCalendarDifference | null;
  readonly baseUnitValue: TargetTemporalExactValue | null;
  readonly unavailableCauses: readonly TargetTemporalCause[];
}

export interface TargetReleaseInput {
  readonly state: "not_applicable" | "unavailable" | "available";
  readonly bound: TargetTemporalExactValue | null;
  readonly relationship: TargetTemporalRelationship | null;
  readonly unavailableCauses: readonly TargetTemporalCause[];
}

export interface TargetDeadlineInput {
  readonly deadline: TargetCalendarValue;
  readonly completionState:
    | "incomplete"
    | "complete_actual_time_unavailable";
  readonly anchorRelationship: TargetTemporalRelationship | null;
}

export interface TargetMilestoneTemporalInput {
  readonly milestoneId: string;
  readonly deadline: TargetDeadlineInput;
}

export interface TargetTaskTemporalInput {
  readonly taskId: string;
  readonly status:
    | "planned"
    | "active"
    | "blocked"
    | "suspended"
    | "done";
  readonly declaredNotBefore: TargetCalendarValue | null;
  readonly release: TargetReleaseInput;
  readonly deadline: TargetDeadlineInput | null;
}

export interface TargetTemporalInputProjection {
  readonly calendar: typeof CALENDAR_ARITHMETIC_IDENTITY;
  readonly documentId: string;
  readonly grammarVersion: 1 | 2 | 3 | 4 | 5;
  readonly anchor: TargetCalendarValue | null;
  readonly effectiveProjection: TargetEffectiveProjection;
  readonly milestoneDeadlines: readonly TargetMilestoneTemporalInput[];
  readonly tasks: readonly TargetTaskTemporalInput[];
}

export interface TargetTemporalInputResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly projection: TargetTemporalInputProjection | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export function assertTemporalScheduleStatusProjection(
  document: DocumentNode<TargetDeclarationKind>,
): void {
  const suspended = document.declarations.find(
    (declaration) =>
      declaration.kind === "task" &&
      fieldNamed(declaration, "status")?.value === "suspended",
  );
  if (suspended !== undefined) {
    throw new TypeError(
      `temporal scheduling requires a projected non-suspended status for task ${suspended.id}`,
    );
  }
}

function declaredCalendarField(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): DeclaredCalendarValue | null {
  const field = fieldNamed(declaration, name);
  if (field === undefined) return null;
  if (
    typeof field.value === "object" &&
    field.value !== null &&
    "kind" in field.value
  ) {
    return field.value as DeclaredCalendarValue;
  }
  return parseDeclaredCalendarValue(field.rawValue) ?? null;
}

function exactValue<Unit extends DurationUnit>(
  value: Rational,
  unit: Unit,
): TargetTemporalExactValue & { readonly unit: Unit } {
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

function cause(
  unavailableCause: CalendarUnavailableCause,
  subjectKind: TargetTemporalCause["subjectKind"],
  subjectId: string | null,
  taskId: string | null,
): TargetTemporalCause {
  return Object.freeze({
    cause: unavailableCause,
    underlyingCause: null,
    subjectKind,
    subjectId,
    taskId,
  });
}

function exactDuration(value: unknown): Rational {
  return rationalFromDuration(value as ExactDurationValue);
}

function effectiveProjection(
  project: DeclarationNode<TargetDeclarationKind>,
): {
  readonly value: TargetEffectiveProjection;
  readonly velocity: Velocity | null;
} {
  const baseUnit = fieldNamed(project, "duration_unit")!.value as DurationUnit;
  const declared = fieldNamed(project, "velocity")?.value as
    | VelocityValue
    | undefined;
  const velocity = declared === undefined
    ? null
    : Object.freeze({
        points: exactDuration(declared.points),
        period: exactDuration(declared.period),
        periodUnit: declared.period.suffix === "d" ? "day" : "hour",
      } satisfies Velocity);
  const effectiveUnit = baseUnit === "point"
    ? velocity?.periodUnit ?? null
    : baseUnit;
  return {
    velocity,
    value: Object.freeze({
      baseUnit,
      effectiveUnit,
      qualifier: baseUnit === "point" ? "velocity_forecast" : "base_unit",
      velocity: velocity === null
        ? null
        : Object.freeze({
            points: exactValue(velocity.points, "point"),
            period: exactValue(velocity.period, velocity.periodUnit),
          }),
    }),
  };
}

function differenceToBaseUnit(
  difference: CalendarDifference,
  baseUnit: DurationUnit,
  velocity: Velocity | null,
): { readonly value: Rational | null; readonly cause: CalendarUnavailableCause | null } {
  if (baseUnit === "point" && velocity === null) {
    return { value: null, cause: "missing_velocity" };
  }
  const effectiveUnit = baseUnit === "point"
    ? velocity!.periodUnit
    : baseUnit;
  if (difference.kind === "calendar_days" && effectiveUnit === "hour") {
    return { value: null, cause: "date_anchor_has_no_clock" };
  }
  const effectiveValue = difference.kind === "calendar_days"
    ? difference.exact
    : divide(
        difference.exact,
        rational(effectiveUnit === "day" ? 86_400n : 3_600n),
      );
  return {
    value: baseUnit === "point"
      ? multiply(effectiveValue, divide(velocity!.points, velocity!.period))
      : effectiveValue,
    cause: null,
  };
}

function relationship(
  anchor: DeclaredCalendarValue,
  value: DeclaredCalendarValue,
  projection: TargetEffectiveProjection,
  velocity: Velocity | null,
  subjectKind: TargetTemporalCause["subjectKind"],
  subjectId: string,
  taskId: string | null,
): TargetTemporalRelationship {
  const calendar = subtractCalendarValues(value, anchor);
  if (calendar.state === "unavailable") {
    return Object.freeze({
      state: "unavailable",
      calendarDifference: null,
      baseUnitValue: null,
      unavailableCauses: Object.freeze([
        cause(calendar.cause, subjectKind, subjectId, taskId),
      ]),
    });
  }
  const converted = differenceToBaseUnit(
    calendar.difference,
    projection.baseUnit,
    velocity,
  );
  if (converted.cause !== null) {
    return Object.freeze({
      state: "unavailable",
      calendarDifference: differenceValue(calendar.difference),
      baseUnitValue: null,
      unavailableCauses: Object.freeze([
        cause(converted.cause, subjectKind, subjectId, taskId),
      ]),
    });
  }
  return Object.freeze({
    state: "available",
    calendarDifference: differenceValue(calendar.difference),
    baseUnitValue: exactValue(converted.value!, projection.baseUnit),
    unavailableCauses: Object.freeze([]),
  });
}

function deadlineInput(
  declaration: DeclarationNode<TargetDeclarationKind>,
  anchor: DeclaredCalendarValue | null,
  projection: TargetEffectiveProjection,
  velocity: Velocity | null,
  complete: boolean,
): TargetDeadlineInput | null {
  const declared = declaredCalendarField(declaration, "deadline");
  if (declared === null) return null;
  const projected = projectDeclaredCalendarValue(declared);
  if (projected === null) {
    throw new Error("validated temporal deadline could not be projected");
  }
  return Object.freeze({
    deadline: projected,
    completionState: complete
      ? "complete_actual_time_unavailable"
      : "incomplete",
    anchorRelationship: complete || anchor === null
      ? null
      : relationship(
          anchor,
          declared,
          projection,
          velocity,
          declaration.kind as "milestone" | "task",
          declaration.id,
          declaration.kind === "task" ? declaration.id : null,
        ),
  });
}

export function projectTargetTemporalInputs(
  validated:
    | TargetGrammar3ValidatedDocument
    | TargetGrammar4ValidatedDocument
    | TargetGrammar5ValidatedDocument,
): TargetTemporalInputProjection {
  const document = validated.document;
  const project = document.declarations.find(
    (declaration) => declaration.kind === "project",
  );
  if (project === undefined) {
    throw new TypeError("validated target document must contain a project");
  }
  const effective = effectiveProjection(project);
  const declaredAnchor = declaredCalendarField(project, "as_of");
  const anchor = declaredAnchor === null
    ? null
    : projectDeclaredCalendarValue(declaredAnchor);
  if (declaredAnchor !== null && anchor === null) {
    throw new Error("validated temporal anchor could not be projected");
  }

  const milestoneDeadlines = document.declarations
    .filter((declaration) => declaration.kind === "milestone")
    .flatMap((declaration) => {
      const deadline = deadlineInput(
        declaration,
        declaredAnchor,
        effective.value,
        effective.velocity,
        fieldNamed(declaration, "state")?.value === "reached",
      );
      return deadline === null
        ? []
        : [Object.freeze({ milestoneId: declaration.id, deadline })];
    });

  const tasks = document.declarations
    .filter((declaration) => declaration.kind === "task")
    .map((declaration): TargetTaskTemporalInput => {
      const status = (
        fieldNamed(declaration, "status")?.value ?? "planned"
      ) as TargetTaskTemporalInput["status"];
      const declaredNotBefore = declaredCalendarField(
        declaration,
        "not_before",
      );
      const notBefore = declaredNotBefore === null
        ? null
        : projectDeclaredCalendarValue(declaredNotBefore);
      if (declaredNotBefore !== null && notBefore === null) {
        throw new Error("validated not_before could not be projected");
      }
      const releaseRelationship =
        declaredAnchor === null || declaredNotBefore === null
          ? null
          : relationship(
              declaredAnchor,
              declaredNotBefore,
              effective.value,
              effective.velocity,
              "task",
              declaration.id,
              declaration.id,
            );
      const release: TargetReleaseInput =
        status === "active" ||
          status === "suspended" ||
          status === "done"
          ? Object.freeze({
              state: "not_applicable",
              bound: null,
              relationship: releaseRelationship,
              unavailableCauses: Object.freeze([]),
            })
          : declaredAnchor === null
            ? Object.freeze({
                state: "unavailable",
                bound: null,
                relationship: null,
                unavailableCauses: Object.freeze([
                  cause(
                    "missing_temporal_anchor",
                    "task",
                    declaration.id,
                    declaration.id,
                  ),
                ]),
              })
            : releaseRelationship?.state === "unavailable"
              ? Object.freeze({
                  state: "unavailable",
                  bound: null,
                  relationship: releaseRelationship,
                  unavailableCauses:
                    releaseRelationship.unavailableCauses,
                })
              : Object.freeze({
                  state: "available",
                  bound: exactValue(
                    releaseRelationship === null ||
                        compare(
                          releaseRelationship.baseUnitValue!,
                          ZERO,
                        ) <= 0
                      ? ZERO
                      : releaseRelationship.baseUnitValue!,
                    effective.value.baseUnit,
                  ),
                  relationship: releaseRelationship,
                  unavailableCauses: Object.freeze([]),
                });
      return Object.freeze({
        taskId: declaration.id,
        status,
        declaredNotBefore: notBefore,
        release,
        deadline: deadlineInput(
          declaration,
          declaredAnchor,
          effective.value,
          effective.velocity,
          status === "done",
        ),
      });
    });

  return Object.freeze({
    calendar: CALENDAR_ARITHMETIC_IDENTITY,
    documentId: project.id,
    grammarVersion: validated.grammarVersion,
    anchor,
    effectiveProjection: effective.value,
    milestoneDeadlines: Object.freeze(milestoneDeadlines),
    tasks: Object.freeze(tasks),
  });
}

export function prepareTargetTemporalInputs(
  text: string,
  capability: TargetGrammar3Capability | TargetGrammar4Capability,
  options: TargetValidationOptions = {},
): TargetTemporalInputResult {
  const checked = capability.grammarVersion === 4
    ? validateTargetGrammar4Document(text, capability, options)
    : validateTargetGrammar3Document(text, capability, options);
  return Object.freeze({
    ok: checked.ok,
    documentId: checked.documentId,
    grammarVersion: checked.grammarVersion,
    projection: checked.validatedDocument === null
      ? null
      : projectTargetTemporalInputs(checked.validatedDocument),
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  });
}
