import { planTargetPlanAssuranceAdvance } from "../assurance/advance.js";
import { canonicalJson } from "../assurance/canonical.js";
import {
  HISTORICAL_GIT_EVIDENCE_LIMITS,
  type HistoricalGitEvidenceOutcome,
  type HistoricalGitEvidenceResult,
  type HistoricalGitInspectionSnapshot,
} from "../history/git-probe.js";
import {
  projectHistoricalTransitionModel,
  type HistoricalTransitionProjectionV1,
} from "../history/historical-transition.js";
import { digestDocumentBytes } from "../io/document-file.js";
import { milestoneAcceptanceBaseText } from "../milestone-acceptance/source.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";
import {
  scanTemporalDeclarationBlocks,
  temporalScheduleBaseText,
} from "../temporal-schedule/source-lexical.js";
import type {
  PlanningHistoricalAxisStates,
  PlanningHistoricalEvidenceBasis,
  PlanningHistoricalExecutionContexts,
  PlanningHistoricalGap,
  PlanningHistoricalLineage,
  PlanningHistoricalOccurrenceEnd,
  PlanningHistoricalRelationKind,
  PlanningHistoricalRelationOccurrence,
  PlanningHistoricalSemanticEpoch,
  PlanningHistoricalSnapshotObservation,
  PlanningHistoricalState,
  PlanningHistoricalTransition,
  PlanningHistoricalWindowCloseObservation,
  PlanningHistoricalWindowOccurrence,
  PlanningHistoricalWorkOccurrence,
  PlanningHistoryCoreCapability,
  PlanningPoolHistoricalObservationResult,
} from "./history-types.js";
import {
  observePlanningPool,
  PLANNING_OBSERVATION_CORE_CAPABILITY,
} from "./observation.js";
import type {
  PlanningObservationExecutionContext,
  PlanningObservationRequest,
  PlanningPoolObservationResult,
  PlanningTaskObservation,
  PlanningMilestoneObservation,
} from "./observation-types.js";
import {
  planningPoolBaseText,
  scanPlanningDeclarationBlocks,
} from "./source-lexical.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "./source.js";
import type {
  PlanningActivitySource,
  PlanningEventSource,
  PlanningPoolSourceDiagnostic,
  PlanningPoolSourceModel,
  PlanningWindowSource,
  PlanningWorkSource,
} from "./source-types.js";

export const PLANNING_HISTORY_CORE_CAPABILITY:
  PlanningHistoryCoreCapability = Object.freeze({
    id: "perttool.planning-history-core",
    version: 1,
  });

export const PLANNING_HISTORY_CORE_LIMITS = Object.freeze({
  inspectedCommits: 2_048,
  rawBytesPerSnapshot: 8_388_608,
  aggregateRawSnapshotBytes: 134_217_728,
  derivedEntityRecords: 100_000,
});

interface StrictProjection {
  readonly baseText: string;
  readonly projection: HistoricalTransitionProjectionV1;
}

interface RelationValue {
  readonly key: string;
  readonly kind: PlanningHistoricalRelationKind;
  readonly ownerId: string;
  readonly targetId: string;
  readonly digest: string;
}

interface ProcessedPlanningSnapshot {
  readonly output: PlanningHistoricalSnapshotObservation;
  readonly text: string | null;
  readonly model: PlanningPoolSourceModel | null;
  readonly poolObservation: PlanningPoolObservationResult | null;
  readonly strict: StrictProjection | null;
  readonly semanticDigest: string | null;
  readonly workValues: ReadonlyMap<string, string>;
  readonly windowValues: ReadonlyMap<string, string>;
  readonly relationValues: ReadonlyMap<string, RelationValue>;
  readonly contextUnavailable: boolean;
}

interface MutableOccurrence {
  readonly sourceId: string;
  readonly occurrenceId: string;
  readonly firstObservedCommitId: string;
  lastObservedCommitId: string;
  retiredAtCommitId: string | null;
  endedBy: PlanningHistoricalOccurrenceEnd;
  readonly observedCommitIds: string[];
  readonly epochs: MutableEpoch[];
  readonly relation: RelationValue | null;
}

interface MutableEpoch {
  readonly ordinal: number;
  readonly firstObservedCommitId: string;
  lastObservedCommitId: string;
  readonly valueDigest: string;
}

interface OccurrenceBuildResult {
  readonly occurrences: readonly MutableOccurrence[];
  readonly ambiguousIds: readonly string[];
}

interface PreparedCurrentObservation {
  readonly sourceDigest: string;
  readonly documentId: string | null;
  readonly model: PlanningPoolSourceModel | null;
  readonly request: PlanningObservationRequest | null;
  readonly current: PlanningPoolHistoricalObservationResult["current"];
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
  readonly valid: boolean;
}

interface PreparedHistoricalProjection {
  readonly processed: readonly ProcessedPlanningSnapshot[];
  readonly lineage: PlanningHistoricalLineage;
  readonly state: PlanningHistoricalState;
  readonly axisStates: PlanningHistoricalAxisStates;
  readonly continuityQualified: boolean;
}

type BoundHistoricalGitEvidence = HistoricalGitEvidenceResult & {
  readonly objectFormat: "sha1" | "sha256";
  readonly repositoryId: string;
  readonly repositoryReadSnapshotId: string;
  readonly repositoryRelativePath: string;
  readonly resolvedEndpoint: string;
};

const qualifiedPattern = /^[A-Za-z][A-Za-z0-9_-]*::[A-Za-z][A-Za-z0-9_-]*$/u;

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

function diagnostic(
  code: string,
  message: string,
  severity: PlanningPoolSourceDiagnostic["severity"] = "warning",
  data: Readonly<Record<string, unknown>> = {},
): PlanningPoolSourceDiagnostic {
  return Object.freeze({ code, severity, message, data });
}

function requireCapability(capability: PlanningHistoryCoreCapability): void {
  if (capability !== PLANNING_HISTORY_CORE_CAPABILITY) {
    throw new TypeError("the private planning history Core capability is required");
  }
}

