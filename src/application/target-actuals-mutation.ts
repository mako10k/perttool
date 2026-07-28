import { createHash } from "node:crypto";
import {
  actualsDiagnostic,
  normalizeFinishActualsRequest,
  reduceTaskLifecycle,
  taskStatus,
  taskStatusSpan,
  validateStoredLifecycleState,
  type ActualsCoverage,
  type FinishActualsMutation,
  type NormalizedFinishActualsRequest,
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
  governanceDenialDiagnostic,
  normalizeGovernanceRequest,
} from "../governance/authority.js";
import { governanceMetadataFromDocument } from "../governance/source.js";
import type {
  GovernanceDecisionV1,
  GovernanceRequestInput,
} from "../governance/types.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import {
  canonicalizeEventDateTimeSourceToken,
} from "../model/calendar.js";
import { canonicalizeExactDurationSourceToken } from "../model/exact-duration-source.js";
import { canonicalizeExactPersonHoursSourceToken } from "../model/exact-person-hours-source.js";
import { compare } from "../model/rational.js";
import type {
  DeclarationNode,
  TargetDeclarationKind,
} from "../model/syntax.js";
import {
  planFinishActualsEdits,
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
} from "../parser/document-parser.js";
import {
  validateTargetGrammar5Document,
  type TargetGrammar5ValidatedDocument,
} from "../semantic/target-validator.js";

export interface TargetActualsMutationOptions extends MutationOptions {
  readonly governance?: GovernanceRequestInput;
}

export interface FinishActualsLifecycleResult {
  readonly modelVersion: 1;
  readonly taskId: string;
  readonly fromState: TaskLifecycleState;
  readonly toState: "done";
  readonly event: ActualWorkEvent;
  readonly coverage: Extract<ActualsCoverage, "complete" | "finish_only">;
}

export interface TargetActualsMutationResultV3 extends MutationResult {
  readonly schemaVersion: "Perttool.MutationResult.v3";
  readonly governance: GovernanceDecisionV1 | null;
  readonly lifecycle: FinishActualsLifecycleResult | null;
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
  request: NormalizedFinishActualsRequest,
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
  return (
    event.model === 1 &&
    event.taskId === request.taskId &&
    event.kind === "finish" &&
    canonicalizeEventDateTimeSourceToken(event.occurredAt.sourceText) ===
      request.event.occurredAt &&
    event.plannedValue === null &&
    activeTime === request.event.activeTime &&
    effort === request.event.effort &&
    event.reason === null
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

function validateFinishSource(
  validated: TargetGrammar5ValidatedDocument,
  request: NormalizedFinishActualsRequest,
): {
  readonly task: DeclarationNode<TargetDeclarationKind>;
  readonly fromState: TaskLifecycleState;
  readonly retryEvent: ActualWorkEvent | null;
  readonly diagnostics: readonly Diagnostic[];
} | {
  readonly task: null;
  readonly fromState: null;
  readonly retryEvent: null;
  readonly diagnostics: readonly Diagnostic[];
} {
  const lifecycleDiagnostics = validateStoredLifecycleState(validated);
  if (lifecycleDiagnostics.length > 0) {
    return {
      task: null,
      fromState: null,
      retryEvent: null,
      diagnostics: lifecycleDiagnostics,
    };
  }
  const sameId = validated.document.declarations.find(
    ({ id }) => id === request.event.id,
  );
  const model = projectActualsSourceModel(validated);
  if (sameId !== undefined) {
    const existing = model.events.find(({ id }) => id === request.event.id);
    if (existing === undefined || !eventPayloadMatches(existing, request)) {
      return {
        task: null,
        fromState: null,
        retryEvent: null,
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
  const declaration = validated.document.declarations.find(
    ({ id }) => id === request.taskId,
  );
  if (declaration === undefined || declaration.kind !== "task") {
    return {
      task: null,
      fromState: null,
      retryEvent: null,
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
  if (sameId !== undefined) {
    if (fromState !== "done") {
      return {
        task: null,
        fromState: null,
        retryEvent: null,
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
      diagnostics: Object.freeze([]),
    };
  }
  if (fromState === "done") {
    return {
      task: null,
      fromState: null,
      retryEvent: null,
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
  return {
    task: declaration,
    fromState,
    retryEvent: null,
    diagnostics: Object.freeze([]),
  };
}

function lifecycleResult(
  candidate: TargetGrammar5ValidatedDocument,
  request: NormalizedFinishActualsRequest,
  fromState: TaskLifecycleState,
): FinishActualsLifecycleResult {
  const model = projectActualsSourceModel(candidate);
  const event = model.events.find(({ id }) => id === request.event.id);
  if (event === undefined) {
    throw new Error("finish actuals candidate lost its event");
  }
  const reduction = reduceTaskLifecycle(
    workEventsForTask(model, request.taskId),
  );
  if (
    !reduction.ok ||
    (reduction.coverage !== "complete" &&
      reduction.coverage !== "finish_only")
  ) {
    throw new Error("finish actuals candidate has incomplete lifecycle coverage");
  }
  if (
    event.activeTime !== null &&
    reduction.derivedActiveTime !== null &&
    compare(event.activeTime.value, reduction.derivedActiveTime) !== 0
  ) {
    throw new Error("finish actuals candidate retained mismatched active time");
  }
  return Object.freeze({
    modelVersion: 1,
    taskId: request.taskId,
    fromState,
    toState: "done",
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

export function planTargetFinishActualsMutation(
  text: string,
  mutation: FinishActualsMutation,
  capability: TargetGrammar5Capability,
  options: TargetActualsMutationOptions = {},
): TargetActualsMutationResultV3 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const originalDigest = digest(text);
  const original = validateTargetGrammar5Document(
    text,
    capability,
    { maxDiagnostics: maximum },
  );
  if (!original.ok || original.validatedDocument === null) {
    return failure(
      text,
      original.documentId,
      original.diagnostics,
      maximum,
      original.diagnosticsTruncated,
    );
  }
  const normalized = normalizeFinishActualsRequest(mutation);
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
  const source = validateFinishSource(
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
    const planned = planFinishActualsEdits(
      text,
      original.validatedDocument,
      normalized.request,
      source.fromState,
    );
    edits = normalizeTextEdits(text, planned.edits, "finish actuals");
  }
  const updatedText = applyTextEdits(text, edits);
  const candidate = validateTargetGrammar5Document(
    updatedText,
    capability,
    { maxDiagnostics: maximum },
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
    candidate.validatedDocument,
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
  const denial = governanceDenialDiagnostic(governance);
  const diagnostics =
    denial === null
      ? candidate.diagnostics
      : [...candidate.diagnostics, denial];
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maximum);
  const baseOptions = requestOptions(options);
  return Object.freeze({
    schemaVersion: "Perttool.MutationResult.v3",
    ok: denial === null,
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
