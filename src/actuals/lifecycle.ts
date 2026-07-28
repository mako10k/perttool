import { createHash } from "node:crypto";
import {
  canonicalizeEventDateTimeSourceToken,
} from "../model/calendar.js";
import { instantKey } from "../model/calendar-arithmetic.js";
import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import { compareStableStrings } from "../model/diagnostics.js";
import { canonicalizeExactDurationSourceToken } from "../model/exact-duration-source.js";
import { canonicalizeExactPersonHoursSourceToken } from "../model/exact-person-hours-source.js";
import {
  add,
  compare,
  divide,
  rational,
  subtract,
  ZERO,
  type Rational,
} from "../model/rational.js";
import type {
  DeclarationNode,
  TargetDeclarationKind,
  WorkEventKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  projectActualsSourceModel,
  workEventsForTask,
  type ActualWorkEvent,
} from "./source.js";
import type {
  TargetGrammar5ValidatedDocument,
} from "../semantic/target-validator.js";

const identifierPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const eventKindOrder: Readonly<Record<WorkEventKind, number>> = Object.freeze({
  start: 0,
  suspend: 1,
  resume: 2,
  finish: 3,
});

export type TaskLifecycleState =
  | "planned"
  | "active"
  | "blocked"
  | "suspended"
  | "done";

export type ActualsCoverage =
  | "complete"
  | "open"
  | "finish_only"
  | "unrecorded"
  | "unavailable";

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

export interface LifecycleReduction {
  readonly ok: boolean;
  readonly coverage: ActualsCoverage;
  readonly state: "active" | "suspended" | "done" | null;
  readonly derivedActiveTime: Rational | null;
  readonly diagnostics: readonly Diagnostic[];
}

export function actualsDiagnostic(
  code:
    | "PTACT-104"
    | "PTACT-105"
    | "PTACT-106"
    | "PTACT-107"
    | "PTACT-108",
  message: string,
  cause: string,
  entityId: string | null,
  span?: SourceSpan,
  data: Readonly<Record<string, unknown>> = {},
): Diagnostic {
  return Object.freeze({
    code,
    severity: "error",
    message,
    ...(entityId === null ? {} : { entityId }),
    ...(span === undefined ? {} : { span }),
    helpTopic: "syntax.work-event",
    data: Object.freeze({ cause, ...data }),
  });
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
  return `WE-${createHash("sha256").update(payload, "utf8").digest("hex")}`;
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

function eventInstant(event: ActualWorkEvent): Rational {
  return instantKey(event.occurredAt);
}

function compareEvents(left: ActualWorkEvent, right: ActualWorkEvent): number {
  const instantOrder = compare(eventInstant(left), eventInstant(right));
  if (instantOrder !== 0) return instantOrder;
  const kindOrder = eventKindOrder[left.kind] - eventKindOrder[right.kind];
  return kindOrder !== 0
    ? kindOrder
    : compareStableStrings(left.id, right.id);
}

function sequenceFailure(
  event: ActualWorkEvent,
  cause: "invalid_transition" | "duplicate_kind_at_instant" | "event_after_finish",
): LifecycleReduction {
  return Object.freeze({
    ok: false,
    coverage: "unavailable",
    state: null,
    derivedActiveTime: null,
    diagnostics: Object.freeze([
      actualsDiagnostic(
        "PTACT-104",
        "invalid work-event lifecycle sequence",
        cause,
        event.id,
        event.idSpan,
      ),
    ]),
  });
}

export function reduceTaskLifecycle(
  events: readonly ActualWorkEvent[],
): LifecycleReduction {
  if (events.length === 0) {
    return Object.freeze({
      ok: true,
      coverage: "unrecorded",
      state: null,
      derivedActiveTime: null,
      diagnostics: Object.freeze([]),
    });
  }
  const ordered = [...events].sort(compareEvents);
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const current = ordered[index]!;
    if (
      compare(eventInstant(previous), eventInstant(current)) === 0 &&
      previous.kind === current.kind
    ) {
      return sequenceFailure(current, "duplicate_kind_at_instant");
    }
  }

  let state: "active" | "suspended" | "done" | null = null;
  let coverage: ActualsCoverage = "open";
  let activeIntervalStart: Rational | null = null;
  let derivedActiveTime = ZERO;
  for (const [index, event] of ordered.entries()) {
    const instant = eventInstant(event);
    if (state === "done") return sequenceFailure(event, "event_after_finish");
    switch (event.kind) {
      case "start":
        if (index !== 0 || state !== null) {
          return sequenceFailure(event, "invalid_transition");
        }
        state = "active";
        activeIntervalStart = instant;
        break;
      case "suspend":
        if (state !== "active" || activeIntervalStart === null) {
          return sequenceFailure(event, "invalid_transition");
        }
        derivedActiveTime = add(
          derivedActiveTime,
          subtract(instant, activeIntervalStart),
        );
        if (derivedActiveTime.numerator < 0n) {
          return sequenceFailure(event, "invalid_transition");
        }
        state = "suspended";
        activeIntervalStart = null;
        break;
      case "resume":
        if (state !== "suspended") {
          return sequenceFailure(event, "invalid_transition");
        }
        state = "active";
        activeIntervalStart = instant;
        break;
      case "finish":
        if (index === 0 && state === null) {
          state = "done";
          coverage = "finish_only";
          break;
        }
        if (state !== "active" && state !== "suspended") {
          return sequenceFailure(event, "invalid_transition");
        }
        if (state === "active" && activeIntervalStart !== null) {
          derivedActiveTime = add(
            derivedActiveTime,
            subtract(instant, activeIntervalStart),
          );
          if (derivedActiveTime.numerator < 0n) {
            return sequenceFailure(event, "invalid_transition");
          }
        }
        state = "done";
        activeIntervalStart = null;
        coverage = "complete";
        break;
    }
  }
  return Object.freeze({
    ok: true,
    coverage,
    state,
    derivedActiveTime:
      coverage === "complete"
        ? divide(derivedActiveTime, rational(3_600n))
        : null,
    diagnostics: Object.freeze([]),
  });
}