function sorted(values: Iterable<string>): readonly string[] {
  return Object.freeze([...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
}

function semanticDigest(value: unknown): string {
  return sha256DigestUtf8(canonicalJson(value));
}

function valueWithoutSourceLocations(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(valueWithoutSourceLocations);
  if (typeof value !== "object" || value === null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "span" || key.endsWith("Span") || key === "sourceText") continue;
    result[key] = valueWithoutSourceLocations(child);
  }
  return result;
}

function eventValue(event: PlanningEventSource): unknown {
  return valueWithoutSourceLocations(event);
}

function activityValue(activity: PlanningActivitySource): unknown {
  return valueWithoutSourceLocations(activity);
}

function workValue(work: PlanningWorkSource, model: PlanningPoolSourceModel): unknown {
  const eventIds = new Set(work.events.map(({ id }) => id));
  const activityIds = new Set(work.activities.map(({ id }) => id));
  return {
    id: work.qualifiedId,
    title: work.title,
    description: work.description?.value ?? null,
    events: model.events.filter(({ id }) => eventIds.has(id)).map(eventValue),
    activities: model.activities.filter(({ id }) => activityIds.has(id)).map(activityValue),
    milestoneLinks: work.milestoneLinks.map(({ qualifiedId }) => qualifiedId),
    taskLinks: work.taskLinks.map(({ qualifiedId }) => qualifiedId),
    dependsOn: work.dependsOn.map(({ qualifiedId }) => qualifiedId),
  };
}

function windowValue(window: PlanningWindowSource): unknown {
  return {
    id: window.qualifiedId,
    title: window.title,
    objective: window.objective,
    start: valueWithoutSourceLocations(window.start),
    end: valueWithoutSourceLocations(window.end),
    works: window.works.map(({ qualifiedId }) => qualifiedId),
  };
}

function workValues(model: PlanningPoolSourceModel): ReadonlyMap<string, string> {
  return new Map(model.works.map((work) => [work.qualifiedId, semanticDigest(workValue(work, model))]));
}

function windowValues(model: PlanningPoolSourceModel): ReadonlyMap<string, string> {
  return new Map(model.windows.map((window) => [window.qualifiedId, semanticDigest(windowValue(window))]));
}

function firstTaskFact(
  observation: PlanningPoolObservationResult,
  taskId: string,
): PlanningTaskObservation | null {
  for (const work of observation.works) {
    const task = work.execution.tasks.find(({ taskId: candidate }) => candidate === taskId);
    if (task !== undefined) return task;
  }
  return null;
}

function firstMilestoneFact(
  observation: PlanningPoolObservationResult,
  milestoneId: string,
): PlanningMilestoneObservation | null {
  for (const work of observation.works) {
    const milestone = work.outcome.milestones.find(({ milestoneId: candidate }) => candidate === milestoneId);
    if (milestone !== undefined) return milestone;
  }
  return null;
}

function relationKey(kind: PlanningHistoricalRelationKind, ownerId: string, targetId: string): string {
  return `${kind}:${ownerId}->${targetId}`;
}

function relationValue(
  kind: PlanningHistoricalRelationKind,
  ownerId: string,
  targetId: string,
  fact: unknown,
): RelationValue {
  const key = relationKey(kind, ownerId, targetId);
  return Object.freeze({ key, kind, ownerId, targetId, digest: semanticDigest({ kind, ownerId, targetId, fact }) });
}

function relationValues(
  model: PlanningPoolSourceModel,
  observation: PlanningPoolObservationResult,
): ReadonlyMap<string, RelationValue> {
  const values: RelationValue[] = [];
  for (const work of model.works) {
    for (const target of work.events) values.push(relationValue("work_event", work.qualifiedId, target.qualifiedId, null));
    for (const target of work.activities) values.push(relationValue("work_activity", work.qualifiedId, target.qualifiedId, null));
    for (const target of work.dependsOn) values.push(relationValue("work_dependency", work.qualifiedId, target.qualifiedId, null));
    for (const target of work.taskLinks) {
      const fact = firstTaskFact(observation, target.qualifiedId);
      values.push(relationValue("work_task_projection", work.qualifiedId, target.qualifiedId, fact));
    }
    for (const target of work.milestoneLinks) {
      const fact = firstMilestoneFact(observation, target.qualifiedId);
      values.push(relationValue("work_milestone_projection", work.qualifiedId, target.qualifiedId, fact));
    }
  }
  for (const window of model.windows) {
    for (const target of window.works) {
      values.push(relationValue("window_membership", window.qualifiedId, target.qualifiedId, null));
    }
  }
  return new Map(values.map((value) => [value.key, value]));
}

function planningSemanticDigest(
  model: PlanningPoolSourceModel,
  works: ReadonlyMap<string, string>,
  windows: ReadonlyMap<string, string>,
  relations: ReadonlyMap<string, RelationValue>,
  strict: StrictProjection,
): string {
  return semanticDigest({
    projectId: model.documentId,
    workOrder: model.workOrder.map(({ qualifiedId }) => qualifiedId),
    works: [...works.entries()],
    windows: [...windows.entries()],
    relations: [...relations.values()].map(({ key, digest }) => [key, digest]),
    strict: strict.projection.semantic_digest,
  });
}

function strictProjection(text: string): StrictProjection | null {
  const grammar8 = planningPoolBaseText(text, scanPlanningDeclarationBlocks(text));
  const grammar7 = temporalScheduleBaseText(grammar8, scanTemporalDeclarationBlocks(grammar8));
  const grammar6 = milestoneAcceptanceBaseText(grammar7);
  const validated = validateTargetGrammar6Document(grammar6, TARGET_GRAMMAR_6_CAPABILITY);
  return !validated.ok || validated.validatedDocument === null
    ? null
    : Object.freeze({
        baseText: grammar6,
        projection: projectHistoricalTransitionModel(validated.validatedDocument),
      });
}

function selectionPresent(model: PlanningPoolSourceModel, request: PlanningObservationRequest): boolean {
  if (request.selection.kind === "pool") return true;
  if (request.selection.kind === "work") {
    const known = new Set(model.works.map(({ qualifiedId }) => qualifiedId));
    return request.selection.work_ids.every((id) => known.has(id));
  }
  if (request.selection.kind === "persisted") {
    const windowId = request.selection.window_id;
    return model.windows.some(({ qualifiedId }) => qualifiedId === windowId);
  }
  const known = new Set(model.works.map(({ qualifiedId }) => qualifiedId));
  return request.selection.work_ids.every((id) => known.has(id));
}

function snapshotRequest(
  request: PlanningObservationRequest,
  sourceDigest: string,
  selection: PlanningObservationRequest["selection"] = request.selection,
): PlanningObservationRequest {
  return Object.freeze({
    ...request,
    source_digest: sourceDigest,
    selection,
    close_dispositions: Object.freeze([]),
  });
}

function unavailableExecution(sourceDigest: string): PlanningObservationExecutionContext {
  return Object.freeze({
    source_digest: sourceDigest,
    evidence_state: "unavailable",
    recommended_task_ids: Object.freeze([]),
    startable_task_ids: Object.freeze([]),
  });
}

function executionMap(
  contexts: PlanningHistoricalExecutionContexts,
  diagnostics: PlanningPoolSourceDiagnostic[],
): ReadonlyMap<string, PlanningObservationExecutionContext> {
  const result = new Map<string, PlanningObservationExecutionContext>();
  for (const entry of contexts.historical) {
    if (result.has(entry.commit_id)) {
      diagnostics.push(diagnostic("PTPOOL-114", `duplicate historical execution context ${entry.commit_id}`));
      continue;
    }
    result.set(entry.commit_id, entry.execution);
  }
  return result;
}

function snapshotBasis(snapshot: HistoricalGitInspectionSnapshot): PlanningHistoricalSnapshotObservation["basis"] {
  return Object.freeze({
    repositoryId: snapshot.repositoryId,
    repositoryRelativePath: snapshot.repositoryRelativePath,
    repositoryReadSnapshotId: snapshot.repositoryReadSnapshotId,
    commitId: snapshot.commitId,
    parentCommitIds: Object.freeze([...snapshot.parentCommitIds]),
    blobId: snapshot.blobId,
    sourceDigest: snapshot.sourceDigest,
    recordedAt: snapshot.recordedAt,
    isMergeCommit: snapshot.isMergeCommit,
    isEndpoint: snapshot.isEndpoint,
    isLowerBoundary: snapshot.isLowerBoundary,
  });
}

function emptyProcessed(
  snapshot: HistoricalGitInspectionSnapshot,
  validity: PlanningHistoricalSnapshotObservation["validity"],
  diagnosticCodes: readonly string[],
  documentId: string | null = null,
): ProcessedPlanningSnapshot {
  return Object.freeze({
    output: Object.freeze({
      basis: snapshotBasis(snapshot),
      validity,
      documentId,
      selectionState: "unavailable",
      observation: null,
      globalExecutionEvidence: "unavailable",
      diagnosticCodes: Object.freeze([...diagnosticCodes]),
    }),
    text: null,
    model: null,
    poolObservation: null,
    strict: null,
    semanticDigest: null,
    workValues: new Map(),
    windowValues: new Map(),
    relationValues: new Map(),
    contextUnavailable: true,
  });
}

function decodeSnapshot(snapshot: HistoricalGitInspectionSnapshot): string | null {
  if (snapshot.source === null) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(snapshot.source);
  } catch {
    return null;
  }
}

