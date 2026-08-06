import {
  analyzeDocument,
  type AnalysisResultV5,
} from "./contract7-assurance.js";
import {
  HISTORICAL_DAG_MODEL_ID,
  HISTORICAL_DAG_MODEL_VERSION,
  HISTORICAL_LINEAR_CORE_LIMITS,
  reconstructHistoricalLinearHistory,
  type HistoricalCheckpointV1,
  type HistoricalGraphOccurrenceV1,
  type HistoricalLinearCauseRecordV1,
  type HistoricalLinearCoreResultV1,
  type HistoricalLineageV1,
  type HistoricalSnapshotGraphV1,
  type HistoricalSourceBindingV1,
  type HistoricalTimelineV1,
} from "../history/historical-graph.js";
import type {
  HistoricalGitEvidenceOutcome,
  HistoricalGitEvidenceRequest,
  HistoricalGitEvidenceResult,
} from "../history/git-probe.js";
import {
  HISTORICAL_TRANSITION_MODEL_VERSION,
  type HistoricalExactValueV1,
} from "../history/historical-transition.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
  type SourceSpan,
} from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import type { DurationUnit } from "../model/units.js";
import { TOOL_VERSION } from "../version.js";

export const TARGET_HISTORICAL_GRAPH_CLI_CONTRACT_VERSION = 7 as const;
export const TARGET_HISTORICAL_GRAPH_SCHEMA_VERSION =
  "Perttool.HistoricalGraphResult.v1" as const;

const TARGET_HISTORICAL_GIT_EVIDENCE_LIMITS = Object.freeze({
  inspectedCommits: 2_048,
  rawBytesPerSnapshot: 8_388_608,
  aggregateRawSnapshotBytes: 134_217_728,
});

export type HistoricalGraphAncestryProfileV1 =
  | "first_parent"
  | "three_way";
export type HistoricalGraphViewV1 = "snapshot" | "lineage" | "timeline";
export type HistoricalGraphAnalysisModeV1 =
  | "none"
  | "precedence"
  | "resource"
  | "both";
export type HistoricalGraphStatusV1 =
  | "complete"
  | "incomplete"
  | "unavailable";

export interface HistoricalGraphRequestV1 {
  readonly targetPath: string;
  readonly requestedEndpoint?: string;
  readonly lowerBoundary?: string;
  readonly ancestryProfile?: HistoricalGraphAncestryProfileV1;
  readonly view?: HistoricalGraphViewV1;
  readonly snapshotCommitId?: string;
  readonly analysisMode?: HistoricalGraphAnalysisModeV1;
  readonly maxDiagnostics?: number;
}

export interface HistoricalGraphGitEvidencePortV1 {
  readonly probe: (
    request: HistoricalGitEvidenceRequest,
  ) => Promise<HistoricalGitEvidenceOutcome>;
}

export type HistoricalGraphPublicCauseV1 =
  | HistoricalLinearCauseRecordV1
  | {
      readonly cause: "git_unavailable" | "unsupported_ancestry_profile";
      readonly commit_id: null;
      readonly subject: "evidence";
      readonly limit: null;
      readonly actual: null;
    };

export interface HistoricalGraphAnalysisExactValueV1 {
  readonly numerator: string;
  readonly denominator: string;
  readonly unit: DurationUnit;
}

