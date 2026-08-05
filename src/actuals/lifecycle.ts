import { sha256HexUtf8 } from "../model/sha256.js";
import {
  canonicalizeEventDateTimeSourceToken,
} from "../model/calendar.js";
import type { Diagnostic } from "../model/diagnostics.js";
import { canonicalizeExactDurationSourceToken } from "../model/exact-duration-source.js";
import { canonicalizeExactPersonHoursSourceToken } from "../model/exact-person-hours-source.js";
import type { WorkEventKind } from "../model/syntax.js";
import { actualsDiagnostic } from "./reduction.js";
export {
  reduceTaskLifecycle,
  taskStatus,
  taskStatusSpan,
  validateStoredLifecycleState,
} from "./reduction.js";
export { actualsDiagnostic };
export type {
  ActualsCoverage,
  LifecycleReduction,
  TaskLifecycleState,
} from "./reduction.js";

const identifierPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
export interface LifecycleEventInput {
  readonly id?: string;
  readonly occurredAt: string;
  readonly reason?: string;
  readonly activeTime?: string;
  readonly effort?: string;
}

export interface FinishActualsMutation {
  readonly kind: "task.finish.actual";
  readonly taskId: string;
  readonly event: LifecycleEventInput;
}

export interface StartActualsMutation {
  readonly kind: "task.start";
  readonly taskId: string;
  readonly event: LifecycleEventInput;
}

export interface SuspendActualsMutation {
  readonly kind: "task.suspend";
  readonly taskId: string;
  readonly event: LifecycleEventInput;
}

export interface ResumeActualsMutation {
  readonly kind: "task.resume";
  readonly taskId: string;
  readonly event: LifecycleEventInput;
}

export type LifecycleMutation =
  | StartActualsMutation
  | SuspendActualsMutation
  | ResumeActualsMutation
  | FinishActualsMutation;

export type LifecycleMutationKind = LifecycleMutation["kind"];

interface NormalizedLifecycleEventBase {
  readonly id: string;
  readonly occurredAt: string;
}

export type NormalizedLifecycleMutationRequest =
  | {
      readonly kind: "task.start";
      readonly taskId: string;
      readonly event: NormalizedLifecycleEventBase;
    }
  | {
      readonly kind: "task.suspend";
      readonly taskId: string;
      readonly event: NormalizedLifecycleEventBase & {
        readonly reason: string | null;
      };
    }
  | {
      readonly kind: "task.resume";
      readonly taskId: string;
      readonly event: NormalizedLifecycleEventBase;
    }
  | {
      readonly kind: "task.finish.actual";
      readonly taskId: string;
      readonly event: NormalizedLifecycleEventBase & {
        readonly activeTime: string | null;
        readonly effort: string | null;
      };
    };

export type NormalizedFinishActualsRequest = Extract<
  NormalizedLifecycleMutationRequest,
  { readonly kind: "task.finish.actual" }
>;

export type NormalizedStartActualsRequest = Extract<
  NormalizedLifecycleMutationRequest,
  { readonly kind: "task.start" }
>;

export type NormalizedSuspendActualsRequest = Extract<
  NormalizedLifecycleMutationRequest,
  { readonly kind: "task.suspend" }
>;

export type NormalizedResumeActualsRequest = Extract<
  NormalizedLifecycleMutationRequest,
  { readonly kind: "task.resume" }
>;

export interface LifecycleMutationRequestNormalization {
  readonly ok: boolean;
  readonly request: NormalizedLifecycleMutationRequest | null;
  readonly diagnostics: readonly Diagnostic[];
}

export interface FinishActualsRequestNormalization {
  readonly ok: boolean;
  readonly request: NormalizedFinishActualsRequest | null;
  readonly diagnostics: readonly Diagnostic[];
}

function invalidRequest(
  taskId: string | null,
  detail: string,
): LifecycleMutationRequestNormalization {
  return Object.freeze({
    ok: false,
    request: null,
    diagnostics: Object.freeze([
      actualsDiagnostic(
        "PTACT-105",
        "invalid lifecycle mutation request",
        "invalid_request",
        taskId,
        undefined,
        { detail },
      ),
    ]),
  });
}

export function deriveWorkEventId(
  taskId: string,
  kind: WorkEventKind,
  canonicalOccurredAt: string,
): string {
  const payload =
    `perttool.work-event-id.v1\u0000${taskId}\u0000${kind}` +
    `\u0000${canonicalOccurredAt}`;
  return `WE-${sha256HexUtf8(payload)}`;
}

