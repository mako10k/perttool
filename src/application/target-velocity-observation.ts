import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import type { TargetCalendarValue } from "../model/target-calendar.js";
import type {
  ActualQuantity,
  ProjectHistoryCoreResult,
  ProjectHistoryProvenance,
} from "../history/project-history.js";
import {
  observeProjectVelocity,
  type ObservationCause,
  type VelocityCandidate,
  type VelocityObservationCoreResult,
  type VelocityObservationRequest,
} from "../history/velocity-observation.js";
import { TOOL_VERSION } from "../version.js";

export const TARGET_VELOCITY_OBSERVATION_CLI_CONTRACT_VERSION = 7 as const;
export const TARGET_VELOCITY_OBSERVATION_SCHEMA_VERSION =
  "Perttool.VelocityObservationResult.v1" as const;

export interface TargetVelocityObservationResultV1
  extends VelocityObservationCoreResult {
  readonly schemaVersion:
    typeof TARGET_VELOCITY_OBSERVATION_SCHEMA_VERSION;
  readonly sourceDigest: string | null;
}

export interface TargetVelocityObservationOptions {
  readonly currentActuals?: ProjectHistoryCoreResult;
  readonly currentSourceDigest?: string;
}

function uniqueDiagnostics(
  diagnostics: readonly Diagnostic[],
): readonly Diagnostic[] {
  const seen = new Set<string>();
  return Object.freeze(diagnostics.filter((diagnostic) => {
    const key = JSON.stringify(diagnostic);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}

function historyWithSelectedCurrentTasks(
  history: ProjectHistoryCoreResult,
  current: ProjectHistoryCoreResult,
  selectedTaskIds: readonly string[],
): ProjectHistoryCoreResult {
  const historicalIds = new Set(history.tasks.map(({ taskId }) => taskId));
  const currentById = new Map(
    current.tasks.map((task) => [task.taskId, task] as const),
  );
  const missing = selectedTaskIds
    .filter((taskId) => !historicalIds.has(taskId))
    .flatMap((taskId) => {
      const task = currentById.get(taskId);
      return task === undefined ? [] : [task];
    });
  return missing.length === 0
    ? history
    : Object.freeze({
        ...history,
        tasks: Object.freeze([...history.tasks, ...missing]),
      });
}

export function observeTargetProjectVelocity(
  history: ProjectHistoryCoreResult,
  request: VelocityObservationRequest = {},
  options: TargetVelocityObservationOptions = {},
): TargetVelocityObservationResultV1 {
  const evidence = request.evidence ?? "declared";
  const current = options.currentActuals;
  const currentSourceDigest = options.currentSourceDigest;
  if (
    current === undefined ||
    currentSourceDigest === undefined ||
    evidence === "git_recorded" ||
    (evidence !== "declared" && evidence !== "all")
  ) {
    const observed = observeProjectVelocity(history, request);
    return Object.freeze({
      schemaVersion: TARGET_VELOCITY_OBSERVATION_SCHEMA_VERSION,
      sourceDigest: history.history.sourceDigest,
      ...observed,
    });
  }

  const selectedTaskIds = Object.freeze(
    request.taskIds === undefined
      ? current.tasks.map(({ taskId }) => taskId)
      : [...request.taskIds],
  );
  const declared = observeProjectVelocity(current, {
    taskIds: selectedTaskIds,
    evidence: "declared",
  });
  const recorded = evidence === "all"
    ? observeProjectVelocity(
        historyWithSelectedCurrentTasks(history, current, selectedTaskIds),
        { taskIds: selectedTaskIds, evidence: "git_recorded" },
      )
    : null;
  return Object.freeze({
    schemaVersion: TARGET_VELOCITY_OBSERVATION_SCHEMA_VERSION,
    sourceDigest: currentSourceDigest,
    ok: history.ok && declared.ok && (recorded?.ok ?? true),
    modelVersion: declared.modelVersion,
    documentId: current.documentId,
    grammarVersion: current.grammarVersion,
    history: history.history,
    observation: Object.freeze({
      ...declared.observation,
      evidence,
      candidates: Object.freeze([
        ...declared.observation.candidates,
        ...(recorded?.observation.candidates ?? []),
      ]),
    }),
    diagnostics: uniqueDiagnostics([
      ...declared.diagnostics,
      ...(recorded?.diagnostics ?? []),
      ...history.diagnostics,
    ]),
  });
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

function observationCauseToJson(
  cause: ObservationCause,
): Readonly<Record<string, unknown>> {
  return {
    cause: cause.cause,
    task_id: cause.taskId,
    event_id: cause.eventId,
    commit_id: cause.commitId,
  };
}

function candidateToJson(
  value: VelocityCandidate,
): Readonly<Record<string, unknown>> {
  return {
    id: value.id,
    measure: value.measure,
    evidence_class: value.evidenceClass,
    state: value.state,
    numerator: quantityToJson(value.numerator),
    denominator: quantityToJson(value.denominator),
    rate: value.rate === null
      ? null
      : {
          numerator: value.rate.numerator,
          denominator: value.rate.denominator,
          unit: value.rate.unit,
        },
    adoptable_velocity_token: value.adoptableVelocityToken,
    included_task_ids: value.includedTaskIds,
    excluded: value.excluded.map((excluded) => ({
      task_id: excluded.taskId,
      causes: excluded.causes.map(observationCauseToJson),
    })),
    observation_start: calendarToJson(value.observationStart),
    observation_finish: calendarToJson(value.observationFinish),
    baseline_sources: value.baselineSources.map((baseline) => ({
      task_id: baseline.taskId,
      source: baseline.source,
      event_id: baseline.eventId,
      commit_id: baseline.commitId,
    })),
    qualifiers: value.qualifiers,
    unavailable_causes:
      value.unavailableCauses.map(observationCauseToJson),
  };
}

export function targetVelocityObservationResultToJson(
  result: TargetVelocityObservationResultV1,
  source: string,
): Readonly<Record<string, unknown>> {
  const provenance = observationProvenance(result);
  return {
    schema_version: result.schemaVersion,
    cli_contract_version: TARGET_VELOCITY_OBSERVATION_CLI_CONTRACT_VERSION,
    tool_version: TOOL_VERSION,
    operation: "project.observe-velocity",
    ok: result.ok,
    document_id: result.documentId,
    source,
    source_digest: result.sourceDigest,
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
      unavailable_causes: result.history.unavailableCauses.map((cause) => ({
        cause: cause.cause,
        commit_id: cause.commitId,
        task_id: cause.taskId,
        event_id: cause.eventId,
      })),
      provenance: {
        model_version: provenance.modelVersion,
        requested_mode: provenance.requestedMode,
        effective_mode: provenance.effectiveMode,
        override_applied: provenance.overrideApplied,
        root_commit_id: provenance.rootCommitId,
        root_source_digest: provenance.rootSourceDigest,
        excluded_predecessors:
          provenance.excludedPredecessors.map((value) => ({
            path: value.path,
            commit_id: value.commitId,
            source_digest: value.sourceDigest,
            project_id: value.projectId,
          })),
      },
    },
    observation: {
      id: result.observation.id,
      version: result.observation.version,
      history_model_version: result.observation.historyModelVersion,
      selected_task_ids: result.observation.selectedTaskIds,
      evidence: result.observation.evidence,
      candidates: result.observation.candidates.map(candidateToJson),
    },
  };
}

function observationProvenance(
  result: TargetVelocityObservationResultV1,
): ProjectHistoryProvenance {
  return result.history.provenance ?? Object.freeze({
    modelVersion: 1,
    requestedMode: "automatic",
    effectiveMode: "automatic",
    overrideApplied: false,
    rootCommitId: null,
    rootSourceDigest: null,
    excludedPredecessors: Object.freeze([]),
  });
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

function causesText(
  causes: readonly { readonly cause: string }[],
): string {
  return causes.length === 0
    ? "-"
    : causes.map(({ cause }) => cause).join(",");
}

function excludedText(value: VelocityCandidate): string {
  return value.excluded.length === 0
    ? "-"
    : value.excluded.map((excluded) =>
        `${excluded.taskId}:${causesText(excluded.causes)}`
      ).join(";");
}

function baselinesText(value: VelocityCandidate): string {
  return value.baselineSources.length === 0
    ? "-"
    : value.baselineSources.map((baseline) =>
        `${baseline.taskId}:${baseline.source}:${
          scalar(baseline.eventId)
        }:${scalar(baseline.commitId)}`
      ).join(",");
}

export function renderTargetVelocityObservationText(
  result: TargetVelocityObservationResultV1,
): string {
  const provenance = observationProvenance(result);
  const lines = [
    `OBSERVATION evidence=${result.observation.evidence} selected=${
      result.observation.selectedTaskIds.length === 0
        ? "-"
        : result.observation.selectedTaskIds.join(",")
    } history_status=${result.history.status} source_digest=${
      scalar(result.sourceDigest)
    } history_source_digest=${
      scalar(result.history.sourceDigest)
    } provenance=${provenance.effectiveMode} override=${
      provenance.overrideApplied
    } models=history:1,observation:1`,
  ];
  for (const value of result.observation.candidates) {
    lines.push(
      `VELOCITY_CANDIDATE id=${value.id} measure=${value.measure} evidence=${
        value.evidenceClass
      } state=${value.state} numerator=${quantityText(value.numerator)} denominator=${
        quantityText(value.denominator)
      } rate=${
        value.rate === null
          ? "-"
          : `${value.rate.numerator}/${value.rate.denominator}:${value.rate.unit}`
      } adoptable=${scalar(value.adoptableVelocityToken)} included=${
        value.includedTaskIds.length === 0
          ? "-"
          : value.includedTaskIds.join(",")
      } excluded=${excludedText(value)} start=${
        calendarText(value.observationStart)
      } finish=${calendarText(value.observationFinish)} baselines=${
        baselinesText(value)
      } qualifiers=${
        value.qualifiers.length === 0 ? "-" : value.qualifiers.join(",")
      } causes=${causesText(value.unavailableCauses)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
