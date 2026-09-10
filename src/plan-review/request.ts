import { canonicalizeEventDateTimeSourceToken } from "../model/calendar.js";
import type { Diagnostic } from "../model/diagnostics.js";
import { compareStableStrings } from "../model/diagnostics.js";
import { rfc8785Json } from "../model/rfc8785.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import type { BatchMutation } from "../mutation/types.js";
import { PLAN_REVIEW_SOURCE_LIMITS } from "./source.js";
import {
  PLAN_REVIEW_CREATE_REQUEST_ID,
  PLAN_REVIEW_RESOLVE_REQUEST_ID,
  type NormalizedPlanReviewCreateRequestV1,
  type NormalizedPlanReviewResolveRequestV1,
} from "./mutation-types.js";

const identifierPattern = /^[A-Za-z][A-Za-z0-9_-]*$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const encoder = new TextEncoder();

export type PlanReviewRequestNormalization<T> = Readonly<{
  ok: boolean;
  request: T | null;
  diagnostics: readonly Diagnostic[];
}>;

function diagnostic(message: string, cause: string): Diagnostic {
  return Object.freeze({
    code: "PTREV-104",
    severity: "error" as const,
    message,
    helpTopic: "editing",
    data: Object.freeze({ cause }),
  });
}

function failure<T>(message: string, cause: string): PlanReviewRequestNormalization<T> {
  return Object.freeze({
    ok: false,
    request: null,
    diagnostics: Object.freeze([diagnostic(message, cause)]),
  });
}

interface InputRecord extends Record<string, unknown> {
  readonly schemaVersion?: unknown;
  readonly requestId?: unknown;
  readonly taskId?: unknown;
  readonly reason?: unknown;
  readonly createdAt?: unknown;
  readonly actor?: unknown;
  readonly locator?: unknown;
  readonly kind?: unknown;
  readonly mutations?: unknown;
  readonly outcome?: unknown;
  readonly resolvedAt?: unknown;
  readonly resolutionReason?: unknown;
  readonly acceptedOwners?: unknown;
  readonly request?: unknown;
}

function record(input: unknown): InputRecord | null {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : null;
}

function closed(value: InputRecord, fields: readonly string[]): boolean {
  const allowed = new Set(fields);
  return Object.keys(value).every((field) => allowed.has(field));
}

