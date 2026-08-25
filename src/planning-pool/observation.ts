import { computeEffectiveReached } from "../analysis/graph.js";
import {
  projectActualsSourceModel,
  workEventsForTask,
} from "../actuals/source.js";
import {
  reduceTaskLifecycle,
  taskStatus,
  validateStoredLifecycleState,
} from "../actuals/lifecycle.js";
import {
  evaluateMilestoneAcceptance,
  type MilestoneAcceptanceModelResultV1,
} from "../milestone-acceptance/evaluate.js";
import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  milestoneAcceptanceBaseText,
  parseMilestoneAcceptanceSource,
} from "../milestone-acceptance/source.js";
import { parseDeclaredCalendarValue } from "../model/calendar.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { fieldLine, scanTemporalDeclarationBlocks, temporalScheduleBaseText } from "../temporal-schedule/source-lexical.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import { validateTargetGrammar6Document, type TargetGrammar5ValidatedDocument } from "../semantic/target-validator.js";
import { canonicalPlanningCalendar, comparePlanningCalendarValues } from "./source-values.js";
import {
  planningPoolBaseText,
  scanPlanningDeclarationBlocks,
} from "./source-lexical.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "./source.js";
import type {
  PlanningPoolSourceDiagnostic,
  PlanningPoolSourceModel,
  PlanningPoolSourceResult,
  PlanningWorkSource,
} from "./source-types.js";
import {
  inspectPlanningWindowSelection,
  PLANNING_WINDOW_CORE_CAPABILITY,
} from "./window.js";
import type { PlanningWindowSnapshot } from "./window-types.js";
import type {
  PlanningCloseDispositionInput,
  PlanningExecutionObservation,
  PlanningGlobalExecutionObservation,
  PlanningMembershipOccurrence,
  PlanningMilestoneObservation,
  PlanningObservationAggregates,
  PlanningObservationCoreCapability,
  PlanningObservationExecutionContext,
  PlanningObservationRequest,
  PlanningObservationSelectionInput,
  PlanningPoolObservationResult,
  PlanningTaskObservation,
  PlanningWindowObservation,
  PlanningWindowTemporalPosition,
  PlanningWorkObservation,
} from "./observation-types.js";

export const PLANNING_OBSERVATION_CORE_CAPABILITY:
  PlanningObservationCoreCapability = Object.freeze({
    id: "perttool.planning-observation-core",
    version: 1,
  });

export const PLANNING_OBSERVATION_CORE_LIMITS = Object.freeze({
  requestUtf8Bytes: 8_388_608,
  derivedEntityRecords: 100_000,
});

const requestSchema = "Perttool.PlanningObservationRequest.v1" as const;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const qualifiedPattern = /^[A-Za-z][A-Za-z0-9_-]*::[A-Za-z][A-Za-z0-9_-]*$/u;

function diagnostic(
  code: string,
  message: string,
  entityId?: string,
): PlanningPoolSourceDiagnostic {
  return Object.freeze({
    code,
    severity: code === "PTPOOL-114" ? "warning" as const : "error" as const,
    message,
    ...(entityId === undefined ? {} : { entityId }),
    data: Object.freeze({}),
  });
}

function requireCapability(capability: PlanningObservationCoreCapability): void {
  if (capability !== PLANNING_OBSERVATION_CORE_CAPABILITY) {
    throw new TypeError("the private planning observation Core capability is required");
  }
}

function closed(
  value: unknown,
  keys: ReadonlySet<string>,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    diagnostics.push(diagnostic("PTPOOL-107", `${label} must be an object`));
    return null;
  }
  const parsed = value as Record<string, unknown>;
  const unknown = Object.keys(parsed).filter((key) => !keys.has(key));
  const missing = [...keys].filter((key) => !(key in parsed));
  if (unknown.length > 0 || missing.length > 0) {
    diagnostics.push(diagnostic(
      "PTPOOL-107",
      `${label} has${missing.length === 0 ? "" : ` missing ${missing.join(", ")}`}${unknown.length === 0 ? "" : ` unknown ${unknown.join(", ")}`}`,
    ));
  }
  return parsed;
}

