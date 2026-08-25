import { parseDeclaredCalendarValue, type DeclaredCalendarValue } from "../model/calendar.js";
import type { TextEdit } from "../mutation/text-edits.js";
import { scanTemporalDeclarationBlocks } from "../temporal-schedule/source-lexical.js";
import { planPlanningPoolSourceMutation } from "./format.js";
import { planningReshapeSha256 } from "./reshape-normalize.js";
import {
  scanPlanningDeclarationBlocks,
  type PlanningDeclarationBlock,
} from "./source-lexical.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
  PLANNING_POOL_SOURCE_LIMITS,
} from "./source.js";
import type {
  PlanningPoolSourceDiagnostic,
  PlanningPoolSourceModel,
  PlanningWindowSource,
} from "./source-types.js";
import {
  canonicalPlanningCalendar,
  comparePlanningCalendarValues,
} from "./source-values.js";
import type {
  PlanningAdHocWindowSelectionInput,
  PlanningCarryOverTarget,
  PlanningNewCarryOverTarget,
  PlanningWindowAuthorityImpact,
  PlanningWindowCloseReport,
  PlanningWindowCoreCapability,
  PlanningWindowDependencyCoverage,
  PlanningWindowDestructiveRecord,
  PlanningWindowFinalFields,
  PlanningWindowMembershipOverlap,
  PlanningWindowMutationAuditResult,
  PlanningWindowMutationRequest,
  PlanningWindowSelectionInput,
  PlanningWindowSelectionResult,
  PlanningWindowSnapshot,
  PlanningWindowTemporalOverlap,
} from "./window-types.js";

export type {
  PlanningAdHocWindowSelectionInput,
  PlanningCarryOverTarget,
  PlanningExistingCarryOverTarget,
  PlanningNewCarryOverTarget,
  PlanningPersistedWindowSelectionInput,
  PlanningWindowAuthorityImpact,
  PlanningWindowCarryOverRecord,
  PlanningWindowCloseReport,
  PlanningWindowCoreCapability,
  PlanningWindowDependencyCoverage,
  PlanningWindowDestructiveRecord,
  PlanningWindowFinalFields,
  PlanningWindowMembershipOverlap,
  PlanningWindowMutationAuditResult,
  PlanningWindowMutationRequest,
  PlanningWindowSelectionInput,
  PlanningWindowSelectionResult,
  PlanningWindowSnapshot,
  PlanningWindowTemporalOverlap,
} from "./window-types.js";

export const PLANNING_WINDOW_CORE_CAPABILITY: PlanningWindowCoreCapability =
  Object.freeze({ id: "perttool.planning-window-core", version: 1 });

const WINDOW_REQUEST_SCHEMA = "Perttool.WindowMutationRequest.v1" as const;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const qualifiedPattern = /^([A-Za-z][A-Za-z0-9_-]*)::([A-Za-z][A-Za-z0-9_-]*)$/u;
const requestKeys = new Set([
  "request_schema_version", "source_digest", "operation", "window_id",
  "final", "objective_disposition", "carry_over_work_ids", "carry_over_target",
]);

function requireCapability(capability: PlanningWindowCoreCapability): void {
  if (capability !== PLANNING_WINDOW_CORE_CAPABILITY) {
    throw new TypeError("the private planning Window Core capability is required");
  }
}

