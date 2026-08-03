import type {
  Diagnostic,
  RelatedLocation,
  SourceSpan,
} from "../model/diagnostics.js";
import {
  compareStableStrings,
  hasErrors,
  sortDiagnostics,
} from "../model/diagnostics.js";
import type {
  AcceptedPlanningInputValue,
  AssuranceConsumerValue,
  DeclarationNode,
  DocumentNode,
  ExactDurationValue,
  FieldNode,
  RequirementValue,
  TargetDeclarationKind,
  VelocityValue,
} from "../model/syntax.js";
import {
  compareDurations,
  fieldNamed,
  fieldsNamed,
  isZeroDuration,
} from "../model/syntax.js";
import {
  add,
  compare,
  divide,
  multiply,
  rational,
  rationalFromDuration,
  type Rational,
} from "../model/rational.js";

type AnyDeclarationNode = DeclarationNode<TargetDeclarationKind>;
type AnyDocumentNode = DocumentNode<TargetDeclarationKind>;

const reservedWords = new Set([
  "project",
  "resource",
  "milestone",
  "task",
  "gate",
  "version",
  "title",
  "description",
  "as_of",
  "duration_unit",
  "velocity",
  "finish",
  "critical_epsilon",
  "target_duration",
  "state",
  "tags",
  "duration",
  "estimate",
  "optimistic",
  "most_likely",
  "pessimistic",
  "status",
  "priority",
  "owner",
  "blocked_reason",
  "source",
  "reason",
  "capacity",
  "requires",
  "planned",
  "reached",
  "active",
  "blocked",
  "done",
  "day",
  "hour",
  "point",
]);

interface Edge {
  readonly declaration: AnyDeclarationNode;
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

interface ValidationProfile {
  readonly supportedGrammarVersions: ReadonlySet<number>;
  readonly unsupportedVersionMessage: string;
  readonly temporalAnchorGrammarVersions: ReadonlySet<number>;
  readonly workEvents: boolean;
  readonly assuranceRecords: boolean;
}

const grammar1ValidationProfile: ValidationProfile = {
  supportedGrammarVersions: new Set([1]),
  unsupportedVersionMessage: "Only grammar version 1 is supported",
  temporalAnchorGrammarVersions: new Set(),
  workEvents: false,
  assuranceRecords: false,
};

const targetValidationProfile: ValidationProfile = {
  supportedGrammarVersions: new Set([1, 2]),
  unsupportedVersionMessage: "Only grammar versions 1 and 2 are supported",
  temporalAnchorGrammarVersions: new Set([2]),
  workEvents: false,
  assuranceRecords: false,
};

const targetGrammar3ValidationProfile: ValidationProfile = {
  supportedGrammarVersions: new Set([1, 2, 3]),
  unsupportedVersionMessage: "Only grammar versions 1, 2, and 3 are supported",
  temporalAnchorGrammarVersions: new Set([2, 3]),
  workEvents: false,
  assuranceRecords: false,
};

const targetGrammar4ValidationProfile: ValidationProfile = {
  supportedGrammarVersions: new Set([1, 2, 3, 4]),
  unsupportedVersionMessage:
    "Only grammar versions 1, 2, 3, and 4 are supported",
  temporalAnchorGrammarVersions: new Set([2, 3, 4]),
  workEvents: false,
  assuranceRecords: false,
};

const targetGrammar5ValidationProfile: ValidationProfile = {
  supportedGrammarVersions: new Set([1, 2, 3, 4, 5]),
  unsupportedVersionMessage:
    "Only grammar versions 1, 2, 3, 4, and 5 are supported",
  temporalAnchorGrammarVersions: new Set([2, 3, 4, 5]),
  workEvents: true,
  assuranceRecords: false,
};

const targetGrammar6ValidationProfile: ValidationProfile = {
  supportedGrammarVersions: new Set([1, 2, 3, 4, 5, 6]),
  unsupportedVersionMessage:
    "Only grammar versions 1, 2, 3, 4, 5, and 6 are supported",
  temporalAnchorGrammarVersions: new Set([2, 3, 4, 5, 6]),
  workEvents: true,
  assuranceRecords: true,
};

function makeDiagnostic(
  code: string,
  severity: "error" | "warning",
  message: string,
  diagnosticSpan: SourceSpan,
  helpTopic: string,
  entityId?: string,
  related?: readonly RelatedLocation[],
  data?: Readonly<Record<string, unknown>>,
): Diagnostic {
  return {
    code,
    severity,
    message,
    span: diagnosticSpan,
    helpTopic,
    ...(entityId === undefined ? {} : { entityId }),
    ...(related === undefined || related.length === 0 ? {} : { related }),
    ...(data === undefined ? {} : { data }),
  };
}

function zeroSpan(document: AnyDocumentNode): SourceSpan {
  return {
    start: { offset: 0, line: 0, column: 0 },
    end: { offset: document.text.length === 0 ? 0 : 1, line: 0, column: document.text.length === 0 ? 0 : 1 },
  };
}

function requireField(
  declaration: AnyDeclarationNode,
  fieldName: string,
  diagnostics: Diagnostic[],
): FieldNode | undefined {
  const fields = fieldsNamed(declaration, fieldName);
  if (fields.length === 0) {
    diagnostics.push(
      makeDiagnostic(
        "PTSEM-101",
        "error",
        `${declaration.kind} ${declaration.id} is missing required field ${fieldName}`,
        declaration.idSpan,
        `syntax.${declaration.kind}`,
        declaration.id,
      ),
    );
    return undefined;
  }
  return fields[0];
}

function validateDuplicateFields(
  declaration: AnyDeclarationNode,
  diagnostics: Diagnostic[],
): void {
  const firstByName = new Map<string, FieldNode>();
  for (const field of declaration.fields) {
    const first = firstByName.get(field.name);
    if (first === undefined) {
      firstByName.set(field.name, field);
      continue;
    }
    diagnostics.push(
      makeDiagnostic(
        "PTSEM-102",
        "error",
        `Field ${field.name} is duplicated in ${declaration.kind} ${declaration.id}`,
        field.span,
        `syntax.${declaration.kind}`,
        declaration.id,
        [{ message: "First field", span: first.span }],
      ),
    );
  }
}

function durationValue(
  field: FieldNode | undefined,
): ExactDurationValue | undefined {
  if (field === undefined || typeof field.value !== "object" || field.value === null) {
    return undefined;
  }
  if (!("suffix" in field.value)) return undefined;
  if (
    field.value.suffix !== "d" &&
    field.value.suffix !== "h" &&
    field.value.suffix !== "p"
  ) {
    return undefined;
  }
  return (
    ("digits" in field.value && "scale" in field.value) ||
    ("numerator" in field.value && "denominator" in field.value)
  )
    ? (field.value as ExactDurationValue)
    : undefined;
}

function velocityValue(field: FieldNode | undefined): VelocityValue | undefined {
  if (field === undefined || typeof field.value !== "object" || field.value === null) {
    return undefined;
  }
  return "points" in field.value && "period" in field.value
    ? (field.value as VelocityValue)
    : undefined;
}

function validateNonemptyText(
  declaration: AnyDeclarationNode,
  fieldName: string,
  diagnostics: Diagnostic[],
): void {
  const field = fieldNamed(declaration, fieldName);
  if (field !== undefined && typeof field.value === "string" && field.value.length === 0) {
    diagnostics.push(
      makeDiagnostic(
        "PTSEM-106",
        "error",
        `${fieldName} must not be empty`,
        field.valueSpan,
        `syntax.${declaration.kind}`,
        declaration.id,
      ),
    );
  }
}

function validateTags(
  declaration: AnyDeclarationNode,
  diagnostics: Diagnostic[],
): void {
  const field = fieldNamed(declaration, "tags");
  if (field === undefined || !Array.isArray(field.value)) return;
  const seen = new Set<string>();
  for (const tag of field.value) {
    if (typeof tag !== "string") continue;
    if (seen.has(tag)) {
      diagnostics.push(
        makeDiagnostic(
          "PTSEM-107",
          "error",
          `Tag ${tag} is duplicated`,
          field.valueSpan,
          "syntax.tags",
          declaration.id,
        ),
      );
      return;
    }
    seen.add(tag);
  }
}

function validateGovernanceDelegates(
  declaration: AnyDeclarationNode,
  diagnostics: Diagnostic[],
): void {
  if (declaration.kind !== "project") return;
  for (const fieldName of ["goal_delegates", "dag_delegates"]) {
    const field = fieldNamed(declaration, fieldName);
    if (field === undefined || !Array.isArray(field.value)) continue;
    const seen = new Set<string>();
    for (const principal of field.value) {
      if (typeof principal !== "string") continue;
      if (seen.has(principal)) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-113",
            "error",
            `Principal ${principal} is duplicated in ${fieldName}`,
            field.valueSpan,
            "syntax.project",
            declaration.id,
          ),
        );
        break;
      }
      seen.add(principal);
    }
  }
}