interface PreparedSnapshotSource {
  readonly text: string;
  readonly model: PlanningPoolSourceModel;
  readonly diagnosticCodes: readonly string[];
}

function preparedSnapshotSource(
  snapshot: HistoricalGitInspectionSnapshot,
): PreparedSnapshotSource | ProcessedPlanningSnapshot {
  if ([snapshot.source, snapshot.sourceDigest, snapshot.blobId].some((value) => value === null)) {
    return emptyProcessed(snapshot, "source_missing", ["PTPOOL-114"]);
  }
  const text = decodeSnapshot(snapshot);
  if (text === null || digestDocumentBytes(snapshot.source!) !== snapshot.sourceDigest) {
    return emptyProcessed(snapshot, "source_binding_invalid", ["PTPOOL-114"]);
  }
  const source = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY);
  const codes = source.diagnostics.map(({ code }) => code);
  if (!source.ok) return emptyProcessed(snapshot, "source_invalid", codes, source.documentId);
  if (source.model === null) return emptyProcessed(snapshot, "planning_absent", codes, source.documentId);
  return Object.freeze({ text, model: source.model, diagnosticCodes: Object.freeze(codes) });
}

function isProcessedSnapshot(
  value: PreparedSnapshotSource | ProcessedPlanningSnapshot,
): value is ProcessedPlanningSnapshot {
  return "output" in value;
}

function historicalExecutionContext(
  snapshot: HistoricalGitInspectionSnapshot,
  contexts: ReadonlyMap<string, PlanningObservationExecutionContext>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): { readonly context: PlanningObservationExecutionContext; readonly unavailable: boolean } {
  const supplied = contexts.get(snapshot.commitId);
  const unavailable = supplied === undefined || supplied.source_digest !== snapshot.sourceDigest;
  if (unavailable) {
    diagnostics.push(diagnostic("PTPOOL-114", `global execution evidence is unavailable at ${snapshot.commitId}`));
  }
  return Object.freeze({
    context: unavailable ? unavailableExecution(snapshot.sourceDigest!) : supplied,
    unavailable,
  });
}

function successfulProcessedSnapshot(
  snapshot: HistoricalGitInspectionSnapshot,
  prepared: PreparedSnapshotSource,
  request: PlanningObservationRequest,
  context: PlanningObservationExecutionContext,
  contextUnavailable: boolean,
): ProcessedPlanningSnapshot {
  const pool = observePlanningPool(
    prepared.text,
    snapshotRequest(request, snapshot.sourceDigest!, { kind: "pool" }),
    context,
    PLANNING_OBSERVATION_CORE_CAPABILITY,
  );
  const strict = strictProjection(prepared.text);
  if (!pool.ok || strict === null) {
    return emptyProcessed(snapshot, "source_invalid", pool.diagnostics.map(({ code }) => code), prepared.model.documentId);
  }
  const present = selectionPresent(prepared.model, request);
  const selected = present
    ? observePlanningPool(
        prepared.text,
        snapshotRequest(request, snapshot.sourceDigest!),
        context,
        PLANNING_OBSERVATION_CORE_CAPABILITY,
      )
    : null;
  if (selected?.ok === false) {
    return emptyProcessed(snapshot, "source_invalid", selected.diagnostics.map(({ code }) => code), prepared.model.documentId);
  }
  const works = workValues(prepared.model);
  const windows = windowValues(prepared.model);
  const relations = relationValues(prepared.model, pool);
  const diagnosticCodes = [...prepared.diagnosticCodes];
  if (contextUnavailable) diagnosticCodes.push("PTPOOL-114");
  return Object.freeze({
    output: Object.freeze({
      basis: snapshotBasis(snapshot),
      validity: "planning_valid",
      documentId: prepared.model.documentId,
      selectionState: present ? "observed" : "absent",
      observation: selected,
      globalExecutionEvidence: context.evidence_state,
      diagnosticCodes: Object.freeze(diagnosticCodes),
    }),
    text: prepared.text,
    model: prepared.model,
    poolObservation: pool,
    strict,
    semanticDigest: planningSemanticDigest(prepared.model, works, windows, relations, strict),
    workValues: works,
    windowValues: windows,
    relationValues: relations,
    contextUnavailable,
  });
}

function processPlanningSnapshot(
  snapshot: HistoricalGitInspectionSnapshot,
  request: PlanningObservationRequest,
  contexts: ReadonlyMap<string, PlanningObservationExecutionContext>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): ProcessedPlanningSnapshot {
  const prepared = preparedSnapshotSource(snapshot);
  if (isProcessedSnapshot(prepared)) return prepared;
  const execution = historicalExecutionContext(snapshot, contexts, diagnostics);
  return successfulProcessedSnapshot(
    snapshot,
    prepared,
    request,
    execution.context,
    execution.unavailable,
  );
}

