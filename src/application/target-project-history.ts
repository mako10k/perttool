import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import {
  inspectProjectHistory,
  PROJECT_HISTORY_MODEL_VERSION,
  type ActualQuantity,
  type ActualsCause,
  type GitRecordedTransition,
  type HistoryRequest,
  type ProjectHistoryCause,
  type ProjectHistoryCoreResult,
  type SuspensionInterval,
  type TaskActualSummary,
  type WorkEventHistory,
  type WorkEventProjection,
} from "../history/project-history.js";
import type {
  GitHistoryProbeDependencies,
  GitHistoryProbeFailure,
  GitHistoryProbeRequest,
  GitHistoryProbeOutcome,
} from "../history/git-probe.js";
import { probeGitHistory } from "../history/git-probe.js";
import type { TargetCalendarValue } from "../model/target-calendar.js";
import type {
  TargetGrammar5Capability,
  TargetGrammar6Capability,
} from "../parser/document-parser.js";
import { TOOL_VERSION } from "../version.js";

export const TARGET_PROJECT_HISTORY_CLI_CONTRACT_VERSION = 7 as const;
export const TARGET_PROJECT_HISTORY_SCHEMA_VERSION =
  "Perttool.ProjectHistoryResult.v1" as const;

export interface TargetProjectHistoryResultV1
  extends ProjectHistoryCoreResult {
  readonly schemaVersion: typeof TARGET_PROJECT_HISTORY_SCHEMA_VERSION;
}

export interface TargetProjectHistoryOptions {
  readonly requestedRevision?: string;
}

export interface TargetProjectHistoryFileRequest
  extends GitHistoryProbeRequest, HistoryRequest {}

function probeFailureDiagnostic(
  failure: GitHistoryProbeFailure,
): Diagnostic {
  const malformed = failure.kind === "malformed_git_output";
  return Object.freeze({
    code: malformed ? "PTIO-502" : "PTCLI-003",
    severity: "error",
    message: malformed
      ? "Git history adapter returned malformed output"
      : "Git history process or filesystem operation failed",
    helpTopic: "actuals",
    data: Object.freeze({
      cause: failure.kind,
      operation: failure.operation,
    }),
  });
}

function failedResult(
  failure: GitHistoryProbeFailure,
  options: TargetProjectHistoryOptions,
): TargetProjectHistoryResultV1 {
  return Object.freeze({
    schemaVersion: TARGET_PROJECT_HISTORY_SCHEMA_VERSION,
    ok: false,
    modelVersion: PROJECT_HISTORY_MODEL_VERSION,
    documentId: null,
    grammarVersion: null,
    history: Object.freeze({
      id: "perttool.project-history",
      version: 1,
      status: "unavailable",
      traversal: "first_parent",
      repositorySnapshotId: null,
      repositoryRelativePath: null,
      requestedRevision: options.requestedRevision ?? "HEAD",
      resolvedRevision: null,
      sourceDigest: null,
      inspectedCommitIds: Object.freeze([]),
      unavailableCauses: Object.freeze([]),
    }),
    events: Object.freeze([]),
    gitRecordedTransitions: Object.freeze([]),
    tasks: Object.freeze([]),
    diagnostics: Object.freeze([probeFailureDiagnostic(failure)]),
  });
}

export function inspectTargetProjectHistory(
  probe: GitHistoryProbeOutcome,
  request: HistoryRequest,
  capability: TargetGrammar5Capability | TargetGrammar6Capability,
  options: TargetProjectHistoryOptions = {},
): TargetProjectHistoryResultV1 {
  if (!probe.ok) return failedResult(probe, options);
  return Object.freeze({
    schemaVersion: TARGET_PROJECT_HISTORY_SCHEMA_VERSION,
    ...inspectProjectHistory(probe, request, capability),
  });
}

export async function inspectTargetProjectHistoryFile(
  request: TargetProjectHistoryFileRequest,
  capability: TargetGrammar5Capability | TargetGrammar6Capability,
  dependencies: GitHistoryProbeDependencies = {},
  probe: typeof probeGitHistory = probeGitHistory,
): Promise<TargetProjectHistoryResultV1> {
  const outcome = await probe(
    {
      targetPath: request.targetPath,
      ...(request.revision === undefined
        ? {}
        : { revision: request.revision }),
      ...(request.expectedSourceDigest === undefined
        ? {}
        : { expectedSourceDigest: request.expectedSourceDigest }),
    },
    dependencies,
  );
  return inspectTargetProjectHistory(
    outcome,
    request.taskIds === undefined ? {} : { taskIds: request.taskIds },
    capability,
    {
      ...(request.revision === undefined
        ? {}
        : { requestedRevision: request.revision }),
    },
  );
}