function isValidIsoDate(raw: string): boolean {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateMatch !== null) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw) &&
    !Number.isNaN(Date.parse(raw))
  );
}

function validateFieldConstraints(
  document: AnyDocumentNode,
  diagnostics: Diagnostic[],
  profile: ValidationProfile,
): void {
  const projects = document.declarations.filter((declaration) => declaration.kind === "project");
  if (projects.length === 0) {
    diagnostics.push(
      makeDiagnostic(
        "PTSEM-101",
        "error",
        "Missing project declaration",
        zeroSpan(document),
        "syntax.project",
      ),
    );
  }
  if (projects.length > 1) {
    const first = projects[0]!;
    for (const project of projects.slice(1)) {
      diagnostics.push(
        makeDiagnostic(
          "PTSEM-201",
          "error",
          "There must be exactly one project declaration",
          project.idSpan,
          "syntax.project",
          project.id,
          [{ message: "First project", span: first.idSpan }],
        ),
      );
    }
  }
  const firstDeclaration = document.declarations[0];
  if (firstDeclaration !== undefined && firstDeclaration.kind !== "project") {
    diagnostics.push(
      makeDiagnostic(
        "PTDSL-003",
        "error",
        "The project must be the first declaration",
        firstDeclaration.idSpan,
        "syntax.top-level",
        firstDeclaration.id,
      ),
    );
  }

  for (const declaration of document.declarations) {
    validateDuplicateFields(declaration, diagnostics);
    validateTags(declaration, diagnostics);
    validateGovernanceDelegates(declaration, diagnostics);
    validateNonemptyText(declaration, "title", diagnostics);
    validateNonemptyText(declaration, "description", diagnostics);
    if (declaration.kind === "project") {
      const title = requireField(declaration, "title", diagnostics);
      const durationUnit = requireField(declaration, "duration_unit", diagnostics);
      const velocityField = fieldNamed(declaration, "velocity");
      const velocity = velocityValue(velocityField);
      requireField(declaration, "finish", diagnostics);
      const version = fieldNamed(declaration, "version");
      if (
        version !== undefined &&
        typeof version.value === "number" &&
        !profile.supportedGrammarVersions.has(version.value)
      ) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-108",
            "error",
            profile.unsupportedVersionMessage,
            version.valueSpan,
            "syntax.project",
            declaration.id,
          ),
        );
      }
      const asOf = fieldNamed(declaration, "as_of");
      if (asOf !== undefined && typeof asOf.value === "string" && !isValidIsoDate(asOf.value)) {
        diagnostics.push(
          makeDiagnostic(
            "PTDSL-008",
            "error",
            "as_of is not a valid ISO date or date-time",
            asOf.valueSpan,
            "syntax.project",
            declaration.id,
          ),
        );
      }
      const criticalEpsilon = durationValue(fieldNamed(declaration, "critical_epsilon"));
      const targetDuration = durationValue(fieldNamed(declaration, "target_duration"));
      if (targetDuration !== undefined && isZeroDuration(targetDuration)) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-104",
            "error",
            "target_duration must be greater than 0",
            fieldNamed(declaration, "target_duration")!.valueSpan,
            "syntax.duration",
            declaration.id,
          ),
        );
      }
      void title;
      void criticalEpsilon;
      if (
        durationUnit !== undefined &&
        (durationUnit.value === "day" ||
          durationUnit.value === "hour" ||
          durationUnit.value === "point")
      ) {
        const expectedSuffix =
          durationUnit.value === "day" ? "d" : durationUnit.value === "hour" ? "h" : "p";
        for (const candidate of document.declarations) {
          for (const field of candidate.fields) {
            const values = field.children ?? [field];
            for (const valueField of values) {
              const value = durationValue(valueField);
              if (
                value !== undefined &&
                !(
                  candidate.kind === "work_event" &&
                  valueField.name === "active_time"
                ) &&
                value.suffix !== expectedSuffix
              ) {
                diagnostics.push(
                  makeDiagnostic(
                    "PTSEM-105",
                    "error",
                    `Duration suffix does not match project unit ${durationUnit.value}`,
                    valueField.valueSpan,
                    "syntax.duration",
                    candidate.id,
                  ),
                );
              }
            }
          }
        }
        if (durationUnit.value === "point" && velocityField === undefined) {
          diagnostics.push(
            makeDiagnostic(
              "PTSEM-111",
              "error",
              "duration_unit point requires velocity",
              durationUnit.valueSpan,
              "syntax.velocity",
              declaration.id,
            ),
          );
        }
        if (velocity !== undefined) {
          if (isZeroDuration(velocity.points) || isZeroDuration(velocity.period)) {
            diagnostics.push(
              makeDiagnostic(
                "PTSEM-111",
                "error",
                "Velocity point and period values must be greater than 0",
                velocityField!.valueSpan,
                "syntax.velocity",
                declaration.id,
              ),
            );
          }
          if (
            durationUnit.value !== "point" &&
            velocity.period.suffix !== expectedSuffix
          ) {
            diagnostics.push(
              makeDiagnostic(
                "PTSEM-111",
                "error",
                `Velocity period suffix does not match project unit ${durationUnit.value}`,
                velocityField!.valueSpan,
                "syntax.velocity",
                declaration.id,
              ),
            );
          }
        }
      }
    }
    if (declaration.kind === "resource") {
      requireField(declaration, "title", diagnostics);
      const capacity = requireField(declaration, "capacity", diagnostics);
      if (capacity !== undefined && typeof capacity.value === "number" && capacity.value < 1) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-109",
            "error",
            "Resource capacity must be at least 1",
            capacity.valueSpan,
            "syntax.resource",
            declaration.id,
          ),
        );
      }
    }
    if (declaration.kind === "milestone") {
      requireField(declaration, "title", diagnostics);
    }
    if (declaration.kind === "task") {
      requireField(declaration, "title", diagnostics);
      const durations = fieldsNamed(declaration, "duration");
      const estimates = fieldsNamed(declaration, "estimate");
      if (durations.length + estimates.length !== 1) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-103",
            "error",
            "A task must have exactly one of duration or estimate",
            declaration.idSpan,
            "syntax.task",
            declaration.id,
          ),
        );
      }
      const duration = durationValue(durations[0]);
      if (duration !== undefined && isZeroDuration(duration)) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-104",
            "error",
            "Task duration must be greater than 0",
            durations[0]!.valueSpan,
            "syntax.duration",
            declaration.id,
          ),
        );
      }
      const estimate = estimates[0];
      if (estimate !== undefined) {
        const children = estimate.children ?? [];
        for (const name of ["optimistic", "most_likely", "pessimistic"]) {
          const matching = children.filter((child) => child.name === name);
          if (matching.length !== 1) {
            diagnostics.push(
              makeDiagnostic(
                matching.length === 0 ? "PTSEM-101" : "PTSEM-102",
                "error",
                `Estimate requires exactly one ${name} value`,
                estimate.span,
                "syntax.estimate",
                declaration.id,
              ),
            );
          }
        }
        const optimistic = durationValue(children.find((child) => child.name === "optimistic"));
        const mostLikely = durationValue(children.find((child) => child.name === "most_likely"));
        const pessimistic = durationValue(children.find((child) => child.name === "pessimistic"));
        if (
          optimistic !== undefined &&
          mostLikely !== undefined &&
          pessimistic !== undefined &&
          (compareDurations(optimistic, mostLikely) > 0 ||
            compareDurations(mostLikely, pessimistic) > 0 ||
            isZeroDuration(pessimistic))
        ) {
          diagnostics.push(
            makeDiagnostic(
              "PTSEM-104",
              "error",
              "An estimate must satisfy optimistic <= most_likely <= pessimistic and pessimistic > 0",
              estimate.span,
              "syntax.estimate",
              declaration.id,
            ),
          );
        }
      }
      const status = fieldNamed(declaration, "status")?.value ?? "planned";
      const blockedReason = fieldNamed(declaration, "blocked_reason");
      if ((status === "blocked") !== (blockedReason !== undefined)) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-103",
            "error",
            "blocked_reason is required only when status=blocked",
            blockedReason?.span ?? fieldNamed(declaration, "status")?.span ?? declaration.idSpan,
            "syntax.task",
            declaration.id,
          ),
        );
      }
      validateNonemptyText(declaration, "blocked_reason", diagnostics);
      const requirements = fieldNamed(declaration, "requires");
      if (requirements !== undefined && Array.isArray(requirements.value)) {
        if (requirements.value.length === 0) {
          diagnostics.push(
            makeDiagnostic(
              "PTSEM-101",
              "error",
              "The requires block must contain at least one requirement",
              requirements.span,
              "syntax.task",
              declaration.id,
            ),
          );
        }
        const seen = new Map<string, RequirementValue>();
        for (const requirement of requirements.value as readonly RequirementValue[]) {
          const first = seen.get(requirement.resourceId);
          if (first !== undefined) {
            diagnostics.push(
              makeDiagnostic(
                "PTSEM-110",
                "error",
                `Resource requirement ${requirement.resourceId} is duplicated`,
                requirement.resourceSpan,
                "syntax.task",
                declaration.id,
                [{ message: "First requirement", span: first.resourceSpan }],
              ),
            );
          } else {
            seen.set(requirement.resourceId, requirement);
          }
          if (requirement.units < 1) {
            diagnostics.push(
              makeDiagnostic(
                "PTSEM-109",
                "error",
                "Requirement units must be at least 1",
                requirement.unitsSpan,
                "syntax.resource",
                declaration.id,
              ),
            );
          }
        }
      }
    }
    if (declaration.kind === "gate") {
      requireField(declaration, "reason", diagnostics);
      validateNonemptyText(declaration, "reason", diagnostics);
    }
  }

  if (projects.length !== 1) return;
  const project = projects[0]!;
  const version = fieldNamed(project, "version")?.value ?? 1;
  if (
    typeof version !== "number" ||
    !profile.temporalAnchorGrammarVersions.has(version) ||
    fieldNamed(project, "as_of") !== undefined
  ) {
    return;
  }
  for (const declaration of document.declarations) {
    for (const field of declaration.fields) {
      if (field.name !== "deadline" && field.name !== "not_before") continue;
      diagnostics.push(
        makeDiagnostic(
          "PTSEM-112",
          "error",
          `${declaration.kind} ${declaration.id}.${field.name} requires project.as_of`,
          field.valueSpan,
          "syntax.temporal",
          declaration.id,
        ),
      );
    }
  }
}

