import { createHash } from "node:crypto";
import {
  actualsDiagnostic,
  normalizeLifecycleMutationRequest,
  reduceTaskLifecycle,
  taskStatus,
  taskStatusSpan,
  validateStoredLifecycleState,
  type ActualsCoverage,
  type FinishActualsMutation,
  type LifecycleMutation,
  type NormalizedLifecycleMutationRequest,
  type TaskLifecycleState,
} from "../actuals/lifecycle.js";
import {
  projectActualsSourceModel,
  workEventsForTask,
  type ActualWorkEvent,
} from "../actuals/source.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import {
  classifyGovernanceScopes,
  evaluateGovernanceAuthority,
  governanceDecisionDiagnostics,
  normalizeGovernanceRequest,
} from "../governance/authority.js";
import { governanceMetadataFromDocument } from "../governance/source.js";
import type {
  GovernanceDecisionV1,
  GovernanceRequestInput,
} from "../governance/types.js";
import {
  compareStableStrings,
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import {
  canonicalizeEventDateTimeSourceToken,
} from "../model/calendar.js";
import {
  canonicalizeExactDurationSourceToken,
  serializeExactDurationSource,
} from "../model/exact-duration-source.js";
import { canonicalizeExactPersonHoursSourceToken } from "../model/exact-person-hours-source.js";
import {
  add,
  compare,
  divide,
  multiply,
  rational,
  rationalFromDuration,
} from "../model/rational.js";
import type {
  DeclarationNode,
  ExactDurationValue,
  RequirementValue,
  TargetDeclarationKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  planLifecycleEdits,
} from "../mutation/actuals.js";
import {
  applyTextEdits,
  normalizeTextEdits,
  type TextEdit,
} from "../mutation/text-edits.js";
import type {
  MutationOptions,
  MutationResult,
} from "../mutation/types.js";
import type {
  TargetGrammar5Capability,
  TargetGrammar6Capability,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar5Document,
  validateTargetGrammar6Document,
  type TargetGrammar5ValidatedDocument,
  type TargetGrammar6ValidatedDocument,
} from "../semantic/target-validator.js";

type TargetActualsCapability =
  | TargetGrammar5Capability
  | TargetGrammar6Capability;
type TargetActualsValidatedDocument =
  | TargetGrammar5ValidatedDocument
  | TargetGrammar6ValidatedDocument;

function validateTargetActualsDocument(
  text: string,
  capability: TargetActualsCapability,
  maxDiagnostics: number,
) {
  return capability.grammarVersion === 6
    ? validateTargetGrammar6Document(text, capability, { maxDiagnostics })
    : validateTargetGrammar5Document(text, capability, { maxDiagnostics });
}

function asGrammar5Actuals(
  validated: TargetActualsValidatedDocument,
): TargetGrammar5ValidatedDocument {
  return validated as unknown as TargetGrammar5ValidatedDocument;
}

export interface TargetActualsMutationOptions extends MutationOptions {
  readonly governance?: GovernanceRequestInput;
}

export interface ActualsLifecycleResult {
  readonly modelVersion: 1;
  readonly taskId: string;
  readonly fromState: TaskLifecycleState;
  readonly toState: "active" | "suspended" | "done";
  readonly event: ActualWorkEvent;
  readonly coverage: Exclude<ActualsCoverage, "unavailable" | "unrecorded">;
}

export type FinishActualsLifecycleResult = ActualsLifecycleResult & {
  readonly toState: "done";
  readonly coverage: Extract<ActualsCoverage, "complete" | "finish_only">;
};

export interface TargetActualsMutationResultV3 extends MutationResult {
  readonly schemaVersion: "Perttool.MutationResult.v3";
  readonly governance: GovernanceDecisionV1 | null;
  readonly lifecycle: ActualsLifecycleResult | null;
}

function digest(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function failure(
  text: string,
  documentId: string | null,
  diagnostics: readonly Diagnostic[],
  maximum: number,
  alreadyTruncated: boolean,
): TargetActualsMutationResultV3 {
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maximum);
  return Object.freeze({
    schemaVersion: "Perttool.MutationResult.v3",
    ok: false,
    documentId,
    changed: false,
    originalDigest: digest(text),
    updatedDigest: null,
    updatedText: null,
    diff: null,
    edits: Object.freeze([]),
    governance: null,
    lifecycle: null,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated: alreadyTruncated || limited.truncated,
  });
}

function eventPayloadMatches(
  event: ActualWorkEvent,
  request: NormalizedLifecycleMutationRequest,
  plannedValue: string | null,
): boolean {
  const activeTime =
    event.activeTime === null
      ? null
      : canonicalizeExactDurationSourceToken(event.activeTime.sourceText)?.token ??
        null;
  const effort =
    event.effort === null
      ? null
      : canonicalizeExactPersonHoursSourceToken(event.effort.sourceText);
  const eventKind =
    request.kind === "task.finish.actual"
      ? "finish"
      : request.kind.slice("task.".length);
  const expectedPlannedValue =
    event.plannedValue === null
      ? null
      : canonicalizeExactDurationSourceToken(
          event.plannedValue.sourceText,
        )?.token ?? null;
  return (
    event.model === 1 &&
    event.taskId === request.taskId &&
    event.kind === eventKind &&
    canonicalizeEventDateTimeSourceToken(event.occurredAt.sourceText) ===
      request.event.occurredAt &&
    expectedPlannedValue === plannedValue &&
    activeTime === (
      request.kind === "task.finish.actual"
        ? request.event.activeTime
        : null
    ) &&
    effort === (
      request.kind === "task.finish.actual"
        ? request.event.effort
        : null
    ) &&
    event.reason === (
      request.kind === "task.suspend"
        ? request.event.reason
        : null
    )
  );
}

function invalidSourceDiagnostic(
  taskId: string,
  detail: string,
  declaration?: DeclarationNode<TargetDeclarationKind>,
): Diagnostic {
  return actualsDiagnostic(
    "PTACT-105",
    "invalid lifecycle mutation request",
    "invalid_source_state",
    taskId,
    declaration?.idSpan,
    { detail },
  );
}

function taskExpectedValue(
  task: DeclarationNode<TargetDeclarationKind>,
): ReturnType<typeof rational> {
  const duration = fieldNamed(task, "duration")?.value as
    | ExactDurationValue
    | undefined;
  if (duration !== undefined) return rationalFromDuration(duration);
  const estimate = fieldNamed(task, "estimate")?.children ?? [];
  const value = (name: string) => {
    const child = estimate.find((field) => field.name === name);
    if (child === undefined) {
      throw new Error(`validated task ${task.id} estimate is missing ${name}`);
    }
    return rationalFromDuration(child.value as ExactDurationValue);
  };
  return divide(
    add(
      add(value("optimistic"), multiply(rational(4n), value("most_likely"))),
      value("pessimistic"),
    ),
    rational(6n),
  );
}

function plannedValueForStart(
  validated: TargetActualsValidatedDocument,
  task: DeclarationNode<TargetDeclarationKind>,
  request: NormalizedLifecycleMutationRequest,
): string | null {
  if (request.kind !== "task.start") return null;
  const project = validated.document.declarations.find(
    ({ kind }) => kind === "project",
  );
  if (project === undefined) {
    throw new Error("validated lifecycle source lost its project");
  }
  const unit = fieldNamed(project, "duration_unit")!.value as
    | "day"
    | "hour"
    | "point";
  return serializeExactDurationSource(taskExpectedValue(task), unit).token;
}

function lifecycleTargetState(
  request: NormalizedLifecycleMutationRequest,
): "active" | "suspended" | "done" {
  return request.kind === "task.start" || request.kind === "task.resume"
    ? "active"
    : request.kind === "task.suspend"
      ? "suspended"
      : "done";
}

function requiredSourceState(
  request: NormalizedLifecycleMutationRequest,
): TaskLifecycleState | null {
  return request.kind === "task.start"
    ? "planned"
    : request.kind === "task.suspend"
      ? "active"
      : request.kind === "task.resume"
        ? "suspended"
        : null;
}

function activationCapacityDiagnostics(
  validated: TargetActualsValidatedDocument,
  task: DeclarationNode<TargetDeclarationKind>,
  request: NormalizedLifecycleMutationRequest,
): readonly Diagnostic[] {
  if (request.kind !== "task.start" && request.kind !== "task.resume") {
    return Object.freeze([]);
  }
  const requirements = (
    fieldNamed(task, "requires")?.value ?? []
  ) as readonly RequirementValue[];
  const activeTasks = validated.document.declarations.filter(
    (declaration) =>
      declaration.kind === "task" &&
      declaration.id !== task.id &&
      taskStatus(declaration) === "active",
  );
  const diagnostics: Diagnostic[] = [];
  for (const requirement of requirements) {
    const resource = validated.document.declarations.find(
      ({ kind, id }) => kind === "resource" && id === requirement.resourceId,
    );
    if (resource === undefined) continue;
    const capacity = fieldNamed(resource, "capacity")!.value as number;
    const occupants = activeTasks
      .filter((declaration) =>
        ((fieldNamed(declaration, "requires")?.value ?? []) as
          readonly RequirementValue[])
          .some(({ resourceId }) => resourceId === requirement.resourceId)
      )
      .sort((left, right) => compareStableStrings(left.id, right.id));
    const activeTaskIds = occupants.map(({ id }) => id);
    const activeUsage = occupants.reduce((sum, declaration) => {
        const activeRequirement = (
          (fieldNamed(declaration, "requires")?.value ?? []) as
            readonly RequirementValue[]
        ).find(({ resourceId }) => resourceId === requirement.resourceId);
        return sum + (activeRequirement?.units ?? 0);
      }, 0);
    if (activeUsage + requirement.units <= capacity) continue;
    const base = actualsDiagnostic(
      "PTACT-108",
      "lifecycle activation exceeds current resource capacity",
      "resource_unavailable",
      task.id,
      requirement.unitsSpan,
      {
        resource_id: requirement.resourceId,
        capacity,
        active_usage: activeUsage,
        required: requirement.units,
        active_task_ids: Object.freeze(activeTaskIds),
      },
    );
    diagnostics.push(
      Object.freeze({
        ...base,
        related: Object.freeze(
          occupants.map((occupant) =>
            Object.freeze({
              message: `active task ${occupant.id}`,
              span: occupant.idSpan,
            })
          ),
        ),
      }),
    );
  }
  return Object.freeze(diagnostics);
}

function validateLifecycleSource(
  validated: TargetActualsValidatedDocument,
  request: NormalizedLifecycleMutationRequest,
): {
  readonly task: DeclarationNode<TargetDeclarationKind>;
  readonly fromState: TaskLifecycleState;
  readonly retryEvent: ActualWorkEvent | null;
  readonly plannedValue: string | null;
  readonly diagnostics: readonly Diagnostic[];
} | {
  readonly task: null;
  readonly fromState: null;
  readonly retryEvent: null;
  readonly plannedValue: null;
  readonly diagnostics: readonly Diagnostic[];
} {
  const lifecycleDiagnostics = validateStoredLifecycleState(
    asGrammar5Actuals(validated),
  );
  if (lifecycleDiagnostics.length > 0) {
    return {
      task: null,
      fromState: null,
      retryEvent: null,
      plannedValue: null,
      diagnostics: lifecycleDiagnostics,
    };
  }
  const declaration = validated.document.declarations.find(
    ({ id }) => id === request.taskId,
  );
  if (declaration === undefined || declaration.kind !== "task") {
    return {
      task: null,
      fromState: null,
      retryEvent: null,
      plannedValue: null,
      diagnostics: Object.freeze([
        invalidSourceDiagnostic(
          request.taskId,
          declaration === undefined ? "missing_task" : "wrong_entity_kind",
          declaration,
        ),
      ]),
    };
  }
  const fromState = taskStatus(declaration);
  const plannedValue = plannedValueForStart(validated, declaration, request);
  const sameId = validated.document.declarations.find(
    ({ id }) => id === request.event.id,
  );
  const model = projectActualsSourceModel(asGrammar5Actuals(validated));
  if (sameId !== undefined) {
    const existing = model.events.find(({ id }) => id === request.event.id);
    if (
      existing === undefined ||
      !eventPayloadMatches(existing, request, plannedValue)
    ) {
      return {
        task: null,
        fromState: null,
        retryEvent: null,
        plannedValue: null,
        diagnostics: Object.freeze([
          actualsDiagnostic(
            "PTACT-106",
            "work-event identity conflicts with an existing payload",
            "event_identity_conflict",
            request.event.id,
            sameId.idSpan,
          ),
        ]),
      };
    }
  }
  if (sameId !== undefined) {
    if (fromState !== lifecycleTargetState(request)) {
      return {
        task: null,
        fromState: null,
        retryEvent: null,
        plannedValue: null,
        diagnostics: Object.freeze([
          invalidSourceDiagnostic(
            request.taskId,
            "retry_target_state_mismatch",
            declaration,
          ),
        ]),
      };
    }
    return {
      task: declaration,
      fromState,
      retryEvent: model.events.find(({ id }) => id === request.event.id)!,
      plannedValue,
      diagnostics: Object.freeze([]),
    };
  }
  if (fromState === "done") {
    return {
      task: null,
      fromState: null,
      retryEvent: null,
      plannedValue: null,
      diagnostics: Object.freeze([
        actualsDiagnostic(
          "PTACT-104",
          "invalid work-event lifecycle sequence",
          "event_after_finish",
          request.taskId,
          taskStatusSpan(declaration),
        ),
      ]),
    };
  }
  const existingEvents = workEventsForTask(model, request.taskId);
  const reduction = reduceTaskLifecycle(existingEvents);
  if (!reduction.ok) {
    return {
      task: null,
      fromState: null,
      retryEvent: null,
      plannedValue: null,
      diagnostics: reduction.diagnostics,
    };
  }
  if (
    reduction.coverage !== "unrecorded" &&
    reduction.state !== fromState
  ) {
    return {
      task: null,
      fromState: null,
      retryEvent: null,
      plannedValue: null,
      diagnostics: Object.freeze([
        actualsDiagnostic(
          "PTACT-104",
          "invalid work-event lifecycle sequence",
          "state_event_mismatch",
          request.taskId,
          taskStatusSpan(declaration),
        ),
      ]),
    };
  }
  const required = requiredSourceState(request);
  if (required !== null && fromState !== required) {
    return {
      task: null,
      fromState: null,
      retryEvent: null,
      plannedValue: null,
      diagnostics: Object.freeze([
        invalidSourceDiagnostic(
          request.taskId,
          `expected_${required}_found_${fromState}`,
          declaration,
        ),
      ]),
    };
  }
  if (
    request.kind !== "task.finish.actual" &&
    request.kind !== "task.start" &&
    reduction.coverage === "unrecorded"
  ) {
    return {
      task: null,
      fromState: null,
      retryEvent: null,
      plannedValue: null,
      diagnostics: Object.freeze([
        invalidSourceDiagnostic(
          request.taskId,
          "lifecycle_sequence_must_start_with_start",
          declaration,
        ),
      ]),
    };
  }
  const capacityDiagnostics = activationCapacityDiagnostics(
    validated,
    declaration,
    request,
  );
  if (capacityDiagnostics.length > 0) {
    return {
      task: null,
      fromState: null,
      retryEvent: null,
      plannedValue: null,
      diagnostics: capacityDiagnostics,
    };
  }
  return {
    task: declaration,
    fromState,
    retryEvent: null,
    plannedValue,
    diagnostics: Object.freeze([]),
  };
}

function lifecycleResult(
  candidate: TargetActualsValidatedDocument,
  request: NormalizedLifecycleMutationRequest,
  fromState: TaskLifecycleState,
): ActualsLifecycleResult {
  const model = projectActualsSourceModel(asGrammar5Actuals(candidate));
  const event = model.events.find(({ id }) => id === request.event.id);
  if (event === undefined) {
    throw new Error("lifecycle candidate lost its event");
  }
  const reduction = reduceTaskLifecycle(
    workEventsForTask(model, request.taskId),
  );
  if (
    !reduction.ok ||
    reduction.coverage === "unavailable" ||
    reduction.coverage === "unrecorded"
  ) {
    throw new Error("lifecycle candidate has unavailable lifecycle coverage");
  }
  if (
    event.activeTime !== null &&
    reduction.derivedActiveTime !== null &&
    compare(event.activeTime.value, reduction.derivedActiveTime) !== 0
  ) {
    throw new Error("lifecycle candidate retained mismatched active time");
  }
  return Object.freeze({
    modelVersion: 1,
    taskId: request.taskId,
    fromState,
    toState: lifecycleTargetState(request),
    event,
    coverage: reduction.coverage,
  });
}

function requestOptions(
  options: TargetActualsMutationOptions,
): MutationOptions {
  return {
    ...(options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics }),
    ...(options.originalLabel === undefined
      ? {}
      : { originalLabel: options.originalLabel }),
    ...(options.updatedLabel === undefined
      ? {}
      : { updatedLabel: options.updatedLabel }),
  };
}