export function taskStatus(
  task: DeclarationNode<TargetDeclarationKind>,
): TaskLifecycleState {
  return (fieldNamed(task, "status")?.value ?? "planned") as TaskLifecycleState;
}

export function taskStatusSpan(
  task: DeclarationNode<TargetDeclarationKind>,
): SourceSpan {
  return fieldNamed(task, "status")?.valueSpan ?? task.idSpan;
}

export function validateStoredLifecycleState(
  validated: TargetGrammar5ValidatedDocument,
): readonly Diagnostic[] {
  const model = projectActualsSourceModel(validated);
  const diagnostics: Diagnostic[] = [];
  for (const task of validated.document.declarations) {
    if (task.kind !== "task") continue;
    const events = workEventsForTask(model, task.id);
    const reduction = reduceTaskLifecycle(events);
    if (!reduction.ok) {
      diagnostics.push(...reduction.diagnostics);
      continue;
    }
    if (reduction.coverage === "unrecorded") continue;
    const stored = taskStatus(task);
    if (reduction.state !== stored) {
      diagnostics.push(
        actualsDiagnostic(
          "PTACT-104",
          "invalid work-event lifecycle sequence",
          "state_event_mismatch",
          task.id,
          taskStatusSpan(task),
          {
            stored_state: stored,
            event_state: reduction.state,
          },
        ),
      );
      continue;
    }
    if (reduction.coverage !== "complete") continue;
    const finish = events.find(({ kind }) => kind === "finish");
    if (
      finish?.activeTime !== null &&
      finish?.activeTime !== undefined &&
      reduction.derivedActiveTime !== null &&
      compare(finish.activeTime.value, reduction.derivedActiveTime) !== 0
    ) {
      diagnostics.push(
        actualsDiagnostic(
          "PTACT-107",
          "explicit active time differs from the event-derived active time",
          "active_time_mismatch",
          finish.id,
          finish.activeTime.valueSpan,
          {
            explicit_numerator: finish.activeTime.value.numerator.toString(),
            explicit_denominator: finish.activeTime.value.denominator.toString(),
            derived_numerator: reduction.derivedActiveTime.numerator.toString(),
            derived_denominator:
              reduction.derivedActiveTime.denominator.toString(),
          },
        ),
      );
    }
  }
  return Object.freeze(diagnostics);
}