function eventDiagnostic(
  code: "PTACT-101" | "PTACT-102" | "PTACT-103",
  message: string,
  declaration: AnyDeclarationNode,
  span: SourceSpan,
  cause:
    | "unsupported_event_model"
    | "missing_task"
    | "wrong_entity_kind"
    | "missing_field"
    | "forbidden_field"
    | "planned_value_mismatch",
  related?: readonly RelatedLocation[],
): Diagnostic {
  return makeDiagnostic(
    code,
    "error",
    message,
    span,
    "syntax.work-event",
    declaration.id,
    related,
    { cause },
  );
}

function taskExpectedValue(task: AnyDeclarationNode): Rational {
  const duration = durationValue(fieldNamed(task, "duration"));
  if (duration !== undefined) return rationalFromDuration(duration);
  const estimate = fieldNamed(task, "estimate");
  if (estimate === undefined) {
    throw new Error(`validated task ${task.id} has no duration or estimate`);
  }
  const children = estimate.children ?? [];
  const value = (name: string): Rational => {
    const durationValueForChild = durationValue(
      children.find((field) => field.name === name),
    );
    if (durationValueForChild === undefined) {
      throw new Error(`validated task ${task.id} estimate is missing ${name}`);
    }
    return rationalFromDuration(durationValueForChild);
  };
  return divide(
    add(
      add(value("optimistic"), multiply(rational(4n), value("most_likely"))),
      value("pessimistic"),
    ),
    rational(6n),
  );
}

