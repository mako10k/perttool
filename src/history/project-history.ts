import { sha256DigestUtf8 } from "../model/sha256.js";
import {
  reduceTaskLifecycle,
  type ActualsCoverage,
} from "../actuals/lifecycle.js";
import {
  projectActualsSourceModel,
  type ActualWorkEvent,
} from "../actuals/source.js";
import { instantKey } from "../model/calendar-arithmetic.js";
import {
  compareStableStrings,
  sortDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import {
  add,
  divide,
  formatDecimal,
  multiply,
  rational,
  rationalFromDuration,
  subtract,
  type Rational,
} from "../model/rational.js";
import type {
  DeclarationNode,
  DocumentNode,
  ExactDurationValue,
  TargetDeclarationKind,
  WorkEventKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  projectDeclaredCalendarValue,
  type TargetCalendarValue,
} from "../model/target-calendar.js";
import type {
  GitHistoryAvailability,
  GitHistoryProbeResult,
  PlanRevisionSnapshot,
} from "./git-probe.js";
import type {
  TargetGrammar5Capability,
  TargetGrammar6Capability,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar5Document,
  validateTargetGrammar6Document,
  type TargetGrammar5ValidatedDocument,
} from "../semantic/target-validator.js";

export const PROJECT_HISTORY_MODEL_VERSION = 1 as const;

export type ProjectHistoryStatus =
  | "complete"
  | "incomplete"
  | "unavailable";

export type ProjectHistoryCauseId =
  | "no_repository"
  | "no_head"
  | "unknown_revision"
  | "untracked_target"
  | "ambiguous_path"
  | "shallow_boundary"
  | "unsupported_rename"
  | "unsupported_source_version"
  | "task_identity_replaced"
  | "event_payload_changed"
  | "duplicate_event_identity"
  | "head_changed"
  | "target_changed";

export type ActualsCauseId =
  | "missing_start"
  | "missing_finish"
  | "open_suspension"
  | "missing_baseline"
  | "active_time_absent"
  | "effort_absent"
  | "history_incomplete"
  | "history_unavailable";

export type RecordedTaskState =
  | "absent"
  | "planned"
  | "active"
  | "blocked"
  | "suspended"
  | "done";

export interface HistoryRequest {
  readonly taskIds?: readonly string[];
}

export interface ProjectHistoryCause {
  readonly cause: ProjectHistoryCauseId;
  readonly commitId: string | null;
  readonly taskId: string | null;
  readonly eventId: string | null;
}

export interface ActualsCause {
  readonly cause: ActualsCauseId;
  readonly commitId: string | null;
  readonly taskId: string | null;
  readonly eventId: string | null;
}

export type ActualQuantityUnit =
  | "day"
  | "hour"
  | "point"
  | "person_hour";

export interface ActualQuantity {
  readonly numerator: string;
  readonly denominator: string;
  readonly unit: ActualQuantityUnit;
  readonly display: string;
}

export interface WorkEventProjection {
  readonly modelVersion: 1;
  readonly id: string;
  readonly taskId: string;
  readonly kind: WorkEventKind;
  readonly occurredAt: TargetCalendarValue;
  readonly plannedValue: ActualQuantity | null;
  readonly activeTime: ActualQuantity | null;
  readonly effort: ActualQuantity | null;
  readonly reason: string | null;
}

export interface WorkEventHistory {
  readonly event: WorkEventProjection;
  readonly evidenceClass: "declared_actual";
  readonly firstSeenCommitId: string;
  readonly lastSeenCommitId: string;
  readonly removalCommitId: string | null;
  readonly payloadDigest: string;
}

export interface GitRecordedTransition {
  readonly taskId: string;
  readonly fromState: RecordedTaskState;
  readonly toState: RecordedTaskState;
  readonly commitId: string;
  readonly recordedAt: TargetCalendarValue | null;
  readonly sourceDigest: string;
  readonly evidenceClass: "git_recorded_transition";
}

export interface SuspensionInterval {
  readonly suspendEventId: string;
  readonly resumeEventId: string | null;
  readonly start: TargetCalendarValue;
  readonly finish: TargetCalendarValue | null;
  readonly duration: ActualQuantity | null;
}

export interface TaskActualSummary {
  readonly taskId: string;
  readonly coverage: ActualsCoverage;
  readonly eventIds: readonly string[];
  readonly firstStart: TargetCalendarValue | null;
  readonly lastFinish: TargetCalendarValue | null;
  readonly suspensionIntervals: readonly SuspensionInterval[];
  readonly cycleTime: ActualQuantity | null;
  readonly derivedActiveTime: ActualQuantity | null;
  readonly explicitActiveTime: ActualQuantity | null;
  readonly effort: ActualQuantity | null;
  readonly plannedValue: ActualQuantity | null;
  readonly baselineSource: "start_baseline" | "finish_snapshot" | null;
  readonly baselineEventId: string | null;
  readonly baselineCommitId: string | null;
  readonly qualifiers: readonly string[];
  readonly unavailableCauses: readonly ActualsCause[];
}

export interface ProjectHistoryMetadata {
  readonly id: "perttool.project-history";
  readonly version: 1;
  readonly status: ProjectHistoryStatus;
  readonly traversal: "first_parent";
  readonly repositorySnapshotId: string | null;
  readonly repositoryRelativePath: string | null;
  readonly requestedRevision: string;
  readonly resolvedRevision: string | null;
  readonly sourceDigest: string | null;
  readonly inspectedCommitIds: readonly string[];
  readonly unavailableCauses: readonly ProjectHistoryCause[];
}

export interface ProjectHistoryCoreResultFor<GrammarVersion extends number> {
  readonly ok: boolean;
  readonly modelVersion: typeof PROJECT_HISTORY_MODEL_VERSION;
  readonly documentId: string | null;
  readonly grammarVersion: GrammarVersion | null;
  readonly history: ProjectHistoryMetadata;
  readonly events: readonly WorkEventHistory[];
  readonly gitRecordedTransitions: readonly GitRecordedTransition[];
  readonly tasks: readonly TaskActualSummary[];
  readonly diagnostics: readonly Diagnostic[];
}

export type ProjectHistoryCoreResult = ProjectHistoryCoreResultFor<
  1 | 2 | 3 | 4 | 5 | 6
>;

export interface ProjectHistorySourceValidation<
  GrammarVersion extends number,
> {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: GrammarVersion | null;
  readonly document: DocumentNode<TargetDeclarationKind>;
}

export type ProjectHistorySourceValidator<GrammarVersion extends number> = (
  text: string,
) => ProjectHistorySourceValidation<GrammarVersion>;

interface ParsedTask {
  readonly state: Exclude<RecordedTaskState, "absent">;
  readonly identity: string;
  readonly plannedValue: ActualQuantity;
}

interface ParsedSnapshot<GrammarVersion extends number> {
  readonly snapshot: PlanRevisionSnapshot;
  readonly documentId: string | null;
  readonly grammarVersion: GrammarVersion | null;
  readonly tasks: ReadonlyMap<string, ParsedTask>;
  readonly events: readonly ActualWorkEvent[];
}

interface EventAccumulator {
  readonly event: ActualWorkEvent;
  readonly projection: WorkEventProjection;
  readonly payloadDigest: string;
  readonly firstSeenCommitId: string;
  lastSeenCommitId: string;
  removalCommitId: string | null;
}

const historyCauseOrder: readonly ProjectHistoryCauseId[] = [
  "no_repository",
  "no_head",
  "unknown_revision",
  "untracked_target",
  "ambiguous_path",
  "shallow_boundary",
  "unsupported_rename",
  "unsupported_source_version",
  "task_identity_replaced",
  "event_payload_changed",
  "duplicate_event_identity",
  "head_changed",
  "target_changed",
];

const actualsCauseOrder: readonly ActualsCauseId[] = [
  "missing_start",
  "missing_finish",
  "open_suspension",
  "missing_baseline",
  "active_time_absent",
  "effort_absent",
  "history_incomplete",
  "history_unavailable",
];

const eventKindOrder: Readonly<Record<WorkEventKind, number>> = Object.freeze({
  start: 0,
  suspend: 1,
  resume: 2,
  finish: 3,
});
const identifierPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;

function quantity(
  value: Rational,
  unit: ActualQuantityUnit,
): ActualQuantity {
  return Object.freeze({
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
    unit,
    display: formatDecimal(value, 6),
  });
}

function durationUnit(
  suffix: ExactDurationValue["suffix"],
): Exclude<ActualQuantityUnit, "person_hour"> {
  return suffix === "d" ? "day" : suffix === "h" ? "hour" : "point";
}

function exactDuration(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): ExactDurationValue {
  const field = fieldNamed(declaration, name);
  if (
    field === undefined ||
    field.value === null ||
    typeof field.value !== "object" ||
    !("suffix" in field.value)
  ) {
    throw new Error(`validated task ${declaration.id} is missing ${name}`);
  }
  return field.value as ExactDurationValue;
}

function exactEstimate(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): ExactDurationValue {
  const estimate = fieldNamed(declaration, "estimate");
  const child = estimate?.children?.find(({ name: childName }) =>
    childName === name
  );
  if (
    child === undefined ||
    child.value === null ||
    typeof child.value !== "object" ||
    !("suffix" in child.value)
  ) {
    throw new Error(
      `validated task ${declaration.id} estimate is missing ${name}`,
    );
  }
  return child.value as ExactDurationValue;
}

function taskPlannedValue(
  declaration: DeclarationNode<TargetDeclarationKind>,
): ActualQuantity {
  const estimate = fieldNamed(declaration, "estimate");
  if (estimate === undefined) {
    const duration = exactDuration(declaration, "duration");
    return quantity(rationalFromDuration(duration), durationUnit(duration.suffix));
  }
  const optimistic = exactEstimate(declaration, "optimistic");
  const mostLikely = exactEstimate(declaration, "most_likely");
  const pessimistic = exactEstimate(declaration, "pessimistic");
  const expected = divide(
    add(
      add(
        rationalFromDuration(optimistic),
        multiply(rational(4n), rationalFromDuration(mostLikely)),
      ),
      rationalFromDuration(pessimistic),
    ),
    rational(6n),
  );
  return quantity(expected, durationUnit(optimistic.suffix));
}

function taskState(
  declaration: DeclarationNode<TargetDeclarationKind>,
): Exclude<RecordedTaskState, "absent"> {
  return (fieldNamed(declaration, "status")?.value ?? "planned") as Exclude<
    RecordedTaskState,
    "absent"
  >;
}

function taskIdentity(
  declaration: DeclarationNode<TargetDeclarationKind>,
): string {
  return `${declaration.from ?? ""}\u0000${declaration.to ?? ""}`;
}

function eventQuantity(
  value: { readonly value: Rational } | null,
  unit: ActualQuantityUnit,
): ActualQuantity | null {
  return value === null ? null : quantity(value.value, unit);
}

function eventProjection(event: ActualWorkEvent): WorkEventProjection {
  const occurredAt = projectDeclaredCalendarValue(event.occurredAt);
  if (occurredAt === null) {
    throw new Error("validated work event lost its calendar projection");
  }
  return Object.freeze({
    modelVersion: 1,
    id: event.id,
    taskId: event.taskId,
    kind: event.kind,
    occurredAt,
    plannedValue:
      event.plannedValue === null
        ? null
        : quantity(event.plannedValue.value, event.plannedValue.unit),
    activeTime: eventQuantity(event.activeTime, "hour"),
    effort: eventQuantity(event.effort, "person_hour"),
    reason: event.reason,
  });
}

function payloadDigest(projection: WorkEventProjection): string {
  const payload = JSON.stringify({
    model_version: projection.modelVersion,
    id: projection.id,
    task_id: projection.taskId,
    kind: projection.kind,
    occurred_at: projection.occurredAt,
    planned_value: projection.plannedValue,
    active_time: projection.activeTime,
    effort: projection.effort,
    reason: projection.reason,
  });
  return sha256DigestUtf8(payload);
}

function historyCause(
  cause: ProjectHistoryCauseId,
  fields: Partial<Omit<ProjectHistoryCause, "cause">> = {},
): ProjectHistoryCause {
  return Object.freeze({
    cause,
    commitId: fields.commitId ?? null,
    taskId: fields.taskId ?? null,
    eventId: fields.eventId ?? null,
  });
}

function actualsCause(
  cause: ActualsCauseId,
  taskId: string,
  fields: Partial<Omit<ActualsCause, "cause" | "taskId">> = {},
): ActualsCause {
  return Object.freeze({
    cause,
    commitId: fields.commitId ?? null,
    taskId,
    eventId: fields.eventId ?? null,
  });
}

function diagnostic(
  cause: ProjectHistoryCause,
): Diagnostic {
  const unavailable = new Set<ProjectHistoryCauseId>([
    "no_repository",
    "no_head",
    "unknown_revision",
    "untracked_target",
    "ambiguous_path",
  ]);
  const race = cause.cause === "head_changed" ||
    cause.cause === "target_changed";
  const conflict = cause.cause === "event_payload_changed" ||
    cause.cause === "duplicate_event_identity";
  const code = race
    ? "PTHIS-104"
    : conflict
      ? "PTHIS-103"
      : unavailable.has(cause.cause)
        ? "PTHIS-101"
        : "PTHIS-102";
  const severity = code === "PTHIS-102" ? "warning" : "error";
  const message = code === "PTHIS-104"
    ? "repository snapshot changed during history inspection"
    : code === "PTHIS-103"
      ? "conflicting work-event history"
      : code === "PTHIS-101"
        ? "project history is unavailable"
        : "project history is incomplete";
  return Object.freeze({
    code,
    severity,
    message,
    ...(cause.eventId === null && cause.taskId === null
      ? {}
      : { entityId: cause.eventId ?? cause.taskId! }),
    helpTopic: "actuals",
    data: Object.freeze({
      cause: cause.cause,
      commit_id: cause.commitId,
      task_id: cause.taskId,
      event_id: cause.eventId,
    }),
  });
}

function compareNullable(
  left: string | null,
  right: string | null,
): number {
  return compareStableStrings(left ?? "", right ?? "");
}

function sortedHistoryCauses(
  causes: readonly ProjectHistoryCause[],
): readonly ProjectHistoryCause[] {
  const order = new Map(
    historyCauseOrder.map((cause, index) => [cause, index]),
  );
  const seen = new Set<string>();
  return Object.freeze(
    [...causes]
      .sort((left, right) =>
        order.get(left.cause)! - order.get(right.cause)! ||
        compareNullable(left.commitId, right.commitId) ||
        compareNullable(left.taskId, right.taskId) ||
        compareNullable(left.eventId, right.eventId)
      )
      .filter((cause) => {
        const key = JSON.stringify(cause);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
  );
}

function sortedActualsCauses(
  causes: readonly ActualsCause[],
): readonly ActualsCause[] {
  const order = new Map(
    actualsCauseOrder.map((cause, index) => [cause, index]),
  );
  const seen = new Set<string>();
  return Object.freeze(
    [...causes]
      .sort((left, right) =>
        order.get(left.cause)! - order.get(right.cause)! ||
        compareNullable(left.commitId, right.commitId) ||
        compareNullable(left.taskId, right.taskId) ||
        compareNullable(left.eventId, right.eventId)
      )
      .filter((cause) => {
        const key = JSON.stringify(cause);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
  );
}

function fromProbeAvailability(
  value: GitHistoryAvailability,
): ProjectHistoryCause {
  return historyCause(value.cause, { commitId: value.commitId });
}

function unsupportedSnapshot(
  snapshot: PlanRevisionSnapshot,
): ProjectHistoryCause {
  return historyCause("unsupported_source_version", {
    commitId: snapshot.commitId,
  });
}

function decodeSnapshot(snapshot: PlanRevisionSnapshot): string | null {
  if (snapshot.source === null) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(snapshot.source);
  } catch {
    return null;
  }
}

function parseSnapshot<GrammarVersion extends number>(
  snapshot: PlanRevisionSnapshot,
  validateSource: ProjectHistorySourceValidator<GrammarVersion>,
): {
  readonly parsed: ParsedSnapshot<GrammarVersion> | null;
  readonly causes: readonly ProjectHistoryCause[];
} {
  if (snapshot.source === null) {
    return {
      parsed: {
        snapshot,
        documentId: null,
        grammarVersion: null,
        tasks: new Map(),
        events: Object.freeze([]),
      },
      causes: Object.freeze([]),
    };
  }
  const text = decodeSnapshot(snapshot);
  if (text === null) {
    return {
      parsed: null,
      causes: Object.freeze([unsupportedSnapshot(snapshot)]),
    };
  }
  const checked = validateSource(text);
  const duplicateIds = checked.document.declarations
    .filter(({ kind }) => kind === "work_event")
    .map(({ id }) => id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    return {
      parsed: null,
      causes: Object.freeze(
        [...new Set(duplicateIds)]
          .sort(compareStableStrings)
          .map((eventId) =>
            historyCause("duplicate_event_identity", {
              commitId: snapshot.commitId,
              eventId,
            })
          ),
      ),
    };
  }
  if (
    !checked.ok ||
    checked.grammarVersion === null
  ) {
    return {
      parsed: null,
      causes: Object.freeze([unsupportedSnapshot(snapshot)]),
    };
  }
  const tasks = new Map<string, ParsedTask>();
  for (const declaration of checked.document.declarations) {
    if (declaration.kind !== "task") continue;
    tasks.set(declaration.id, {
      state: taskState(declaration),
      identity: taskIdentity(declaration),
      plannedValue: taskPlannedValue(declaration),
    });
  }
  return {
    parsed: {
      snapshot,
      documentId: checked.documentId,
      grammarVersion: checked.grammarVersion,
      tasks,
      events: projectActualsSourceModel({
        grammarVersion: checked.grammarVersion,
        document: checked.document,
      } as unknown as TargetGrammar5ValidatedDocument).events,
    },
    causes: Object.freeze([]),
  };
}

function compareEvents(left: ActualWorkEvent, right: ActualWorkEvent): number {
  const instantOrder = (
    instantKey(left.occurredAt).numerator *
      instantKey(right.occurredAt).denominator -
    instantKey(right.occurredAt).numerator *
      instantKey(left.occurredAt).denominator
  );
  if (instantOrder !== 0n) return instantOrder < 0n ? -1 : 1;
  return eventKindOrder[left.kind] - eventKindOrder[right.kind] ||
    compareStableStrings(left.id, right.id);
}

function hoursBetween(
  start: ActualWorkEvent,
  finish: ActualWorkEvent,
): ActualQuantity {
  return quantity(
    divide(
      subtract(instantKey(finish.occurredAt), instantKey(start.occurredAt)),
      rational(3_600n),
    ),
    "hour",
  );
}

function suspensionIntervals(
  events: readonly ActualWorkEvent[],
): readonly SuspensionInterval[] {
  const ordered = [...events].sort(compareEvents);
  const result: SuspensionInterval[] = [];
  let suspended: ActualWorkEvent | null = null;
  for (const event of ordered) {
    if (event.kind === "suspend") {
      suspended = event;
      continue;
    }
    if (
      suspended !== null &&
      (event.kind === "resume" || event.kind === "finish")
    ) {
      const start = projectDeclaredCalendarValue(suspended.occurredAt);
      const finish = projectDeclaredCalendarValue(event.occurredAt);
      if (start === null || finish === null) {
        throw new Error("validated suspension interval lost calendar values");
      }
      result.push(Object.freeze({
        suspendEventId: suspended.id,
        resumeEventId: event.kind === "resume" ? event.id : null,
        start,
        finish,
        duration: hoursBetween(suspended, event),
      }));
      suspended = null;
    }
  }
  if (suspended !== null) {
    const start = projectDeclaredCalendarValue(suspended.occurredAt);
    if (start === null) {
      throw new Error("validated open suspension lost its calendar value");
    }
    result.push(Object.freeze({
      suspendEventId: suspended.id,
      resumeEventId: null,
      start,
      finish: null,
      duration: null,
    }));
  }
  return Object.freeze(result);
}

function summaryForTask(
  taskId: string,
  eventEntries: readonly EventAccumulator[],
  transitions: readonly GitRecordedTransition[],
  plannedByCommit: ReadonlyMap<string, ReadonlyMap<string, ActualQuantity>>,
  historyStatus: ProjectHistoryStatus,
  identityReplaced: boolean,
): TaskActualSummary {
  if (identityReplaced) {
    return Object.freeze({
      taskId,
      coverage: "unavailable",
      eventIds: Object.freeze([]),
      firstStart: null,
      lastFinish: null,
      suspensionIntervals: Object.freeze([]),
      cycleTime: null,
      derivedActiveTime: null,
      explicitActiveTime: null,
      effort: null,
      plannedValue: null,
      baselineSource: null,
      baselineEventId: null,
      baselineCommitId: null,
      qualifiers: Object.freeze(["history_incomplete"]),
      unavailableCauses: Object.freeze([
        actualsCause("history_incomplete", taskId),
      ]),
    });
  }
  const entries = eventEntries
    .filter(({ event }) => event.taskId === taskId)
    .sort((left, right) => compareEvents(left.event, right.event));
  const events = entries.map(({ event }) => event);
  const reduction = reduceTaskLifecycle(events);
  const firstStartEntry = entries.find(({ event }) => event.kind === "start") ??
    null;
  const finishEntries = entries.filter(({ event }) => event.kind === "finish");
  const lastFinishEntry = finishEntries.at(-1) ?? null;
  const firstStart = firstStartEntry === null
    ? null
    : projectDeclaredCalendarValue(firstStartEntry.event.occurredAt);
  const lastFinish = lastFinishEntry === null
    ? null
    : projectDeclaredCalendarValue(lastFinishEntry.event.occurredAt);
  const complete = reduction.ok && reduction.coverage === "complete";
  const cycleTime =
    complete && firstStartEntry !== null && lastFinishEntry !== null
      ? hoursBetween(firstStartEntry.event, lastFinishEntry.event)
      : null;
  const finishEvent = lastFinishEntry?.event ?? null;
  const explicitActiveTime = finishEvent === null
    ? null
    : eventQuantity(finishEvent.activeTime, "hour");
  const effort = finishEvent === null
    ? null
    : eventQuantity(finishEvent.effort, "person_hour");
  let plannedValue: ActualQuantity | null = null;
  let baselineSource: TaskActualSummary["baselineSource"] = null;
  let baselineEventId: string | null = null;
  let baselineCommitId: string | null = null;
  if (
    firstStartEntry !== null &&
    firstStartEntry.event.plannedValue !== null
  ) {
    plannedValue = quantity(
      firstStartEntry.event.plannedValue.value,
      firstStartEntry.event.plannedValue.unit,
    );
    baselineSource = "start_baseline";
    baselineEventId = firstStartEntry.event.id;
    baselineCommitId = firstStartEntry.firstSeenCommitId;
  } else if (
    reduction.ok &&
    reduction.coverage === "finish_only" &&
    lastFinishEntry !== null
  ) {
    plannedValue =
      plannedByCommit.get(lastFinishEntry.lastSeenCommitId)?.get(taskId) ??
      null;
    baselineSource = plannedValue === null ? null : "finish_snapshot";
    baselineEventId = plannedValue === null ? null : lastFinishEntry.event.id;
    baselineCommitId =
      plannedValue === null ? null : lastFinishEntry.lastSeenCommitId;
  } else if (
    reduction.ok &&
    reduction.coverage === "unrecorded"
  ) {
    const recordedFinish = transitions
      .filter(
        (transition) =>
          transition.taskId === taskId &&
          transition.toState === "done",
      )
      .at(-1);
    if (recordedFinish !== undefined) {
      plannedValue =
        plannedByCommit.get(recordedFinish.commitId)?.get(taskId) ?? null;
      baselineSource = plannedValue === null ? null : "finish_snapshot";
      baselineCommitId =
        plannedValue === null ? null : recordedFinish.commitId;
    }
  }
  const causes: ActualsCause[] = [];
  const coverage = reduction.ok ? reduction.coverage : "unavailable";
  if (firstStartEntry === null) {
    causes.push(actualsCause("missing_start", taskId));
  }
  if (lastFinishEntry === null) {
    causes.push(actualsCause("missing_finish", taskId));
  }
  if (
    reduction.ok &&
    reduction.coverage === "open" &&
    reduction.state === "suspended"
  ) {
    causes.push(actualsCause("open_suspension", taskId));
  }
  if (plannedValue === null) {
    causes.push(actualsCause("missing_baseline", taskId));
  }
  if (explicitActiveTime === null) {
    causes.push(actualsCause("active_time_absent", taskId));
  }
  if (effort === null) {
    causes.push(actualsCause("effort_absent", taskId));
  }
  if (historyStatus === "incomplete") {
    causes.push(actualsCause("history_incomplete", taskId));
  } else if (historyStatus === "unavailable" || !reduction.ok) {
    causes.push(actualsCause("history_unavailable", taskId));
  }
  const qualifiers = [
    ...(baselineSource === "finish_snapshot" ? ["finish_snapshot"] : []),
    ...(historyStatus === "incomplete" ? ["history_incomplete"] : []),
    ...(historyStatus === "unavailable" ? ["history_unavailable"] : []),
  ];
  return Object.freeze({
    taskId,
    coverage,
    eventIds: Object.freeze(entries.map(({ event }) => event.id)),
    firstStart,
    lastFinish,
    suspensionIntervals: suspensionIntervals(events),
    cycleTime,
    derivedActiveTime:
      reduction.ok && reduction.derivedActiveTime !== null
        ? quantity(reduction.derivedActiveTime, "hour")
        : null,
    explicitActiveTime,
    effort,
    plannedValue,
    baselineSource,
    baselineEventId,
    baselineCommitId,
    qualifiers: Object.freeze(qualifiers),
    unavailableCauses: sortedActualsCauses(causes),
  });
}

function statusForCauses(
  probeStatus: ProjectHistoryStatus,
  causes: readonly ProjectHistoryCause[],
): ProjectHistoryStatus {
  if (
    probeStatus === "unavailable" ||
    causes.some(({ cause }) =>
      cause === "no_repository" ||
      cause === "no_head" ||
      cause === "unknown_revision" ||
      cause === "untracked_target" ||
      cause === "ambiguous_path" ||
      cause === "event_payload_changed" ||
      cause === "duplicate_event_identity" ||
      cause === "head_changed" ||
      cause === "target_changed"
    )
  ) {
    return "unavailable";
  }
  return probeStatus === "incomplete" || causes.length > 0
    ? "incomplete"
    : "complete";
}

function emptyResult<GrammarVersion extends number>(
  probe: GitHistoryProbeResult,
  causes: readonly ProjectHistoryCause[],
): ProjectHistoryCoreResultFor<GrammarVersion> {
  const sortedCauses = sortedHistoryCauses(causes);
  return Object.freeze({
    ok: false,
    modelVersion: PROJECT_HISTORY_MODEL_VERSION,
    documentId: null,
    grammarVersion: null,
    history: Object.freeze({
      id: "perttool.project-history",
      version: 1,
      status: "unavailable",
      traversal: "first_parent",
      repositorySnapshotId: probe.repositorySnapshotId,
      repositoryRelativePath: probe.repositoryRelativePath,
      requestedRevision: probe.requestedRevision,
      resolvedRevision: probe.resolvedRevision,
      sourceDigest: probe.selectedSourceDigest,
      inspectedCommitIds: Object.freeze([...probe.inspectedCommitIds]),
      unavailableCauses: sortedCauses,
    }),
    events: Object.freeze([]),
    gitRecordedTransitions: Object.freeze([]),
    tasks: Object.freeze([]),
    diagnostics: Object.freeze(sortDiagnostics(sortedCauses.map(diagnostic))),
  });
}

function invalidRequestResult<GrammarVersion extends number>(
  probe: GitHistoryProbeResult,
  cause: "duplicate_task" | "invalid_task_id",
  taskId: string | null,
): ProjectHistoryCoreResultFor<GrammarVersion> {
  return Object.freeze({
    ok: false,
    modelVersion: PROJECT_HISTORY_MODEL_VERSION,
    documentId: null,
    grammarVersion: null,
    history: Object.freeze({
      id: "perttool.project-history",
      version: 1,
      status: "unavailable",
      traversal: "first_parent",
      repositorySnapshotId: probe.repositorySnapshotId,
      repositoryRelativePath: probe.repositoryRelativePath,
      requestedRevision: probe.requestedRevision,
      resolvedRevision: probe.resolvedRevision,
      sourceDigest: probe.selectedSourceDigest,
      inspectedCommitIds: Object.freeze([...probe.inspectedCommitIds]),
      unavailableCauses: Object.freeze([]),
    }),
    events: Object.freeze([]),
    gitRecordedTransitions: Object.freeze([]),
    tasks: Object.freeze([]),
    diagnostics: Object.freeze([
      Object.freeze({
        code: "PTCLI-001",
        severity: "error",
        message: "invalid project history task selection",
        ...(taskId === null ? {} : { entityId: taskId }),
        helpTopic: "actuals",
        data: Object.freeze({
          usage_kind: "invalid_option_value",
          cause,
          task_id: taskId,
        }),
      }),
    ]),
  });
}

export function inspectProjectHistoryWithValidator<
  GrammarVersion extends number,
>(
  probe: GitHistoryProbeResult,
  request: HistoryRequest,
  validateSource: ProjectHistorySourceValidator<GrammarVersion>,
): ProjectHistoryCoreResultFor<GrammarVersion> {
  const adapterCauses = probe.availability.map(fromProbeAvailability);
  if (probe.status === "unavailable") {
    return emptyResult(probe, adapterCauses);
  }
  const selectedTaskIds = request.taskIds === undefined
    ? null
    : [...request.taskIds].sort(compareStableStrings);
  if (selectedTaskIds !== null) {
    const invalidTaskId = selectedTaskIds.find(
      (taskId) => !identifierPattern.test(taskId),
    );
    if (invalidTaskId !== undefined) {
      return invalidRequestResult(probe, "invalid_task_id", invalidTaskId);
    }
    const duplicateTaskId = selectedTaskIds.find(
      (taskId, index) => selectedTaskIds.indexOf(taskId) !== index,
    );
    if (duplicateTaskId !== undefined) {
      return invalidRequestResult(probe, "duplicate_task", duplicateTaskId);
    }
  }

  const causes: ProjectHistoryCause[] = [...adapterCauses];
  const transitions: GitRecordedTransition[] = [];
  const eventMap = new Map<string, EventAccumulator>();
  const conflictedEventIds = new Set<string>();
  const eventfulTaskIds = new Set<string>();
  const taskIdentities = new Map<string, string>();
  const replacedTaskIds = new Set<string>();
  const allTaskIds = new Set<string>();
  const plannedByCommit =
    new Map<string, ReadonlyMap<string, ActualQuantity>>();
  let previousTasks = new Map<string, ParsedTask>();
  let previousEventIds = new Set<string>();
  let previousSourceDigest: string | null = null;
  let transitionContinuityKnown = !adapterCauses.some(({ cause }) =>
    cause === "shallow_boundary" || cause === "unsupported_rename"
  );
  let documentId: string | null = null;
  let grammarVersion: GrammarVersion | null = null;

  for (const snapshot of probe.snapshots) {
    const parsedSnapshot = parseSnapshot(snapshot, validateSource);
    causes.push(...parsedSnapshot.causes);
    if (parsedSnapshot.parsed === null) {
      transitionContinuityKnown = false;
      previousEventIds = new Set();
      continue;
    }
    const parsed = parsedSnapshot.parsed;
    if (parsed.documentId !== null) documentId = parsed.documentId;
    if (parsed.grammarVersion !== null) {
      grammarVersion = parsed.grammarVersion;
    }
    plannedByCommit.set(
      snapshot.commitId,
      new Map(
        [...parsed.tasks].map(([taskId, task]) => [
          taskId,
          task.plannedValue,
        ]),
      ),
    );
    const replacedInSnapshot = new Set<string>();
    for (const [taskId, task] of parsed.tasks) {
      allTaskIds.add(taskId);
      const priorIdentity = taskIdentities.get(taskId);
      if (priorIdentity !== undefined && priorIdentity !== task.identity) {
        causes.push(historyCause("task_identity_replaced", {
          commitId: snapshot.commitId,
          taskId,
        }));
        replacedTaskIds.add(taskId);
        replacedInSnapshot.add(taskId);
        taskIdentities.set(taskId, task.identity);
      } else if (priorIdentity === undefined) {
        taskIdentities.set(taskId, task.identity);
      }
    }

    const currentEventsById = new Map(
      parsed.events.map((event) => [event.id, event]),
    );
    for (const eventId of previousEventIds) {
      if (currentEventsById.has(eventId)) continue;
      const accumulator = eventMap.get(eventId);
      if (
        accumulator !== undefined &&
        accumulator.removalCommitId === null
      ) {
        accumulator.removalCommitId = snapshot.commitId;
      }
    }
    for (const event of parsed.events) {
      allTaskIds.add(event.taskId);
      eventfulTaskIds.add(event.taskId);
      const projection = eventProjection(event);
      const digest = payloadDigest(projection);
      const existing = eventMap.get(event.id);
      if (existing === undefined) {
        eventMap.set(event.id, {
          event,
          projection,
          payloadDigest: digest,
          firstSeenCommitId: snapshot.commitId,
          lastSeenCommitId: snapshot.commitId,
          removalCommitId: null,
        });
      } else if (
        existing.payloadDigest !== digest ||
        existing.removalCommitId !== null
      ) {
        conflictedEventIds.add(event.id);
        const cause = existing.removalCommitId === null
          ? "event_payload_changed"
          : "duplicate_event_identity";
        causes.push(
          historyCause(cause, {
            commitId: existing.firstSeenCommitId,
            taskId: existing.event.taskId,
            eventId: event.id,
          }),
          historyCause(cause, {
            commitId: snapshot.commitId,
            taskId: event.taskId,
            eventId: event.id,
          }),
        );
      } else {
        existing.lastSeenCommitId = snapshot.commitId;
      }
    }

    const transitionTaskIds = new Set([
      ...previousTasks.keys(),
      ...parsed.tasks.keys(),
    ]);
    for (const taskId of [...transitionTaskIds].sort(compareStableStrings)) {
      const fromState = previousTasks.get(taskId)?.state ?? "absent";
      const toState = parsed.tasks.get(taskId)?.state ?? "absent";
      if (
        !transitionContinuityKnown ||
        fromState === toState ||
        replacedInSnapshot.has(taskId) ||
        eventfulTaskIds.has(taskId)
      ) {
        continue;
      }
      const recordedAt = snapshot.recordedAt === null
        ? null
        : projectDeclaredCalendarValue(snapshot.recordedAt);
      transitions.push(Object.freeze({
        taskId,
        fromState,
        toState,
        commitId: snapshot.commitId,
        recordedAt,
        sourceDigest: snapshot.sourceDigest ?? previousSourceDigest ?? "",
        evidenceClass: "git_recorded_transition",
      }));
    }
    previousTasks = new Map(parsed.tasks);
    previousEventIds = new Set(currentEventsById.keys());
    previousSourceDigest = snapshot.sourceDigest;
    transitionContinuityKnown = true;
  }

  const sortedCauses = sortedHistoryCauses(causes);
  const status = statusForCauses(probe.status, sortedCauses);
  if (status === "unavailable") {
    return emptyResult(probe, sortedCauses);
  }
  const eventEntries = [...eventMap]
    .filter(([eventId]) => !conflictedEventIds.has(eventId))
    .map(([, value]) => value)
    .sort((left, right) =>
      compareStableStrings(left.event.id, right.event.id)
    );
  const historyEvents: readonly WorkEventHistory[] = Object.freeze(
    eventEntries.map((entry) =>
      Object.freeze({
        event: entry.projection,
        evidenceClass: "declared_actual" as const,
        firstSeenCommitId: entry.firstSeenCommitId,
        lastSeenCommitId: entry.lastSeenCommitId,
        removalCommitId: entry.removalCommitId,
        payloadDigest: entry.payloadDigest,
      })
    ),
  );
  const summaryTaskIds = selectedTaskIds ??
    [...allTaskIds].sort(compareStableStrings);
  const tasks = Object.freeze(
    summaryTaskIds.map((taskId) =>
      summaryForTask(
        taskId,
        eventEntries,
        transitions,
        plannedByCommit,
        status,
        replacedTaskIds.has(taskId),
      )
    ),
  );
  const selected = selectedTaskIds === null
    ? () => true
    : (taskId: string) => selectedTaskIds.includes(taskId);
  const filteredEvents = Object.freeze(
    historyEvents.filter(({ event }) => selected(event.taskId)),
  );
  const filteredTransitions = Object.freeze(
    transitions
      .filter(({ taskId }) => selected(taskId))
      .sort((left, right) =>
        probe.inspectedCommitIds.indexOf(left.commitId) -
          probe.inspectedCommitIds.indexOf(right.commitId) ||
        compareStableStrings(left.taskId, right.taskId)
      ),
  );

  return Object.freeze({
    ok: true,
    modelVersion: PROJECT_HISTORY_MODEL_VERSION,
    documentId,
    grammarVersion,
    history: Object.freeze({
      id: "perttool.project-history",
      version: 1,
      status,
      traversal: "first_parent",
      repositorySnapshotId: probe.repositorySnapshotId,
      repositoryRelativePath: probe.repositoryRelativePath,
      requestedRevision: probe.requestedRevision,
      resolvedRevision: probe.resolvedRevision,
      sourceDigest: probe.selectedSourceDigest,
      inspectedCommitIds: Object.freeze([...probe.inspectedCommitIds]),
      unavailableCauses: sortedCauses,
    }),
    events: filteredEvents,
    gitRecordedTransitions: filteredTransitions,
    tasks,
    diagnostics: Object.freeze(sortDiagnostics(sortedCauses.map(diagnostic))),
  });
}

export function inspectProjectHistory(
  probe: GitHistoryProbeResult,
  request: HistoryRequest,
  capability: TargetGrammar5Capability | TargetGrammar6Capability,
): ProjectHistoryCoreResult {
  return inspectProjectHistoryWithValidator(
    probe,
    request,
    (text): ProjectHistorySourceValidation<1 | 2 | 3 | 4 | 5 | 6> => {
      const checked = capability.grammarVersion === 6
        ? validateTargetGrammar6Document(text, capability)
        : validateTargetGrammar5Document(text, capability);
      return {
        ok: checked.ok && checked.validatedDocument !== null,
        documentId: checked.documentId,
        grammarVersion: checked.validatedDocument?.grammarVersion ?? null,
        document:
          checked.validatedDocument?.document ?? checked.document,
      };
    },
  );
}