function diagnostic(
  code: string,
  message: string,
  entityId?: string,
): PlanningPoolSourceDiagnostic {
  return Object.freeze({
    code,
    severity: "error" as const,
    message,
    ...(entityId === undefined ? {} : { entityId }),
    data: Object.freeze({}),
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function closed(
  value: unknown,
  keys: ReadonlySet<string>,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): Record<string, unknown> | null {
  const parsed = record(value);
  if (parsed === null) {
    diagnostics.push(diagnostic("PTPOOL-107", `${label} must be an object`));
    return null;
  }
  const actual = Object.keys(parsed);
  const missing = [...keys].filter((key) => !(key in parsed));
  const unknown = actual.filter((key) => !keys.has(key));
  if (missing.length > 0 || unknown.length > 0) {
    diagnostics.push(diagnostic(
      "PTPOOL-107",
      `${label} has ${missing.length > 0 ? `missing ${missing.join(", ")}` : ""}${missing.length > 0 && unknown.length > 0 ? " and " : ""}${unknown.length > 0 ? `unknown ${unknown.join(", ")}` : ""}`,
    ));
  }
  return parsed;
}

function nonEmptyString(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | null {
  if (typeof value !== "string" || value.length === 0) {
    diagnostics.push(diagnostic("PTPOOL-107", `${label} must be a non-empty string`));
    return null;
  }
  return value;
}

function qualifiedId(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | null {
  const parsed = nonEmptyString(value, label, diagnostics);
  if (parsed !== null && !qualifiedPattern.test(parsed)) {
    diagnostics.push(diagnostic("PTPOOL-102", `${label} must be a qualified identity`));
    return null;
  }
  return parsed;
}

function stringSet(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): readonly string[] | null {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic("PTPOOL-107", `${label} must be an array`));
    return null;
  }
  const result = value.map((item) => qualifiedId(item, label, diagnostics))
    .filter((item): item is string => item !== null);
  if (new Set(result).size !== result.length) {
    diagnostics.push(diagnostic("PTPOOL-107", `${label} contains a duplicate`));
  }
  return Object.freeze([...result].sort());
}

function calendar(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") {
    diagnostics.push(diagnostic("PTPOOL-107", `${label} must be null or an ISO date or fixed-offset date-time`));
    return undefined;
  }
  const canonical = canonicalPlanningCalendar(value);
  if (canonical === null) {
    diagnostics.push(diagnostic("PTPOOL-107", `${label} is not an ISO date or fixed-offset date-time`));
    return undefined;
  }
  return canonical;
}

function validateBounds(
  start: string | null,
  end: string | null,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  if (start === null || end === null) return;
  const left = parseDeclaredCalendarValue(start)!;
  const right = parseDeclaredCalendarValue(end)!;
  const comparison = comparePlanningCalendarValues(left, right);
  if (comparison === null || comparison >= 0) {
    diagnostics.push(diagnostic("PTPOOL-107", "Window bounds must have one kind and satisfy start < end"));
  }
}

function finalFields(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningWindowFinalFields | null {
  const parsed = closed(value, new Set(["title", "objective", "start", "end", "work_ids"]), "Window final fields", diagnostics);
  if (parsed === null) return null;
  const title = nonEmptyString(parsed["title"], "Window title", diagnostics);
  const objective = nonEmptyString(parsed["objective"], "Window objective", diagnostics);
  const start = calendar(parsed["start"], "Window start", diagnostics);
  const end = calendar(parsed["end"], "Window end", diagnostics);
  const works = stringSet(parsed["work_ids"], "Window Work", diagnostics);
  if (works !== null && works.length === 0) diagnostics.push(diagnostic("PTPOOL-107", "A persisted Window requires at least one Work"));
  if (start !== undefined && end !== undefined) validateBounds(start, end, diagnostics);
  return title === null || objective === null || start === undefined || end === undefined || works === null
    ? null
    : Object.freeze({ title, objective, start, end, work_ids: works });
}

function existingCarryTarget(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningCarryOverTarget | null {
  const parsed = closed(value, new Set(["kind", "window_id"]), "existing carry-over target", diagnostics);
  const id = qualifiedId(parsed?.["window_id"], "carry-over Window", diagnostics);
  return parsed === null || id === null ? null : Object.freeze({ kind: "existing", window_id: id });
}

function newCarryTarget(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningCarryOverTarget | null {
  const parsed = closed(value, new Set(["kind", "window_id", "title", "objective", "start", "end"]), "new carry-over target", diagnostics);
  if (parsed === null) return null;
  const id = qualifiedId(parsed["window_id"], "new carry-over Window", diagnostics);
  const title = nonEmptyString(parsed["title"], "new Window title", diagnostics);
  const objective = nonEmptyString(parsed["objective"], "new Window objective", diagnostics);
  const start = calendar(parsed["start"], "new Window start", diagnostics);
  const end = calendar(parsed["end"], "new Window end", diagnostics);
  if (start !== undefined && end !== undefined) validateBounds(start, end, diagnostics);
  return id === null || title === null || objective === null || start === undefined || end === undefined
    ? null
    : Object.freeze({ kind: "new", window_id: id, title, objective, start, end });
}

function carryTarget(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningCarryOverTarget | null {
  if (value === null) return null;
  const kind = record(value)?.["kind"];
  if (kind === "existing") return existingCarryTarget(value, diagnostics);
  if (kind === "new") return newCarryTarget(value, diagnostics);
  diagnostics.push(diagnostic("PTPOOL-107", "carry_over_target must be null, existing, or new"));
  return null;
}

function requestSizeIsValid(
  input: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): boolean {
  try {
    if (new TextEncoder().encode(JSON.stringify(input)).byteLength <= PLANNING_POOL_SOURCE_LIMITS.sourceOrCandidateUtf8Bytes) return true;
    diagnostics.push(diagnostic("PTPOOL-115", "Window mutation request exceeds 8388608 UTF-8 bytes"));
  } catch {
    diagnostics.push(diagnostic("PTPOOL-107", "Window mutation request is not JSON-compatible"));
  }
  return false;
}

function operationValue(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningWindowMutationRequest["operation"] | null {
  if (value === "add" || value === "set" || value === "close") return value;
  diagnostics.push(diagnostic("PTPOOL-107", "Window operation must be add, set, or close"));
  return null;
}

function objectiveDisposition(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): "discard" | null | undefined {
  if (value === null || value === "discard") return value;
  diagnostics.push(diagnostic("PTPOOL-107", "objective_disposition must be null or discard"));
  return undefined;
}

function validateOperationFields(
  operation: PlanningWindowMutationRequest["operation"],
  final: PlanningWindowFinalFields | null,
  disposition: "discard" | null,
  carry: readonly string[],
  target: PlanningCarryOverTarget | null,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  if (operation === "close") {
    if (final !== null || disposition !== "discard") diagnostics.push(diagnostic("PTPOOL-107", "Window close requires null final fields and objective_disposition discard"));
    if ((carry.length === 0) !== (target === null)) diagnostics.push(diagnostic("PTPOOL-107", "Window close requires a target exactly when carry-over is non-empty"));
    return;
  }
  if (final === null || disposition !== null || carry.length > 0 || target !== null) {
    diagnostics.push(diagnostic("PTPOOL-107", "Window add and set require complete final fields and no close fields"));
  }
}

function normalizeRequest(
  input: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningWindowMutationRequest | null {
  if (!requestSizeIsValid(input, diagnostics)) return null;
  const parsed = closed(input, requestKeys, "Window mutation request", diagnostics);
  if (parsed === null) return null;
  if (parsed["request_schema_version"] !== WINDOW_REQUEST_SCHEMA) {
    diagnostics.push(diagnostic("PTPOOL-107", "Window mutation request schema identity is unsupported"));
  }
  const sourceDigest = nonEmptyString(parsed["source_digest"], "source_digest", diagnostics);
  if (sourceDigest !== null && !digestPattern.test(sourceDigest)) diagnostics.push(diagnostic("PTPOOL-111", "source_digest must be a lowercase SHA-256 identity"));
  const operation = operationValue(parsed["operation"], diagnostics);
  const windowId = qualifiedId(parsed["window_id"], "Window id", diagnostics);
  const final = parsed["final"] === null ? null : finalFields(parsed["final"], diagnostics);
  const disposition = objectiveDisposition(parsed["objective_disposition"], diagnostics);
  const carry = stringSet(parsed["carry_over_work_ids"], "carry-over Work", diagnostics);
  const target = carryTarget(parsed["carry_over_target"], diagnostics);
  if (sourceDigest === null || operation === null || windowId === null || disposition === undefined || carry === null) return null;
  validateOperationFields(operation, final, disposition, carry, target, diagnostics);
  return Object.freeze({
    request_schema_version: WINDOW_REQUEST_SCHEMA,
    source_digest: sourceDigest,
    operation,
    window_id: windowId,
    final,
    objective_disposition: disposition,
    carry_over_work_ids: carry,
    carry_over_target: target,
  });
}

function localId(
  qualified: string,
  documentId: string,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | null {
  const match = qualifiedPattern.exec(qualified);
  if (match === null || match[1] !== documentId) {
    diagnostics.push(diagnostic("PTPOOL-102", `${label} must use namespace ${documentId}`, qualified));
    return null;
  }
  return match[2]!;
}

function knownWorkIds(model: PlanningPoolSourceModel): ReadonlySet<string> {
  return new Set(model.works.map(({ qualifiedId }) => qualifiedId));
}

function validateWorks(
  ids: readonly string[],
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  const known = knownWorkIds(model);
  for (const id of ids) {
    localId(id, model.documentId, "Window Work", diagnostics);
    if (!known.has(id)) diagnostics.push(diagnostic("PTPOOL-107", `Window references unknown Work ${id}`, id));
  }
}

function lineEnding(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function renderWindow(
  id: string,
  fields: PlanningWindowFinalFields,
  ending: string,
): string {
  const lines = [
    `window ${id}:`,
    `  title ${JSON.stringify(fields.title)}`,
    `  objective ${JSON.stringify(fields.objective)}`,
  ];
  if (fields.start !== null) lines.push(`  start ${fields.start}`);
  if (fields.end !== null) lines.push(`  end ${fields.end}`);
  lines.push("  works:", ...fields.work_ids.map((work) => `    ${qualifiedPattern.exec(work)![2]}`));
  return `${lines.join(ending)}${ending}`;
}

function snapshot(window: PlanningWindowSource): PlanningWindowSnapshot {
  return Object.freeze({
    kind: "persisted" as const,
    qualifiedId: window.qualifiedId,
    title: window.title,
    objective: window.objective,
    start: window.start?.sourceText ?? null,
    end: window.end?.sourceText ?? null,
    workIds: Object.freeze(window.works.map(({ qualifiedId }) => qualifiedId)),
  });
}

function finalSnapshot(
  id: string,
  fields: PlanningWindowFinalFields,
): PlanningWindowSnapshot {
  return Object.freeze({
    kind: "persisted" as const,
    qualifiedId: id,
    title: fields.title,
    objective: fields.objective,
    start: fields.start,
    end: fields.end,
    workIds: fields.work_ids,
  });
}

function blockFor(
  text: string,
  id: string,
): PlanningDeclarationBlock | undefined {
  return scanPlanningDeclarationBlocks(text).find((block) => block.kind === "window" && block.id === id);
}

function insertionOffset(text: string): number {
  const blocks = scanPlanningDeclarationBlocks(text);
  const order = blocks.find(({ kind }) => kind === "work_order");
  if (order !== undefined) return order.span.start.offset;
  const strict = scanTemporalDeclarationBlocks(text).find(({ kind }) => kind === "milestone" || kind === "task");
  return strict?.span.start.offset ?? text.length;
}

function targetNewFields(
  target: PlanningNewCarryOverTarget,
  carry: readonly string[],
): PlanningWindowFinalFields {
  return Object.freeze({
    title: target.title,
    objective: target.objective,
    start: target.start,
    end: target.end,
    work_ids: carry,
  });
}

interface PlannedWindowEdits {
  readonly edits: readonly TextEdit[];
  readonly before: PlanningWindowSnapshot | null;
  readonly after: PlanningWindowSnapshot | null;
  readonly closeReport: PlanningWindowCloseReport | null;
  readonly destructiveRecords: readonly PlanningWindowDestructiveRecord[];
}

function destructive(
  window: PlanningWindowSource,
): PlanningWindowDestructiveRecord {
  return Object.freeze({
    ownerClass: "canonical" as const,
    entityKind: "window" as const,
    qualifiedId: window.qualifiedId,
    startOffset: window.span.start.offset,
    endOffset: window.span.end.offset,
  });
}

function planAddOrSet(
  text: string,
  request: PlanningWindowMutationRequest,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlannedWindowEdits | null {
  const local = localId(request.window_id, model.documentId, "Window id", diagnostics);
  const existing = model.windows.find(({ qualifiedId }) => qualifiedId === request.window_id);
  const fields = request.final;
  if (local === null || fields === null) return null;
  validateWorks(fields.work_ids, model, diagnostics);
  if (request.operation === "add" && existing !== undefined) diagnostics.push(diagnostic("PTPOOL-102", `Window ${request.window_id} already exists`, request.window_id));
  if (request.operation === "set" && existing === undefined) diagnostics.push(diagnostic("PTPOOL-107", `Window ${request.window_id} does not exist`, request.window_id));
  if (diagnostics.length > 0) return null;
  const ending = lineEnding(text);
  const replacement = renderWindow(local, fields, ending);
  const edit: TextEdit = existing === undefined
    ? Object.freeze({ startOffset: insertionOffset(text), endOffset: insertionOffset(text), replacement: `${replacement}${ending}` })
    : Object.freeze({ startOffset: existing.span.start.offset, endOffset: existing.span.end.offset, replacement });
  return Object.freeze({
    edits: Object.freeze([edit]),
    before: existing === undefined ? null : snapshot(existing),
    after: finalSnapshot(request.window_id, fields),
    closeReport: null,
    destructiveRecords: existing === undefined ? Object.freeze([]) : Object.freeze([destructive(existing)]),
  });
}

function validateCarrySelection(
  request: PlanningWindowMutationRequest,
  model: PlanningPoolSourceModel,
  source: PlanningWindowSource,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  validateWorks(request.carry_over_work_ids, model, diagnostics);
  const sourceWorks = new Set(source.works.map(({ qualifiedId }) => qualifiedId));
  for (const work of request.carry_over_work_ids) {
    if (!sourceWorks.has(work)) diagnostics.push(diagnostic("PTPOOL-107", `Carry-over Work ${work} is not selected by ${source.qualifiedId}`, work));
  }
}

interface ResolvedCarryTarget {
  readonly localId: string;
  readonly existing: PlanningWindowSource | undefined;
}

function resolveCarryTarget(
  target: PlanningCarryOverTarget,
  model: PlanningPoolSourceModel,
  source: PlanningWindowSource,
  diagnostics: PlanningPoolSourceDiagnostic[],
): ResolvedCarryTarget | null {
  if (target.window_id === source.qualifiedId) diagnostics.push(diagnostic("PTPOOL-107", "Window cannot carry over to itself", source.qualifiedId));
  const local = localId(target.window_id, model.documentId, "carry-over Window", diagnostics);
  const existing = model.windows.find(({ qualifiedId }) => qualifiedId === target.window_id);
  if (target.kind === "existing" && existing === undefined) diagnostics.push(diagnostic("PTPOOL-107", `Carry-over Window ${target.window_id} does not exist`, target.window_id));
  if (target.kind === "new" && existing !== undefined) diagnostics.push(diagnostic("PTPOOL-102", `New carry-over Window ${target.window_id} already exists`, target.window_id));
  return local === null || diagnostics.length > 0 ? null : Object.freeze({ localId: local, existing });
}

function fieldsForCarryTarget(
  target: PlanningCarryOverTarget,
  existing: PlanningWindowSource | undefined,
  finalWorks: readonly string[],
): PlanningWindowFinalFields {
  return target.kind === "new"
    ? targetNewFields(target, finalWorks)
    : Object.freeze({
        title: existing!.title,
        objective: existing!.objective,
        start: existing!.start?.sourceText ?? null,
        end: existing!.end?.sourceText ?? null,
        work_ids: finalWorks,
      });
}

function carryRecords(
  request: PlanningWindowMutationRequest,
  target: PlanningCarryOverTarget,
  existingWorks: ReadonlySet<string>,
): PlanningWindowCloseReport["carryOver"] {
  return Object.freeze(request.carry_over_work_ids.map((workId) => Object.freeze({
    workId,
    targetWindowId: target.window_id,
    status: existingWorks.has(workId) ? "already_selected" as const : "selected" as const,
  })));
}

function emptyCloseTarget(
  source: PlanningWindowSource,
): Readonly<{ edits: readonly TextEdit[]; report: PlanningWindowCloseReport; destructive: readonly PlanningWindowDestructiveRecord[] }> {
  return Object.freeze({
    edits: Object.freeze([{ startOffset: source.span.start.offset, endOffset: source.span.end.offset, replacement: "" }]),
    report: Object.freeze({ removedWindow: snapshot(source), objectiveDisposition: "discard", carryOver: Object.freeze([]), targetCreated: false }),
    destructive: Object.freeze([destructive(source)]),
  });
}

function closeTarget(
  text: string,
  request: PlanningWindowMutationRequest,
  model: PlanningPoolSourceModel,
  source: PlanningWindowSource,
  diagnostics: PlanningPoolSourceDiagnostic[],
): Readonly<{ edits: readonly TextEdit[]; report: PlanningWindowCloseReport; destructive: readonly PlanningWindowDestructiveRecord[] }> | null {
  const target = request.carry_over_target;
  if (target === null) return emptyCloseTarget(source);
  validateCarrySelection(request, model, source, diagnostics);
  const resolved = resolveCarryTarget(target, model, source, diagnostics);
  if (resolved === null) return null;
  const { localId: targetLocal, existing } = resolved;
  const existingWorks = new Set(existing?.works.map(({ qualifiedId }) => qualifiedId) ?? []);
  const finalWorks = Object.freeze([...new Set([...existingWorks, ...request.carry_over_work_ids])].sort());
  const targetReplacement = renderWindow(targetLocal, fieldsForCarryTarget(target, existing, finalWorks), lineEnding(text));
  const edits: TextEdit[] = [
    { startOffset: source.span.start.offset, endOffset: source.span.end.offset, replacement: target.kind === "new" ? targetReplacement : "" },
  ];
  if (existing !== undefined) edits.push({ startOffset: existing.span.start.offset, endOffset: existing.span.end.offset, replacement: targetReplacement });
  return Object.freeze({
    edits: Object.freeze(edits),
    report: Object.freeze({ removedWindow: snapshot(source), objectiveDisposition: "discard", carryOver: carryRecords(request, target, existingWorks), targetCreated: target.kind === "new" }),
    destructive: Object.freeze([destructive(source), ...(existing === undefined ? [] : [destructive(existing)])]),
  });
}

function planClose(
  text: string,
  request: PlanningWindowMutationRequest,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlannedWindowEdits | null {
  const local = localId(request.window_id, model.documentId, "Window id", diagnostics);
  const source = model.windows.find(({ qualifiedId }) => qualifiedId === request.window_id);
  if (local !== null && source === undefined) diagnostics.push(diagnostic("PTPOOL-107", `Window ${request.window_id} does not exist`, request.window_id));
  if (source === undefined || diagnostics.length > 0) return null;
  const target = closeTarget(text, request, model, source, diagnostics);
  return target === null ? null : Object.freeze({
    edits: target.edits,
    before: snapshot(source),
    after: null,
    closeReport: target.report,
    destructiveRecords: target.destructive,
  });
}

const ordinaryAuthority: PlanningWindowAuthorityImpact = Object.freeze({
  affectedScopes: Object.freeze([] as const),
  ordinaryMaintenance: true,
  userResponseRequired: false,
});

function failedMutation(
  sourceDigest: string,
  documentId: string | null,
  request: PlanningWindowMutationRequest | null,
  diagnostics: readonly PlanningPoolSourceDiagnostic[],
): PlanningWindowMutationAuditResult {
  return Object.freeze({
    schemaVersion: "Perttool.PlanningMutationResult.v1",
    windowCapability: "perttool.planning-window-core@1",
    ok: false,
    documentId,
    sourceDigest,
    normalizedRequest: request,
    candidateDigest: null,
    candidateText: null,
    changed: false,
    edits: Object.freeze([]),
    before: null,
    after: null,
    closeReport: null,
    destructiveRecords: Object.freeze([]),
    authorityImpact: null,
    diagnostics: Object.freeze(diagnostics),
  });
}

export function auditPlanningWindowMutation(
  text: string,
  input: unknown,
  capability: PlanningWindowCoreCapability,
): PlanningWindowMutationAuditResult {
  requireCapability(capability);
  const sourceDigest = planningReshapeSha256(text);
  const diagnostics: PlanningPoolSourceDiagnostic[] = [];
  const parsed = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY);
  const request = normalizeRequest(input, diagnostics);
  if (!parsed.ok || parsed.model === null) {
    diagnostics.push(...parsed.diagnostics, diagnostic("PTPOOL-116", "Window mutation requires a valid Grammar 9 source"));
  }
  if (request !== null && request.source_digest !== sourceDigest) diagnostics.push(diagnostic("PTPOOL-111", "Window mutation source digest does not match current source"));
  if (request === null || parsed.model === null || diagnostics.length > 0) {
    return failedMutation(sourceDigest, parsed.documentId, request, diagnostics);
  }
  const plan = request.operation === "close"
    ? planClose(text, request, parsed.model, diagnostics)
    : planAddOrSet(text, request, parsed.model, diagnostics);
  if (plan === null || diagnostics.length > 0) return failedMutation(sourceDigest, parsed.documentId, request, diagnostics);
  const candidate = planPlanningPoolSourceMutation(text, plan.edits, PLANNING_POOL_SOURCE_CAPABILITY);
  if (!candidate.ok || candidate.updatedText === null) {
    return failedMutation(sourceDigest, parsed.documentId, request, [...diagnostics, ...candidate.diagnostics]);
  }
  return Object.freeze({
    schemaVersion: "Perttool.PlanningMutationResult.v1",
    windowCapability: "perttool.planning-window-core@1",
    ok: true,
    documentId: parsed.documentId,
    sourceDigest,
    normalizedRequest: request,
    candidateDigest: planningReshapeSha256(candidate.updatedText),
    candidateText: candidate.updatedText,
    changed: candidate.changed,
    edits: candidate.edits,
    before: plan.before,
    after: plan.after,
    closeReport: plan.closeReport,
    destructiveRecords: plan.destructiveRecords,
    authorityImpact: ordinaryAuthority,
    diagnostics: Object.freeze(candidate.diagnostics),
  });
}

function selectionInput(
  input: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningWindowSelectionInput | null {
  const base = record(input);
  if (base?.["kind"] === "persisted") {
    const parsed = closed(input, new Set(["kind", "window_id"]), "persisted Window selection", diagnostics);
    const id = qualifiedId(parsed?.["window_id"], "Window id", diagnostics);
    return parsed === null || id === null ? null : Object.freeze({ kind: "persisted", window_id: id });
  }
  if (base?.["kind"] !== "ad_hoc") {
    diagnostics.push(diagnostic("PTPOOL-107", "Window selection kind must be persisted or ad_hoc"));
    return null;
  }
  const parsed = closed(input, new Set(["kind", "title", "objective", "start", "end", "work_ids"]), "ad hoc Window selection", diagnostics);
  if (parsed === null) return null;
  const title = parsed["title"] === null ? null : nonEmptyString(parsed["title"], "ad hoc title", diagnostics);
  const objective = parsed["objective"] === null ? null : nonEmptyString(parsed["objective"], "ad hoc objective", diagnostics);
  const start = calendar(parsed["start"], "ad hoc start", diagnostics);
  const end = calendar(parsed["end"], "ad hoc end", diagnostics);
  const works = stringSet(parsed["work_ids"], "ad hoc Work", diagnostics);
  if (start !== undefined && end !== undefined) validateBounds(start, end, diagnostics);
  return title === undefined || objective === undefined || start === undefined || end === undefined || works === null
    ? null
    : Object.freeze({ kind: "ad_hoc", title, objective, start, end, work_ids: works });
}

function adHocSnapshot(input: PlanningAdHocWindowSelectionInput): PlanningWindowSnapshot {
  return Object.freeze({
    kind: "ad_hoc" as const,
    qualifiedId: null,
    title: input.title,
    objective: input.objective,
    start: input.start,
    end: input.end,
    workIds: input.work_ids,
  });
}

function dependencies(
  selection: PlanningWindowSnapshot,
  model: PlanningPoolSourceModel,
): readonly PlanningWindowDependencyCoverage[] {
  const selected = new Set(selection.workIds);
  return Object.freeze(model.works.flatMap((work) => selected.has(work.qualifiedId)
    ? work.dependsOn.map((prerequisite) => Object.freeze({
        dependentWorkId: work.qualifiedId,
        prerequisiteWorkId: prerequisite.qualifiedId,
        covered: selected.has(prerequisite.qualifiedId),
      }))
    : []));
}

function membershipOverlaps(
  selection: PlanningWindowSnapshot,
  model: PlanningPoolSourceModel,
): readonly PlanningWindowMembershipOverlap[] {
  const selected = new Set(selection.workIds);
  return Object.freeze(model.windows.flatMap((window) => {
    if (window.qualifiedId === selection.qualifiedId) return [];
    const shared = window.works.map(({ qualifiedId }) => qualifiedId).filter((id) => selected.has(id));
    return shared.length === 0 ? [] : [Object.freeze({ windowId: window.qualifiedId, sharedWorkIds: Object.freeze(shared) })];
  }));
}

function parsedBound(value: string | null): DeclaredCalendarValue | null {
  return value === null ? null : parseDeclaredCalendarValue(value) ?? null;
}

function intervalKind(snapshotValue: PlanningWindowSnapshot): DeclaredCalendarValue["kind"] | null {
  return parsedBound(snapshotValue.start)?.kind ?? parsedBound(snapshotValue.end)?.kind ?? null;
}

function selectBound(
  left: DeclaredCalendarValue | null,
  right: DeclaredCalendarValue | null,
  chooseLater: boolean,
): DeclaredCalendarValue | null {
  if (left === null) return right;
  if (right === null) return left;
  const comparison = comparePlanningCalendarValues(left, right)!;
  return chooseLater === comparison >= 0 ? left : right;
}

function temporalOverlap(
  selection: PlanningWindowSnapshot,
  other: PlanningWindowSource,
): PlanningWindowTemporalOverlap {
  const currentKind = intervalKind(selection);
  const otherSnapshot = snapshot(other);
  const otherKind = intervalKind(otherSnapshot);
  if (currentKind !== null && otherKind !== null && currentKind !== otherKind) return Object.freeze({
    windowId: other.qualifiedId,
    state: "unavailable" as const,
    intersectionStart: null,
    intersectionEnd: null,
    cause: "incomparable_temporal_kinds" as const,
  });
  const start = selectBound(parsedBound(selection.start), parsedBound(otherSnapshot.start), true);
  const end = selectBound(parsedBound(selection.end), parsedBound(otherSnapshot.end), false);
  const disjoint = start !== null && end !== null && comparePlanningCalendarValues(start, end)! >= 0;
  return Object.freeze({
    windowId: other.qualifiedId,
    state: disjoint ? "disjoint" as const : "overlap" as const,
    intersectionStart: disjoint ? null : start?.sourceText ?? null,
    intersectionEnd: disjoint ? null : end?.sourceText ?? null,
    cause: null,
  });
}

function temporalOverlaps(
  selection: PlanningWindowSnapshot,
  model: PlanningPoolSourceModel,
): readonly PlanningWindowTemporalOverlap[] {
  return Object.freeze(model.windows
    .filter(({ qualifiedId }) => qualifiedId !== selection.qualifiedId)
    .map((window) => temporalOverlap(selection, window)));
}

function failedSelection(
  documentId: string | null,
  sourceDigest: string,
  diagnostics: readonly PlanningPoolSourceDiagnostic[],
): PlanningWindowSelectionResult {
  return Object.freeze({
    ok: false,
    documentId,
    sourceDigest,
    selection: null,
    orderedWorkIds: Object.freeze([]),
    dependencies: Object.freeze([]),
    membershipOverlaps: Object.freeze([]),
    temporalOverlaps: Object.freeze([]),
    diagnostics: Object.freeze(diagnostics),
  });
}

export function inspectPlanningWindowSelection(
  text: string,
  input: unknown,
  capability: PlanningWindowCoreCapability,
): PlanningWindowSelectionResult {
  requireCapability(capability);
  const sourceDigest = planningReshapeSha256(text);
  const diagnostics: PlanningPoolSourceDiagnostic[] = [];
  const parsed = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY);
  const request = selectionInput(input, diagnostics);
  if (!parsed.ok || parsed.model === null) diagnostics.push(...parsed.diagnostics, diagnostic("PTPOOL-116", "Window selection requires a valid Grammar 9 source"));
  if (request === null || parsed.model === null || diagnostics.length > 0) {
    return failedSelection(parsed.documentId, sourceDigest, diagnostics);
  }
  const selected = request.kind === "persisted"
    ? parsed.model.windows.find(({ qualifiedId }) => qualifiedId === request.window_id)
    : null;
  if (request.kind === "persisted" && selected === undefined) diagnostics.push(diagnostic("PTPOOL-107", `Window ${request.window_id} does not exist`, request.window_id));
  if (request.kind === "persisted") localId(request.window_id, parsed.model.documentId, "Window id", diagnostics);
  if (request.kind === "ad_hoc") validateWorks(request.work_ids, parsed.model, diagnostics);
  if (diagnostics.length > 0) return failedSelection(parsed.documentId, sourceDigest, diagnostics);
  const selectedSnapshot = selected === null || selected === undefined
    ? adHocSnapshot(request as PlanningAdHocWindowSelectionInput)
    : snapshot(selected);
  const selectedSet = new Set(selectedSnapshot.workIds);
  return Object.freeze({
    ok: true,
    documentId: parsed.model.documentId,
    sourceDigest,
    selection: selectedSnapshot,
    orderedWorkIds: Object.freeze(parsed.model.workOrder.map(({ qualifiedId }) => qualifiedId).filter((id) => selectedSet.has(id))),
    dependencies: dependencies(selectedSnapshot, parsed.model),
    membershipOverlaps: membershipOverlaps(selectedSnapshot, parsed.model),
    temporalOverlaps: temporalOverlaps(selectedSnapshot, parsed.model),
    diagnostics: Object.freeze([]),
  });
}