function validateWorkEvents(
  document: AnyDocumentNode,
  diagnostics: Diagnostic[],
): void {
  const entities = new Map<string, AnyDeclarationNode>();
  const tasks = new Map<string, AnyDeclarationNode>();
  for (const declaration of document.declarations) {
    if (!entities.has(declaration.id)) {
      entities.set(declaration.id, declaration);
    }
    if (declaration.kind === "task" && !tasks.has(declaration.id)) {
      tasks.set(declaration.id, declaration);
    }
  }
  for (const event of document.declarations.filter(
    (declaration) => declaration.kind === "work_event",
  )) {
    const requiredFields = ["model", "task", "kind", "occurred_at"] as const;
    let missingRequired = false;
    for (const fieldName of requiredFields) {
      if (fieldNamed(event, fieldName) !== undefined) continue;
      diagnostics.push(
        eventDiagnostic(
          "PTACT-103",
          `work_event ${event.id} is missing required field ${fieldName}`,
          event,
          event.idSpan,
          "missing_field",
        ),
      );
      missingRequired = true;
    }
    if (missingRequired) continue;

    const modelField = fieldNamed(event, "model")!;
    if (modelField.value !== 1) {
      diagnostics.push(
        eventDiagnostic(
          "PTACT-101",
          `work_event ${event.id} uses unsupported model ${modelField.rawValue}`,
          event,
          modelField.valueSpan,
          "unsupported_event_model",
        ),
      );
    }

    const taskField = fieldNamed(event, "task")!;
    const task = typeof taskField.value === "string"
      ? tasks.get(taskField.value)
      : undefined;
    if (task === undefined) {
      const referenced = typeof taskField.value === "string"
        ? entities.get(taskField.value)
        : undefined;
      if (referenced === undefined) {
        diagnostics.push(
          eventDiagnostic(
            "PTACT-102",
            `work_event ${event.id} references missing task ${taskField.rawValue}`,
            event,
            taskField.valueSpan,
            "missing_task",
          ),
        );
      } else {
        diagnostics.push(
          eventDiagnostic(
            "PTACT-102",
            `work_event ${event.id} reference ${referenced.id} is not a task`,
            event,
            taskField.valueSpan,
            "wrong_entity_kind",
            [{
              message: `${referenced.kind} declaration`,
              span: referenced.idSpan,
            }],
          ),
        );
      }
    }

    const kind = fieldNamed(event, "kind")!.value;
    if (
      kind !== "start" &&
      kind !== "suspend" &&
      kind !== "resume" &&
      kind !== "finish"
    ) {
      continue;
    }
    const matrix: Readonly<Record<
      typeof kind,
      Readonly<Record<
        "planned_value" | "active_time" | "effort" | "reason",
        "required" | "optional" | "forbidden"
      >>
    >> = {
      start: {
        planned_value: "required",
        active_time: "forbidden",
        effort: "forbidden",
        reason: "forbidden",
      },
      suspend: {
        planned_value: "forbidden",
        active_time: "forbidden",
        effort: "forbidden",
        reason: "optional",
      },
      resume: {
        planned_value: "forbidden",
        active_time: "forbidden",
        effort: "forbidden",
        reason: "forbidden",
      },
      finish: {
        planned_value: "forbidden",
        active_time: "optional",
        effort: "optional",
        reason: "forbidden",
      },
    };
    for (const [fieldName, presence] of Object.entries(matrix[kind]) as Array<
      [
        "planned_value" | "active_time" | "effort" | "reason",
        "required" | "optional" | "forbidden",
      ]
    >) {
      const field = fieldNamed(event, fieldName);
      if (presence === "required" && field === undefined) {
        diagnostics.push(
          eventDiagnostic(
            "PTACT-103",
            `work_event ${event.id} kind ${kind} requires field ${fieldName}`,
            event,
            fieldNamed(event, "kind")!.valueSpan,
            "missing_field",
          ),
        );
      } else if (presence === "forbidden" && field !== undefined) {
        diagnostics.push(
          eventDiagnostic(
            "PTACT-103",
            `work_event ${event.id} kind ${kind} forbids field ${fieldName}`,
            event,
            field.span,
            "forbidden_field",
          ),
        );
      }
    }

    const plannedValueField = fieldNamed(event, "planned_value");
    const plannedValue = durationValue(plannedValueField);
    if (
      kind === "start" &&
      task?.kind === "task" &&
      plannedValue !== undefined &&
      compare(rationalFromDuration(plannedValue), taskExpectedValue(task)) !== 0
    ) {
      diagnostics.push(
        eventDiagnostic(
          "PTACT-103",
          `work_event ${event.id} planned_value does not match task ${task.id}`,
          event,
          plannedValueField!.valueSpan,
          "planned_value_mismatch",
          [{ message: "Owned task", span: task.idSpan }],
        ),
      );
    }
  }
}

function assuranceDiagnostic(
  code: "PTASSURE-101" | "PTASSURE-102",
  message: string,
  declaration: AnyDeclarationNode,
  diagnosticSpan: SourceSpan = declaration.idSpan,
  data?: Readonly<Record<string, unknown>>,
): Diagnostic {
  return makeDiagnostic(
    code,
    "error",
    message,
    diagnosticSpan,
    "syntax.plan-assurance",
    declaration.id,
    undefined,
    data,
  );
}

function requiredAssuranceField(
  declaration: AnyDeclarationNode,
  name: string,
  diagnostics: Diagnostic[],
): FieldNode | undefined {
  const field = fieldNamed(declaration, name);
  if (field === undefined) {
    diagnostics.push(assuranceDiagnostic(
      "PTASSURE-101",
      `${declaration.kind} ${declaration.id} is missing required field ${name}`,
      declaration,
    ));
  }
  return field;
}

function taskPairKey(predecessorTaskId: string, successorTaskId: string): string {
  return `${predecessorTaskId}\u0000${successorTaskId}`;
}