function positionToJson(position: SourceSpan["start"]): {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
} {
  return {
    offset: position.offset,
    line: position.line + 1,
    column: position.column + 1,
  };
}

function spanToJson(
  span: SourceSpan,
): Readonly<Record<string, unknown>> {
  return {
    start: positionToJson(span.start),
    end: positionToJson(span.end),
  };
}

function diagnosticToJson(
  diagnostic: Diagnostic,
): Readonly<Record<string, unknown>> {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    entity_id: diagnostic.entityId ?? null,
    span: diagnostic.span === undefined ? null : spanToJson(diagnostic.span),
    related: (diagnostic.related ?? []).map(({ message, span }) => ({
      message,
      span: spanToJson(span),
    })),
    help_topic: null,
    guide_topic: diagnostic.helpTopic ?? null,
    expected_syntax: diagnostic.expectedSyntax ?? null,
    fixes: [],
    data: diagnostic.data ?? {},
  };
}

function calendarToJson(
  value: TargetCalendarValue | null,
): Readonly<Record<string, unknown>> | null {
  if (value === null) return null;
  return value.kind === "date"
    ? {
        kind: value.kind,
        source_text: value.sourceText,
        year: value.year,
        month: value.month,
        day: value.day,
      }
    : {
        kind: value.kind,
        source_text: value.sourceText,
        year: value.year,
        month: value.month,
        day: value.day,
        hour: value.hour,
        minute: value.minute,
        second: {
          numerator: value.second.numerator,
          denominator: value.second.denominator,
        },
        offset_minutes: value.offsetMinutes,
      };
}

function quantityToJson(
  value: ActualQuantity | null,
): Readonly<Record<string, unknown>> | null {
  return value === null
    ? null
    : {
        numerator: value.numerator,
        denominator: value.denominator,
        unit: value.unit,
        display: value.display,
      };
}

function historyCauseToJson(
  cause: ProjectHistoryCause,
): Readonly<Record<string, unknown>> {
  return {
    cause: cause.cause,
    commit_id: cause.commitId,
    task_id: cause.taskId,
    event_id: cause.eventId,
  };
}

function actualsCauseToJson(
  cause: ActualsCause,
): Readonly<Record<string, unknown>> {
  return {
    cause: cause.cause,
    commit_id: cause.commitId,
    task_id: cause.taskId,
    event_id: cause.eventId,
  };
}

function eventProjectionToJson(
  event: WorkEventProjection,
): Readonly<Record<string, unknown>> {
  return {
    model_version: event.modelVersion,
    id: event.id,
    task_id: event.taskId,
    kind: event.kind,
    occurred_at: calendarToJson(event.occurredAt),
    planned_value: quantityToJson(event.plannedValue),
    active_time: quantityToJson(event.activeTime),
    effort: quantityToJson(event.effort),
    reason: event.reason,
  };
}

function eventHistoryToJson(
  value: WorkEventHistory,
): Readonly<Record<string, unknown>> {
  return {
    event: eventProjectionToJson(value.event),
    evidence_class: value.evidenceClass,
    first_seen_commit_id: value.firstSeenCommitId,
    last_seen_commit_id: value.lastSeenCommitId,
    removal_commit_id: value.removalCommitId,
    payload_digest: value.payloadDigest,
  };
}

function transitionToJson(
  value: GitRecordedTransition,
): Readonly<Record<string, unknown>> {
  return {
    task_id: value.taskId,
    from_state: value.fromState,
    to_state: value.toState,
    commit_id: value.commitId,
    recorded_at: calendarToJson(value.recordedAt),
    source_digest: value.sourceDigest,
    evidence_class: value.evidenceClass,
  };
}

function suspensionToJson(
  value: SuspensionInterval,
): Readonly<Record<string, unknown>> {
  return {
    suspend_event_id: value.suspendEventId,
    resume_event_id: value.resumeEventId,
    start: calendarToJson(value.start),
    finish: calendarToJson(value.finish),
    duration: quantityToJson(value.duration),
  };
}