function objectIdPattern(objectFormat: "sha1" | "sha256"): RegExp {
  return objectFormat === "sha1" ? /^[0-9a-f]{40}$/u : /^[0-9a-f]{64}$/u;
}

function evidenceReadSnapshotId(evidence: HistoricalGitEvidenceResult): string | null {
  if (
    evidence.objectFormat === null || evidence.repositoryId === null ||
    evidence.repositoryRelativePath === null || evidence.resolvedEndpoint === null
  ) return null;
  const digest = digestDocumentBytes(Buffer.from(JSON.stringify({
    model: "Perttool.HistoricalGitEvidence.v1",
    objectFormat: evidence.objectFormat,
    repositoryId: evidence.repositoryId,
    repositoryRelativePath: evidence.repositoryRelativePath,
    resolvedEndpoint: evidence.resolvedEndpoint,
    resolvedLowerBoundary: evidence.resolvedLowerBoundary,
    snapshots: evidence.snapshots.map((snapshot) => ({
      commitId: snapshot.commitId,
      parentCommitIds: snapshot.parentCommitIds,
      blobId: snapshot.blobId,
      sourceDigest: snapshot.sourceDigest,
    })),
  }), "utf8"));
  return `git-read:${digest}`;
}

function evidenceBindingValid(
  evidence: HistoricalGitEvidenceResult,
  currentSourceDigest: string,
): boolean {
  if (evidence.currentSourceDigest !== currentSourceDigest) return false;
  if (evidence.status === "unavailable") return true;
  if (!evidenceHeaderValid(evidence)) return false;
  const idPattern = objectIdPattern(evidence.objectFormat);
  const seen = new Set<string>();
  let aggregate = 0;
  for (const [index, snapshot] of evidence.snapshots.entries()) {
    aggregate += snapshot.source?.byteLength ?? 0;
    if (!snapshotBindingValid(snapshot, evidence, index, idPattern, seen)) return false;
    seen.add(snapshot.commitId);
  }
  return evidenceEndpointValid(evidence, aggregate);
}

function evidenceHeaderValid(evidence: HistoricalGitEvidenceResult): evidence is BoundHistoricalGitEvidence {
  return [
    evidence.ancestryProfile === "first_parent",
    evidence.objectFormat !== null,
    evidence.repositoryId !== null,
    evidence.repositoryReadSnapshotId !== null,
    evidence.repositoryRelativePath !== null,
    evidence.resolvedEndpoint !== null,
    evidence.snapshots.length > 0,
    evidence.snapshots.length === evidence.inspectedCommitIds.length,
    evidenceReadSnapshotId(evidence) === evidence.repositoryReadSnapshotId,
  ].every(Boolean);
}

function snapshotBindingValid(
  snapshot: HistoricalGitInspectionSnapshot,
  evidence: BoundHistoricalGitEvidence,
  index: number,
  idPattern: RegExp,
  seen: ReadonlySet<string>,
): boolean {
  return [
    snapshot.modelVersion === 1,
    snapshot.objectFormat === evidence.objectFormat,
    snapshot.repositoryId === evidence.repositoryId,
    snapshot.repositoryReadSnapshotId === evidence.repositoryReadSnapshotId,
    snapshot.repositoryRelativePath === evidence.repositoryRelativePath,
    evidence.inspectedCommitIds[index] === snapshot.commitId,
    !seen.has(snapshot.commitId),
    idPattern.test(snapshot.commitId),
    snapshot.parentCommitIds.every((id) => idPattern.test(id)),
    snapshot.blobId === null || idPattern.test(snapshot.blobId),
    (snapshot.source === null) === (snapshot.sourceDigest === null),
    (snapshot.source === null) === (snapshot.blobId === null),
    snapshot.source === null || digestDocumentBytes(snapshot.source) === snapshot.sourceDigest,
  ].every(Boolean);
}

function evidenceEndpointValid(evidence: HistoricalGitEvidenceResult, aggregate: number): boolean {
  return [
    aggregate === evidence.aggregateRawSnapshotBytes,
    evidence.snapshots.at(-1)?.commitId === evidence.resolvedEndpoint,
    evidence.snapshots.at(-1)?.isEndpoint === true,
  ].every(Boolean);
}

function evidenceWithinLimits(evidence: HistoricalGitEvidenceResult): boolean {
  if (evidence.status === "unavailable") return true;
  return evidence.inspectedCommitIds.length <= PLANNING_HISTORY_CORE_LIMITS.inspectedCommits &&
    evidence.snapshots.every(({ source }) => (source?.byteLength ?? 0) <= PLANNING_HISTORY_CORE_LIMITS.rawBytesPerSnapshot) &&
    evidence.aggregateRawSnapshotBytes <= PLANNING_HISTORY_CORE_LIMITS.aggregateRawSnapshotBytes &&
    evidence.limits.inspectedCommits <= PLANNING_HISTORY_CORE_LIMITS.inspectedCommits &&
    evidence.limits.rawBytesPerSnapshot <= PLANNING_HISTORY_CORE_LIMITS.rawBytesPerSnapshot &&
    evidence.limits.aggregateRawSnapshotBytes <= PLANNING_HISTORY_CORE_LIMITS.aggregateRawSnapshotBytes;
}

function emptyAxisStates(state: "unknown" | "unavailable"): PlanningHistoricalAxisStates {
  return Object.freeze({
    refinement: state,
    execution: state,
    outcome: state,
    organization: state,
    temporal: state,
    closeDisposition: state,
  });
}

function completeAxisStates(): PlanningHistoricalAxisStates {
  return Object.freeze({
    refinement: "complete",
    execution: "complete",
    outcome: "complete",
    organization: "complete",
    temporal: "complete",
    closeDisposition: "complete",
  });
}

function evidenceBasis(
  evidence: HistoricalGitEvidenceOutcome,
  sourceDigest: string,
  state: PlanningHistoricalState,
  continuityQualified: boolean,
): PlanningHistoricalEvidenceBasis {
  if (!evidence.ok) {
    return Object.freeze({
      mode: "historical",
      state,
      ancestryProfile: "first_parent",
      repositoryId: null,
      repositoryRelativePath: null,
      repositoryReadSnapshotId: null,
      requestedEndpoint: "HEAD",
      resolvedEndpoint: null,
      requestedLowerBoundary: null,
      resolvedLowerBoundary: null,
      currentSourceDigest: sourceDigest,
      limits: HISTORICAL_GIT_EVIDENCE_LIMITS,
      causes: Object.freeze([]),
      continuityQualified,
      forcedLossDistinguishable: false,
    });
  }
  return Object.freeze({
    mode: "historical",
    state,
    ancestryProfile: "first_parent",
    repositoryId: evidence.repositoryId,
    repositoryRelativePath: evidence.repositoryRelativePath,
    repositoryReadSnapshotId: evidence.repositoryReadSnapshotId,
    requestedEndpoint: evidence.requestedEndpoint,
    resolvedEndpoint: evidence.resolvedEndpoint,
    requestedLowerBoundary: evidence.requestedLowerBoundary,
    resolvedLowerBoundary: evidence.resolvedLowerBoundary,
    currentSourceDigest: sourceDigest,
    limits: evidence.limits,
    causes: evidence.causes,
    continuityQualified,
    forcedLossDistinguishable: false,
  });
}