function validatePlanAssuranceSource(
  document: AnyDocumentNode,
  diagnostics: Diagnostic[],
): void {
  const project = document.declarations.find(
    (declaration) => declaration.kind === "project",
  );
  if (project === undefined) return;
  const model = fieldNamed(project, "plan_assurance_model");
  const hashModel = fieldNamed(project, "plan_assurance_hash_model");
  if ((model === undefined) !== (hashModel === undefined)) {
    diagnostics.push(assuranceDiagnostic(
      "PTASSURE-101",
      "project assurance model and hash model must be declared together",
      project,
      (model ?? hashModel)!.valueSpan,
    ));
  }
  for (const field of [model, hashModel]) {
    if (
      field !== undefined &&
      (typeof field.value !== "number" || field.value <= 0)
    ) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        `${field.name} must be a positive integer`,
        project,
        field.valueSpan,
      ));
    }
  }

  const assuranceDeclarations = document.declarations.filter(
    (declaration) =>
      declaration.kind === "task_relation" ||
      declaration.kind === "plan_seal" ||
      declaration.kind === "task_outcome" ||
      declaration.kind === "assurance_receipt",
  );
  if (
    assuranceDeclarations.length > 0 &&
    (model === undefined || hashModel === undefined)
  ) {
    for (const declaration of assuranceDeclarations) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        `${declaration.kind} requires both project assurance model fields`,
        declaration,
      ));
    }
    return;
  }

  const tasks = document.declarations.filter(
    (declaration) => declaration.kind === "task",
  );
  const tasksById = new Map(tasks.map((task) => [task.id, task] as const));
  const gates = document.declarations.filter(
    (declaration) => declaration.kind === "gate",
  );
  const gateTargets = new Map<string, string[]>();
  for (const gate of gates) {
    const targets = gateTargets.get(gate.from!) ?? [];
    targets.push(gate.to!);
    gateTargets.set(gate.from!, targets);
  }
  for (const targets of gateTargets.values()) targets.sort(compareStableStrings);
  const gateOnlyReachable = (source: string, target: string): boolean => {
    if (source === target) return true;
    const pending = [source];
    const seen = new Set(pending);
    while (pending.length > 0) {
      const current = pending.shift()!;
      for (const next of gateTargets.get(current) ?? []) {
        if (next === target) return true;
        if (!seen.has(next)) {
          seen.add(next);
          pending.push(next);
        }
      }
    }
    return false;
  };
  const executionPairs = new Set<string>();
  for (const predecessor of tasks) {
    for (const successor of tasks) {
      if (
        predecessor !== successor &&
        gateOnlyReachable(predecessor.to!, successor.from!)
      ) {
        executionPairs.add(taskPairKey(predecessor.id, successor.id));
      }
    }
  }

  const explicitByPair = new Map<string, AnyDeclarationNode>();
  for (const relation of document.declarations.filter(
    (declaration) => declaration.kind === "task_relation",
  )) {
    const modeField = requiredAssuranceField(relation, "mode", diagnostics);
    const mode = modeField?.value;
    const reason = fieldNamed(relation, "reason");
    const predecessor = tasksById.get(relation.from!);
    const successor = tasksById.get(relation.to!);
    const key = taskPairKey(relation.from!, relation.to!);
    if (
      predecessor === undefined ||
      successor === undefined ||
      predecessor === successor
    ) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        `task_relation ${relation.id} endpoints must be distinct current tasks`,
        relation,
        relation.arrowSpan,
      ));
    }
    const first = explicitByPair.get(key);
    if (first !== undefined) {
      diagnostics.push(makeDiagnostic(
        "PTASSURE-101",
        "error",
        `Planning dependency ${relation.from} -> ${relation.to} is duplicated`,
        relation.arrowSpan!,
        "syntax.plan-assurance",
        relation.id,
        [{ message: "First relation", span: first.arrowSpan! }],
      ));
    } else {
      explicitByPair.set(key, relation);
    }
    const directExecution = executionPairs.has(key);
    if (
      (mode === "both" || mode === "execution_only") &&
      !directExecution
    ) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        `${String(mode)} relation requires a direct projected execution dependency`,
        relation,
        modeField?.valueSpan,
      ));
    }
    if (mode === "planning_only" && directExecution) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        "planning_only relation must not duplicate a direct projected execution dependency",
        relation,
        modeField?.valueSpan,
      ));
    }
    if (
      (mode === "execution_only" || mode === "planning_only") &&
      (reason === undefined ||
        typeof reason.value !== "string" ||
        reason.value.length === 0)
    ) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        `${String(mode)} relation requires a nonempty reason`,
        relation,
        reason?.valueSpan,
      ));
    }
    if (
      mode === "both" &&
      reason !== undefined &&
      (typeof reason.value !== "string" || reason.value.length === 0)
    ) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        "both relation reason must be nonempty when present",
        relation,
        reason.valueSpan,
      ));
    }
  }

  const sealsByTask = new Map<string, AnyDeclarationNode>();
  for (const seal of document.declarations.filter(
    (declaration) => declaration.kind === "plan_seal",
  )) {
    const task = tasksById.get(seal.id);
    if (task === undefined) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        `plan_seal ${seal.id} must refer to a current task`,
        seal,
      ));
    }
    const first = sealsByTask.get(seal.id);
    if (first !== undefined) {
      diagnostics.push(makeDiagnostic(
        "PTASSURE-101",
        "error",
        `Task ${seal.id} has more than one plan seal`,
        seal.idSpan,
        "syntax.plan-assurance",
        seal.id,
        [{ message: "First seal", span: first.idSpan }],
      ));
    } else {
      sealsByTask.set(seal.id, seal);
    }
    requiredAssuranceField(seal, "accepted_contract", diagnostics);
    requiredAssuranceField(seal, "accepted_basis", diagnostics);
    const reason = requiredAssuranceField(seal, "reason", diagnostics);
    if (
      reason !== undefined &&
      (typeof reason.value !== "string" || reason.value.length === 0)
    ) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        `plan_seal ${seal.id} requires a nonempty reason`,
        seal,
        reason.valueSpan,
      ));
    }
    const acceptedInputs = fieldNamed(seal, "accepted_inputs");
    if (acceptedInputs === undefined) continue;
    const values = acceptedInputs.value as readonly AcceptedPlanningInputValue[];
    if (values.length === 0) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        "accepted_inputs must be omitted when the accepted input set is empty",
        seal,
        acceptedInputs.valueSpan,
      ));
    }
    for (let index = 1; index < values.length; index += 1) {
      if (
        compareStableStrings(
          values[index - 1]!.predecessorTaskId,
          values[index]!.predecessorTaskId,
        ) >= 0
      ) {
        diagnostics.push(assuranceDiagnostic(
          "PTASSURE-101",
          "accepted_inputs must have unique predecessor IDs in ascending order",
          seal,
          values[index]!.predecessorSpan,
        ));
      }
    }
  }

  const outcomesByTask = new Map<string, AnyDeclarationNode>();
  for (const outcome of document.declarations.filter(
    (declaration) => declaration.kind === "task_outcome",
  )) {
    const modelField = requiredAssuranceField(outcome, "model", diagnostics);
    const taskField = requiredAssuranceField(outcome, "task", diagnostics);
    requiredAssuranceField(outcome, "against_basis", diagnostics);
    const statusField = requiredAssuranceField(outcome, "status", diagnostics);
    const reason = requiredAssuranceField(outcome, "reason", diagnostics);
    if (
      modelField !== undefined &&
      (typeof modelField.value !== "number" || modelField.value <= 0)
    ) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        "task outcome model must be a positive integer",
        outcome,
        modelField.valueSpan,
      ));
    }
    const taskId = typeof taskField?.value === "string" ? taskField.value : "";
    if (!tasksById.has(taskId)) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        `task_outcome ${outcome.id} must refer to a current task`,
        outcome,
        taskField?.valueSpan,
      ));
    } else {
      const task = tasksById.get(taskId)!;
      if ((fieldNamed(task, "status")?.value ?? "planned") !== "done") {
        diagnostics.push(assuranceDiagnostic(
          "PTASSURE-101",
          `task_outcome ${outcome.id} requires a completed task`,
          outcome,
          taskField?.valueSpan,
        ));
      }
      const first = outcomesByTask.get(taskId);
      if (first !== undefined) {
        diagnostics.push(makeDiagnostic(
          "PTASSURE-101",
          "error",
          `Task ${taskId} has more than one outcome record`,
          taskField!.valueSpan,
          "syntax.plan-assurance",
          outcome.id,
          [{ message: "First outcome", span: first.idSpan }],
        ));
      } else {
        outcomesByTask.set(taskId, outcome);
      }
    }
    if (
      reason !== undefined &&
      (typeof reason.value !== "string" || reason.value.length === 0)
    ) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        `task_outcome ${outcome.id} requires a nonempty reason`,
        outcome,
        reason.valueSpan,
      ));
    }
    const summary = fieldNamed(outcome, "summary");
    if (
      statusField?.value === "changed" &&
      (summary === undefined ||
        typeof summary.value !== "string" ||
        summary.value.length === 0)
    ) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        `changed task_outcome ${outcome.id} requires a nonempty summary`,
        outcome,
        summary?.valueSpan,
      ));
    }
    if (statusField?.value === "conformant" && summary !== undefined) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        `conformant task_outcome ${outcome.id} forbids summary`,
        outcome,
        summary.valueSpan,
      ));
    }
  }

  const frontierPairs = new Map<string, AnyDeclarationNode>();
  for (const receipt of document.declarations.filter(
    (declaration) => declaration.kind === "assurance_receipt",
  )) {
    const modelField = requiredAssuranceField(receipt, "model", diagnostics);
    requiredAssuranceField(receipt, "receipt_hash", diagnostics);
    const producerField = requiredAssuranceField(receipt, "producer", diagnostics);
    requiredAssuranceField(receipt, "producer_contract_hash", diagnostics);
    requiredAssuranceField(receipt, "producer_assurance_hash", diagnostics);
    requiredAssuranceField(receipt, "outcome", diagnostics);
    const consumersField = requiredAssuranceField(receipt, "consumers", diagnostics);
    if (
      modelField !== undefined &&
      (typeof modelField.value !== "number" || modelField.value <= 0)
    ) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        "assurance receipt model must be a positive integer",
        receipt,
        modelField.valueSpan,
      ));
    }
    const producer = typeof producerField?.value === "string"
      ? producerField.value
      : "";
    if (tasksById.has(producer)) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        `Assurance receipt producer ${producer} must be historical, not a current task`,
        receipt,
        producerField?.valueSpan,
      ));
    }
    if (consumersField === undefined) continue;
    const consumers = consumersField.value as readonly AssuranceConsumerValue[];
    if (consumers.length === 0) {
      diagnostics.push(assuranceDiagnostic(
        "PTASSURE-101",
        "assurance receipt consumers must not be empty",
        receipt,
        consumersField.valueSpan,
      ));
    }
    for (let index = 0; index < consumers.length; index += 1) {
      const consumer = consumers[index]!;
      if (!tasksById.has(consumer.consumerTaskId)) {
        diagnostics.push(assuranceDiagnostic(
          "PTASSURE-101",
          `Assurance consumer ${consumer.consumerTaskId} is not a current task`,
          receipt,
          consumer.consumerSpan,
        ));
      }
      const pair = taskPairKey(producer, consumer.consumerTaskId);
      const first = frontierPairs.get(pair);
      if (first !== undefined) {
        diagnostics.push(makeDiagnostic(
          "PTASSURE-101",
          "error",
          `Frontier planning input ${producer} -> ${consumer.consumerTaskId} is duplicated`,
          consumer.consumerSpan,
          "syntax.plan-assurance",
          receipt.id,
          [{ message: "First receipt", span: first.idSpan }],
        ));
      } else {
        frontierPairs.set(pair, receipt);
      }
      if (
        index > 0 &&
        compareStableStrings(
          consumers[index - 1]!.consumerTaskId,
          consumer.consumerTaskId,
        ) >= 0
      ) {
        diagnostics.push(assuranceDiagnostic(
          "PTASSURE-101",
          "assurance receipt consumers must have unique task IDs in ascending order",
          receipt,
          consumer.consumerSpan,
        ));
      }
    }
  }

  if (hasErrors(diagnostics)) return;
  const successors = new Map(tasks.map((task) => [task.id, [] as string[]]));
  for (const key of executionPairs) {
    const [predecessorTaskId, successorTaskId] = key.split("\u0000") as [string, string];
    const explicit = explicitByPair.get(key);
    if (
      explicit !== undefined &&
      fieldNamed(explicit, "mode")?.value === "execution_only"
    ) continue;
    successors.get(predecessorTaskId)!.push(successorTaskId);
  }
  for (const [key, relation] of explicitByPair) {
    if (fieldNamed(relation, "mode")?.value !== "planning_only") continue;
    const [predecessorTaskId, successorTaskId] = key.split("\u0000") as [string, string];
    successors.get(predecessorTaskId)!.push(successorTaskId);
  }
  for (const values of successors.values()) values.sort(compareStableStrings);
  const state = new Map<string, "visiting" | "visited">();
  const stack: string[] = [];
  let witness: string[] | null = null;
  const visit = (taskId: string): void => {
    if (witness !== null) return;
    state.set(taskId, "visiting");
    stack.push(taskId);
    for (const successor of successors.get(taskId) ?? []) {
      if (state.get(successor) === "visiting") {
        witness = [...stack.slice(stack.indexOf(successor)), successor];
        return;
      }
      if (state.get(successor) === undefined) visit(successor);
    }
    stack.pop();
    state.set(taskId, "visited");
  };
  for (const taskId of [...tasksById.keys()].sort(compareStableStrings)) {
    if (state.get(taskId) === undefined) visit(taskId);
  }
  const cycleWitness = witness as readonly string[] | null;
  if (cycleWitness !== null) {
    diagnostics.push(assuranceDiagnostic(
      "PTASSURE-102",
      `Effective planning dependency cycle: ${cycleWitness.join(" -> ")}`,
      project,
      project.idSpan,
      { cycle_task_ids: cycleWitness },
    ));
  }
}