export interface HistoricalGraphAnalysisV1 {
  readonly status: "not_requested" | "complete" | "unavailable";
  readonly mode: HistoricalGraphAnalysisModeV1;
  readonly checkpoint_commit_id: string | null;
  readonly source_digest: string | null;
  readonly document_id: string | null;
  readonly grammar_version: number | null;
  readonly precision: number;
  readonly duration_unit: DurationUnit | null;
  readonly milestones: readonly {
    readonly source_id: string;
    readonly occurrence_id: string;
    readonly earliest: HistoricalGraphAnalysisExactValueV1;
    readonly latest: HistoricalGraphAnalysisExactValueV1;
    readonly slack: HistoricalGraphAnalysisExactValueV1;
    readonly critical: boolean;
  }[];
  readonly edges: readonly {
    readonly source_id: string;
    readonly occurrence_id: string;
    readonly kind: "task" | "gate";
    readonly precedence: {
      readonly earliest_start: HistoricalGraphAnalysisExactValueV1;
      readonly earliest_finish: HistoricalGraphAnalysisExactValueV1;
      readonly latest_start: HistoricalGraphAnalysisExactValueV1;
      readonly latest_finish: HistoricalGraphAnalysisExactValueV1;
      readonly total_float: HistoricalGraphAnalysisExactValueV1;
      readonly free_float: HistoricalGraphAnalysisExactValueV1;
      readonly critical: boolean;
      readonly driving: boolean;
    } | null;
    readonly resource: {
      readonly scheduled_start: HistoricalGraphAnalysisExactValueV1;
      readonly scheduled_finish: HistoricalGraphAnalysisExactValueV1;
      readonly resource_delay: HistoricalGraphAnalysisExactValueV1;
      readonly schedule_critical: boolean;
    } | null;
  }[];
  readonly precedence: {
    readonly makespan: HistoricalGraphAnalysisExactValueV1;
    readonly critical_milestone_occurrence_ids: readonly string[];
    readonly critical_task_occurrence_ids: readonly string[];
    readonly critical_gate_occurrence_ids: readonly string[];
    readonly representative_path_occurrence_ids: readonly string[];
  } | null;
  readonly resource: {
    readonly algorithm_id: "parallel-sgs";
    readonly algorithm_version: 1;
    readonly optimal: false;
    readonly makespan: HistoricalGraphAnalysisExactValueV1;
    readonly resource_delay: HistoricalGraphAnalysisExactValueV1;
    readonly schedule_critical_task_occurrence_ids: readonly string[];
  } | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnostic_codes: readonly string[];
}