function nonemptyWithin(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 &&
    encoder.encode(value).byteLength <= maximum;
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

function canonicalDateTime(value: unknown): string | null {
  return typeof value === "string"
    ? canonicalizeEventDateTimeSourceToken(value)
    : null;
}

export function normalizePlanReviewCreateRequest(
  input: unknown,
): PlanReviewRequestNormalization<NormalizedPlanReviewCreateRequestV1> {
  const value = record(input);
  const fields = ["schemaVersion", "requestId", "taskId", "reason", "createdAt", "actor", "locator"];
  if (value === null || !closed(value, fields)) {
    return failure("invalid Plan Review create request", "unsupported_field");
  }
  if (value.schemaVersion !== PLAN_REVIEW_CREATE_REQUEST_ID) {
    return failure("invalid Plan Review create request", "invalid_schema_version");
  }
  if (!validIdentifier(value.requestId) || !validIdentifier(value.taskId)) {
    return failure("invalid Plan Review create request", "invalid_identity");
  }
  if (!nonemptyWithin(value.reason, PLAN_REVIEW_SOURCE_LIMITS.reasonUtf8Bytes)) {
    return failure("invalid Plan Review create request", "invalid_reason");
  }
  const createdAt = canonicalDateTime(value.createdAt);
  if (createdAt === null) {
    return failure("invalid Plan Review create request", "invalid_created_at");
  }
  if (!validIdentifier(value.actor)) {
    return failure("invalid Plan Review create request", "invalid_actor");
  }
  if (
    value.locator !== undefined &&
    (typeof value.locator !== "string" ||
      encoder.encode(value.locator).byteLength > PLAN_REVIEW_SOURCE_LIMITS.locatorUtf8Bytes)
  ) {
    return failure("invalid Plan Review create request", "invalid_locator");
  }
  return Object.freeze({
    ok: true,
    request: Object.freeze({
      schemaVersion: PLAN_REVIEW_CREATE_REQUEST_ID,
      requestId: value.requestId,
      taskId: value.taskId,
      reason: value.reason,
      createdAt,
      actor: value.actor,
      locator: (value.locator as string | undefined) ?? null,
    }),
    diagnostics: Object.freeze([]),
  });
}

function normalizedBatch(input: unknown): Readonly<{
  request: BatchMutation;
  canonical: string;
  digest: string;
}> | null {
  const value = record(input);
  if (value === null || !closed(value, ["kind", "mutations"]) || value.kind !== "batch" ||
      !Array.isArray(value.mutations) || value.mutations.length === 0 ||
      value.mutations.length > 10_000) return null;
  if (value.mutations.some((item) => {
    const mutation = record(item);
    return mutation === null || typeof mutation.kind !== "string" ||
      mutation.kind.startsWith("plan_review.") || !closedAtomicMutation(mutation);
  })) return null;
  try {
    const canonical = rfc8785Json(value);
    if (encoder.encode(canonical).byteLength > 8_388_608) return null;
    return Object.freeze({
      request: value as unknown as BatchMutation,
      canonical,
      digest: sha256DigestUtf8(canonical),
    });
  } catch {
    return null;
  }
}

const atomicFields = Object.freeze<Record<string, readonly string[]>>({
  "project.set": ["kind", "set", "clear"],
  "task.add": ["kind", "id", "from", "to", "task"],
  "task.set": ["kind", "id", "from", "to", "set", "clear", "addTags", "removeTags", "upsertRequirements", "removeRequirements"],
  "task.remove": ["kind", "id"],
  "task.finish": ["kind", "id"],
  "gate.add": ["kind", "id", "from", "to", "gate"],
  "gate.set": ["kind", "id", "from", "to", "set"],
  "gate.remove": ["kind", "id"],
  "milestone.add": ["kind", "id", "milestone"],
  "milestone.set": ["kind", "id", "set", "clear", "addTags", "removeTags"],
  "milestone.remove": ["kind", "id"],
  "resource.add": ["kind", "id", "resource"],
  "resource.set": ["kind", "id", "set", "clear"],
  "resource.remove": ["kind", "id"],
});

const nestedFields = Object.freeze<Record<string, readonly string[]>>({
  projectSet: ["id", "version", "title", "description", "asOf", "durationUnit", "velocity", "finish", "goalOwner", "goalDelegates", "dagOwner", "dagDelegates", "criticalEpsilon", "targetDuration"],
  task: ["title", "description", "duration", "estimate", "notBefore", "deadline", "status", "priority", "requirements", "owner", "tags", "blockedReason", "source"],
  taskSet: ["title", "description", "duration", "estimate", "notBefore", "deadline", "status", "priority", "owner", "blockedReason", "source"],
  estimate: ["optimistic", "mostLikely", "pessimistic"],
  requirement: ["resourceId", "units"],
  gate: ["reason"],
  milestone: ["title", "description", "state", "deadline", "tags"],
  milestoneSet: ["title", "description", "state", "deadline"],
  resource: ["title", "capacity", "description"],
  resourceSet: ["title", "description", "capacity"],
});

function closedOptionalObject(value: unknown, fields: readonly string[]): boolean {
  if (value === undefined) return true;
  const object = record(value);
  return object !== null && closed(object, fields);
}

function closedObjectArray(value: unknown, fields: readonly string[]): boolean {
  return value === undefined || (Array.isArray(value) && value.every((item) => {
    const object = record(item);
    return object !== null && closed(object, fields);
  }));
}

function taskMutationFieldsClosed(value: InputRecord, addition: boolean): boolean {
  const item = addition ? value["task"] : value["set"];
  const fields = addition ? nestedFields["task"]! : nestedFields["taskSet"]!;
  if (!closedOptionalObject(item, fields)) return false;
  const itemRecord = item === undefined ? null : record(item);
  if (itemRecord !== null &&
      !closedOptionalObject(itemRecord["estimate"], nestedFields["estimate"]!)) return false;
  if (itemRecord !== null &&
      !closedObjectArray(itemRecord["requirements"], nestedFields["requirement"]!)) return false;
  return closedObjectArray(value["upsertRequirements"], nestedFields["requirement"]!);
}

function namedMutationFieldsClosed(
  value: InputRecord,
  addition: boolean,
  additionField: string,
  additionShape: string,
  setShape: string,
): boolean {
  const item = addition ? value[additionField] : value["set"];
  return closedOptionalObject(
    item,
    nestedFields[addition ? additionShape : setShape]!,
  );
}

function closedAtomicMutation(value: InputRecord): boolean {
  const kind = typeof value.kind === "string" ? value.kind : "";
  const fields = atomicFields[kind];
  if (fields === undefined || !closed(value, fields)) return false;
  if (kind === "project.set") {
    return closedOptionalObject(value["set"], nestedFields["projectSet"]!);
  }
  if (kind === "task.add" || kind === "task.set") {
    return taskMutationFieldsClosed(value, kind === "task.add");
  }
  if (kind === "gate.add" || kind === "gate.set") {
    return namedMutationFieldsClosed(value, kind === "gate.add", "gate", "gate", "gate");
  }
  if (kind === "milestone.add" || kind === "milestone.set") {
    return namedMutationFieldsClosed(
      value, kind === "milestone.add", "milestone", "milestone", "milestoneSet",
    );
  }
  if (kind === "resource.add" || kind === "resource.set") {
    return namedMutationFieldsClosed(
      value, kind === "resource.add", "resource", "resource", "resourceSet",
    );
  }
  return true;
}

interface ResolveBasics {
  readonly requestId: string;
  readonly outcome: "plan_retained" | "plan_changed";
  readonly resolvedAt: string;
  readonly actor: string;
  readonly resolutionReason: string;
}

function resolveBasics(value: InputRecord): ResolveBasics | string {
  if (value.schemaVersion !== PLAN_REVIEW_RESOLVE_REQUEST_ID) return "invalid_schema_version";
  if (!validIdentifier(value.requestId)) return "invalid_request_id";
  if (value.outcome !== "plan_retained" && value.outcome !== "plan_changed") return "invalid_outcome";
  const resolvedAt = canonicalDateTime(value.resolvedAt);
  if (resolvedAt === null) return "invalid_resolved_at";
  if (!validIdentifier(value.actor)) return "invalid_actor";
  if (!nonemptyWithin(value.resolutionReason, PLAN_REVIEW_SOURCE_LIMITS.resolutionReasonUtf8Bytes)) {
    return "invalid_resolution_reason";
  }
  return Object.freeze({
    requestId: value.requestId,
    outcome: value.outcome,
    resolvedAt,
    actor: value.actor,
    resolutionReason: value.resolutionReason,
  });
}

function acceptedOwners(value: unknown): readonly string[] | null {
  const accepted = value ?? [];
  if (!Array.isArray(accepted) || accepted.some((owner) => !validIdentifier(owner))) return null;
  if (new Set(accepted).size !== accepted.length) return null;
  return Object.freeze([...(accepted as string[])].sort(compareStableStrings));
}

function resolveBatch(
  outcome: ResolveBasics["outcome"],
  request: unknown,
): ReturnType<typeof normalizedBatch> | "invalid" {
  if (outcome === "plan_retained") return request === undefined ? null : "invalid";
  return normalizedBatch(request) ?? "invalid";
}

export function normalizePlanReviewResolveRequest(
  input: unknown,
): PlanReviewRequestNormalization<NormalizedPlanReviewResolveRequestV1> {
  const value = record(input);
  const fields = ["schemaVersion", "requestId", "outcome", "resolvedAt", "actor", "resolutionReason", "acceptedOwners", "request"];
  if (value === null || !closed(value, fields)) {
    return failure("invalid Plan Review resolve request", "unsupported_field");
  }
  const basics = resolveBasics(value);
  if (typeof basics === "string") {
    return failure("invalid Plan Review resolve request", basics);
  }
  const accepted = acceptedOwners(value.acceptedOwners);
  if (accepted === null) {
    return failure("invalid Plan Review resolve request", "invalid_accepted_owner");
  }
  const batch = resolveBatch(basics.outcome, value.request);
  if (batch === "invalid") {
    return failure("invalid Plan Review resolve request", "invalid_change_request");
  }
  return Object.freeze({
    ok: true,
    request: Object.freeze({
      schemaVersion: PLAN_REVIEW_RESOLVE_REQUEST_ID,
      ...basics,
      acceptedOwners: accepted,
      request: batch?.request ?? null,
      canonicalChangeRequest: batch?.canonical ?? null,
      changeRequestDigest: batch?.digest ?? null,
    }),
    diagnostics: Object.freeze([]),
  });
}

export function isSha256Digest(value: string): boolean {
  return digestPattern.test(value);
}
