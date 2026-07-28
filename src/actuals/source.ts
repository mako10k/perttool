import type {
  DeclaredCalendarDateTime,
} from "../model/calendar.js";
import type {
  SourceSpan,
} from "../model/diagnostics.js";
import {
  rational,
  rationalFromDuration,
  type Rational,
} from "../model/rational.js";
import type {
  DeclarationNode,
  ExactDurationValue,
  ExactPersonHoursValue,
  FieldNode,
  TargetDeclarationKind,
  WorkEventKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type {
  TargetGrammar5ValidatedDocument,
} from "../semantic/target-validator.js";

export const ACTUALS_SOURCE_MODEL_VERSION = 1 as const;

export type ActualsDurationUnit = "day" | "hour" | "point";

export interface ActualsExactValue {
  readonly value: Rational;
  readonly sourceText: string;
  readonly valueSpan: SourceSpan;
}

export interface PlannedActualValue extends ActualsExactValue {
  readonly unit: ActualsDurationUnit;
}

export interface ActualWorkEvent {
  readonly id: string;
  readonly model: 1;
  readonly taskId: string;
  readonly kind: WorkEventKind;
  readonly occurredAt: DeclaredCalendarDateTime;
  readonly plannedValue: PlannedActualValue | null;
  readonly activeTime: ActualsExactValue | null;
  readonly effort: ActualsExactValue | null;
  readonly reason: string | null;
  readonly declarationSpan: SourceSpan;
  readonly idSpan: SourceSpan;
}

export interface ProjectActualsSourceModel {
  readonly modelVersion: typeof ACTUALS_SOURCE_MODEL_VERSION;
  readonly grammarVersion: 1 | 2 | 3 | 4 | 5;
  readonly events: readonly ActualWorkEvent[];
}

function requiredField(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): FieldNode {
  const field = fieldNamed(declaration, name);
  if (field === undefined) {
    throw new Error(
      `validated work_event ${declaration.id} is missing ${name}`,
    );
  }
  return field;
}

function exactDuration(field: FieldNode): ExactDurationValue {
  if (
    field.value === null ||
    typeof field.value !== "object" ||
    !("suffix" in field.value) ||
    (
      !("digits" in field.value) &&
      !("numerator" in field.value)
    )
  ) {
    throw new Error(`validated ${field.name} is not an exact duration`);
  }
  return field.value as ExactDurationValue;
}

function exactPersonHours(field: FieldNode): ExactPersonHoursValue {
  if (
    field.value === null ||
    typeof field.value !== "object" ||
    !("suffix" in field.value) ||
    field.value.suffix !== "ph" ||
    (
      !("digits" in field.value) &&
      !("numerator" in field.value)
    )
  ) {
    throw new Error("validated effort is not an exact person-hour value");
  }
  return field.value as ExactPersonHoursValue;
}

function exactPersonHoursRational(value: ExactPersonHoursValue): Rational {
  return "numerator" in value
    ? rational(value.numerator, value.denominator)
    : rational(value.digits, 10n ** BigInt(value.scale));
}

function exactValue(
  field: FieldNode | undefined,
  kind: "duration" | "person_hours",
): ActualsExactValue | null {
  if (field === undefined) return null;
  const value = kind === "duration"
    ? rationalFromDuration(exactDuration(field))
    : exactPersonHoursRational(exactPersonHours(field));
  return Object.freeze({
    value,
    sourceText: field.rawValue,
    valueSpan: field.valueSpan,
  });
}

function plannedValue(
  field: FieldNode | undefined,
): PlannedActualValue | null {
  if (field === undefined) return null;
  const duration = exactDuration(field);
  const unit: ActualsDurationUnit =
    duration.suffix === "d"
      ? "day"
      : duration.suffix === "h"
        ? "hour"
        : "point";
  return Object.freeze({
    value: rationalFromDuration(duration),
    unit,
    sourceText: field.rawValue,
    valueSpan: field.valueSpan,
  });
}

function eventFromDeclaration(
  declaration: DeclarationNode<TargetDeclarationKind>,
): ActualWorkEvent {
  const model = requiredField(declaration, "model").value;
  const taskId = requiredField(declaration, "task").value;
  const kind = requiredField(declaration, "kind").value;
  const occurredAt = requiredField(declaration, "occurred_at").value;
  if (model !== 1) {
    throw new Error(`validated work_event ${declaration.id} has unknown model`);
  }
  if (typeof taskId !== "string") {
    throw new Error(`validated work_event ${declaration.id} has invalid task`);
  }
  if (
    kind !== "start" &&
    kind !== "suspend" &&
    kind !== "resume" &&
    kind !== "finish"
  ) {
    throw new Error(`validated work_event ${declaration.id} has invalid kind`);
  }
  if (
    occurredAt === null ||
    typeof occurredAt !== "object" ||
    !("kind" in occurredAt) ||
    occurredAt.kind !== "date_time"
  ) {
    throw new Error(
      `validated work_event ${declaration.id} has invalid occurred_at`,
    );
  }
  const reason = fieldNamed(declaration, "reason")?.value;
  if (reason !== undefined && typeof reason !== "string") {
    throw new Error(`validated work_event ${declaration.id} has invalid reason`);
  }
  return Object.freeze({
    id: declaration.id,
    model: 1,
    taskId,
    kind,
    occurredAt: occurredAt as DeclaredCalendarDateTime,
    plannedValue: plannedValue(fieldNamed(declaration, "planned_value")),
    activeTime: exactValue(
      fieldNamed(declaration, "active_time"),
      "duration",
    ),
    effort: exactValue(fieldNamed(declaration, "effort"), "person_hours"),
    reason: reason ?? null,
    declarationSpan: declaration.span,
    idSpan: declaration.idSpan,
  });
}

export function projectActualsSourceModel(
  validated: TargetGrammar5ValidatedDocument,
): ProjectActualsSourceModel {
  const events = validated.document.declarations
    .filter((declaration) => declaration.kind === "work_event")
    .map(eventFromDeclaration);
  return Object.freeze({
    modelVersion: ACTUALS_SOURCE_MODEL_VERSION,
    grammarVersion: validated.grammarVersion,
    events: Object.freeze(events),
  });
}

export function workEventsForTask(
  model: ProjectActualsSourceModel,
  taskId: string,
): readonly ActualWorkEvent[] {
  return Object.freeze(
    model.events.filter((event) => event.taskId === taskId),
  );
}