function validateGraph(
  document: AnyDocumentNode,
  diagnostics: Diagnostic[],
  profile: ValidationProfile,
): void {
  const firstById = new Map<string, AnyDeclarationNode>();
  for (const declaration of document.declarations) {
    if (declaration.kind === "plan_seal") continue;
    if (reservedWords.has(declaration.id)) {
      diagnostics.push(
        makeDiagnostic(
          "PTSEM-202",
          "error",
          `Reserved word ${declaration.id} cannot be used as an entity ID`,
          declaration.idSpan,
          "syntax",
          declaration.id,
        ),
      );
    }
    const first = firstById.get(declaration.id);
    if (first !== undefined) {
      diagnostics.push(
        makeDiagnostic(
          "PTSEM-201",
          "error",
          `Entity ID ${declaration.id} is duplicated`,
          declaration.idSpan,
          "errors",
          declaration.id,
          [{ message: "First declaration", span: first.idSpan }],
        ),
      );
    } else {
      firstById.set(declaration.id, declaration);
    }
  }
  if (hasErrors(diagnostics)) return;

  const project = document.declarations.find((declaration) => declaration.kind === "project")!;
  const milestones = new Map(
    document.declarations
      .filter((declaration) => declaration.kind === "milestone")
      .map((declaration) => [declaration.id, declaration]),
  );
  const resources = new Map(
    document.declarations
      .filter((declaration) => declaration.kind === "resource")
      .map((declaration) => [declaration.id, declaration]),
  );
  const edges: Edge[] = document.declarations
    .filter((declaration) => declaration.kind === "task" || declaration.kind === "gate")
    .map((declaration) => ({
      declaration,
      id: declaration.id,
      source: declaration.from!,
      target: declaration.to!,
    }));

  const finishField = fieldNamed(project, "finish")!;
  const finish = finishField.value as string;
  const finishEntity = firstById.get(finish);
  if (finishEntity === undefined) {
    diagnostics.push(
      makeDiagnostic(
        "PTSEM-203",
        "error",
        `project.finish ${finish} is undefined`,
        finishField.valueSpan,
        "syntax.project",
        project.id,
      ),
    );
  } else if (finishEntity.kind !== "milestone") {
    diagnostics.push(
      makeDiagnostic(
        "PTSEM-205",
        "error",
        `project.finish ${finish} is not a milestone`,
        finishField.valueSpan,
        "syntax.project",
        project.id,
      ),
    );
  }

  for (const edge of edges) {
    for (const [endpoint, endpointSpan] of [
      [edge.source, edge.declaration.fromSpan!],
      [edge.target, edge.declaration.toSpan!],
    ] as const) {
      const entity = firstById.get(endpoint);
      if (entity === undefined) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-204",
            "error",
            `Endpoint ${endpoint} is undefined`,
            endpointSpan,
            `syntax.${edge.declaration.kind}`,
            edge.id,
          ),
        );
      } else if (entity.kind !== "milestone") {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-205",
            "error",
            `Endpoint ${endpoint} is not a milestone`,
            endpointSpan,
            `syntax.${edge.declaration.kind}`,
            edge.id,
          ),
        );
      }
    }
    if (edge.source === edge.target) {
      diagnostics.push(
        makeDiagnostic(
          "PTDAG-201",
          "error",
          `Edge ${edge.id} is a self-loop`,
          edge.declaration.arrowSpan!,
          "errors",
          edge.id,
        ),
      );
    }
  }

  for (const task of document.declarations.filter((declaration) => declaration.kind === "task")) {
    const requirements = fieldNamed(task, "requires")?.value;
    if (!Array.isArray(requirements)) continue;
    for (const requirement of requirements as readonly RequirementValue[]) {
      const entity = firstById.get(requirement.resourceId);
      if (entity === undefined) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-206",
            "error",
            `Resource ${requirement.resourceId} is undefined`,
            requirement.resourceSpan,
            "syntax.resource",
            task.id,
          ),
        );
      } else if (entity.kind !== "resource") {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-207",
            "error",
            `${requirement.resourceId} is not a resource`,
            requirement.resourceSpan,
            "syntax.resource",
            task.id,
          ),
        );
      } else {
        const capacity = fieldNamed(entity, "capacity")!.value as number;
        if (requirement.units > capacity) {
          diagnostics.push(
            makeDiagnostic(
              "PTSEM-208",
              "error",
              `Requirement ${requirement.units} exceeds capacity ${capacity}`,
              requirement.unitsSpan,
              "syntax.resource",
              task.id,
            ),
          );
        }
      }
    }
  }
  if (hasErrors(diagnostics)) return;

  const outgoing = new Map<string, Edge[]>();
  const incoming = new Map<string, Edge[]>();
  for (const milestone of milestones.keys()) {
    outgoing.set(milestone, []);
    incoming.set(milestone, []);
  }
  for (const edge of edges) {
    outgoing.get(edge.source)!.push(edge);
    incoming.get(edge.target)!.push(edge);
  }
  for (const list of [...outgoing.values(), ...incoming.values()]) {
    list.sort((left, right) => compareStableStrings(left.id, right.id));
  }

  const indegree = new Map([...milestones.keys()].map((id) => [id, incoming.get(id)!.length]));
  const available = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id).sort();
  let processed = 0;
  while (available.length > 0) {
    const milestone = available.shift()!;
    processed += 1;
    for (const edge of outgoing.get(milestone)!) {
      const next = indegree.get(edge.target)! - 1;
      indegree.set(edge.target, next);
      if (next === 0) {
        available.push(edge.target);
        available.sort(compareStableStrings);
      }
    }
  }
  if (processed !== milestones.size) {
    const cycleEdge = edges
      .filter((edge) => (indegree.get(edge.source) ?? 0) > 0 && (indegree.get(edge.target) ?? 0) > 0)
      .sort((left, right) => compareStableStrings(left.id, right.id))[0];
    diagnostics.push(
      makeDiagnostic(
        "PTDAG-202",
        "error",
        "Detected a directed cycle",
        cycleEdge?.declaration.headerSpan ?? project.idSpan,
        "errors",
        cycleEdge?.id,
      ),
    );
    return;
  }

  if (finishEntity?.kind === "milestone" && outgoing.get(finish)!.length > 0) {
    const firstOutgoing = outgoing.get(finish)![0]!;
    diagnostics.push(
      makeDiagnostic(
        "PTDAG-203",
        "error",
        `Finish milestone ${finish} has an outgoing edge`,
        firstOutgoing.declaration.headerSpan,
        "errors",
        firstOutgoing.id,
      ),
    );
  }

  if (finishEntity?.kind === "milestone") {
    const canReachFinish = new Set<string>([finish]);
    const queue = [finish];
    while (queue.length > 0) {
      const target = queue.shift()!;
      for (const edge of incoming.get(target)!) {
        if (!canReachFinish.has(edge.source)) {
          canReachFinish.add(edge.source);
          queue.push(edge.source);
        }
      }
    }
    for (const milestone of milestones.values()) {
      if (!canReachFinish.has(milestone.id)) {
        diagnostics.push(
          makeDiagnostic(
            "PTDAG-204",
            "error",
            `Milestone ${milestone.id} cannot reach the finish`,
            milestone.idSpan,
            "errors",
            milestone.id,
          ),
        );
      }
    }
  }

  const explicitReached = new Set(
    [...milestones.values()]
      .filter((milestone) => fieldNamed(milestone, "state")?.value === "reached")
      .map((milestone) => milestone.id),
  );
  for (const milestone of milestones.values()) {
    if (incoming.get(milestone.id)!.length === 0 && !explicitReached.has(milestone.id)) {
      diagnostics.push(
        makeDiagnostic(
          "PTDAG-205",
          "error",
          `Root milestone ${milestone.id} must have state reached`,
          fieldNamed(milestone, "state")?.valueSpan ?? milestone.idSpan,
          "errors",
          milestone.id,
        ),
      );
    }
  }
  if (hasErrors(diagnostics)) return;

  const reached = new Set(explicitReached);
  const satisfied = (edge: Edge): boolean => {
    if (!reached.has(edge.source)) return false;
    if (edge.declaration.kind === "gate") return true;
    return (fieldNamed(edge.declaration, "status")?.value ?? "planned") === "done";
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const milestone of milestones.values()) {
      if (reached.has(milestone.id)) continue;
      const edgesIn = incoming.get(milestone.id)!;
      if (edgesIn.length > 0 && edgesIn.every(satisfied)) {
        reached.add(milestone.id);
        changed = true;
      }
    }
  }
  for (const milestoneId of explicitReached) {
    const edgesIn = incoming.get(milestoneId)!;
    if (edgesIn.length > 0 && !edgesIn.every(satisfied)) {
      const milestone = milestones.get(milestoneId)!;
      diagnostics.push(
        makeDiagnostic(
          "PTDAG-206",
          "error",
          `Reached milestone ${milestoneId} has an unsatisfied incoming edge`,
          fieldNamed(milestone, "state")?.valueSpan ?? milestone.idSpan,
          "errors",
          milestoneId,
        ),
      );
    }
  }
  for (const task of document.declarations.filter((declaration) => declaration.kind === "task")) {
    const status = fieldNamed(task, "status")?.value ?? "planned";
    if (
      (
        status === "active" ||
        status === "done" ||
        (profile.workEvents && status === "suspended")
      ) &&
      !reached.has(task.from!)
    ) {
      diagnostics.push(
        makeDiagnostic(
          "PTDAG-207",
          "error",
          `Source of ${status} task ${task.id} is not reached`,
          fieldNamed(task, "status")?.valueSpan ?? task.idSpan,
          "errors",
          task.id,
        ),
      );
    }
  }
  for (const milestoneId of [...reached].sort()) {
    const milestone = milestones.get(milestoneId)!;
    if (!explicitReached.has(milestoneId)) {
      diagnostics.push(
        makeDiagnostic(
          "PTDAG-208",
          "warning",
          `Milestone ${milestoneId} is reached by closure; consider advance`,
          milestone.idSpan,
          "workflows",
          milestoneId,
        ),
      );
    }
  }

  for (const resource of resources.values()) {
    const capacity = fieldNamed(resource, "capacity")!.value as number;
    const activeTasks: AnyDeclarationNode[] = [];
    let usage = 0;
    for (const task of document.declarations.filter((declaration) => declaration.kind === "task")) {
      if ((fieldNamed(task, "status")?.value ?? "planned") !== "active") continue;
      const requirements = fieldNamed(task, "requires")?.value;
      if (!Array.isArray(requirements)) continue;
      const requirement = (requirements as readonly RequirementValue[]).find(
        (candidate) => candidate.resourceId === resource.id,
      );
      if (requirement !== undefined) {
        usage += requirement.units;
        activeTasks.push(task);
      }
    }
    if (usage > capacity) {
      diagnostics.push(
        makeDiagnostic(
          "PTRES-201",
          "error",
          `Active usage ${usage} exceeds capacity ${capacity} of resource ${resource.id}`,
          fieldNamed(resource, "capacity")!.valueSpan,
          "analysis.resources",
          resource.id,
          activeTasks.map((task) => ({ message: `active task ${task.id}`, span: task.idSpan })),
        ),
      );
    }
  }
}

