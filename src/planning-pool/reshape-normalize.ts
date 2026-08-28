import { sha256DigestUtf8 } from "../model/sha256.js";
import type { PlanningPoolSourceDiagnostic } from "./source-types.js";
import type {
  PlanningAssociationDisposition,
  PlanningDependencyDisposition,
  PlanningEntityDisposition,
  PlanningProjectionLinkDisposition,
  PlanningResidualDescriptionAction,
  PlanningReshapeCreatedWork,
  PlanningReshapeElementDestination,
  PlanningReshapeElementOrigin,
  PlanningReshapeIntent,
  PlanningReshapeNormalizationResult,
  PlanningReshapeRequest,
  PlanningReshapeSemanticElement,
  PlanningStrictFragment,
  PlanningWindowMembershipDisposition,
  PlanningWorkTitleDisposition,
} from "./reshape-types.js";
import type {
  PlanningCarryOverTarget,
  PlanningWindowCloseIntent,
} from "./window-types.js";

export const PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION =
  "Perttool.PlanningReshapeRequest.v1" as const;
export const PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION_2 =
  "Perttool.PlanningReshapeRequest.v2" as const;
export const PLANNING_RESHAPE_NORMALIZATION_CONTRACT =
  "perttool.planning-reshape-normalization@1" as const;
export const PLANNING_RESHAPE_NORMALIZATION_CONTRACT_2 =
  "perttool.planning-reshape-normalization@2" as const;
export const PLANNING_RESHAPE_REQUEST_UTF8_LIMIT = 8_388_608;
export const PLANNING_RESHAPE_NORMALIZED_LIMITS = Object.freeze({
  affectedWorks: 2_048,
  semanticRows: 50_000,
  relationshipDispositions: 200_000,
});

type JsonRecord = Record<string, unknown>;

