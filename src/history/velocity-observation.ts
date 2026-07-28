import {
  civilDayNumber,
} from "../model/calendar-arithmetic.js";
import {
  compareStableStrings,
  type Diagnostic,
} from "../model/diagnostics.js";
import { serializeExactDurationSource } from "../model/exact-duration-source.js";
import {
  ONE,
  ZERO,
  add,
  compare,
  divide,
  formatDecimal,
  rational,
  subtract,
  type Rational,
} from "../model/rational.js";
import type { TargetCalendarValue } from "../model/target-calendar.js";
import type {
  ActualQuantity,
  GitRecordedTransition,
  ProjectHistoryCoreResult,
  TaskActualSummary,
} from "./project-history.js";

export const VELOCITY_OBSERVATION_MODEL_VERSION = 1 as const;

export type VelocityObservationEvidence =
  | "declared"
  | "git_recorded"
  | "all";

export interface VelocityObservationRequest {
  readonly taskIds?: readonly string[];
  readonly evidence?: VelocityObservationEvidence;
}

export type VelocityObservationMeasure =
  | "elapsed_hour_throughput"
  | "active_date_throughput"
  | "effort_productivity"
  | "git_recorded_elapsed_hour_throughput";

export type ObservationCauseId =
  | "no_selected_tasks"
  | "no_complete_sequence"
  | "non_positive_window"
  | "mixed_offsets"
  | "incomplete_active_intervals"
  | "missing_effort"
  | "missing_baseline"
  | "history_incomplete"
  | "history_unavailable"
  | "git_recorded_start_missing"
  | "git_recorded_finish_missing";

export interface ObservationCause {
  readonly cause: ObservationCauseId;
  readonly taskId: string | null;
  readonly eventId: string | null;
  readonly commitId: string | null;
}

export interface VelocityExcludedTask {
  readonly taskId: string;
  readonly causes: readonly ObservationCause[];
}

export interface VelocityBaselineSource {
  readonly taskId: string;
  readonly source: "start_baseline" | "finish_snapshot";
  readonly eventId: string | null;
  readonly commitId: string | null;
}

export type VelocityRateUnit =
  | "point_per_hour"
  | "point_per_day"
  | "point_per_person_hour";

export interface VelocityRate {
  readonly numerator: string;
  readonly denominator: string;
  readonly unit: VelocityRateUnit;
}

export interface VelocityCandidate {
  readonly id: string;
  readonly measure: VelocityObservationMeasure;
  readonly evidenceClass:
    | "declared_actual"
    | "git_recorded_transition";
  readonly state: "available" | "unavailable";
  readonly numerator: ActualQuantity | null;
  readonly denominator: ActualQuantity | null;
  readonly rate: VelocityRate | null;
  readonly adoptableVelocityToken: string | null;
  readonly includedTaskIds: readonly string[];
  readonly excluded: readonly VelocityExcludedTask[];
  readonly observationStart: TargetCalendarValue | null;
  readonly observationFinish: TargetCalendarValue | null;
  readonly baselineSources: readonly VelocityBaselineSource[];
  readonly qualifiers: readonly string[];
  readonly unavailableCauses: readonly ObservationCause[];
}

export interface VelocityObservationMetadata {
  readonly id: "perttool.velocity-observation";
  readonly version: typeof VELOCITY_OBSERVATION_MODEL_VERSION;
  readonly historyModelVersion: 1;
  readonly selectedTaskIds: readonly string[];
  readonly evidence: VelocityObservationEvidence;
  readonly candidates: readonly VelocityCandidate[];
}

export interface VelocityObservationCoreResult {
  readonly ok: boolean;
  readonly modelVersion: typeof VELOCITY_OBSERVATION_MODEL_VERSION;
  readonly documentId: string | null;
  readonly grammarVersion: ProjectHistoryCoreResult["grammarVersion"];
  readonly history: ProjectHistoryCoreResult["history"];
  readonly observation: VelocityObservationMetadata;
  readonly diagnostics: readonly Diagnostic[];
}

interface IncludedTask {
  readonly task: TaskActualSummary;
  readonly baseline: Rational;
}