function qualifiedIds(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): readonly string[] | null {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic("PTPOOL-107", `${label} must be an array`));
    return null;
  }
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !qualifiedPattern.test(item)) {
      diagnostics.push(diagnostic("PTPOOL-102", `${label} must contain qualified identities`));
    } else {
      ids.push(item);
    }
  }
  if (new Set(ids).size !== ids.length) {
    diagnostics.push(diagnostic("PTPOOL-107", `${label} contains a duplicate`));
  }
  return Object.freeze(ids);
}

function optionalString(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    diagnostics.push(diagnostic("PTPOOL-107", `${label} must be null or a non-empty string`));
    return undefined;
  }
  return value;
}

function poolSelection(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningObservationSelectionInput | null {
  return closed(value, new Set(["kind"]), "Pool selection", diagnostics) === null
    ? null
    : Object.freeze({ kind: "pool" as const });
}

function workSelection(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningObservationSelectionInput | null {
  const parsed = closed(value, new Set(["kind", "work_ids"]), "Work selection", diagnostics);
  const ids = qualifiedIds(parsed?.["work_ids"], "Work selection", diagnostics);
  return parsed === null || ids === null
    ? null
    : Object.freeze({ kind: "work" as const, work_ids: ids });
}

function persistedSelection(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningObservationSelectionInput | null {
  const parsed = closed(value, new Set(["kind", "window_id"]), "persisted Window selection", diagnostics);
  const id = parsed?.["window_id"];
  if (typeof id !== "string" || !qualifiedPattern.test(id)) {
    diagnostics.push(diagnostic("PTPOOL-102", "Window selection requires a qualified identity"));
    return null;
  }
  return Object.freeze({ kind: "persisted" as const, window_id: id });
}

function adHocSelection(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningObservationSelectionInput | null {
  const parsed = closed(
    value,
    new Set(["kind", "title", "objective", "start", "end", "work_ids"]),
    "ad hoc Window selection",
    diagnostics,
  );
  if (parsed === null) return null;
  const title = optionalString(parsed["title"], "ad hoc title", diagnostics);
  const objective = optionalString(parsed["objective"], "ad hoc objective", diagnostics);
  const start = parsed["start"] === null ? null : canonicalPlanningCalendar(String(parsed["start"]));
  const end = parsed["end"] === null ? null : canonicalPlanningCalendar(String(parsed["end"]));
  const works = qualifiedIds(parsed["work_ids"], "ad hoc Work", diagnostics);
  if (parsed["start"] !== null && start === null) diagnostics.push(diagnostic("PTPOOL-107", "ad hoc start is invalid"));
  if (parsed["end"] !== null && end === null) diagnostics.push(diagnostic("PTPOOL-107", "ad hoc end is invalid"));
  if (title === undefined || objective === undefined || works === null || diagnostics.length > 0) return null;
  return Object.freeze({ kind: "ad_hoc" as const, title, objective, start, end, work_ids: works });
}

function normalizeSelection(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningObservationSelectionInput | null {
  const kind = value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)["kind"]
    : undefined;
  switch (kind) {
    case "pool": return poolSelection(value, diagnostics);
    case "work": return workSelection(value, diagnostics);
    case "persisted": return persistedSelection(value, diagnostics);
    case "ad_hoc": return adHocSelection(value, diagnostics);
    default:
      diagnostics.push(diagnostic("PTPOOL-107", "Observation selection kind must be pool, work, persisted, or ad_hoc"));
      return null;
  }
}

function normalizeDispositions(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): readonly PlanningCloseDispositionInput[] | null {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic("PTPOOL-107", "close_dispositions must be an array"));
    return null;
  }
  const result: PlanningCloseDispositionInput[] = [];
  for (const item of value) {
    const parsed = closed(item, new Set(["work_id", "disposition"]), "close disposition", diagnostics);
    const workId = parsed?.["work_id"];
    const disposition = parsed?.["disposition"];
    if (typeof workId !== "string" || !qualifiedPattern.test(workId)) {
      diagnostics.push(diagnostic("PTPOOL-102", "close disposition Work must be qualified"));
      continue;
    }
    if (disposition !== "carried_over" && disposition !== "retained_backlog" && disposition !== "archive_requested") {
      diagnostics.push(diagnostic("PTPOOL-107", "close disposition is unsupported", workId));
      continue;
    }
    result.push(Object.freeze({ work_id: workId, disposition }));
  }
  if (new Set(result.map(({ work_id }) => work_id)).size !== result.length) {
    diagnostics.push(diagnostic("PTPOOL-107", "close disposition Work is duplicated"));
  }
  return Object.freeze(result);
}

function normalizeRequest(
  input: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningObservationRequest | null {
  try {
    if (new TextEncoder().encode(JSON.stringify(input)).byteLength > PLANNING_OBSERVATION_CORE_LIMITS.requestUtf8Bytes) {
      diagnostics.push(diagnostic("PTPOOL-115", "Planning observation request exceeds 8388608 UTF-8 bytes"));
      return null;
    }
  } catch {
    diagnostics.push(diagnostic("PTPOOL-107", "Planning observation request is not JSON-compatible"));
    return null;
  }
  const parsed = closed(
    input,
    new Set(["request_schema_version", "source_digest", "selection", "observation_at", "close_dispositions"]),
    "Planning observation request",
    diagnostics,
  );
  if (parsed === null) return null;
  if (parsed["request_schema_version"] !== requestSchema) {
    diagnostics.push(diagnostic("PTPOOL-107", "Planning observation request schema identity is unsupported"));
  }
  const sourceDigest = parsed["source_digest"];
  if (typeof sourceDigest !== "string" || !digestPattern.test(sourceDigest)) {
    diagnostics.push(diagnostic("PTPOOL-111", "source_digest must be a lowercase SHA-256 identity"));
  }
  const selection = normalizeSelection(parsed["selection"], diagnostics);
  const rawObservation = parsed["observation_at"];
  const observationAt = rawObservation === null ? null : canonicalPlanningCalendar(String(rawObservation));
  if (rawObservation !== null && observationAt === null) {
    diagnostics.push(diagnostic("PTPOOL-107", "observation_at must be null or an ISO date or fixed-offset date-time"));
  }
  const dispositions = normalizeDispositions(parsed["close_dispositions"], diagnostics);
  if (typeof sourceDigest !== "string" || selection === null || dispositions === null || diagnostics.length > 0) return null;
  return Object.freeze({
    request_schema_version: requestSchema,
    source_digest: sourceDigest,
    selection,
    observation_at: observationAt,
    close_dispositions: dispositions,
  });
}

function localId(qualifiedId: string, documentId: string): string | null {
  const prefix = `${documentId}::`;
  return qualifiedId.startsWith(prefix) ? qualifiedId.slice(prefix.length) : null;
}

function validateExecutionContext(
  context: PlanningObservationExecutionContext,
  sourceDigest: string,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  if (context.source_digest !== sourceDigest) {
    diagnostics.push(diagnostic("PTPOOL-111", "global execution context does not match current source"));
  }
  if (!(["complete", "incomplete", "unavailable"] as const).includes(context.evidence_state)) {
    diagnostics.push(diagnostic("PTPOOL-107", "global execution evidence state is unsupported"));
  }
  for (const ids of [context.recommended_task_ids, context.startable_task_ids]) {
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !qualifiedPattern.test(id) || localId(id, model.documentId) === null)
    ) {
      diagnostics.push(diagnostic("PTPOOL-107", "global execution context requires unique qualified Task identities"));
    }
  }
  if (context.startable_task_ids.some((id) => !context.recommended_task_ids.includes(id))) {
    diagnostics.push(diagnostic("PTPOOL-107", "startable Task facts must remain a subset of recommendations"));
  }
}

interface CurrentStrictFacts {
  readonly validated: TargetGrammar5ValidatedDocument;
  readonly acceptance: MilestoneAcceptanceModelResultV1;
}

function currentStrictFacts(text: string): CurrentStrictFacts | null {
  const grammar8 = planningPoolBaseText(text, scanPlanningDeclarationBlocks(text));
  const grammar7 = temporalScheduleBaseText(grammar8, scanTemporalDeclarationBlocks(grammar8));
  const acceptanceSource = parseMilestoneAcceptanceSource(grammar7, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  const grammar6 = milestoneAcceptanceBaseText(grammar7);
  const checked = validateTargetGrammar6Document(grammar6, TARGET_GRAMMAR_6_CAPABILITY);
  if (!acceptanceSource.ok || !checked.ok || checked.validatedDocument === null) return null;
  const validated = checked.validatedDocument as unknown as TargetGrammar5ValidatedDocument;
  if (validateStoredLifecycleState(validated).length > 0) return null;
  const milestoneIds = validated.document.declarations
    .filter(({ kind }) => kind === "milestone")
    .map(({ id }) => id);
  const acceptance = evaluateMilestoneAcceptance({
    source: acceptanceSource,
    milestoneIds,
    closureReachedMilestoneIds: computeEffectiveReached(validated.document as never),
  });
  return acceptance.ok ? Object.freeze({ validated, acceptance }) : null;
}

function validateExecutionTaskIdentities(
  context: PlanningObservationExecutionContext,
  strict: CurrentStrictFacts,
  documentId: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  const known = new Set(strict.validated.document.declarations
    .filter(({ kind }) => kind === "task")
    .map(({ id }) => `${documentId}::${id}`));
  const unknown = [...context.recommended_task_ids, ...context.startable_task_ids]
    .find((id) => !known.has(id));
  if (unknown !== undefined) diagnostics.push(diagnostic("PTPOOL-107", "global execution context names an unknown Task", unknown));
}

function allWorkIds(model: PlanningPoolSourceModel): readonly string[] {
  return Object.freeze(model.workOrder.map(({ qualifiedId }) => qualifiedId));
}

interface SelectedObservation {
  readonly workIds: readonly string[];
  readonly window: PlanningWindowSnapshot | null;
  readonly temporalOverlaps: PlanningWindowObservation["temporalOverlaps"];
}

function selectedObservation(
  text: string,
  request: PlanningObservationRequest,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): SelectedObservation | null {
  if (request.selection.kind === "pool") {
    return Object.freeze({ workIds: allWorkIds(model), window: null, temporalOverlaps: Object.freeze([]) });
  }
  if (request.selection.kind === "work") {
    const known = new Set(model.works.map(({ qualifiedId }) => qualifiedId));
    const foreign = request.selection.work_ids.find((id) => localId(id, model.documentId) === null || !known.has(id));
    if (foreign !== undefined) {
      diagnostics.push(diagnostic("PTPOOL-107", `Work ${foreign} does not exist`, foreign));
      return null;
    }
    const selected = new Set(request.selection.work_ids);
    return Object.freeze({
      workIds: Object.freeze(allWorkIds(model).filter((id) => selected.has(id))),
      window: null,
      temporalOverlaps: Object.freeze([]),
    });
  }
  const inspected = inspectPlanningWindowSelection(text, request.selection, PLANNING_WINDOW_CORE_CAPABILITY);
  if (!inspected.ok || inspected.selection === null) {
    diagnostics.push(...inspected.diagnostics);
    return null;
  }
  return Object.freeze({
    workIds: inspected.orderedWorkIds,
    window: inspected.selection,
    temporalOverlaps: inspected.temporalOverlaps,
  });
}

function projectAsOf(text: string): string | null {
  const project = scanTemporalDeclarationBlocks(text).find(({ kind }) => kind === "project");
  const raw = project?.lines.map(fieldLine).find((field) => field?.name === "as_of")?.rawValue;
  return raw === undefined ? null : canonicalPlanningCalendar(raw);
}

interface TemporalObservationBasis {
  readonly value: string | null;
  readonly source: "request" | "project_as_of" | null;
}

function temporalObservationBasis(
  requestValue: string | null,
  fallbackValue: string | null,
): TemporalObservationBasis {
  return requestValue !== null
    ? Object.freeze({ value: requestValue, source: "request" as const })
    : fallbackValue !== null
      ? Object.freeze({ value: fallbackValue, source: "project_as_of" as const })
      : Object.freeze({ value: null, source: null });
}

function unavailableTemporalPosition(
  basis: TemporalObservationBasis,
  cause: PlanningWindowTemporalPosition["cause"],
): PlanningWindowTemporalPosition {
  return Object.freeze({
    state: "unavailable",
    observationValue: basis.value,
    source: basis.source,
    cause,
  });
}

function boundedTemporalPosition(
  window: PlanningWindowSnapshot,
  basis: TemporalObservationBasis,
): PlanningWindowTemporalPosition {
  if (basis.value === null) return unavailableTemporalPosition(basis, "missing_observation_value");
  const value = parsePlanningCalendar(basis.value);
  const representativeBound = parsePlanningCalendar(window.start ?? window.end!);
  if (
    value === null || representativeBound === null ||
    comparePlanningCalendarValues(value, representativeBound) === null
  ) {
    return unavailableTemporalPosition(basis, "incomparable_temporal_kinds");
  }
  const start = window.start === null ? null : parsePlanningCalendar(window.start);
  const end = window.end === null ? null : parsePlanningCalendar(window.end);
  const state = start !== null && comparePlanningCalendarValues(value, start)! < 0
    ? "before" as const
    : end !== null && comparePlanningCalendarValues(value, end)! >= 0
      ? "after" as const
      : "inside" as const;
  return Object.freeze({
    state,
    observationValue: basis.value,
    source: basis.source,
    cause: null,
  });
}

function temporalPosition(
  window: PlanningWindowSnapshot,
  requestValue: string | null,
  fallbackValue: string | null,
): PlanningWindowTemporalPosition {
  const basis = temporalObservationBasis(requestValue, fallbackValue);
  if (window.start === null && window.end === null) {
    return Object.freeze({
      state: "unbounded",
      observationValue: basis.value,
      source: basis.source,
      cause: null,
    });
  }
  return boundedTemporalPosition(window, basis);
}

function parsePlanningCalendar(value: string) {
  return parseDeclaredCalendarValue(value) ?? null;
}

function workArchiveable(work: PlanningWorkSource, model: PlanningPoolSourceModel): boolean {
  const incoming = model.works.some((candidate) => candidate.qualifiedId !== work.qualifiedId &&
    candidate.dependsOn.some(({ qualifiedId }) => qualifiedId === work.qualifiedId));
  const membership = model.windows.some((window) => window.works.some(({ qualifiedId }) => qualifiedId === work.qualifiedId));
  const meaning = (work.description?.value ?? "").length > 0 || work.events.length > 0 || work.activities.length > 0 ||
    work.milestoneLinks.length > 0 || work.taskLinks.length > 0;
  return !meaning && work.dependsOn.length === 0 && !incoming && !membership;
}

function taskFacts(
  work: PlanningWorkSource,
  model: PlanningPoolSourceModel,
  strict: CurrentStrictFacts,
): readonly PlanningTaskObservation[] {
  const actuals = projectActualsSourceModel(strict.validated);
  const consumers = new Map<string, number>();
  for (const candidate of model.works) {
    for (const link of candidate.taskLinks) consumers.set(link.qualifiedId, (consumers.get(link.qualifiedId) ?? 0) + 1);
  }
  return Object.freeze(work.taskLinks.map((link) => {
    const local = localId(link.qualifiedId, model.documentId)!;
    const declaration = strict.validated.document.declarations.find(({ kind, id }) => kind === "task" && id === local)!;
    const events = workEventsForTask(actuals, local);
    const lifecycle = reduceTaskLifecycle(events);
    const status = taskStatus(declaration);
    return Object.freeze({
      taskId: link.qualifiedId,
      status,
      actualsCoverage: lifecycle.coverage,
      workEventIds: Object.freeze(events.map(({ id }) => `${model.documentId}::${id}`)),
      complete: status === "done",
      attribution: (consumers.get(link.qualifiedId) ?? 0) > 1 ? "non_exclusive" as const : "exclusive" as const,
    });
  }));
}

function executionFacts(work: PlanningWorkSource, tasks: readonly PlanningTaskObservation[]): PlanningExecutionObservation {
  const obligations = Object.freeze([...work.activities.map(({ qualifiedId }) => qualifiedId), ...work.taskLinks.map(({ qualifiedId }) => qualifiedId)]);
  const unprojected = Object.freeze(work.activities.map(({ qualifiedId }) => qualifiedId));
  const state = obligations.length === 0
    ? "uncovered" as const
    : unprojected.length === 0 && tasks.every(({ complete }) => complete)
      ? "complete" as const
      : "partial" as const;
  return Object.freeze({ state, activityObligationIds: obligations, unprojectedActivityIds: unprojected, tasks });
}

function milestoneFacts(
  work: PlanningWorkSource,
  model: PlanningPoolSourceModel,
  strict: CurrentStrictFacts,
): readonly PlanningMilestoneObservation[] {
  const consumers = new Map<string, number>();
  for (const candidate of model.works) {
    for (const link of candidate.milestoneLinks) consumers.set(link.qualifiedId, (consumers.get(link.qualifiedId) ?? 0) + 1);
  }
  return Object.freeze(work.milestoneLinks.map((link) => {
    const local = localId(link.qualifiedId, model.documentId)!;
    const evaluation = strict.acceptance.milestones.find(({ milestoneId }) => milestoneId === local)!;
    return Object.freeze({
      milestoneId: link.qualifiedId,
      closure: evaluation.closure,
      acceptance: evaluation.acceptance,
      criteria: evaluation.criteria,
      evidenceComplete: evaluation.acceptance !== "unavailable",
      attribution: (consumers.get(link.qualifiedId) ?? 0) > 1 ? "non_exclusive" as const : "exclusive" as const,
    });
  }));
}

function cycleIds(work: PlanningWorkSource, model: PlanningPoolSourceModel): readonly string[] {
  const cycle = model.dependencyCycles.find((ids) => ids.includes(work.id));
  return Object.freeze((cycle ?? []).map((id) => `${model.documentId}::${id}`));
}

function workFacts(
  work: PlanningWorkSource,
  selected: ReadonlySet<string>,
  model: PlanningPoolSourceModel,
  strict: CurrentStrictFacts,
  dispositions: ReadonlyMap<string, PlanningCloseDispositionInput["disposition"]>,
): PlanningWorkObservation {
  const tasks = taskFacts(work, model, strict);
  const milestones = milestoneFacts(work, model, strict);
  const dependentIds = model.works.filter((candidate) => candidate.dependsOn.some(({ qualifiedId }) => qualifiedId === work.qualifiedId))
    .map(({ qualifiedId }) => qualifiedId);
  const windowIds = model.windows.filter((window) => window.works.some(({ qualifiedId }) => qualifiedId === work.qualifiedId))
    .map(({ qualifiedId }) => qualifiedId);
  const traceUseful = work.taskLinks.length > 0 || work.milestoneLinks.length > 0 || work.dependsOn.length > 0 || dependentIds.length > 0 || windowIds.length > 0;
  return Object.freeze({
    workId: work.qualifiedId,
    title: work.title,
    refinement: Object.freeze({
      residualDescriptionPresent: (work.description?.value ?? "").length > 0,
      eventIds: Object.freeze(work.events.map(({ qualifiedId }) => qualifiedId)),
      activityIds: Object.freeze(work.activities.map(({ qualifiedId }) => qualifiedId)),
      milestoneLinkIds: Object.freeze(work.milestoneLinks.map(({ qualifiedId }) => qualifiedId)),
      taskLinkIds: Object.freeze(work.taskLinks.map(({ qualifiedId }) => qualifiedId)),
      uncoveredDependencyIds: Object.freeze(work.dependsOn.map(({ qualifiedId }) => qualifiedId).filter((id) => !selected.has(id))),
    }),
    execution: executionFacts(work, tasks),
    outcome: Object.freeze({ state: "complete" as const, milestones }),
    organization: Object.freeze({
      globalRank: model.workOrder.findIndex(({ qualifiedId }) => qualifiedId === work.qualifiedId),
      dependencyIds: Object.freeze(work.dependsOn.map(({ qualifiedId }) => qualifiedId)),
      dependentIds: Object.freeze(dependentIds),
      dependencyCycleIds: cycleIds(work, model),
      windowIds: Object.freeze(windowIds),
      traceUseful,
      archiveable: workArchiveable(work, model),
    }),
    closeDisposition: dispositions.get(work.qualifiedId) ?? "not_applicable",
  });
}

function membershipOccurrences(
  model: PlanningPoolSourceModel,
  selected: ReadonlySet<string>,
): readonly PlanningMembershipOccurrence[] {
  return Object.freeze(model.windows.flatMap((window) => window.works.map((work) => Object.freeze({
    windowId: window.qualifiedId,
    workId: work.qualifiedId,
    selected: selected.has(work.qualifiedId),
  }))));
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function aggregates(
  works: readonly PlanningWorkObservation[],
  occurrences: readonly PlanningMembershipOccurrence[],
): PlanningObservationAggregates {
  const tasks = works.flatMap(({ execution }) => execution.tasks);
  const milestones = works.flatMap(({ outcome }) => outcome.milestones);
  return Object.freeze({
    uniqueWorkIds: unique(works.map(({ workId }) => workId)),
    uniqueTaskIds: unique(tasks.map(({ taskId }) => taskId)),
    uniqueMilestoneIds: unique(milestones.map(({ milestoneId }) => milestoneId)),
    uniqueWorkEventIds: unique(tasks.flatMap(({ workEventIds }) => workEventIds)),
    completedTaskIds: unique(tasks.filter(({ complete }) => complete).map(({ taskId }) => taskId)),
    acceptedMilestoneIds: unique(milestones.filter(({ acceptance }) => acceptance === "accepted").map(({ milestoneId }) => milestoneId)),
    membershipOccurrenceCount: occurrences.filter(({ selected }) => selected).length,
  });
}

function derivedRecordCount(
  works: readonly PlanningWorkObservation[],
  occurrences: readonly PlanningMembershipOccurrence[],
): number {
  return works.length + occurrences.length + works.reduce((sum, work) =>
    sum + work.execution.tasks.length + work.outcome.milestones.length +
    work.execution.tasks.reduce((events, task) => events + task.workEventIds.length, 0), 0);
}

function selectedExecution(works: readonly PlanningWorkObservation[]): PlanningWindowObservation["selectedExecution"] {
  const states = works.map(({ execution }) => execution.state);
  if (states.length === 0 || states.every((state) => state === "uncovered")) return "uncovered";
  if (states.some((state) => state === "unavailable")) return "unavailable";
  if (states.some((state) => state === "unknown")) return "unknown";
  return states.every((state) => state === "complete") ? "complete" : "partial";
}

function emptyAggregates(): PlanningObservationAggregates {
  return Object.freeze({
    uniqueWorkIds: Object.freeze([]), uniqueTaskIds: Object.freeze([]), uniqueMilestoneIds: Object.freeze([]),
    uniqueWorkEventIds: Object.freeze([]), completedTaskIds: Object.freeze([]), acceptedMilestoneIds: Object.freeze([]),
    membershipOccurrenceCount: 0,
  });
}

function globalExecution(context: PlanningObservationExecutionContext): PlanningGlobalExecutionObservation {
  return Object.freeze({
    evidenceState: context.evidence_state,
    recommendedTaskIds: Object.freeze([...context.recommended_task_ids]),
    startableTaskIds: Object.freeze([...context.startable_task_ids]),
  });
}

function failed(
  documentId: string | null,
  sourceDigest: string,
  request: PlanningObservationRequest | null,
  context: PlanningObservationExecutionContext,
  diagnostics: readonly PlanningPoolSourceDiagnostic[],
): PlanningPoolObservationResult {
  return Object.freeze({
    schemaVersion: "Perttool.PlanningPoolResult.v1",
    observationCapability: "perttool.planning-observation-core@1",
    operation: "observe",
    ok: false,
    documentId,
    sourceDigest,
    normalizedRequest: request,
    evidence: Object.freeze({ mode: "current", state: "unavailable", sourceDigest, historyRequested: false }),
    selectedWorkOrder: Object.freeze([]),
    works: Object.freeze([]),
    window: null,
    membershipOccurrences: Object.freeze([]),
    aggregates: emptyAggregates(),
    globalExecution: globalExecution(context),
    diagnostics: Object.freeze(diagnostics),
  });
}

interface PreparedObservation {
  readonly source: PlanningPoolSourceResult;
  readonly request: PlanningObservationRequest | null;
  readonly strict: CurrentStrictFacts | null;
  readonly selected: SelectedObservation | null;
}

function hasErrors(diagnostics: readonly PlanningPoolSourceDiagnostic[]): boolean {
  return diagnostics.some(({ severity }) => severity === "error");
}

function prepareObservation(
  text: string,
  input: unknown,
  context: PlanningObservationExecutionContext,
  sourceDigest: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PreparedObservation {
  const source = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY);
  const request = normalizeRequest(input, diagnostics);
  if (!source.ok || source.model === null) {
    diagnostics.push(...source.diagnostics, diagnostic("PTPOOL-116", "Planning observation requires a valid Grammar 9 source"));
  }
  if (request !== null && request.source_digest !== sourceDigest) {
    diagnostics.push(diagnostic("PTPOOL-111", "Planning observation source digest does not match current source"));
  }
  if (source.model !== null) validateExecutionContext(context, sourceDigest, source.model, diagnostics);
  const strict = source.model === null ? null : currentStrictFacts(text);
  if (strict === null) diagnostics.push(diagnostic("PTPOOL-114", "current strict execution or outcome evidence is unavailable"));
  if (source.model !== null && strict !== null) {
    validateExecutionTaskIdentities(context, strict, source.model.documentId, diagnostics);
  }
  const selected = request !== null && source.model !== null && strict !== null && !hasErrors(diagnostics)
    ? selectedObservation(text, request, source.model, diagnostics)
    : null;
  return Object.freeze({ source, request, strict, selected });
}

function invalidDisposition(
  request: PlanningObservationRequest,
  selected: ReadonlySet<string>,
): PlanningCloseDispositionInput | undefined {
  return request.close_dispositions.find(({ work_id }) => !selected.has(work_id));
}

export function observePlanningPool(
  text: string,
  input: unknown,
  context: PlanningObservationExecutionContext,
  capability: PlanningObservationCoreCapability,
): PlanningPoolObservationResult {
  requireCapability(capability);
  const sourceDigest = sha256DigestUtf8(text);
  const diagnostics: PlanningPoolSourceDiagnostic[] = [];
  const prepared = prepareObservation(text, input, context, sourceDigest, diagnostics);
  const { source, request, strict, selected } = prepared;
  if (request === null || source.model === null || strict === null || selected === null || hasErrors(diagnostics)) {
    return failed(source.documentId, sourceDigest, request, context, diagnostics);
  }
  const selectedSet = new Set(selected.workIds);
  const dispositions = new Map(request.close_dispositions.map(({ work_id, disposition }) => [work_id, disposition]));
  const invalid = invalidDisposition(request, selectedSet);
  if (invalid !== undefined) {
    diagnostics.push(diagnostic("PTPOOL-107", "close disposition must name selected Work", invalid.work_id));
    return failed(source.documentId, sourceDigest, request, context, diagnostics);
  }
  const works = Object.freeze(selected.workIds.map((id) => {
    const work = source.model!.works.find(({ qualifiedId }) => qualifiedId === id)!;
    return workFacts(work, selectedSet, source.model!, strict, dispositions);
  }));
  const occurrences = membershipOccurrences(source.model, selectedSet);
  if (derivedRecordCount(works, occurrences) > PLANNING_OBSERVATION_CORE_LIMITS.derivedEntityRecords) {
    diagnostics.push(diagnostic("PTPOOL-115", "Planning observation derived entity records exceed 100000"));
    return failed(source.documentId, sourceDigest, request, context, diagnostics);
  }
  const window = selected.window === null ? null : Object.freeze({
    window: selected.window,
    objective: selected.window.objective,
    temporalPosition: temporalPosition(selected.window, request.observation_at, projectAsOf(text)),
    temporalOverlaps: selected.temporalOverlaps,
    selectedExecution: selectedExecution(works),
  });
  return Object.freeze({
    schemaVersion: "Perttool.PlanningPoolResult.v1",
    observationCapability: "perttool.planning-observation-core@1",
    operation: "observe",
    ok: true,
    documentId: source.model.documentId,
    sourceDigest,
    normalizedRequest: request,
    evidence: Object.freeze({ mode: "current", state: context.evidence_state, sourceDigest, historyRequested: false }),
    selectedWorkOrder: selected.workIds,
    works,
    window,
    membershipOccurrences: occurrences,
    aggregates: aggregates(works, occurrences),
    globalExecution: globalExecution(context),
    diagnostics: Object.freeze(diagnostics),
  });
}