export function validateDocument(
  document: DocumentNode,
  parseDiagnostics: readonly Diagnostic[] = [],
): readonly Diagnostic[] {
  return validateDocumentWithProfile(
    document,
    parseDiagnostics,
    targetGrammar5ValidationProfile,
  );
}

function validateDocumentWithProfile(
  document: AnyDocumentNode,
  parseDiagnostics: readonly Diagnostic[],
  profile: ValidationProfile,
): readonly Diagnostic[] {
  const diagnostics = [...parseDiagnostics];
  if (hasErrors(diagnostics)) return sortDiagnostics(diagnostics);
  validateFieldConstraints(document, diagnostics, profile);
  if (!hasErrors(diagnostics) && profile.workEvents) {
    validateWorkEvents(document, diagnostics);
  }
  if (!hasErrors(diagnostics)) validateGraph(document, diagnostics, profile);
  if (!hasErrors(diagnostics) && profile.assuranceRecords) {
    validatePlanAssuranceSource(document, diagnostics);
  }
  return sortDiagnostics(diagnostics);
}

export function validateTargetDocumentSemantics(
  document: DocumentNode,
  parseDiagnostics: readonly Diagnostic[] = [],
): readonly Diagnostic[] {
  return validateDocumentWithProfile(
    document,
    parseDiagnostics,
    targetValidationProfile,
  );
}

export function validateTargetGrammar3DocumentSemantics(
  document: DocumentNode,
  parseDiagnostics: readonly Diagnostic[] = [],
): readonly Diagnostic[] {
  return validateDocumentWithProfile(
    document,
    parseDiagnostics,
    targetGrammar3ValidationProfile,
  );
}

export function validateTargetGrammar4DocumentSemantics(
  document: DocumentNode,
  parseDiagnostics: readonly Diagnostic[] = [],
): readonly Diagnostic[] {
  return validateDocumentWithProfile(
    document,
    parseDiagnostics,
    targetGrammar4ValidationProfile,
  );
}

export function validateTargetGrammar5DocumentSemantics(
  document: AnyDocumentNode,
  parseDiagnostics: readonly Diagnostic[] = [],
): readonly Diagnostic[] {
  return validateDocumentWithProfile(
    document,
    parseDiagnostics,
    targetGrammar5ValidationProfile,
  );
}

export function validateTargetGrammar6DocumentSemantics(
  document: AnyDocumentNode,
  parseDiagnostics: readonly Diagnostic[] = [],
): readonly Diagnostic[] {
  return validateDocumentWithProfile(
    document,
    parseDiagnostics,
    targetGrammar6ValidationProfile,
  );
}