interface TaskSelection {
  readonly included: readonly IncludedTask[];
  readonly excluded: readonly VelocityExcludedTask[];
}

interface CandidateParts {
  readonly id: string;
  readonly measure: VelocityObservationMeasure;
  readonly evidenceClass: VelocityCandidate["evidenceClass"];
  readonly numerator: Rational | null;
  readonly denominator: Rational | null;
  readonly denominatorUnit: "hour" | "day" | "person_hour";
  readonly rateUnit: VelocityRateUnit;
  readonly included: readonly IncludedTask[];
  readonly excluded: readonly VelocityExcludedTask[];
  readonly observationStart: TargetCalendarValue | null;
  readonly observationFinish: TargetCalendarValue | null;
  readonly qualifiers?: readonly string[];
  readonly unavailableCauses: readonly ObservationCause[];
  readonly adoptableUnit?: "hour" | "day";
}

const causeOrder: readonly ObservationCauseId[] = [
  "no_selected_tasks",
  "no_complete_sequence",
  "non_positive_window",
  "mixed_offsets",
  "incomplete_active_intervals",
  "missing_effort",
  "missing_baseline",
  "history_incomplete",
  "history_unavailable",
  "git_recorded_start_missing",
  "git_recorded_finish_missing",
];

function exact(value: ActualQuantity): Rational {
  return rational(BigInt(value.numerator), BigInt(value.denominator));
}

function quantity(
  value: Rational,
  unit: ActualQuantity["unit"],
): ActualQuantity {
  return Object.freeze({
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
    unit,
    display: formatDecimal(value, 6),
  });
}

function observationCause(
  cause: ObservationCauseId,
  fields: Partial<Omit<ObservationCause, "cause">> = {},
): ObservationCause {
  return Object.freeze({
    cause,
    taskId: fields.taskId ?? null,
    eventId: fields.eventId ?? null,
    commitId: fields.commitId ?? null,
  });
}

function sortCauses(
  causes: readonly ObservationCause[],
): readonly ObservationCause[] {
  const order = new Map(
    causeOrder.map((cause, index) => [cause, index]),
  );
  const key = (value: string | null) => value ?? "";
  return Object.freeze([...causes].sort((left, right) =>
    order.get(left.cause)! - order.get(right.cause)! ||
    compareStableStrings(key(left.taskId), key(right.taskId)) ||
    compareStableStrings(key(left.eventId), key(right.eventId)) ||
    compareStableStrings(key(left.commitId), key(right.commitId))
  ));
}