export interface TargetHistoricalGraphResultV1 {
  readonly schemaVersion: typeof TARGET_HISTORICAL_GRAPH_SCHEMA_VERSION;
  readonly cliContractVersion:
    typeof TARGET_HISTORICAL_GRAPH_CLI_CONTRACT_VERSION;
  readonly toolVersion: string;
  readonly operation: "dag.history";
  readonly ok: boolean;
  readonly source: string;
  readonly sourceDigest: string | null;
  readonly documentId: string | null;
  readonly status: HistoricalGraphStatusV1;
  readonly request: {
    readonly requested_endpoint: string;
    readonly requested_lower_boundary: string | null;
    readonly ancestry_profile: HistoricalGraphAncestryProfileV1;
    readonly view: HistoricalGraphViewV1;
    readonly snapshot_commit_id: string | null;
    readonly analysis_mode: HistoricalGraphAnalysisModeV1;
  };
  readonly evidence: HistoricalGitEvidenceResult | null;
  readonly linear: HistoricalLinearCoreResultV1 | null;
  readonly snapshot: HistoricalCheckpointV1 | null;
  readonly lineage: HistoricalLineageV1 | null;
  readonly timeline: HistoricalTimelineV1 | null;
  readonly analysis: HistoricalGraphAnalysisV1;
  readonly causes: readonly HistoricalGraphPublicCauseV1[];
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function publicCause(
  cause: "git_unavailable" | "unsupported_ancestry_profile",
): HistoricalGraphPublicCauseV1 {
  return Object.freeze({
    cause,
    commit_id: null,
    subject: "evidence",
    limit: null,
    actual: null,
  });
}

function causeDiagnostic(
  cause: HistoricalGraphPublicCauseV1,
  status: HistoricalGraphStatusV1,
): Diagnostic {
  const code = cause.cause === "unsupported_ancestry_profile"
    ? "PTHDG-106"
    : cause.cause === "repository_race"
      ? "PTHDG-105"
      : cause.cause === "hard_limit"
        ? "PTHDG-104"
        : cause.cause === "event_payload_changed" ||
            cause.cause === "identity_ambiguous" ||
            cause.cause === "ambiguous_edit" ||
            cause.cause === "noncanonical_removal" ||
            cause.cause === "topology_conflict" ||
            cause.cause === "lineage_cycle"
          ? "PTHDG-103"
          : cause.cause === "source_missing" ||
              cause.cause === "source_invalid" ||
              cause.cause === "grammar_unsupported" ||
              cause.cause === "syntax_invalid" ||
              cause.cause === "semantic_invalid" ||
              cause.cause === "assurance_withheld" ||
              cause.cause === "shallow_origin"
            ? "PTHDG-102"
            : "PTHDG-101";
  const category = code === "PTHDG-101"
    ? "historical repository or revision request is unavailable"
    : code === "PTHDG-102"
      ? "historical source continuity is incomplete"
      : code === "PTHDG-103"
        ? "historical semantic lineage is conflicted"
        : code === "PTHDG-104"
          ? "historical graph hard limit was exceeded"
          : code === "PTHDG-105"
            ? "historical repository binding changed during capture"
            : "historical ancestry profile is unsupported";
  return Object.freeze({
    code,
    severity: status === "unavailable" ? "error" : "warning",
    message: `${category}: ${cause.cause}`,
    helpTopic: "historical-dag",
    data: Object.freeze({
      cause: cause.cause,
      commit_id: cause.commit_id,
      subject: cause.subject,
      limit: cause.limit,
      actual: cause.actual,
    }),
  });
}

function requestProjection(
  request: HistoricalGraphRequestV1,
): TargetHistoricalGraphResultV1["request"] {
  return Object.freeze({
    requested_endpoint: request.requestedEndpoint ?? "HEAD",
    requested_lower_boundary: request.lowerBoundary ?? null,
    ancestry_profile: request.ancestryProfile ?? "first_parent",
    view: request.view ?? "lineage",
    snapshot_commit_id: request.snapshotCommitId ?? null,
    analysis_mode: request.analysisMode ?? "none",
  });
}

function emptyAnalysis(
  mode: HistoricalGraphAnalysisModeV1,
  status: HistoricalGraphAnalysisV1["status"],
  checkpointCommitId: string | null = null,
): HistoricalGraphAnalysisV1 {
  return deepFreeze({
    status,
    mode,
    checkpoint_commit_id: checkpointCommitId,
    source_digest: null,
    document_id: null,
    grammar_version: null,
    precision: 3,
    duration_unit: null,
    milestones: [],
    edges: [],
    precedence: null,
    resource: null,
    diagnostics: [],
    diagnostic_codes: [],
  });
}

function exact(
  value: Rational,
  unit: DurationUnit,
): HistoricalGraphAnalysisExactValueV1 {
  return Object.freeze({
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
    unit,
  });
}

function occurrenceMap(
  graph: HistoricalSnapshotGraphV1,
): ReadonlyMap<string, HistoricalGraphOccurrenceV1> {
  return new Map(graph.occurrences.map((occurrence) => [
    `${occurrence.entity_kind}\u0000${occurrence.source_id}`,
    occurrence,
  ]));
}

function occurrenceId(
  occurrences: ReadonlyMap<string, HistoricalGraphOccurrenceV1>,
  kind: HistoricalGraphOccurrenceV1["entity_kind"],
  sourceId: string,
): string | null {
  return occurrences.get(`${kind}\u0000${sourceId}`)?.occurrence_id ?? null;
}

function analysisProjection(
  result: AnalysisResultV5,
  checkpoint: HistoricalCheckpointV1,
): HistoricalGraphAnalysisV1 {
  if (!result.ok || result.durationUnit === null) {
    return deepFreeze({
      ...emptyAnalysis(result.mode, "unavailable", checkpoint.commit_id),
      source_digest: checkpoint.source_digest,
      document_id: result.documentId,
      grammar_version: result.grammarVersion,
      precision: result.precision,
      diagnostics: result.diagnostics,
      diagnostic_codes: result.diagnostics.map(({ code }) => code),
    });
  }
  const unit = result.durationUnit;
  const occurrences = occurrenceMap(checkpoint.graph);
  const milestoneTimings = new Map(
    (result.precedence?.milestones ?? []).map((value) => [value.id, value]),
  );
  const edgeTimings = new Map(
    (result.precedence?.edges ?? []).map((value) => [value.id, value]),
  );
  const scheduledTasks = new Map(
    (result.resource?.tasks ?? []).map((value) => [value.id, value]),
  );
  const scheduleCritical = new Set(
    result.resource?.scheduleCritical.taskIds ?? [],
  );
  const milestones = checkpoint.graph.occurrences.flatMap((occurrence) => {
    if (occurrence.entity_kind !== "milestone" || occurrence.occurrence_id === null) {
      return [];
    }
    const timing = milestoneTimings.get(occurrence.source_id);
    return timing === undefined
      ? []
      : [{
          source_id: occurrence.source_id,
          occurrence_id: occurrence.occurrence_id,
          earliest: exact(timing.earliest, unit),
          latest: exact(timing.latest, unit),
          slack: exact(timing.slack, unit),
          critical: timing.slack.numerator === 0n,
        }];
  });
  const edges = checkpoint.graph.occurrences.flatMap((occurrence) => {
    if (
      (occurrence.entity_kind !== "task" && occurrence.entity_kind !== "gate") ||
      occurrence.occurrence_id === null
    ) return [];
    const timing = edgeTimings.get(occurrence.source_id);
    const scheduled = occurrence.entity_kind === "task"
      ? scheduledTasks.get(occurrence.source_id)
      : undefined;
    return [{
      source_id: occurrence.source_id,
      occurrence_id: occurrence.occurrence_id,
      kind: occurrence.entity_kind,
      precedence: timing === undefined
        ? null
        : {
            earliest_start: exact(timing.es, unit),
            earliest_finish: exact(timing.ef, unit),
            latest_start: exact(timing.ls, unit),
            latest_finish: exact(timing.lf, unit),
            total_float: exact(timing.totalFloat, unit),
            free_float: exact(timing.freeFloat, unit),
            critical: timing.isCritical,
            driving: timing.isDriving,
          },
      resource: scheduled === undefined
        ? null
        : {
            scheduled_start: exact(scheduled.start, unit),
            scheduled_finish: exact(scheduled.finish, unit),
            resource_delay: exact(scheduled.resourceWait, unit),
            schedule_critical: scheduleCritical.has(occurrence.source_id),
          },
    }];
  });
  const ids = (
    kind: HistoricalGraphOccurrenceV1["entity_kind"],
    sourceIds: readonly string[],
  ): readonly string[] => sourceIds.flatMap((sourceId) => {
    const id = occurrenceId(occurrences, kind, sourceId);
    return id === null ? [] : [id];
  });
  return deepFreeze({
    status: "complete",
    mode: result.mode,
    checkpoint_commit_id: checkpoint.commit_id,
    source_digest: checkpoint.source_digest,
    document_id: result.documentId,
    grammar_version: result.grammarVersion,
    precision: result.precision,
    duration_unit: unit,
    milestones,
    edges,
    precedence: result.precedence === null
      ? null
      : {
          makespan: exact(result.precedence.makespan, unit),
          critical_milestone_occurrence_ids: ids(
            "milestone",
            result.precedence.critical.milestoneIds,
          ),
          critical_task_occurrence_ids: ids(
            "task",
            result.precedence.critical.taskIds,
          ),
          critical_gate_occurrence_ids: ids(
            "gate",
            result.precedence.critical.gateIds,
          ),
          representative_path_occurrence_ids:
            result.precedence.critical.representativePath.edgeIds.flatMap(
              (sourceId) => {
                const task = occurrenceId(occurrences, "task", sourceId);
                if (task !== null) return [task];
                const gate = occurrenceId(occurrences, "gate", sourceId);
                return gate === null ? [] : [gate];
              },
            ),
        },
    resource: result.resource === null
      ? null
      : {
          algorithm_id: result.resource.algorithm.id,
          algorithm_version: result.resource.algorithm.version,
          optimal: result.resource.algorithm.optimal,
          makespan: exact(result.resource.makespan, unit),
          resource_delay: exact(result.resource.resourceDelay, unit),
          schedule_critical_task_occurrence_ids: ids(
            "task",
            result.resource.scheduleCritical.taskIds,
          ),
        },
    diagnostics: result.diagnostics,
    diagnostic_codes: result.diagnostics.map(({ code }) => code),
  });
}

function selectedAnalysisCheckpoint(
  linear: HistoricalLinearCoreResultV1,
  view: HistoricalGraphViewV1,
): HistoricalCheckpointV1 | null {
  const commitId = view === "snapshot"
    ? linear.selected_snapshot_commit_id
    : linear.resolved_endpoint;
  return commitId === null
    ? null
    : linear.checkpoints.find(({ commit_id }) => commit_id === commitId) ?? null;
}

function runAnalysis(
  evidence: HistoricalGitEvidenceResult,
  linear: HistoricalLinearCoreResultV1,
  view: HistoricalGraphViewV1,
  mode: HistoricalGraphAnalysisModeV1,
): HistoricalGraphAnalysisV1 {
  if (mode === "none") return emptyAnalysis(mode, "not_requested");
  const checkpoint = selectedAnalysisCheckpoint(linear, view);
  if (checkpoint === null) return emptyAnalysis(mode, "unavailable");
  const snapshot = evidence.snapshots.find(
    ({ commitId }) => commitId === checkpoint.commit_id,
  );
  if (snapshot?.source === null || snapshot?.source === undefined) {
    return emptyAnalysis(mode, "unavailable", checkpoint.commit_id);
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(snapshot.source);
  } catch {
    return emptyAnalysis(mode, "unavailable", checkpoint.commit_id);
  }
  return analysisProjection(analyzeDocument(text, {
    mode,
    maxPaths: 1,
    precision: 3,
    maxDiagnostics: 100,
  }), checkpoint);
}

function viewStatus(
  linear: HistoricalLinearCoreResultV1,
  view: HistoricalGraphViewV1,
): HistoricalGraphStatusV1 {
  if (linear.status === "unavailable") return "unavailable";
  if (linear.status === "incomplete") return "incomplete";
  if (view === "snapshot") {
    return linear.selected_snapshot === null ? "incomplete" : "complete";
  }
  if (view === "lineage") {
    return linear.lineage === null ? "incomplete" : "complete";
  }
  return linear.timeline === null || linear.status !== "complete"
    ? "incomplete"
    : "complete";
}

function result(
  request: HistoricalGraphRequestV1,
  values: {
    readonly evidence: HistoricalGitEvidenceResult | null;
    readonly linear: HistoricalLinearCoreResultV1 | null;
    readonly analysis: HistoricalGraphAnalysisV1;
    readonly status: HistoricalGraphStatusV1;
    readonly causes: readonly HistoricalGraphPublicCauseV1[];
  },
): TargetHistoricalGraphResultV1 {
  const projectedRequest = requestProjection(request);
  const maximum = normalizeMaxDiagnostics(request.maxDiagnostics);
  const diagnostics = sortDiagnostics([
    ...values.causes.map((cause) => causeDiagnostic(cause, values.status)),
    ...values.analysis.diagnostics,
  ]);
  const limited = limitDiagnostics(diagnostics, maximum);
  const selected = values.linear?.selected_snapshot ?? null;
  const endpointSnapshot = values.evidence?.snapshots.find(
    ({ commitId }) => commitId === values.evidence?.resolvedEndpoint,
  );
  const sourceDigest = projectedRequest.view === "snapshot"
    ? selected?.source_digest ?? null
    : endpointSnapshot?.sourceDigest ?? null;
  return deepFreeze({
    schemaVersion: TARGET_HISTORICAL_GRAPH_SCHEMA_VERSION,
    cliContractVersion: TARGET_HISTORICAL_GRAPH_CLI_CONTRACT_VERSION,
    toolVersion: TOOL_VERSION,
    operation: "dag.history",
    ok: values.status !== "unavailable",
    source: request.targetPath,
    sourceDigest,
    documentId: selected?.graph.project_id ??
      values.linear?.checkpoints.at(-1)?.graph.project_id ?? null,
    status: values.status,
    request: projectedRequest,
    evidence: values.evidence,
    linear: values.linear,
    snapshot: projectedRequest.view === "snapshot" ? selected : null,
    lineage: projectedRequest.view === "lineage"
      ? values.linear?.lineage ?? null
      : null,
    timeline: projectedRequest.view === "timeline"
      ? values.linear?.timeline ?? null
      : null,
    analysis: values.analysis,
    causes: [...values.causes],
    diagnostics: limited.diagnostics,
    diagnosticsTruncated: limited.truncated,
  });
}

export async function inspectTargetHistoricalGraphFile(
  request: HistoricalGraphRequestV1,
  gitEvidence: HistoricalGraphGitEvidencePortV1,
): Promise<TargetHistoricalGraphResultV1> {
  const projectedRequest = requestProjection(request);
  if (projectedRequest.ancestry_profile !== "first_parent") {
    return result(request, {
      evidence: null,
      linear: null,
      analysis: emptyAnalysis(
        projectedRequest.analysis_mode,
        projectedRequest.analysis_mode === "none"
          ? "not_requested"
          : "unavailable",
      ),
      status: "unavailable",
      causes: [publicCause("unsupported_ancestry_profile")],
    });
  }
  const evidence = await gitEvidence.probe({
    targetPath: request.targetPath,
    ...(request.requestedEndpoint === undefined
      ? {}
      : { requestedEndpoint: request.requestedEndpoint }),
    ...(request.lowerBoundary === undefined
      ? {}
      : { lowerBoundary: request.lowerBoundary }),
  });
  if (!evidence.ok) {
    return result(request, {
      evidence: null,
      linear: null,
      analysis: emptyAnalysis(
        projectedRequest.analysis_mode,
        projectedRequest.analysis_mode === "none"
          ? "not_requested"
          : "unavailable",
      ),
      status: "unavailable",
      causes: [publicCause("git_unavailable")],
    });
  }
  const linear = reconstructHistoricalLinearHistory(evidence, {
    ...(request.snapshotCommitId === undefined
      ? {}
      : { snapshotCommitId: request.snapshotCommitId }),
  });
  const analysis = runAnalysis(
    evidence,
    linear,
    projectedRequest.view,
    projectedRequest.analysis_mode,
  );
  let status = viewStatus(linear, projectedRequest.view);
  if (status === "complete" && analysis.status === "unavailable") {
    status = "incomplete";
  }
  return result(request, {
    evidence,
    linear,
    analysis,
    status,
    causes: linear.causes,
  });
}

function positionToJson(position: SourceSpan["start"]): {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
} {
  return {
    offset: position.offset,
    line: position.line,
    column: position.column,
  };
}

function bindingToJson(
  binding: HistoricalSourceBindingV1,
): Readonly<Record<string, unknown>> {
  return {
    repository_id: binding.repository_id,
    repository_relative_path: binding.repository_relative_path,
    commit_id: binding.commit_id,
    blob_id: binding.blob_id,
    source_digest: binding.source_digest,
    range: {
      start: positionToJson(binding.range.start),
      end: positionToJson(binding.range.end),
    },
    declaration_kind: binding.declaration_kind,
    source_id: binding.source_id,
    owner_path: binding.owner_path,
  };
}

function checkpointSummary(
  checkpoint: HistoricalCheckpointV1,
): Readonly<Record<string, unknown>> {
  return {
    commit_id: checkpoint.commit_id,
    parent_commit_ids: checkpoint.parent_commit_ids,
    blob_id: checkpoint.blob_id,
    source_digest: checkpoint.source_digest,
    recorded_at: checkpoint.recorded_at,
    is_merge_commit: checkpoint.is_merge_commit,
    segment_ordinal: checkpoint.segment_ordinal,
    assurance: checkpoint.assurance,
    semantic_digest: checkpoint.semantic_digest,
    topology_epoch_id: checkpoint.graph.topology_epoch_id,
    transition: checkpoint.transition,
    occurrence_count: checkpoint.graph.occurrences.length,
    source_binding_count: checkpoint.source_bindings.length,
  };
}

function snapshotToJson(
  snapshot: HistoricalCheckpointV1 | null,
): Readonly<Record<string, unknown>> | null {
  return snapshot === null
    ? null
    : {
        ...checkpointSummary(snapshot),
        graph: snapshot.graph,
      };
}

function allSourceBindings(
  linear: HistoricalLinearCoreResultV1 | null,
): readonly Readonly<Record<string, unknown>>[] {
  if (linear === null) return [];
  return linear.checkpoints.flatMap(({ source_bindings }) =>
    source_bindings.map(bindingToJson)
  );
}

function diagnosticToJson(
  diagnostic: Diagnostic,
): Readonly<Record<string, unknown>> {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    entity_id: diagnostic.entityId ?? null,
    span: null,
    related: [],
    help_topic: null,
    guide_topic: diagnostic.helpTopic ?? null,
    expected_syntax: null,
    fixes: [],
    data: diagnostic.data ?? {},
  };
}