function makeEpoch(commitId: string, digest: string): MutableEpoch {
  return { ordinal: 1, firstObservedCommitId: commitId, lastObservedCommitId: commitId, valueDigest: digest };
}

function updateOccurrence(occurrence: MutableOccurrence, commitId: string, digest: string): void {
  occurrence.lastObservedCommitId = commitId;
  occurrence.observedCommitIds.push(commitId);
  const epoch = occurrence.epochs.at(-1)!;
  if (epoch.valueDigest === digest) epoch.lastObservedCommitId = commitId;
  else occurrence.epochs.push({
    ordinal: occurrence.epochs.length + 1,
    firstObservedCommitId: commitId,
    lastObservedCommitId: commitId,
    valueDigest: digest,
  });
}

function closeActive(
  active: Map<string, MutableOccurrence>,
  endedBy: PlanningHistoricalOccurrenceEnd,
  retiredAtCommitId: string | null,
): void {
  for (const occurrence of active.values()) {
    occurrence.endedBy = endedBy;
    occurrence.retiredAtCommitId = retiredAtCommitId;
  }
  active.clear();
}

function buildOccurrences(
  snapshots: readonly ProcessedPlanningSnapshot[],
  select: (snapshot: ProcessedPlanningSnapshot) => ReadonlyMap<string, string | RelationValue>,
  prefix: string,
): OccurrenceBuildResult {
  const active = new Map<string, MutableOccurrence>();
  const occurrences: MutableOccurrence[] = [];
  const ordinals = new Map<string, number>();
  const seen = new Set<string>();
  const ambiguous = new Set<string>();
  let previousValid = false;
  let previousProject: string | null = null;
  for (const snapshot of snapshots) {
    const valid = snapshot.model !== null && snapshot.output.validity === "planning_valid";
    const project = snapshot.model?.documentId ?? null;
    if (!valid || (previousValid && previousProject !== project)) {
      if (active.size > 0) closeActive(active, "gap", null);
      previousValid = false;
      previousProject = project;
      continue;
    }
    const commitId = snapshot.output.basis.commitId;
    const values = select(snapshot);
    if (!previousValid && active.size > 0) closeActive(active, "gap", null);
    for (const [id, occurrence] of [...active]) {
      if (!values.has(id)) {
        occurrence.endedBy = "removed";
        occurrence.retiredAtCommitId = commitId;
        active.delete(id);
      }
    }
    for (const [id, raw] of values) {
      const value = typeof raw === "string" ? raw : raw.digest;
      const existing = active.get(id);
      if (existing !== undefined) {
        updateOccurrence(existing, commitId, value);
        continue;
      }
      if (seen.has(id)) ambiguous.add(id);
      seen.add(id);
      const ordinal = (ordinals.get(id) ?? 0) + 1;
      ordinals.set(id, ordinal);
      const relation = typeof raw === "string" ? null : raw;
      const occurrence: MutableOccurrence = {
        sourceId: id,
        occurrenceId: `${prefix}:${id}:${ordinal}`,
        firstObservedCommitId: commitId,
        lastObservedCommitId: commitId,
        retiredAtCommitId: null,
        endedBy: "historical_endpoint",
        observedCommitIds: [commitId],
        epochs: [makeEpoch(commitId, value)],
        relation,
      };
      occurrences.push(occurrence);
      active.set(id, occurrence);
    }
    previousValid = true;
    previousProject = project;
  }
  return Object.freeze({ occurrences: Object.freeze(occurrences), ambiguousIds: sorted(ambiguous) });
}

function epochs(occurrence: MutableOccurrence): readonly PlanningHistoricalSemanticEpoch[] {
  return Object.freeze(occurrence.epochs.map((epoch) => Object.freeze({ ...epoch })));
}

function workOccurrences(values: readonly MutableOccurrence[]): readonly PlanningHistoricalWorkOccurrence[] {
  return Object.freeze(values.map((value) => Object.freeze({
    occurrenceId: value.occurrenceId,
    workId: value.sourceId,
    firstObservedCommitId: value.firstObservedCommitId,
    lastObservedCommitId: value.lastObservedCommitId,
    retiredAtCommitId: value.retiredAtCommitId,
    endedBy: value.endedBy,
    observedCommitIds: Object.freeze([...value.observedCommitIds]),
    semanticEpochs: epochs(value),
  })));
}

function windowOccurrences(values: readonly MutableOccurrence[]): readonly PlanningHistoricalWindowOccurrence[] {
  return Object.freeze(values.map((value) => Object.freeze({
    occurrenceId: value.occurrenceId,
    windowId: value.sourceId,
    firstObservedCommitId: value.firstObservedCommitId,
    lastObservedCommitId: value.lastObservedCommitId,
    retiredAtCommitId: value.retiredAtCommitId,
    endedBy: value.endedBy,
    observedCommitIds: Object.freeze([...value.observedCommitIds]),
    semanticEpochs: epochs(value),
  })));
}

function relationOccurrences(values: readonly MutableOccurrence[]): readonly PlanningHistoricalRelationOccurrence[] {
  return Object.freeze(values.map((value) => Object.freeze({
    occurrenceId: value.occurrenceId,
    kind: value.relation!.kind,
    ownerId: value.relation!.ownerId,
    targetId: value.relation!.targetId,
    firstObservedCommitId: value.firstObservedCommitId,
    lastObservedCommitId: value.lastObservedCommitId,
    retiredAtCommitId: value.retiredAtCommitId,
    endedBy: value.endedBy,
    observedCommitIds: Object.freeze([...value.observedCommitIds]),
    factEpochs: epochs(value),
  })));
}

function removedIds<T extends { readonly id: string }>(before: readonly T[], after: readonly T[]): readonly string[] {
  const retained = new Set(after.map(({ id }) => id));
  return sorted(before.map(({ id }) => id).filter((id) => !retained.has(id)));
}