function diagnostic(message: string, code = "PTPOOL-110"): PlanningPoolSourceDiagnostic {
  return Object.freeze({
    code,
    severity: "error" as const,
    message,
    data: Object.freeze({}),
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function closedRecord(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): JsonRecord | null {
  if (!isRecord(value)) {
    diagnostics.push(diagnostic(`${label} must be an object`));
    return null;
  }
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (unknown.length > 0) diagnostics.push(diagnostic(`${label} has unknown fields: ${unknown.join(", ")}`));
  if (missing.length > 0) diagnostics.push(diagnostic(`${label} is missing fields: ${missing.join(", ")}`));
  return unknown.length === 0 && missing.length === 0 ? value : null;
}

function stringValue(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
  nonEmpty = true,
): string | null {
  if (typeof value !== "string" || (nonEmpty && value.length === 0)) {
    diagnostics.push(diagnostic(`${label} must be ${nonEmpty ? "a non-empty" : "a"} string`));
    return null;
  }
  return value;
}

function integerValue(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): number | null {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    diagnostics.push(diagnostic(`${label} must be a non-negative safe integer`));
    return null;
  }
  return value as number;
}

const qualifiedIdPattern = /^[A-Za-z][A-Za-z0-9_-]*::[A-Za-z][A-Za-z0-9_-]*$/u;
const elementIdPattern = /^[A-Za-z][A-Za-z0-9_-]*$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;

function qualifiedId(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | null {
  const result = stringValue(value, label, diagnostics);
  if (result !== null && !qualifiedIdPattern.test(result)) {
    diagnostics.push(diagnostic(`${label} must be a fully qualified planning identity`));
    return null;
  }
  return result;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): T | null {
  if (typeof value !== "string" || !values.includes(value as T)) {
    diagnostics.push(diagnostic(`${label} has an unknown value`));
    return null;
  }
  return value as T;
}

function nullableQualifiedId(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | null | undefined {
  return value === null ? null : qualifiedId(value, label, diagnostics) ?? undefined;
}

function parseCreatedWork(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningReshapeCreatedWork | null {
  const record = closedRecord(
    value,
    ["work_id", "title", "insert_after_work_id"],
    [],
    "created Work",
    diagnostics,
  );
  if (record === null) return null;
  const workId = qualifiedId(record["work_id"], "created Work work_id", diagnostics);
  const title = stringValue(record["title"], "created Work title", diagnostics);
  const anchor = nullableQualifiedId(record["insert_after_work_id"], "created Work insertion anchor", diagnostics);
  return workId === null || title === null || anchor === undefined
    ? null
    : Object.freeze({ work_id: workId, title, insert_after_work_id: anchor });
}

function parseWorkTitleDisposition(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningWorkTitleDisposition | null {
  const record = closedRecord(
    value,
    ["work_id", "title"],
    [],
    "Work title disposition",
    diagnostics,
  );
  if (record === null) return null;
  const workId = qualifiedId(record["work_id"], "Work title disposition work_id", diagnostics);
  const title = stringValue(record["title"], "Work title disposition title", diagnostics);
  return workId === null || title === null
    ? null
    : Object.freeze({ work_id: workId, title });
}

function parseExistingOrigin(
  record: JsonRecord,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningReshapeElementOrigin | null {
  const checked = closedRecord(
    record,
    ["kind", "work_id", "start_utf16", "end_utf16", "source_text"],
    [],
    "existing semantic origin",
    diagnostics,
  );
  if (checked === null || checked["kind"] !== "existing") return null;
  const workId = qualifiedId(checked["work_id"], "semantic origin work_id", diagnostics);
  const start = integerValue(checked["start_utf16"], "semantic origin start_utf16", diagnostics);
  const end = integerValue(checked["end_utf16"], "semantic origin end_utf16", diagnostics);
  const sourceText = stringValue(checked["source_text"], "semantic origin source_text", diagnostics, false);
  if (start !== null && end !== null && end < start) diagnostics.push(diagnostic("semantic origin end_utf16 precedes start_utf16"));
  return workId === null || start === null || end === null || sourceText === null || end < start
    ? null
    : Object.freeze({ kind: "existing", work_id: workId, start_utf16: start, end_utf16: end, source_text: sourceText });
}

function parseCreatedOrigin(
  record: JsonRecord,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningReshapeElementOrigin | null {
  const checked = closedRecord(
    record,
    ["kind", "source_text", "asserted_new_meaning"],
    [],
    "created semantic origin",
    diagnostics,
  );
  if (checked === null || checked["kind"] !== "created") return null;
  const sourceText = stringValue(checked["source_text"], "created semantic origin source_text", diagnostics, false);
  if (checked["asserted_new_meaning"] !== true) diagnostics.push(diagnostic("created semantic origin requires asserted_new_meaning true"));
  return sourceText === null || checked["asserted_new_meaning"] !== true
    ? null
    : Object.freeze({ kind: "created", source_text: sourceText, asserted_new_meaning: true });
}

function parseOrigin(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningReshapeElementOrigin | null {
  if (!isRecord(value)) {
    diagnostics.push(diagnostic("semantic origin must be an object"));
    return null;
  }
  if (value["kind"] === "existing") return parseExistingOrigin(value, diagnostics);
  if (value["kind"] === "created") return parseCreatedOrigin(value, diagnostics);
  diagnostics.push(diagnostic("semantic origin has an unknown kind"));
  return null;
}

function parseDestination(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningReshapeElementDestination | null {
  if (!isRecord(value)) {
    diagnostics.push(diagnostic("semantic destination must be an object"));
    return null;
  }
  if (value["kind"] === "work") {
    const record = closedRecord(
      value,
      ["kind", "work_id", "position", "text"],
      [],
      "Work semantic destination",
      diagnostics,
    );
    if (record === null) return null;
    const workId = qualifiedId(record["work_id"], "semantic destination work_id", diagnostics);
    const position = integerValue(record["position"], "semantic destination position", diagnostics);
    const text = stringValue(record["text"], "semantic destination text", diagnostics, false);
    return workId === null || position === null || text === null
      ? null
      : Object.freeze({ kind: "work", work_id: workId, position, text });
  }
  if (value["kind"] === "discard") {
    const record = closedRecord(value, ["kind"], ["reason"], "discard destination", diagnostics);
    if (record === null) return null;
    const reason = record["reason"] === undefined
      ? undefined
      : stringValue(record["reason"], "discard reason", diagnostics, false) ?? undefined;
    return record["reason"] !== undefined && reason === undefined
      ? null
      : Object.freeze({ kind: "discard", ...(reason === undefined ? {} : { reason }) });
  }
  diagnostics.push(diagnostic("semantic destination has an unknown kind"));
  return null;
}

function parseSemanticElement(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningReshapeSemanticElement | null {
  const record = closedRecord(value, ["element_id", "origin", "destination"], [], "semantic element", diagnostics);
  if (record === null) return null;
  const elementId = stringValue(record["element_id"], "semantic element_id", diagnostics);
  if (elementId !== null && !elementIdPattern.test(elementId)) {
    diagnostics.push(diagnostic("semantic element_id is invalid"));
  }
  const origin = parseOrigin(record["origin"], diagnostics);
  const destination = parseDestination(record["destination"], diagnostics);
  return elementId === null || !elementIdPattern.test(elementId) || origin === null || destination === null
    ? null
    : Object.freeze({ element_id: elementId, origin, destination });
}

function parseEntityDisposition(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningEntityDisposition | null {
  const record = closedRecord(value, ["entity_kind", "entity_id", "action"], ["reason"], "planning entity disposition", diagnostics);
  if (record === null) return null;
  const kind = enumValue(record["entity_kind"], ["event", "activity"], "planning entity kind", diagnostics);
  const id = qualifiedId(record["entity_id"], "planning entity id", diagnostics);
  const action = enumValue(record["action"], ["retain", "create", "project", "defer", "discard"], "planning entity action", diagnostics);
  const reason = record["reason"] === undefined ? undefined : stringValue(record["reason"], "planning entity reason", diagnostics, false) ?? undefined;
  return kind === null || id === null || action === null || (record["reason"] !== undefined && reason === undefined)
    ? null
    : Object.freeze({ entity_kind: kind, entity_id: id, action, ...(reason === undefined ? {} : { reason }) });
}

function parseAssociationDisposition(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningAssociationDisposition | null {
  const record = closedRecord(
    value,
    ["entity_kind", "entity_id", "origin_work_id", "destination_work_id"],
    [],
    "association disposition",
    diagnostics,
  );
  if (record === null) return null;
  const kind = enumValue(record["entity_kind"], ["event", "activity"], "association entity kind", diagnostics);
  const entityId = qualifiedId(record["entity_id"], "association entity id", diagnostics);
  const origin = nullableQualifiedId(record["origin_work_id"], "association origin Work", diagnostics);
  const destination = nullableQualifiedId(record["destination_work_id"], "association destination Work", diagnostics);
  if (origin === null && destination === null) diagnostics.push(diagnostic("association disposition must retain one endpoint"));
  return kind === null || entityId === null || origin === undefined || destination === undefined || (origin === null && destination === null)
    ? null
    : Object.freeze({ entity_kind: kind, entity_id: entityId, origin_work_id: origin, destination_work_id: destination });
}

function parseProjectionLinkDisposition(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningProjectionLinkDisposition | null {
  const record = closedRecord(
    value,
    ["strict_kind", "strict_id", "origin_work_id", "destination_work_id"],
    [],
    "projection-link disposition",
    diagnostics,
  );
  if (record === null) return null;
  const kind = enumValue(record["strict_kind"], ["milestone", "task"], "strict entity kind", diagnostics);
  const strictId = qualifiedId(record["strict_id"], "strict entity id", diagnostics);
  const origin = nullableQualifiedId(record["origin_work_id"], "projection-link origin Work", diagnostics);
  const destination = nullableQualifiedId(record["destination_work_id"], "projection-link destination Work", diagnostics);
  if (origin === null && destination === null) diagnostics.push(diagnostic("projection-link disposition must retain one endpoint"));
  return kind === null || strictId === null || origin === undefined || destination === undefined || (origin === null && destination === null)
    ? null
    : Object.freeze({ strict_kind: kind, strict_id: strictId, origin_work_id: origin, destination_work_id: destination });
}

function parseStringSet(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): readonly string[] | null {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic(`${label} must be an array`));
    return null;
  }
  const result = value.map((item) => qualifiedId(item, label, diagnostics));
  return result.some((item) => item === null)
    ? null
    : Object.freeze((result as string[]).sort(compareUnicodeScalars));
}

function optionalQualifiedId(
  record: JsonRecord,
  field: string,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | undefined | null {
  return record[field] === undefined
    ? undefined
    : qualifiedId(record[field], label, diagnostics) ?? null;
}

function optionalQualifiedIdSet(
  record: JsonRecord,
  field: string,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): readonly string[] | undefined | null {
  return record[field] === undefined
    ? undefined
    : parseStringSet(record[field], label, diagnostics) ?? null;
}

function optionalText(
  record: JsonRecord,
  field: string,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | undefined | null {
  return record[field] === undefined
    ? undefined
    : stringValue(record[field], label, diagnostics, false) ?? null;
}

function validateDependencyDispositionShape(
  action: PlanningDependencyDisposition["action"] | null,
  finalDependent: string | undefined | null,
  finalPrerequisite: string | undefined | null,
  representedBy: readonly string[] | undefined | null,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  validateDependencyEndpoints(action, finalDependent, finalPrerequisite, diagnostics);
  validateDependencyOwners(action, representedBy, diagnostics);
}

function validateDependencyEndpoints(
  action: PlanningDependencyDisposition["action"] | null,
  finalDependent: string | undefined | null,
  finalPrerequisite: string | undefined | null,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  if (action === "retain" && (finalDependent !== undefined || finalPrerequisite !== undefined)) {
    diagnostics.push(diagnostic("retained dependency cannot declare final endpoints"));
  }
  if (action !== null && action !== "rebind" && (finalDependent !== undefined || finalPrerequisite !== undefined)) {
    diagnostics.push(diagnostic("only a rebound dependency may declare final endpoints"));
  }
  if (action === "rebind" && (typeof finalDependent !== "string" || typeof finalPrerequisite !== "string")) {
    diagnostics.push(diagnostic("rebound dependency requires both final endpoints"));
  }
}

function validateDependencyOwners(
  action: PlanningDependencyDisposition["action"] | null,
  representedBy: readonly string[] | undefined | null,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  if (action === "represented" && (!Array.isArray(representedBy) || representedBy.length === 0)) {
    diagnostics.push(diagnostic("represented dependency requires final owners"));
  }
  if (action !== null && action !== "represented" && representedBy !== undefined) {
    diagnostics.push(diagnostic("only a represented dependency may cite final owners"));
  }
}

function hasNull(values: readonly unknown[]): boolean {
  return values.some((value) => value === null);
}

function parseDependencyDisposition(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningDependencyDisposition | null {
  const record = closedRecord(
    value,
    ["dependent_work_id", "prerequisite_work_id", "action"],
    ["final_dependent_work_id", "final_prerequisite_work_id", "represented_by", "reason"],
    "dependency disposition",
    diagnostics,
  );
  if (record === null) return null;
  const dependent = qualifiedId(record["dependent_work_id"], "dependent Work", diagnostics);
  const prerequisite = qualifiedId(record["prerequisite_work_id"], "prerequisite Work", diagnostics);
  const action = enumValue(record["action"], ["retain", "create", "rebind", "represented", "no_longer_required"], "dependency action", diagnostics);
  const finalDependent = optionalQualifiedId(record, "final_dependent_work_id", "final dependent Work", diagnostics);
  const finalPrerequisite = optionalQualifiedId(record, "final_prerequisite_work_id", "final prerequisite Work", diagnostics);
  const representedBy = optionalQualifiedIdSet(record, "represented_by", "represented owner", diagnostics);
  const reason = optionalText(record, "reason", "dependency reason", diagnostics);
  validateDependencyDispositionShape(action, finalDependent, finalPrerequisite, representedBy, diagnostics);
  if (hasNull([dependent, prerequisite, action, finalDependent, finalPrerequisite, representedBy, reason])) return null;
  return Object.freeze({
    dependent_work_id: dependent!,
    prerequisite_work_id: prerequisite!,
    action: action!,
    ...(finalDependent === undefined ? {} : { final_dependent_work_id: finalDependent as string }),
    ...(finalPrerequisite === undefined ? {} : { final_prerequisite_work_id: finalPrerequisite as string }),
    ...(representedBy === undefined ? {} : { represented_by: representedBy as readonly string[] }),
    ...(reason === undefined ? {} : { reason: reason as string }),
  });
}

function parseWindowMembershipDisposition(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningWindowMembershipDisposition | null {
  const record = closedRecord(
    value,
    ["window_id", "origin_work_id", "destination_work_id"],
    [],
    "Window membership disposition",
    diagnostics,
  );
  if (record === null) return null;
  const windowId = qualifiedId(record["window_id"], "Window id", diagnostics);
  const origin = qualifiedId(record["origin_work_id"], "Window origin Work", diagnostics);
  const destination = nullableQualifiedId(record["destination_work_id"], "Window destination Work", diagnostics);
  return windowId === null || origin === null || destination === undefined
    ? null
    : Object.freeze({ window_id: windowId, origin_work_id: origin, destination_work_id: destination });
}

function parseResidualAction(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningResidualDescriptionAction | null {
  const record = closedRecord(value, ["work_id", "text"], [], "residual-description action", diagnostics);
  if (record === null) return null;
  const workId = qualifiedId(record["work_id"], "residual-description Work", diagnostics);
  const text = stringValue(record["text"], "residual-description text", diagnostics, false);
  return workId === null || text === null ? null : Object.freeze({ work_id: workId, text });
}

function parseArray<T>(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
  parse: (item: unknown, diagnostics: PlanningPoolSourceDiagnostic[]) => T | null,
): readonly T[] | null {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic(`${label} must be an array`));
    return null;
  }
  const result = value.map((item) => parse(item, diagnostics));
  return result.some((item) => item === null)
    ? null
    : Object.freeze(result as T[]);
}

function unique<T>(
  values: readonly T[],
  key: (value: T) => string,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    const identity = key(value);
    if (seen.has(identity)) {
      diagnostics.push(diagnostic(`Duplicate ${label} ${identity}`));
      return false;
    }
    seen.add(identity);
  }
  return true;
}

function compareUnicodeScalars(left: string, right: string): number {
  const leftPoints = Array.from(left, (value) => value.codePointAt(0)!);
  const rightPoints = Array.from(right, (value) => value.codePointAt(0)!);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

function sorted<T>(values: readonly T[], key: (value: T) => string): readonly T[] {
  return Object.freeze([...values].sort((left, right) => compareUnicodeScalars(key(left), key(right))));
}

function canonicalValue(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  const record = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(record).sort(compareUnicodeScalars);
  const fields = keys.map((key) => `${JSON.stringify(key)}:${canonicalValue(record[key])}`);
  return `{${fields.join(",")}}`;
}

function rawRequestBytes(input: unknown): number | null {
  try {
    const text = typeof input === "string" ? input : JSON.stringify(input);
    return new TextEncoder().encode(text).byteLength;
  } catch {
    return null;
  }
}

function parsedInput(input: unknown, diagnostics: PlanningPoolSourceDiagnostic[]): unknown {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input) as unknown;
  } catch {
    diagnostics.push(diagnostic("Planning reshape request is not valid JSON"));
    return null;
  }
}

function arrayLength(record: JsonRecord, field: string): number {
  const value = record[field];
  return Array.isArray(value) ? value.length : 0;
}

function exceedsNormalizedLimits(
  record: JsonRecord,
  diagnostics: PlanningPoolSourceDiagnostic[],
): boolean {
  const relationCount = [
    "planning_entity_dispositions",
    "association_dispositions",
    "projection_link_dispositions",
    "dependency_dispositions",
    "window_membership_dispositions",
  ].reduce((total, field) => total + arrayLength(record, field), 0);
  const violations = [
    arrayLength(record, "affected_work_ids") > PLANNING_RESHAPE_NORMALIZED_LIMITS.affectedWorks,
    arrayLength(record, "semantic_elements") > PLANNING_RESHAPE_NORMALIZED_LIMITS.semanticRows,
    relationCount > PLANNING_RESHAPE_NORMALIZED_LIMITS.relationshipDispositions,
  ];
  if (!violations.some(Boolean)) return false;
  diagnostics.push(diagnostic("Planning reshape request count limit exceeded", "PTPOOL-115"));
  return true;
}

function failedNormalization(
  diagnostics: readonly PlanningPoolSourceDiagnostic[],
): PlanningReshapeNormalizationResult {
  return Object.freeze({
    ok: false,
    request: null,
    canonicalUtf8: null,
    preflightHash: null,
    diagnostics: Object.freeze(diagnostics),
  });
}

const requestFieldsV1 = Object.freeze([
  "request_schema_version",
  "normalization_contract",
  "source_digest",
  "intent",
  "affected_work_ids",
  "created_works",
  "removed_work_ids",
  "semantic_elements",
  "planning_entity_dispositions",
  "association_dispositions",
  "projection_link_dispositions",
  "dependency_dispositions",
  "window_membership_dispositions",
  "final_work_order",
  "add_residual_description",
  "strict_fragment",
  "window_close",
]);
const requestFieldsV2 = Object.freeze([
  ...requestFieldsV1,
  "work_title_dispositions",
]);

function planningRequestRecord(
  input: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): JsonRecord | null {
  const byteLength = rawRequestBytes(input);
  if (byteLength === null) diagnostics.push(diagnostic("Planning reshape request cannot be serialized"));
  if (byteLength !== null && byteLength > PLANNING_RESHAPE_REQUEST_UTF8_LIMIT) {
    diagnostics.push(diagnostic(`Planning reshape request exceeds ${PLANNING_RESHAPE_REQUEST_UTF8_LIMIT} UTF-8 bytes`, "PTPOOL-115"));
  }
  const parsed = parsedInput(input, diagnostics);
  const version = isRecord(parsed) ? parsed["request_schema_version"] : null;
  const fields = version === PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION_2
    ? requestFieldsV2
    : requestFieldsV1;
  const record = closedRecord(
    parsed,
    fields,
    [],
    "Planning reshape request",
    diagnostics,
  );
  if (record !== null) exceedsNormalizedLimits(record, diagnostics);
  return diagnostics.length === 0 ? record : null;
}

interface ParsedRequestFields {
  readonly version:
    | typeof PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION
    | typeof PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION_2;
  readonly sourceDigest: string;
  readonly intent: PlanningReshapeIntent;
  readonly affected: readonly string[];
  readonly created: readonly PlanningReshapeCreatedWork[];
  readonly titles: readonly PlanningWorkTitleDisposition[];
  readonly removed: readonly string[];
  readonly elements: readonly PlanningReshapeSemanticElement[];
  readonly entities: readonly PlanningEntityDisposition[];
  readonly associations: readonly PlanningAssociationDisposition[];
  readonly links: readonly PlanningProjectionLinkDisposition[];
  readonly dependencies: readonly PlanningDependencyDisposition[];
  readonly memberships: readonly PlanningWindowMembershipDisposition[];
  readonly order: readonly string[];
  readonly residual: readonly PlanningResidualDescriptionAction[];
  readonly strictFragment: PlanningStrictFragment | null;
  readonly windowClose: PlanningWindowCloseIntent | null;
}

function nullableStringValue(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | null | undefined {
  return value === null ? null : stringValue(value, label, diagnostics) ?? undefined;
}

function parseExistingCarryTarget(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningCarryOverTarget | null {
  const record = closedRecord(value, ["kind", "window_id"], [], "existing carry-over target", diagnostics);
  const windowId = record === null ? null : qualifiedId(record["window_id"], "carry-over Window", diagnostics);
  return record === null || record["kind"] !== "existing" || windowId === null
    ? null
    : Object.freeze({ kind: "existing", window_id: windowId });
}

function parseNewCarryTarget(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningCarryOverTarget | null {
  const record = closedRecord(
    value,
    ["kind", "window_id", "title", "objective", "start", "end"],
    [],
    "new carry-over target",
    diagnostics,
  );
  if (record === null || record["kind"] !== "new") return null;
  const windowId = qualifiedId(record["window_id"], "new carry-over Window", diagnostics);
  const title = stringValue(record["title"], "new carry-over Window title", diagnostics);
  const objective = stringValue(record["objective"], "new carry-over Window objective", diagnostics);
  const start = nullableStringValue(record["start"], "new carry-over Window start", diagnostics);
  const end = nullableStringValue(record["end"], "new carry-over Window end", diagnostics);
  return windowId === null || title === null || objective === null || start === undefined || end === undefined
    ? null
    : Object.freeze({ kind: "new", window_id: windowId, title, objective, start, end });
}

function parseCarryTarget(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningCarryOverTarget | null {
  if (value === null) return null;
  const kind = isRecord(value) ? value["kind"] : undefined;
  if (kind === "existing") return parseExistingCarryTarget(value, diagnostics);
  if (kind === "new") return parseNewCarryTarget(value, diagnostics);
  diagnostics.push(diagnostic("carry_over_target must be null, existing, or new"));
  return null;
}

function parseWindowClose(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningWindowCloseIntent | null {
  if (value === null) return null;
  const record = closedRecord(
    value,
    ["window_id", "objective_disposition", "carry_over_work_ids", "carry_over_target"],
    [],
    "Window close",
    diagnostics,
  );
  if (record === null) return null;
  const windowId = qualifiedId(record["window_id"], "closed Window", diagnostics);
  const works = parseStringSet(record["carry_over_work_ids"], "carry-over Work", diagnostics);
  const target = parseCarryTarget(record["carry_over_target"], diagnostics);
  if (record["objective_disposition"] !== "discard") diagnostics.push(diagnostic("Window close must discard its objective"));
  if (works !== null && (works.length === 0) !== (target === null)) {
    diagnostics.push(diagnostic("Window close requires a target exactly when carry-over is non-empty"));
  }
  return windowId === null || works === null || record["objective_disposition"] !== "discard"
    ? null
    : Object.freeze({
        window_id: windowId,
        objective_disposition: "discard",
        carry_over_work_ids: works,
        carry_over_target: target,
      });
}

function parseStrictFragment(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningStrictFragment | null {
  if (value === null) return null;
  const base = closedRecord(value, ["kind"], ["event_ids", "activity_ids", "task_ids", "milestone_ids"], "strict fragment", diagnostics);
  if (base === null) return null;
  const kind = enumValue(base["kind"], ["project", "defer"], "strict fragment kind", diagnostics);
  if (kind === "project") {
    const exact = closedRecord(value, ["kind", "event_ids", "activity_ids"], [], "projection strict fragment", diagnostics);
    if (exact === null) return null;
    const events = parseStringSet(exact["event_ids"], "projection Event", diagnostics);
    const activities = parseStringSet(exact["activity_ids"], "projection Activity", diagnostics);
    return events === null || activities === null
      ? null
      : Object.freeze({ kind, event_ids: events, activity_ids: activities });
  }
  if (kind === "defer") {
    const exact = closedRecord(value, ["kind", "task_ids", "milestone_ids"], [], "deferral strict fragment", diagnostics);
    if (exact === null) return null;
    const tasks = parseStringSet(exact["task_ids"], "deferral Task", diagnostics);
    const milestones = parseStringSet(exact["milestone_ids"], "deferral Milestone", diagnostics);
    return tasks === null || milestones === null
      ? null
      : Object.freeze({ kind, task_ids: tasks, milestone_ids: milestones });
  }
  return null;
}

function parseFinalWorkOrder(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): readonly string[] | null {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic("final_work_order must be an array"));
    return null;
  }
  return Object.freeze(value.map((item) =>
    qualifiedId(item, "final_work_order", diagnostics)).filter((item): item is string => item !== null));
}

function parseRequestFields(
  record: JsonRecord,
  diagnostics: PlanningPoolSourceDiagnostic[],
): ParsedRequestFields | null {
  const version = record["request_schema_version"] === PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION_2
    ? PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION_2
    : PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION;
  const sourceDigest = stringValue(record["source_digest"], "source_digest", diagnostics);
  if (sourceDigest !== null && !digestPattern.test(sourceDigest)) diagnostics.push(diagnostic("source_digest must be a lowercase SHA-256 identity"));
  const intent = enumValue(record["intent"], ["reshape", "project", "defer", "archive", "composite"], "reshape intent", diagnostics) as PlanningReshapeIntent | null;
  const affected = parseStringSet(record["affected_work_ids"], "affected Work", diagnostics);
  const created = parseArray(record["created_works"], "created_works", diagnostics, parseCreatedWork);
  const titles = version === PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION_2
    ? parseArray(record["work_title_dispositions"], "work_title_dispositions", diagnostics, parseWorkTitleDisposition)
    : Object.freeze([] as PlanningWorkTitleDisposition[]);
  const removed = parseStringSet(record["removed_work_ids"], "removed Work", diagnostics);
  const elements = parseArray(record["semantic_elements"], "semantic_elements", diagnostics, parseSemanticElement);
  const entities = parseArray(record["planning_entity_dispositions"], "planning_entity_dispositions", diagnostics, parseEntityDisposition);
  const associations = parseArray(record["association_dispositions"], "association_dispositions", diagnostics, parseAssociationDisposition);
  const links = parseArray(record["projection_link_dispositions"], "projection_link_dispositions", diagnostics, parseProjectionLinkDisposition);
  const dependencies = parseArray(record["dependency_dispositions"], "dependency_dispositions", diagnostics, parseDependencyDisposition);
  const memberships = parseArray(record["window_membership_dispositions"], "window_membership_dispositions", diagnostics, parseWindowMembershipDisposition);
  const order = parseFinalWorkOrder(record["final_work_order"], diagnostics);
  const residual = parseArray(record["add_residual_description"], "add_residual_description", diagnostics, parseResidualAction);
  const strictFragment = parseStrictFragment(record["strict_fragment"], diagnostics);
  const windowClose = parseWindowClose(record["window_close"], diagnostics);
  if (hasNull([sourceDigest, intent, affected, created, titles, removed, elements, entities, associations, links, dependencies, memberships, order, residual])) return null;
  return Object.freeze({
    version, sourceDigest: sourceDigest!, intent: intent!, affected: affected!, created: created!, titles: titles!,
    removed: removed!, elements: elements!, entities: entities!, associations: associations!,
    links: links!, dependencies: dependencies!, memberships: memberships!, order: order!, residual: residual!,
    strictFragment, windowClose,
  });
}

function validateRequestUniqueness(
  fields: ParsedRequestFields,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  unique(fields.affected, (item) => item, "affected Work", diagnostics);
  unique(fields.created, (item) => item.work_id, "created Work", diagnostics);
  unique(fields.titles, (item) => item.work_id, "Work title disposition", diagnostics);
  unique(fields.removed, (item) => item, "removed Work", diagnostics);
  unique(fields.elements, (item) => item.element_id, "semantic element", diagnostics);
  unique(fields.entities, (item) => `${item.entity_kind}:${item.entity_id}`, "planning entity disposition", diagnostics);
  unique(fields.associations, (item) => `${item.entity_kind}:${item.entity_id}:${item.origin_work_id ?? "-"}:${item.destination_work_id ?? "-"}`, "association disposition", diagnostics);
  unique(fields.links, (item) => `${item.strict_kind}:${item.strict_id}:${item.origin_work_id ?? "-"}:${item.destination_work_id ?? "-"}`, "projection-link disposition", diagnostics);
  unique(fields.dependencies, (item) => `${item.dependent_work_id}:${item.prerequisite_work_id}`, "dependency disposition", diagnostics);
  unique(fields.memberships, (item) => `${item.window_id}:${item.origin_work_id}`, "Window membership disposition", diagnostics);
  unique(fields.order, (item) => item, "final Work order", diagnostics);
  unique(fields.residual, (item) => item.work_id, "residual-description action", diagnostics);
  if (fields.strictFragment?.kind === "project") {
    unique(fields.strictFragment.event_ids, (item) => item, "projection Event", diagnostics);
    unique(fields.strictFragment.activity_ids, (item) => item, "projection Activity", diagnostics);
  }
  if (fields.strictFragment?.kind === "defer") {
    unique(fields.strictFragment.task_ids, (item) => item, "deferral Task", diagnostics);
    unique(fields.strictFragment.milestone_ids, (item) => item, "deferral Milestone", diagnostics);
  }
  if (fields.windowClose !== null) {
    unique(fields.windowClose.carry_over_work_ids, (item) => item, "carry-over Work", diagnostics);
  }
}

function normalizedRequest(fields: ParsedRequestFields): PlanningReshapeRequest {
  const version2 = fields.version === PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION_2;
  return Object.freeze({
    request_schema_version: fields.version,
    normalization_contract: version2
      ? PLANNING_RESHAPE_NORMALIZATION_CONTRACT_2
      : PLANNING_RESHAPE_NORMALIZATION_CONTRACT,
    source_digest: fields.sourceDigest,
    intent: fields.intent,
    affected_work_ids: fields.affected,
    created_works: sorted(fields.created, (item) => item.work_id),
    ...(version2
      ? { work_title_dispositions: sorted(fields.titles, (item) => item.work_id) }
      : {}),
    removed_work_ids: fields.removed,
    semantic_elements: fields.elements,
    planning_entity_dispositions: sorted(fields.entities, (item) => `${item.entity_kind}:${item.entity_id}`),
    association_dispositions: sorted(fields.associations, (item) => `${item.entity_kind}:${item.entity_id}:${item.origin_work_id ?? "-"}:${item.destination_work_id ?? "-"}`),
    projection_link_dispositions: sorted(fields.links, (item) => `${item.strict_kind}:${item.strict_id}:${item.origin_work_id ?? "-"}:${item.destination_work_id ?? "-"}`),
    dependency_dispositions: sorted(fields.dependencies, (item) => `${item.dependent_work_id}:${item.prerequisite_work_id}`),
    window_membership_dispositions: sorted(fields.memberships, (item) => `${item.window_id}:${item.origin_work_id}`),
    final_work_order: fields.order,
    add_residual_description: sorted(fields.residual, (item) => item.work_id),
    strict_fragment: fields.strictFragment,
    window_close: fields.windowClose,
  });
}

export function planningReshapeSha256(text: string): string {
  return sha256DigestUtf8(text);
}

export function canonicalPlanningReshapeJson(value: unknown): string {
  return canonicalValue(value);
}

function validateRequestIdentities(
  record: JsonRecord,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  const version = record["request_schema_version"];
  if (version !== PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION && version !== PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION_2) {
    diagnostics.push(diagnostic("Planning reshape request schema identity is unsupported"));
  }
  const expected = version === PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION_2
    ? PLANNING_RESHAPE_NORMALIZATION_CONTRACT_2
    : PLANNING_RESHAPE_NORMALIZATION_CONTRACT;
  if (record["normalization_contract"] !== expected) {
    diagnostics.push(diagnostic("Planning reshape normalization identity is unsupported"));
  }
}

function validateRequestIntent(
  fields: ParsedRequestFields,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  if (fields.version === PLANNING_RESHAPE_REQUEST_SCHEMA_VERSION &&
      fields.dependencies.some(({ action }) => action === "create")) {
    diagnostics.push(diagnostic("created dependency requires PlanningReshapeRequest.v2"));
  }
  if ((fields.intent === "project") !== (fields.strictFragment?.kind === "project")) {
    diagnostics.push(diagnostic("project intent requires exactly one projection strict fragment"));
  }
  if ((fields.intent === "defer") !== (fields.strictFragment?.kind === "defer")) {
    diagnostics.push(diagnostic("defer intent requires exactly one deferral strict fragment"));
  }
  if (fields.intent !== "project" && fields.intent !== "defer" && fields.strictFragment !== null) {
    diagnostics.push(diagnostic("strict_fragment requires project or defer intent"));
  }
  if (fields.windowClose !== null && fields.intent !== "composite") {
    diagnostics.push(diagnostic("window_close requires composite intent"));
  }
  if (fields.windowClose !== null && fields.affected.length === 0) {
    diagnostics.push(diagnostic("window_close requires an audited affected Work set"));
  }
}

function successfulNormalization(fields: ParsedRequestFields): PlanningReshapeNormalizationResult {
  const request = normalizedRequest(fields);
  const canonicalUtf8 = canonicalValue(request);
  return Object.freeze({
    ok: true,
    request,
    canonicalUtf8,
    preflightHash: planningReshapeSha256(canonicalUtf8),
    diagnostics: Object.freeze([]),
  });
}

export function normalizePlanningReshapeRequest(
  input: unknown,
): PlanningReshapeNormalizationResult {
  const diagnostics: PlanningPoolSourceDiagnostic[] = [];
  const record = planningRequestRecord(input, diagnostics);
  if (record === null) return failedNormalization(diagnostics);
  validateRequestIdentities(record, diagnostics);
  const fields = parseRequestFields(record, diagnostics);
  if (fields === null) return failedNormalization(diagnostics);
  validateRequestIntent(fields, diagnostics);
  validateRequestUniqueness(fields, diagnostics);
  if (diagnostics.length > 0) return failedNormalization(diagnostics);
  return successfulNormalization(fields);
}
