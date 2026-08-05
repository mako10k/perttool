import { instantKey } from "../model/calendar-arithmetic.js";
import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import { compareStableStrings } from "../model/diagnostics.js";
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
import type { TargetGrammar5ValidatedDocument } from "../semantic/target-validator.js";
import {
  projectActualsSourceModel,
  workEventsForTask,
  type ActualWorkEvent,
} from "./source.js";

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