export function normalizeLifecycleMutationRequest(
  input: unknown,
): LifecycleMutationRequestNormalization {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return invalidRequest(null, "request_must_be_object");
  }
  const record = input as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (name) => !["kind", "taskId", "event"].includes(name),
    ) ||
    (
      record["kind"] !== "task.start" &&
      record["kind"] !== "task.suspend" &&
      record["kind"] !== "task.resume" &&
      record["kind"] !== "task.finish.actual"
    ) ||
    typeof record["taskId"] !== "string" ||
    !identifierPattern.test(record["taskId"])
  ) {
    return invalidRequest(
      typeof record["taskId"] === "string" ? record["taskId"] : null,
      "invalid_request_shape",
    );
  }
  const taskId = record["taskId"];
  const event = record["event"];
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    return invalidRequest(taskId, "event_must_be_object");
  }
  const eventRecord = event as Record<string, unknown>;
  const kind = record["kind"] as LifecycleMutationKind;
  const permittedFields: Readonly<Record<
    LifecycleMutationKind,
    ReadonlySet<string>
  >> = {
    "task.start": new Set(["id", "occurredAt"]),
    "task.suspend": new Set(["id", "occurredAt", "reason"]),
    "task.resume": new Set(["id", "occurredAt"]),
    "task.finish.actual": new Set([
      "id",
      "occurredAt",
      "activeTime",
      "effort",
    ]),
  };
  if (
    Object.keys(eventRecord).some(
      (name) => !permittedFields[kind].has(name),
    )
  ) {
    return invalidRequest(
      taskId,
      kind === "task.finish.actual"
        ? "invalid_finish_event_fields"
        : `invalid_${kind.slice("task.".length)}_event_fields`,
    );
  }
  if (typeof eventRecord["occurredAt"] !== "string") {
    return invalidRequest(taskId, "occurred_at_required");
  }
  const occurredAt = canonicalizeEventDateTimeSourceToken(
    eventRecord["occurredAt"],
  );
  if (occurredAt === null) {
    return invalidRequest(taskId, "invalid_occurred_at");
  }
  const requestedId = eventRecord["id"];
  if (
    requestedId !== undefined &&
    (typeof requestedId !== "string" || !identifierPattern.test(requestedId))
  ) {
    return invalidRequest(taskId, "invalid_event_id");
  }
  const eventKind: WorkEventKind =
    kind === "task.finish.actual"
      ? "finish"
      : kind.slice("task.".length) as Exclude<WorkEventKind, "finish">;
  const id = requestedId ?? deriveWorkEventId(taskId, eventKind, occurredAt);
  if (kind === "task.suspend") {
    const reason = eventRecord["reason"];
    if (reason !== undefined && typeof reason !== "string") {
      return invalidRequest(taskId, "invalid_reason");
    }
    return Object.freeze({
      ok: true,
      request: Object.freeze({
        kind,
        taskId,
        event: Object.freeze({
          id,
          occurredAt,
          reason: reason ?? null,
        }),
      }),
      diagnostics: Object.freeze([]),
    });
  }
  if (kind === "task.start" || kind === "task.resume") {
    return Object.freeze({
      ok: true,
      request: Object.freeze({
        kind,
        taskId,
        event: Object.freeze({ id, occurredAt }),
      }),
      diagnostics: Object.freeze([]),
    });
  }
  const activeInput = eventRecord["activeTime"];
  if (activeInput !== undefined && typeof activeInput !== "string") {
    return invalidRequest(taskId, "invalid_active_time");
  }
  const activeTime = activeInput === undefined
    ? null
    : canonicalizeExactDurationSourceToken(activeInput);
  if (
    activeInput !== undefined &&
    (activeTime === null || !activeInput.endsWith("h"))
  ) {
    return invalidRequest(taskId, "invalid_active_time");
  }
  const effortInput = eventRecord["effort"];
  if (effortInput !== undefined && typeof effortInput !== "string") {
    return invalidRequest(taskId, "invalid_effort");
  }
  const effort = effortInput === undefined
    ? null
    : canonicalizeExactPersonHoursSourceToken(effortInput);
  if (effortInput !== undefined && effort === null) {
    return invalidRequest(taskId, "invalid_effort");
  }
  return Object.freeze({
    ok: true,
    request: Object.freeze({
      kind,
      taskId,
      event: Object.freeze({
        id,
        occurredAt,
        activeTime: activeTime?.token ?? null,
        effort,
      }),
    }),
    diagnostics: Object.freeze([]),
  });
}

export function normalizeFinishActualsRequest(
  input: unknown,
): FinishActualsRequestNormalization {
  const normalized = normalizeLifecycleMutationRequest(input);
  if (
    !normalized.ok ||
    normalized.request === null ||
    normalized.request.kind !== "task.finish.actual"
  ) {
    if (normalized.ok && normalized.request !== null) {
      return invalidRequest(
        normalized.request.taskId,
        "invalid_request_shape",
      ) as FinishActualsRequestNormalization;
    }
    return Object.freeze({
      ok: false,
      request: null,
      diagnostics: normalized.diagnostics,
    });
  }
  return normalized as FinishActualsRequestNormalization;
}