export function targetHistoricalGraphResultToJson(
  value: TargetHistoricalGraphResultV1,
): Readonly<Record<string, unknown>> {
  const evidence = value.evidence;
  const linear = value.linear;
  const { diagnostics: _analysisDiagnostics, ...analysis } = value.analysis;
  return {
    schema_version: value.schemaVersion,
    cli_contract_version: value.cliContractVersion,
    tool_version: value.toolVersion,
    operation: value.operation,
    ok: value.ok,
    document_id: value.documentId,
    source: value.source,
    source_digest: value.sourceDigest,
    diagnostics: value.diagnostics.map(diagnosticToJson),
    diagnostics_truncated: value.diagnosticsTruncated,
    model: HISTORICAL_DAG_MODEL_ID,
    model_version: HISTORICAL_DAG_MODEL_VERSION,
    transition_model_version: HISTORICAL_TRANSITION_MODEL_VERSION,
    status: value.status,
    request: value.request,
    evidence: {
      status: evidence?.status ?? "unavailable",
      ancestry_profile: "first_parent",
      object_format: evidence?.objectFormat ?? null,
      repository_id: evidence?.repositoryId ?? null,
      repository_relative_path: evidence?.repositoryRelativePath ?? null,
      repository_read_snapshot_id: evidence?.repositoryReadSnapshotId ?? null,
      requested_endpoint: value.request.requested_endpoint,
      resolved_endpoint: evidence?.resolvedEndpoint ?? null,
      requested_lower_boundary: value.request.requested_lower_boundary,
      resolved_lower_boundary: evidence?.resolvedLowerBoundary ?? null,
      oldest_inspected_commit_id: evidence?.oldestInspectedCommitId ?? null,
      inspected_commit_ids: evidence?.inspectedCommitIds ?? [],
      aggregate_raw_snapshot_bytes:
        evidence?.aggregateRawSnapshotBytes ?? 0,
    },
    effective_checkpoint_id: linear?.effective_checkpoint_id ?? null,
    selected_snapshot_commit_id:
      linear?.selected_snapshot_commit_id ??
      value.request.snapshot_commit_id ??
      evidence?.resolvedEndpoint ??
      value.request.requested_endpoint,
    checkpoints: linear?.checkpoints.map(checkpointSummary) ?? [],
    snapshot: snapshotToJson(value.snapshot),
    lineage: value.lineage,
    timeline: value.timeline,
    analysis,
    source_bindings: allSourceBindings(linear),
    causes: value.causes,
    limits: {
      inspected_commits:
        evidence?.limits.inspectedCommits ??
        TARGET_HISTORICAL_GIT_EVIDENCE_LIMITS.inspectedCommits,
      raw_bytes_per_snapshot:
        evidence?.limits.rawBytesPerSnapshot ??
        TARGET_HISTORICAL_GIT_EVIDENCE_LIMITS.rawBytesPerSnapshot,
      aggregate_raw_snapshot_bytes:
        evidence?.limits.aggregateRawSnapshotBytes ??
        TARGET_HISTORICAL_GIT_EVIDENCE_LIMITS.aggregateRawSnapshotBytes,
      entity_value_epochs: linear?.limits.entityValueEpochs ??
        HISTORICAL_LINEAR_CORE_LIMITS.entityValueEpochs,
      transition_records: linear?.limits.transitionRecords ??
        HISTORICAL_LINEAR_CORE_LIMITS.transitionRecords,
      rendered_graph_occurrences:
        linear?.limits.renderedGraphOccurrences ??
        HISTORICAL_LINEAR_CORE_LIMITS.renderedGraphOccurrences,
      historical_source_bindings:
        linear?.limits.historicalSourceBindings ??
        HISTORICAL_LINEAR_CORE_LIMITS.historicalSourceBindings,
    },
  };
}