function strictCanonicalAdvance(before: StrictProjection, after: StrictProjection): boolean {
  const planned = planTargetPlanAssuranceAdvance(
    before.baseText,
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  if (
    !planned.ok || !planned.changed || planned.updatedText === null || planned.advance === null ||
    planned.assuranceGuard?.status === "blocked"
  ) return false;
  const validated = validateTargetGrammar6Document(planned.updatedText, TARGET_GRAMMAR_6_CAPABILITY);
  if (!validated.ok || validated.validatedDocument === null) return false;
  const candidate = projectHistoricalTransitionModel(validated.validatedDocument);
  return candidate.semantic_digest === after.projection.semantic_digest;
}

function sameMap(left: ReadonlyMap<string, string>, right: ReadonlyMap<string, string>): boolean {
  return left.size === right.size && [...left].every(([key, value]) => right.get(key) === value);
}

function windowWithoutWorks(window: PlanningWindowSource): string {
  return semanticDigest({
    id: window.qualifiedId,
    title: window.title,
    objective: window.objective,
    start: valueWithoutSourceLocations(window.start),
    end: valueWithoutSourceLocations(window.end),
  });
}

function windowCarryOver(
  window: PlanningWindowSource,
  prior: PlanningWindowSource | undefined,
  members: ReadonlySet<string>,
): readonly { readonly workId: string; readonly targetWindowId: string }[] | null {
  if (prior !== undefined && windowWithoutWorks(prior) !== windowWithoutWorks(window)) return null;
  const current = new Set(window.works.map(({ qualifiedId }) => qualifiedId));
  if (prior?.works.some(({ qualifiedId }) => !current.has(qualifiedId)) === true) return null;
  const previous = new Set(prior?.works.map(({ qualifiedId }) => qualifiedId) ?? []);
  const additions = window.works.filter(({ qualifiedId }) => !previous.has(qualifiedId));
  if (additions.some(({ qualifiedId }) => !members.has(qualifiedId))) return null;
  return Object.freeze(additions.map(({ qualifiedId }) => Object.freeze({
    workId: qualifiedId,
    targetWindowId: window.qualifiedId,
  })));
}

function closeWindowCandidate(
  before: ProcessedPlanningSnapshot,
  after: ProcessedPlanningSnapshot,
): PlanningWindowSource | null {
  if ([before.model, after.model, before.strict, after.strict].some((value) => value === null)) return null;
  const conditions = [
    before.strict!.projection.semantic_digest === after.strict!.projection.semantic_digest,
    sameMap(before.workValues, after.workValues),
  ];
  if (!conditions.every(Boolean)) return null;
  const afterIds = new Set(after.model!.windows.map(({ qualifiedId }) => qualifiedId));
  const removed = before.model!.windows.filter(({ qualifiedId }) => !afterIds.has(qualifiedId));
  return removed.length === 1 ? removed[0]! : null;
}

function compareCarryOver(
  before: PlanningPoolSourceModel,
  after: PlanningPoolSourceModel,
  members: ReadonlySet<string>,
): readonly { readonly workId: string; readonly targetWindowId: string }[] | null {
  const beforeById = new Map(before.windows.map((window) => [window.qualifiedId, window]));
  const carried: { readonly workId: string; readonly targetWindowId: string }[] = [];
  for (const window of after.windows) {
    const values = windowCarryOver(window, beforeById.get(window.qualifiedId), members);
    if (values === null) return null;
    carried.push(...values);
  }
  return Object.freeze(carried);
}

function compareCarry(left: { readonly workId: string; readonly targetWindowId: string }, right: { readonly workId: string; readonly targetWindowId: string }): number {
  const a = `${left.workId}\u0000${left.targetWindowId}`;
  const b = `${right.workId}\u0000${right.targetWindowId}`;
  return a < b ? -1 : a > b ? 1 : 0;
}

function windowCloseObservation(
  before: ProcessedPlanningSnapshot,
  after: ProcessedPlanningSnapshot,
): PlanningHistoricalWindowCloseObservation | null {
  const closed = closeWindowCandidate(before, after);
  if (closed === null) return null;
  const members = new Set(closed.works.map(({ qualifiedId }) => qualifiedId));
  const carried = compareCarryOver(before.model!, after.model!, members);
  if (carried === null) return null;
  const carriedIds = new Set(carried.map(({ workId }) => workId));
  return Object.freeze({
    windowId: closed.qualifiedId,
    fromCommitId: before.output.basis.commitId,
    toCommitId: after.output.basis.commitId,
    memberWorkIds: sorted(members),
    carriedOver: Object.freeze([...carried].sort(compareCarry)),
    unrecordedDispositionWorkIds: sorted([...members].filter((id) => !carriedIds.has(id))),
    exactMutationRequestAvailable: false,
  });
}

function keys<T>(map: ReadonlyMap<string, T>): ReadonlySet<string> {
  return new Set(map.keys());
}

function added(before: ReadonlySet<string>, after: ReadonlySet<string>): readonly string[] {
  return sorted([...after].filter((value) => !before.has(value)));
}

function gapTransition(
  previous: ProcessedPlanningSnapshot | null,
  snapshot: ProcessedPlanningSnapshot,
): PlanningHistoricalTransition {
  return Object.freeze({
    fromCommitId: previous?.output.basis.commitId ?? null,
    toCommitId: snapshot.output.basis.commitId,
    kind: "gap",
    sourceChanged: true,
    semanticChanged: true,
    addedWorkIds: Object.freeze([]), removedWorkIds: Object.freeze([]),
    addedWindowIds: Object.freeze([]), removedWindowIds: Object.freeze([]),
    addedRelationKeys: Object.freeze([]), removedRelationKeys: Object.freeze([]),
    removedTaskIds: Object.freeze([]), removedMilestoneIds: Object.freeze([]),
    strictCanonicalAdvance: false,
    continuity: "gap",
  });
}

function baselineTransition(snapshot: ProcessedPlanningSnapshot): PlanningHistoricalTransition {
  return Object.freeze({
    fromCommitId: null,
    toCommitId: snapshot.output.basis.commitId,
    kind: "baseline",
    sourceChanged: true,
    semanticChanged: true,
    addedWorkIds: sorted(snapshot.workValues.keys()), removedWorkIds: Object.freeze([]),
    addedWindowIds: sorted(snapshot.windowValues.keys()), removedWindowIds: Object.freeze([]),
    addedRelationKeys: sorted(snapshot.relationValues.keys()), removedRelationKeys: Object.freeze([]),
    removedTaskIds: Object.freeze([]), removedMilestoneIds: Object.freeze([]),
    strictCanonicalAdvance: false,
    continuity: "continuous",
  });
}

function transitionKind(
  canonical: boolean,
  close: PlanningHistoricalWindowCloseObservation | null,
  semanticChanged: boolean,
  removedCount: number,
): PlanningHistoricalTransition["kind"] {
  if (canonical) return "canonical_advance";
  if (close !== null) return "window_close";
  if (!semanticChanged) return "representation";
  return removedCount > 0 ? "contraction" : "planning_change";
}

function connectedTransition(
  previous: ProcessedPlanningSnapshot,
  snapshot: ProcessedPlanningSnapshot,
): { readonly transition: PlanningHistoricalTransition; readonly close: PlanningHistoricalWindowCloseObservation | null } {
  const beforeWork = keys(previous.workValues);
  const afterWork = keys(snapshot.workValues);
  const beforeWindow = keys(previous.windowValues);
  const afterWindow = keys(snapshot.windowValues);
  const beforeRelations = keys(previous.relationValues);
  const afterRelations = keys(snapshot.relationValues);
  const qualify = (id: string) => `${snapshot.model!.documentId}::${id}`;
  const removedTaskIds = removedIds(previous.strict!.projection.semantic.tasks, snapshot.strict!.projection.semantic.tasks).map(qualify);
  const removedMilestoneIds = removedIds(previous.strict!.projection.semantic.milestones, snapshot.strict!.projection.semantic.milestones).map(qualify);
  const canonical = strictCanonicalAdvance(previous.strict!, snapshot.strict!);
  const close = windowCloseObservation(previous, snapshot);
  const removedWorkIds = added(afterWork, beforeWork);
  const removedWindowIds = added(afterWindow, beforeWindow);
  const removedRelationKeys = added(afterRelations, beforeRelations);
  const semanticChanged = previous.semanticDigest !== snapshot.semanticDigest;
  return Object.freeze({
    close,
    transition: Object.freeze({
      fromCommitId: previous.output.basis.commitId,
      toCommitId: snapshot.output.basis.commitId,
      kind: transitionKind(canonical, close, semanticChanged, removedWorkIds.length + removedWindowIds.length + removedRelationKeys.length),
      sourceChanged: previous.output.basis.sourceDigest !== snapshot.output.basis.sourceDigest,
      semanticChanged,
      addedWorkIds: added(beforeWork, afterWork), removedWorkIds,
      addedWindowIds: added(beforeWindow, afterWindow), removedWindowIds,
      addedRelationKeys: added(beforeRelations, afterRelations), removedRelationKeys,
      removedTaskIds, removedMilestoneIds,
      strictCanonicalAdvance: canonical,
      continuity: "continuous",
    }),
  });
}

function transitions(
  snapshots: readonly ProcessedPlanningSnapshot[],
): { readonly transitions: readonly PlanningHistoricalTransition[]; readonly closes: readonly PlanningHistoricalWindowCloseObservation[] } {
  const result: PlanningHistoricalTransition[] = [];
  const closes: PlanningHistoricalWindowCloseObservation[] = [];
  let previous: ProcessedPlanningSnapshot | null = null;
  for (const snapshot of snapshots) {
    const valid = snapshot.model !== null && snapshot.strict !== null && snapshot.semanticDigest !== null;
    if (!valid) {
      result.push(gapTransition(previous, snapshot));
      previous = null;
      continue;
    }
    if (previous === null || previous.model?.documentId !== snapshot.model!.documentId) {
      result.push(baselineTransition(snapshot));
      previous = snapshot;
      continue;
    }
    const connected = connectedTransition(previous, snapshot);
    result.push(connected.transition);
    if (connected.close !== null) closes.push(connected.close);
    previous = snapshot;
  }
  return Object.freeze({ transitions: Object.freeze(result), closes: Object.freeze(closes) });
}

function gapCause(snapshot: ProcessedPlanningSnapshot): PlanningHistoricalGap["cause"] {
  if (snapshot.output.validity === "planning_absent") return "planning_absent";
  if (snapshot.output.validity === "source_missing") return "source_missing";
  if (snapshot.output.validity === "source_binding_invalid") return "source_binding_invalid";
  return "source_invalid";
}

function buildLineage(
  snapshots: readonly ProcessedPlanningSnapshot[],
  projectId: string,
  endpointIsCurrent: boolean,
): PlanningHistoricalLineage {
  const works = buildOccurrences(snapshots, (snapshot) => snapshot.workValues, "PPHW");
  const windows = buildOccurrences(snapshots, (snapshot) => snapshot.windowValues, "PPHN");
  const relations = buildOccurrences(snapshots, (snapshot) => snapshot.relationValues, "PPHR");
  const lastValidCommit = [...snapshots].reverse().find(({ model }) => model !== null)?.output.basis.commitId ?? null;
  for (const collection of [works.occurrences, windows.occurrences, relations.occurrences]) {
    for (const occurrence of collection) {
      if (occurrence.retiredAtCommitId === null && occurrence.endedBy === "historical_endpoint" &&
          endpointIsCurrent && occurrence.lastObservedCommitId === lastValidCommit) {
        occurrence.endedBy = "current_endpoint";
      }
    }
  }
  const transitionResult = transitions(snapshots);
  const gaps: PlanningHistoricalGap[] = snapshots
    .filter(({ output }) => output.validity !== "planning_valid")
    .map((snapshot) => Object.freeze({
      commitId: snapshot.output.basis.commitId,
      cause: gapCause(snapshot),
      axisStates: emptyAxisStates("unknown"),
    }));
  const ambiguous = new Set([...works.ambiguousIds, ...windows.ambiguousIds]);
  for (const id of ambiguous) {
    const occurrence = [...works.occurrences, ...windows.occurrences].find(({ sourceId }) => sourceId === id);
    if (occurrence !== undefined) gaps.push(Object.freeze({
      commitId: occurrence.firstObservedCommitId,
      cause: "missing_or_forced_loss",
      axisStates: emptyAxisStates("unknown"),
    }));
  }
  return deepFreeze({
    projectId,
    workOccurrences: workOccurrences(works.occurrences),
    windowOccurrences: windowOccurrences(windows.occurrences),
    relationOccurrences: relationOccurrences(relations.occurrences),
    transitions: transitionResult.transitions,
    windowCloses: transitionResult.closes,
    gaps,
    ambiguousIdentityIds: sorted(ambiguous),
  });
}

function derivedRecordCount(
  snapshots: readonly ProcessedPlanningSnapshot[],
  lineage: PlanningHistoricalLineage,
): number {
  return snapshots.length +
    snapshots.reduce((sum, snapshot) => sum +
      (snapshot.output.observation?.works.length ?? 0) + snapshot.relationValues.size, 0) +
    lineage.workOccurrences.length + lineage.windowOccurrences.length +
    lineage.relationOccurrences.length + lineage.transitions.length +
    lineage.windowCloses.length + lineage.gaps.length;
}

function failedResult(
  sourceDigest: string,
  documentId: string | null,
  request: PlanningObservationRequest | null,
  current: PlanningPoolHistoricalObservationResult["current"],
  evidence: HistoricalGitEvidenceOutcome,
  diagnostics: readonly PlanningPoolSourceDiagnostic[],
): PlanningPoolHistoricalObservationResult {
  return deepFreeze({
    schemaVersion: "Perttool.PlanningPoolResult.v1",
    historyCapability: "perttool.planning-history-core@1",
    operation: "observe_history",
    ok: false,
    documentId,
    sourceDigest,
    normalizedRequest: request,
    current,
    evidence: evidenceBasis(evidence, sourceDigest, "unavailable", false),
    axisStates: emptyAxisStates("unavailable"),
    snapshots: [],
    lineage: null,
    diagnostics,
  });
}

function prepareCurrentObservation(
  currentText: string,
  input: unknown,
  contexts: PlanningHistoricalExecutionContexts,
): PreparedCurrentObservation {
  const sourceDigest = sha256DigestUtf8(currentText);
  const source = parsePlanningPoolSource(currentText, PLANNING_POOL_SOURCE_CAPABILITY);
  const attempted = observePlanningPool(
    currentText,
    input,
    contexts.current,
    PLANNING_OBSERVATION_CORE_CAPABILITY,
  );
  const request = attempted.normalizedRequest;
  const absent = source.model !== null && request !== null && !selectionPresent(source.model, request);
  const current = Object.freeze({
    state: attempted.ok ? "observed" as const : absent ? "selection_absent" as const : "unavailable" as const,
    sourceDigest,
    observation: attempted.ok ? attempted : null,
    overridesHistoricalFacts: true as const,
  });
  return Object.freeze({
    sourceDigest,
    documentId: source.documentId,
    model: source.model,
    request,
    current,
    diagnostics: attempted.diagnostics,
    valid: source.ok && source.model !== null && request !== null && (attempted.ok || absent),
  });
}

function historicalEvidenceDiagnostic(
  evidence: HistoricalGitEvidenceOutcome,
  sourceDigest: string,
): PlanningPoolSourceDiagnostic | null {
  if (!evidence.ok) {
    return diagnostic("PTPOOL-114", `historical Git evidence is unavailable: ${evidence.kind}`);
  }
  if (!evidenceWithinLimits(evidence)) {
    return diagnostic("PTPOOL-115", "historical Git evidence exceeds the accepted hard limits", "error");
  }
  if (!evidenceBindingValid(evidence, sourceDigest)) {
    return diagnostic("PTPOOL-111", "historical Git evidence binding is stale or inconsistent", "error");
  }
  return evidence.status === "unavailable"
    ? diagnostic("PTPOOL-114", "historical Git evidence contains no usable snapshot")
    : null;
}

function historicalProjection(
  evidence: HistoricalGitEvidenceResult,
  current: PreparedCurrentObservation,
  contexts: PlanningHistoricalExecutionContexts,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PreparedHistoricalProjection | PlanningPoolSourceDiagnostic {
  const historicalContexts = executionMap(contexts, diagnostics);
  const processed = Object.freeze(evidence.snapshots.map((snapshot) =>
    processPlanningSnapshot(snapshot, current.request!, historicalContexts, diagnostics)
  ));
  if (!processed.some(({ model }) => model !== null)) {
    return diagnostic("PTPOOL-114", "historical evidence has no valid Grammar 9 planning snapshot");
  }
  const endpoint = processed.at(-1)!;
  const endpointIsCurrent = endpoint.output.basis.sourceDigest === current.sourceDigest &&
    endpoint.output.basis.commitId === evidence.resolvedEndpoint;
  const lineage = buildLineage(processed, current.model!.documentId, endpointIsCurrent);
  if (derivedRecordCount(processed, lineage) > PLANNING_HISTORY_CORE_LIMITS.derivedEntityRecords) {
    return diagnostic("PTPOOL-115", "historical derived observation records exceed 100000", "error");
  }
  const hasGap = lineage.gaps.length > 0 || processed.some(({ contextUnavailable }) => contextUnavailable);
  const state: PlanningHistoricalState = evidence.status === "complete" && !hasGap && endpointIsCurrent
    ? "complete"
    : "incomplete";
  if (state === "incomplete") {
    diagnostics.push(diagnostic(
      "PTPOOL-114",
      "historical planning observation is bounded or incomplete; affected axes remain unknown",
    ));
  }
  return Object.freeze({
    processed,
    lineage,
    state,
    axisStates: state === "complete" ? completeAxisStates() : emptyAxisStates("unknown"),
    continuityQualified: state === "complete" && lineage.ambiguousIdentityIds.length === 0,
  });
}

function isProjectionDiagnostic(
  value: PreparedHistoricalProjection | PlanningPoolSourceDiagnostic,
): value is PlanningPoolSourceDiagnostic {
  return "code" in value;
}

function successfulHistoricalResult(
  current: PreparedCurrentObservation,
  evidence: HistoricalGitEvidenceResult,
  projection: PreparedHistoricalProjection,
  diagnostics: readonly PlanningPoolSourceDiagnostic[],
): PlanningPoolHistoricalObservationResult {
  return deepFreeze({
    schemaVersion: "Perttool.PlanningPoolResult.v1",
    historyCapability: "perttool.planning-history-core@1",
    operation: "observe_history",
    ok: true,
    documentId: current.model!.documentId,
    sourceDigest: current.sourceDigest,
    normalizedRequest: current.request,
    current: current.current,
    evidence: evidenceBasis(evidence, current.sourceDigest, projection.state, projection.continuityQualified),
    axisStates: projection.axisStates,
    snapshots: projection.processed.map(({ output }) => output),
    lineage: projection.lineage,
    diagnostics,
  });
}

export function reconstructPlanningPoolHistory(
  currentText: string,
  input: unknown,
  contexts: PlanningHistoricalExecutionContexts,
  gitEvidence: HistoricalGitEvidenceOutcome,
  capability: PlanningHistoryCoreCapability,
): PlanningPoolHistoricalObservationResult {
  requireCapability(capability);
  const current = prepareCurrentObservation(currentText, input, contexts);
  const diagnostics: PlanningPoolSourceDiagnostic[] = [];
  if (!current.valid) {
    diagnostics.push(...current.diagnostics);
    return failedResult(current.sourceDigest, current.documentId, current.request, current.current, gitEvidence, diagnostics);
  }
  const evidenceFailure = historicalEvidenceDiagnostic(gitEvidence, current.sourceDigest);
  if (evidenceFailure !== null || !gitEvidence.ok) {
    if (evidenceFailure !== null) diagnostics.push(evidenceFailure);
    return failedResult(current.sourceDigest, current.documentId, current.request, current.current, gitEvidence, diagnostics);
  }
  const projection = historicalProjection(gitEvidence, current, contexts, diagnostics);
  if (isProjectionDiagnostic(projection)) {
    diagnostics.push(projection);
    return failedResult(current.sourceDigest, current.documentId, current.request, current.current, gitEvidence, diagnostics);
  }
  return successfulHistoricalResult(current, gitEvidence, projection, diagnostics);
}