export function planTargetLifecycleMutation(
  text: string,
  mutation: LifecycleMutation,
  capability: TargetActualsCapability,
  options: TargetActualsMutationOptions = {},
): TargetActualsMutationResultV3 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const originalDigest = digest(text);
  const original = validateTargetActualsDocument(text, capability, maximum);
  if (!original.ok || original.validatedDocument === null) {
    return failure(
      text,
      original.documentId,
      original.diagnostics,
      maximum,
      original.diagnosticsTruncated,
    );
  }
  const normalized = normalizeLifecycleMutationRequest(mutation);
  if (!normalized.ok || normalized.request === null) {
    return failure(
      text,
      original.documentId,
      [...original.diagnostics, ...normalized.diagnostics],
      maximum,
      original.diagnosticsTruncated,
    );
  }
  const governanceRequest = normalizeGovernanceRequest(options.governance);
  if (!governanceRequest.ok) {
    return failure(
      text,
      original.documentId,
      [...original.diagnostics, ...governanceRequest.diagnostics],
      maximum,
      original.diagnosticsTruncated,
    );
  }
  const source = validateLifecycleSource(
    original.validatedDocument,
    normalized.request,
  );
  if (source.task === null || source.fromState === null) {
    return failure(
      text,
      original.documentId,
      [...original.diagnostics, ...source.diagnostics],
      maximum,
      original.diagnosticsTruncated,
    );
  }

  let edits: readonly TextEdit[];
  if (source.retryEvent !== null) {
    edits = Object.freeze([]);
  } else {
    const planned = planLifecycleEdits(
      text,
      asGrammar5Actuals(original.validatedDocument),
      normalized.request,
      source.fromState,
      source.plannedValue,
    );
    edits = normalizeTextEdits(text, planned.edits, "lifecycle actuals");
  }
  const updatedText = applyTextEdits(text, edits);
  const candidate = validateTargetActualsDocument(
    updatedText,
    capability,
    maximum,
  );
  if (!candidate.ok || candidate.validatedDocument === null) {
    return failure(
      text,
      original.documentId,
      candidate.diagnostics,
      maximum,
      candidate.diagnosticsTruncated,
    );
  }
  const lifecycleDiagnostics = validateStoredLifecycleState(
    asGrammar5Actuals(candidate.validatedDocument),
  );
  if (lifecycleDiagnostics.length > 0) {
    return failure(
      text,
      original.documentId,
      [...candidate.diagnostics, ...lifecycleDiagnostics],
      maximum,
      candidate.diagnosticsTruncated,
    );
  }
  const lifecycle = lifecycleResult(
    candidate.validatedDocument,
    normalized.request,
    source.fromState,
  );
  const metadata = governanceMetadataFromDocument(
    original.validatedDocument.document,
  );
  const governance = evaluateGovernanceAuthority(
    {
      originalDigest,
      effective: metadata.effective,
    },
    classifyGovernanceScopes(
      original.validatedDocument.document,
      candidate.validatedDocument.document,
    ),
    governanceRequest.request,
  );
  const decisionDiagnostics = governanceDecisionDiagnostics(governance);
  const diagnostics = [...candidate.diagnostics, ...decisionDiagnostics];
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maximum);
  const baseOptions = requestOptions(options);
  return Object.freeze({
    schemaVersion: "Perttool.MutationResult.v3",
    ok: !decisionDiagnostics.some(({ severity }) => severity === "error"),
    documentId: original.documentId,
    changed: updatedText !== text,
    originalDigest,
    updatedDigest: digest(updatedText),
    updatedText,
    diff: createUnifiedDiff(text, updatedText, {
      ...(baseOptions.originalLabel === undefined
        ? {}
        : { originalLabel: baseOptions.originalLabel }),
      ...(baseOptions.updatedLabel === undefined
        ? {}
        : { updatedLabel: baseOptions.updatedLabel }),
    }),
    edits,
    governance,
    lifecycle,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated:
      candidate.diagnosticsTruncated || limited.truncated,
  });
}

export function planTargetFinishActualsMutation(
  text: string,
  mutation: FinishActualsMutation,
  capability: TargetActualsCapability,
  options: TargetActualsMutationOptions = {},
): TargetActualsMutationResultV3 {
  return planTargetLifecycleMutation(text, mutation, capability, options);
}