function textExact(
  value: HistoricalExactValueV1 | HistoricalGraphAnalysisExactValueV1,
): string {
  return `${value.numerator}/${value.denominator}:${value.unit}`;
}

export function renderTargetHistoricalGraphText(
  value: TargetHistoricalGraphResultV1,
): string {
  const linear = value.linear;
  const lines = [
    `HISTORICAL_GRAPH status=${value.status} view=${value.request.view} ancestry=${value.request.ancestry_profile} endpoint=${value.evidence?.resolvedEndpoint ?? "-"} lower=${value.evidence?.resolvedLowerBoundary ?? "-"} selected=${linear?.selected_snapshot_commit_id ?? "-"}`,
  ];
  for (const checkpoint of linear?.checkpoints ?? []) {
    lines.push(
      `CHECKPOINT commit=${checkpoint.commit_id} segment=${checkpoint.segment_ordinal} transition=${checkpoint.transition.class} topology=${checkpoint.graph.topology_epoch_id ?? "-"} occurrences=${checkpoint.graph.occurrences.length} assurance=${checkpoint.assurance}`,
    );
  }
  const occurrences = value.snapshot?.graph.occurrences ??
    value.lineage?.occurrences ?? [];
  for (const occurrence of occurrences) {
    const semantic = occurrence.semantic;
    const label = occurrence.entity_kind === "task"
      ? "plan" in semantic ? semantic.plan.title : occurrence.source_id
      : occurrence.entity_kind === "gate"
        ? "reason" in semantic ? semantic.reason : occurrence.source_id
        : "title" in semantic ? semantic.title : occurrence.source_id;
    const timing = occurrence.entity_kind === "task" &&
        "plan" in semantic && semantic.plan.timing.kind === "duration"
      ? ` duration=${textExact(semantic.plan.timing.value)}`
      : "";
    lines.push(
      `OCCURRENCE id=${occurrence.occurrence_id ?? "-"} kind=${occurrence.entity_kind} source_id=${occurrence.source_id} from=${occurrence.from_occurrence_id ?? "-"} to=${occurrence.to_occurrence_id ?? "-"} retired_at=${occurrence.retired_at_commit_id ?? "-"}${timing} label=${JSON.stringify(label)}`,
    );
  }
  for (const entry of value.timeline?.entries ?? []) {
    lines.push(
      `TIMELINE commit=${entry.commit_id} validity=${entry.validity} segment=${entry.segment_ordinal ?? "-"} transition=${entry.transition?.class ?? "-"} topology=${entry.topology_epoch_id ?? "-"}`,
    );
  }
  lines.push(
    `ANALYSIS status=${value.analysis.status} mode=${value.analysis.mode} checkpoint=${value.analysis.checkpoint_commit_id ?? "-"} precedence=${value.analysis.precedence === null ? "-" : textExact(value.analysis.precedence.makespan)} resource=${value.analysis.resource === null ? "-" : textExact(value.analysis.resource.makespan)}`,
  );
  for (const cause of value.causes) {
    lines.push(
      `CAUSE ${cause.cause} subject=${cause.subject} commit=${cause.commit_id ?? "-"} limit=${cause.limit ?? "-"} actual=${cause.actual ?? "-"}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