function uniqueCauses(
  causes: readonly ObservationCause[],
): readonly ObservationCause[] {
  const seen = new Set<string>();
  return sortCauses(causes.filter((cause) => {
    const key = [
      cause.cause,
      cause.taskId ?? "",
      cause.eventId ?? "",
      cause.commitId ?? "",
    ].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}

function targetInstant(value: TargetCalendarValue): Rational | null {
  if (value.kind !== "date_time") return null;
  const wholeSeconds =
    civilDayNumber(value) * 86_400n +
    BigInt(value.hour * 3_600 + value.minute * 60) -
    BigInt(value.offsetMinutes * 60);
  return add(
    rational(wholeSeconds),
    rational(
      BigInt(value.second.numerator),
      BigInt(value.second.denominator),
    ),
  );
}

function compareCalendar(
  left: TargetCalendarValue,
  right: TargetCalendarValue,
): number {
  const leftInstant = targetInstant(left);
  const rightInstant = targetInstant(right);
  if (leftInstant === null || rightInstant === null) {
    throw new Error("velocity observation requires fixed-offset date-times");
  }
  return compare(leftInstant, rightInstant);
}

function baselineSource(task: TaskActualSummary): VelocityBaselineSource {
  if (task.baselineSource === null) {
    throw new Error("included velocity task lost its baseline source");
  }
  return Object.freeze({
    taskId: task.taskId,
    source: task.baselineSource,
    eventId: task.baselineEventId,
    commitId: task.baselineCommitId,
  });
}

function unavailableHistoryCauses(
  history: ProjectHistoryCoreResult,
): readonly ObservationCause[] {
  return history.history.status === "incomplete"
    ? Object.freeze([observationCause("history_incomplete")])
    : history.history.status === "unavailable"
      ? Object.freeze([observationCause("history_unavailable")])
      : Object.freeze([]);
}

function excludedTask(
  taskId: string,
  causes: readonly ObservationCause[],
): VelocityExcludedTask {
  return Object.freeze({
    taskId,
    causes: uniqueCauses(causes),
  });
}

function completedSelection(
  tasks: readonly TaskActualSummary[],
): TaskSelection {
  const included: IncludedTask[] = [];
  const excluded: VelocityExcludedTask[] = [];
  for (const task of tasks) {
    const causes: ObservationCause[] = [];
    if (
      task.coverage !== "complete" ||
      task.firstStart === null ||
      task.lastFinish === null
    ) {
      causes.push(observationCause("no_complete_sequence", {
        taskId: task.taskId,
      }));
    }
    if (
      task.plannedValue === null ||
      task.plannedValue.unit !== "point"
    ) {
      causes.push(observationCause("missing_baseline", {
        taskId: task.taskId,
        eventId: task.baselineEventId,
        commitId: task.baselineCommitId,
      }));
    }
    if (causes.length > 0) {
      excluded.push(excludedTask(task.taskId, causes));
      continue;
    }
    included.push(Object.freeze({
      task,
      baseline: exact(task.plannedValue!),
    }));
  }
  return Object.freeze({
    included: Object.freeze(included),
    excluded: Object.freeze(excluded),
  });
}

function effortSelection(
  tasks: readonly TaskActualSummary[],
): TaskSelection {
  const included: IncludedTask[] = [];
  const excluded: VelocityExcludedTask[] = [];
  for (const task of tasks) {
    const causes: ObservationCause[] = [];
    if (task.coverage !== "complete" && task.coverage !== "finish_only") {
      causes.push(observationCause("no_complete_sequence", {
        taskId: task.taskId,
      }));
    }
    if (
      task.plannedValue === null ||
      task.plannedValue.unit !== "point"
    ) {
      causes.push(observationCause("missing_baseline", {
        taskId: task.taskId,
        eventId: task.baselineEventId,
        commitId: task.baselineCommitId,
      }));
    }
    if (task.effort === null || task.effort.unit !== "person_hour") {
      causes.push(observationCause("missing_effort", {
        taskId: task.taskId,
      }));
    }
    if (causes.length > 0) {
      excluded.push(excludedTask(task.taskId, causes));
      continue;
    }
    included.push(Object.freeze({
      task,
      baseline: exact(task.plannedValue!),
    }));
  }
  return Object.freeze({
    included: Object.freeze(included),
    excluded: Object.freeze(excluded),
  });
}

function pointTotal(tasks: readonly IncludedTask[]): Rational {
  return tasks.reduce(
    (total, task) => add(total, task.baseline),
    ZERO,
  );
}

function unavailableFromEmptySelection(
  selectedTaskIds: readonly string[],
  selection: TaskSelection,
): readonly ObservationCause[] {
  if (selectedTaskIds.length === 0) {
    return Object.freeze([observationCause("no_selected_tasks")]);
  }
  if (selection.included.length > 0) return Object.freeze([]);
  return uniqueCauses(
    selection.excluded.flatMap(({ causes }) => causes),
  );
}

function calendarBounds(
  tasks: readonly IncludedTask[],
): {
  readonly start: TargetCalendarValue | null;
  readonly finish: TargetCalendarValue | null;
} {
  let start: TargetCalendarValue | null = null;
  let finish: TargetCalendarValue | null = null;
  for (const { task } of tasks) {
    if (task.firstStart === null || task.lastFinish === null) continue;
    if (start === null || compareCalendar(task.firstStart, start) < 0) {
      start = task.firstStart;
    }
    if (finish === null || compareCalendar(task.lastFinish, finish) > 0) {
      finish = task.lastFinish;
    }
  }
  return Object.freeze({ start, finish });
}

function velocityToken(
  rate: Rational,
  unit: "hour" | "day",
): string | null {
  if (rate.numerator <= 0n) return null;
  return `${
    serializeExactDurationSource(rate, "point").token
  }/${serializeExactDurationSource(ONE, unit).token}`;
}

function candidate(parts: CandidateParts): VelocityCandidate {
  const causes = uniqueCauses(parts.unavailableCauses);
  const rateValue =
    parts.numerator === null ||
      parts.denominator === null ||
      compare(parts.denominator, ZERO) <= 0
      ? null
      : divide(parts.numerator, parts.denominator);
  const available = causes.length === 0 && rateValue !== null;
  return Object.freeze({
    id: parts.id,
    measure: parts.measure,
    evidenceClass: parts.evidenceClass,
    state: available ? "available" : "unavailable",
    numerator:
      parts.numerator === null ? null : quantity(parts.numerator, "point"),
    denominator:
      parts.denominator === null
        ? null
        : quantity(parts.denominator, parts.denominatorUnit),
    rate:
      !available || rateValue === null
        ? null
        : Object.freeze({
            numerator: rateValue.numerator.toString(),
            denominator: rateValue.denominator.toString(),
            unit: parts.rateUnit,
          }),
    adoptableVelocityToken:
      !available ||
        rateValue === null ||
        parts.adoptableUnit === undefined
        ? null
        : velocityToken(rateValue, parts.adoptableUnit),
    includedTaskIds: Object.freeze(
      parts.included.map(({ task }) => task.taskId),
    ),
    excluded: Object.freeze([...parts.excluded]),
    observationStart: parts.observationStart,
    observationFinish: parts.observationFinish,
    baselineSources: Object.freeze(
      parts.included.map(({ task }) => baselineSource(task)),
    ),
    qualifiers: Object.freeze([...(parts.qualifiers ?? [])]),
    unavailableCauses: causes,
  });
}

function elapsedCandidate(
  history: ProjectHistoryCoreResult,
  selectedTaskIds: readonly string[],
  tasks: readonly TaskActualSummary[],
): VelocityCandidate {
  const selection = completedSelection(tasks);
  const bounds = calendarBounds(selection.included);
  let denominator: Rational | null = null;
  const causes = [
    ...unavailableHistoryCauses(history),
    ...unavailableFromEmptySelection(selectedTaskIds, selection),
  ];
  if (bounds.start !== null && bounds.finish !== null) {
    const start = targetInstant(bounds.start)!;
    const finish = targetInstant(bounds.finish)!;
    denominator = divide(subtract(finish, start), rational(3_600n));
    if (compare(denominator, ZERO) <= 0) {
      causes.push(observationCause("non_positive_window"));
    }
  }
  return candidate({
    id: "declared_elapsed_hour_throughput",
    measure: "elapsed_hour_throughput",
    evidenceClass: "declared_actual",
    numerator:
      selection.included.length === 0
        ? null
        : pointTotal(selection.included),
    denominator,
    denominatorUnit: "hour",
    rateUnit: "point_per_hour",
    included: selection.included,
    excluded: selection.excluded,
    observationStart: bounds.start,
    observationFinish: bounds.finish,
    unavailableCauses: causes,
    adoptableUnit: "hour",
  });
}

interface ActiveInterval {
  readonly start: TargetCalendarValue;
  readonly finish: TargetCalendarValue;
}

function activeIntervals(
  task: TaskActualSummary,
): readonly ActiveInterval[] | null {
  if (
    task.coverage !== "complete" ||
    task.firstStart === null ||
    task.lastFinish === null
  ) {
    return null;
  }
  const intervals: ActiveInterval[] = [];
  let start = task.firstStart;
  for (const suspension of task.suspensionIntervals) {
    if (suspension.finish === null) return null;
    const activeFinish = suspension.start;
    if (compareCalendar(activeFinish, start) < 0) return null;
    if (compareCalendar(activeFinish, start) > 0) {
      intervals.push(Object.freeze({ start, finish: activeFinish }));
    }
    start = suspension.finish;
  }
  if (compareCalendar(task.lastFinish, start) < 0) return null;
  if (compareCalendar(task.lastFinish, start) > 0) {
    intervals.push(Object.freeze({ start, finish: task.lastFinish }));
  }
  return Object.freeze(intervals);
}

function isLocalMidnight(value: TargetCalendarValue): boolean {
  return (
    value.kind === "date_time" &&
    value.hour === 0 &&
    value.minute === 0 &&
    BigInt(value.second.numerator) === 0n
  );
}

function activeDateCount(
  intervals: readonly ActiveInterval[],
): Rational {
  const dates = new Set<string>();
  for (const interval of intervals) {
    let first = civilDayNumber(interval.start);
    let last = civilDayNumber(interval.finish);
    if (isLocalMidnight(interval.finish)) last -= 1n;
    while (first <= last) {
      dates.add(first.toString());
      first += 1n;
    }
  }
  return rational(BigInt(dates.size));
}

function activeDateCandidate(
  history: ProjectHistoryCoreResult,
  selectedTaskIds: readonly string[],
  tasks: readonly TaskActualSummary[],
): VelocityCandidate {
  const initial = completedSelection(tasks);
  const included: IncludedTask[] = [];
  const excluded: VelocityExcludedTask[] = [...initial.excluded];
  const intervals: ActiveInterval[] = [];
  for (const item of initial.included) {
    const taskIntervals = activeIntervals(item.task);
    if (taskIntervals === null || taskIntervals.length === 0) {
      excluded.push(excludedTask(item.task.taskId, [
        observationCause("incomplete_active_intervals", {
          taskId: item.task.taskId,
        }),
      ]));
      continue;
    }
    included.push(item);
    intervals.push(...taskIntervals);
  }
  const selection = Object.freeze({
    included: Object.freeze(included),
    excluded: Object.freeze(excluded),
  });
  const bounds = calendarBounds(selection.included);
  const causes = [
    ...unavailableHistoryCauses(history),
    ...unavailableFromEmptySelection(selectedTaskIds, selection),
  ];
  const offsets = new Set(
    intervals.flatMap(({ start, finish }) =>
      [start, finish].flatMap((value) =>
        value.kind === "date_time" ? [value.offsetMinutes] : []
      )
    ),
  );
  if (
    intervals.some(
      ({ start, finish }) =>
        start.kind !== "date_time" || finish.kind !== "date_time",
    )
  ) {
    causes.push(observationCause("incomplete_active_intervals"));
  }
  if (offsets.size > 1) {
    causes.push(observationCause("mixed_offsets"));
  }
  const denominator =
    intervals.length === 0 ||
      offsets.size !== 1 ||
      causes.some(({ cause }) => cause === "incomplete_active_intervals")
      ? null
      : activeDateCount(intervals);
  if (denominator !== null && compare(denominator, ZERO) <= 0) {
    causes.push(observationCause("non_positive_window"));
  }
  return candidate({
    id: "declared_active_date_throughput",
    measure: "active_date_throughput",
    evidenceClass: "declared_actual",
    numerator:
      selection.included.length === 0
        ? null
        : pointTotal(selection.included),
    denominator,
    denominatorUnit: "day",
    rateUnit: "point_per_day",
    included: selection.included,
    excluded: selection.excluded,
    observationStart: bounds.start,
    observationFinish: bounds.finish,
    unavailableCauses: causes,
    adoptableUnit: "day",
  });
}

function effortCandidate(
  history: ProjectHistoryCoreResult,
  selectedTaskIds: readonly string[],
  tasks: readonly TaskActualSummary[],
): VelocityCandidate {
  const selection = effortSelection(tasks);
  const causes = [
    ...unavailableHistoryCauses(history),
    ...unavailableFromEmptySelection(selectedTaskIds, selection),
  ];
  const denominator =
    selection.included.length === 0
      ? null
      : selection.included.reduce(
          (total, { task }) => add(total, exact(task.effort!)),
          ZERO,
        );
  if (denominator !== null && compare(denominator, ZERO) <= 0) {
    causes.push(observationCause("non_positive_window"));
  }
  const qualifiers = selection.included.some(
      ({ task }) => task.baselineSource === "finish_snapshot",
    )
    ? ["finish_snapshot"]
    : [];
  return candidate({
    id: "declared_effort_productivity",
    measure: "effort_productivity",
    evidenceClass: "declared_actual",
    numerator:
      selection.included.length === 0
        ? null
        : pointTotal(selection.included),
    denominator,
    denominatorUnit: "person_hour",
    rateUnit: "point_per_person_hour",
    included: selection.included,
    excluded: selection.excluded,
    observationStart: null,
    observationFinish: null,
    qualifiers,
    unavailableCauses: causes,
  });
}

interface RecordedSample {
  readonly included: IncludedTask;
  readonly start: GitRecordedTransition;
  readonly finish: GitRecordedTransition;
}

function recordedSelection(
  history: ProjectHistoryCoreResult,
  tasks: readonly TaskActualSummary[],
): {
  readonly samples: readonly RecordedSample[];
  readonly selection: TaskSelection;
} {
  const samples: RecordedSample[] = [];
  const included: IncludedTask[] = [];
  const excluded: VelocityExcludedTask[] = [];
  for (const task of tasks) {
    const causes: ObservationCause[] = [];
    if (
      task.plannedValue === null ||
      task.plannedValue.unit !== "point"
    ) {
      causes.push(observationCause("missing_baseline", {
        taskId: task.taskId,
        commitId: task.baselineCommitId,
      }));
    }
    const transitions = history.gitRecordedTransitions.filter(
      ({ taskId }) => taskId === task.taskId,
    );
    let finishIndex = -1;
    for (let index = transitions.length - 1; index >= 0; index -= 1) {
      const transition = transitions[index]!;
      if (
        transition.toState === "done" &&
        transition.recordedAt !== null &&
        (
          task.baselineCommitId === null ||
          transition.commitId === task.baselineCommitId
        )
      ) {
        finishIndex = index;
        break;
      }
    }
    let startIndex = -1;
    for (let index = finishIndex - 1; index >= 0; index -= 1) {
      const transition = transitions[index]!;
      if (transition.toState === "active" && transition.recordedAt !== null) {
        startIndex = index;
        break;
      }
    }
    if (startIndex < 0) {
      causes.push(observationCause("git_recorded_start_missing", {
        taskId: task.taskId,
      }));
    }
    const finish = finishIndex < 0 ? undefined : transitions[finishIndex];
    if (finish === undefined) {
      causes.push(observationCause("git_recorded_finish_missing", {
        taskId: task.taskId,
      }));
    }
    if (causes.length > 0) {
      excluded.push(excludedTask(task.taskId, causes));
      continue;
    }
    const item = Object.freeze({
      task,
      baseline: exact(task.plannedValue!),
    });
    included.push(item);
    samples.push(Object.freeze({
      included: item,
      start: transitions[startIndex]!,
      finish: finish!,
    }));
  }
  return Object.freeze({
    samples: Object.freeze(samples),
    selection: Object.freeze({
      included: Object.freeze(included),
      excluded: Object.freeze(excluded),
    }),
  });
}

function recordedCandidate(
  history: ProjectHistoryCoreResult,
  selectedTaskIds: readonly string[],
  tasks: readonly TaskActualSummary[],
): VelocityCandidate {
  const selected = recordedSelection(history, tasks);
  let start: TargetCalendarValue | null = null;
  let finish: TargetCalendarValue | null = null;
  for (const sample of selected.samples) {
    const sampleStart = sample.start.recordedAt!;
    const sampleFinish = sample.finish.recordedAt!;
    if (start === null || compareCalendar(sampleStart, start) < 0) {
      start = sampleStart;
    }
    if (finish === null || compareCalendar(sampleFinish, finish) > 0) {
      finish = sampleFinish;
    }
  }
  const causes = [
    ...unavailableHistoryCauses(history),
    ...unavailableFromEmptySelection(
      selectedTaskIds,
      selected.selection,
    ),
  ];
  let denominator: Rational | null = null;
  if (start !== null && finish !== null) {
    denominator = divide(
      subtract(targetInstant(finish)!, targetInstant(start)!),
      rational(3_600n),
    );
    if (compare(denominator, ZERO) <= 0) {
      causes.push(observationCause("non_positive_window"));
    }
  }
  return candidate({
    id: "git_recorded_elapsed_hour_throughput",
    measure: "git_recorded_elapsed_hour_throughput",
    evidenceClass: "git_recorded_transition",
    numerator:
      selected.selection.included.length === 0
        ? null
        : pointTotal(selected.selection.included),
    denominator,
    denominatorUnit: "hour",
    rateUnit: "point_per_hour",
    included: selected.selection.included,
    excluded: selected.selection.excluded,
    observationStart: start,
    observationFinish: finish,
    qualifiers: ["recorded_not_actual"],
    unavailableCauses: causes,
  });
}

function observationDiagnostic(
  cause: "duplicate_task" | "unknown_task" | "unsupported_evidence",
  taskId: string | null = null,
): Diagnostic {
  return Object.freeze({
    code: "PTOBS-101",
    severity: "error",
    message: "invalid velocity observation selection",
    ...(taskId === null ? {} : { entityId: taskId }),
    helpTopic: "project.observe-velocity",
    data: Object.freeze({
      cause,
      task_id: taskId,
    }),
  });
}

function failedResult(
  history: ProjectHistoryCoreResult,
  evidence: VelocityObservationEvidence,
  selectedTaskIds: readonly string[],
  diagnostic: Diagnostic,
): VelocityObservationCoreResult {
  return Object.freeze({
    ok: false,
    modelVersion: VELOCITY_OBSERVATION_MODEL_VERSION,
    documentId: history.documentId,
    grammarVersion: history.grammarVersion,
    history: history.history,
    observation: Object.freeze({
      id: "perttool.velocity-observation",
      version: VELOCITY_OBSERVATION_MODEL_VERSION,
      historyModelVersion: 1,
      selectedTaskIds,
      evidence,
      candidates: Object.freeze([]),
    }),
    diagnostics: Object.freeze([diagnostic]),
  });
}

export function observeProjectVelocity(
  history: ProjectHistoryCoreResult,
  request: VelocityObservationRequest = {},
): VelocityObservationCoreResult {
  const evidence = request.evidence ?? "declared";
  if (
    evidence !== "declared" &&
    evidence !== "git_recorded" &&
    evidence !== "all"
  ) {
    return failedResult(
      history,
      "declared",
      Object.freeze([]),
      observationDiagnostic("unsupported_evidence"),
    );
  }
  const requested = request.taskIds === undefined
    ? history.tasks.map(({ taskId }) => taskId)
    : [...request.taskIds];
  const duplicate = requested.find(
    (taskId, index) => requested.indexOf(taskId) !== index,
  );
  const selectedTaskIds = Object.freeze(
    [...new Set(requested)].sort(compareStableStrings),
  );
  if (duplicate !== undefined) {
    return failedResult(
      history,
      evidence,
      selectedTaskIds,
      observationDiagnostic("duplicate_task", duplicate),
    );
  }
  if (history.history.status !== "unavailable") {
    const known = new Set(history.tasks.map(({ taskId }) => taskId));
    const unknown = selectedTaskIds.find((taskId) => !known.has(taskId));
    if (unknown !== undefined) {
      return failedResult(
        history,
        evidence,
        selectedTaskIds,
        observationDiagnostic("unknown_task", unknown),
      );
    }
  }
  const selected = history.tasks
    .filter(({ taskId }) => selectedTaskIds.includes(taskId))
    .sort((left, right) => compareStableStrings(left.taskId, right.taskId));
  const candidates: VelocityCandidate[] = [];
  if (evidence === "declared" || evidence === "all") {
    candidates.push(
      elapsedCandidate(history, selectedTaskIds, selected),
      activeDateCandidate(history, selectedTaskIds, selected),
      effortCandidate(history, selectedTaskIds, selected),
    );
  }
  if (evidence === "git_recorded" || evidence === "all") {
    candidates.push(
      recordedCandidate(history, selectedTaskIds, selected),
    );
  }
  return Object.freeze({
    ok: history.ok,
    modelVersion: VELOCITY_OBSERVATION_MODEL_VERSION,
    documentId: history.documentId,
    grammarVersion: history.grammarVersion,
    history: history.history,
    observation: Object.freeze({
      id: "perttool.velocity-observation",
      version: VELOCITY_OBSERVATION_MODEL_VERSION,
      historyModelVersion: 1,
      selectedTaskIds,
      evidence,
      candidates: Object.freeze(candidates),
    }),
    diagnostics: history.diagnostics,
  });
}