function taskToJson(
  value: TaskActualSummary,
): Readonly<Record<string, unknown>> {
  return {
    task_id: value.taskId,
    coverage: value.coverage,
    event_ids: value.eventIds,
    first_start: calendarToJson(value.firstStart),
    last_finish: calendarToJson(value.lastFinish),
    suspension_intervals: value.suspensionIntervals.map(suspensionToJson),
    cycle_time: quantityToJson(value.cycleTime),
    derived_active_time: quantityToJson(value.derivedActiveTime),
    explicit_active_time: quantityToJson(value.explicitActiveTime),
    effort: quantityToJson(value.effort),
    planned_value: quantityToJson(value.plannedValue),
    baseline_source: value.baselineSource,
    baseline_event_id: value.baselineEventId,
    baseline_commit_id: value.baselineCommitId,
    qualifiers: value.qualifiers,
    unavailable_causes: value.unavailableCauses.map(actualsCauseToJson),
  };
}

export function targetProjectHistoryResultToJson(
  result: TargetProjectHistoryResultV1,
  source: string,
): Readonly<Record<string, unknown>> {
  return {
    schema_version: result.schemaVersion,
    cli_contract_version: TARGET_PROJECT_HISTORY_CLI_CONTRACT_VERSION,
    tool_version: TOOL_VERSION,
    operation: "project.history",
    ok: result.ok,
    document_id: result.documentId,
    source,
    source_digest: result.history.sourceDigest,
    diagnostics: result.diagnostics.map(diagnosticToJson),
    diagnostics_truncated: false,
    grammar_version: result.grammarVersion,
    history: {
      id: result.history.id,
      version: result.history.version,
      status: result.history.status,
      traversal: result.history.traversal,
      repository_snapshot_id: result.history.repositorySnapshotId,
      repository_relative_path: result.history.repositoryRelativePath,
      requested_revision: result.history.requestedRevision,
      resolved_revision: result.history.resolvedRevision,
      source_digest: result.history.sourceDigest,
      inspected_commit_ids: result.history.inspectedCommitIds,
      unavailable_causes:
        result.history.unavailableCauses.map(historyCauseToJson),
    },
    events: result.events.map(eventHistoryToJson),
    git_recorded_transitions:
      result.gitRecordedTransitions.map(transitionToJson),
    tasks: result.tasks.map(taskToJson),
  };
}

function scalar(value: string | null): string {
  return value ?? "-";
}

function calendarText(value: TargetCalendarValue | null): string {
  return value?.sourceText ?? "-";
}

function quantityText(value: ActualQuantity | null): string {
  return value === null
    ? "-"
    : `${value.numerator}/${value.denominator}:${value.unit}`;
}

function causeList(
  values: readonly { readonly cause: string }[],
): string {
  return values.length === 0
    ? "-"
    : values.map(({ cause }) => cause).join(",");
}

export function renderTargetProjectHistoryText(
  result: TargetProjectHistoryResultV1,
): string {
  const lines = [
    `HISTORY status=${result.history.status} revision=${
      scalar(result.history.resolvedRevision)
    } path=${scalar(result.history.repositoryRelativePath)} models=git:1,history:1`,
  ];
  for (const value of result.events) {
    lines.push(
      `EVENT id=${value.event.id} task=${value.event.taskId} kind=${
        value.event.kind
      } occurred_at=${calendarText(value.event.occurredAt)} first_commit=${
        value.firstSeenCommitId
      } last_commit=${value.lastSeenCommitId} removal_commit=${
        scalar(value.removalCommitId)
      } payload_digest=${value.payloadDigest}`,
    );
  }
  for (const value of result.gitRecordedTransitions) {
    lines.push(
      `RECORDED_TRANSITION task=${value.taskId} from=${value.fromState} to=${
        value.toState
      } commit=${value.commitId} recorded_at=${
        calendarText(value.recordedAt)
      } evidence=${value.evidenceClass}`,
    );
  }
  for (const value of result.tasks) {
    lines.push(
      `TASK_ACTUAL task=${value.taskId} coverage=${value.coverage} events=${
        value.eventIds.length === 0 ? "-" : value.eventIds.join(",")
      } first_start=${calendarText(value.firstStart)} last_finish=${
        calendarText(value.lastFinish)
      } cycle_time=${quantityText(value.cycleTime)} active_time=${
        quantityText(value.derivedActiveTime)
      } effort=${quantityText(value.effort)} baseline=${
        quantityText(value.plannedValue)
      } baseline_source=${scalar(value.baselineSource)} qualifiers=${
        value.qualifiers.length === 0 ? "-" : value.qualifiers.join(",")
      } causes=${causeList(value.unavailableCauses)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
