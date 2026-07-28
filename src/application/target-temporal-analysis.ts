import { createHash } from "node:crypto";
import {
  evaluateTemporalDeadlines,
  type DeadlineEvaluation,
  type DeadlineUnavailableCause,
} from "../analysis/temporal-deadline.js";
import {
  analyzeTemporalPrecedenceSchedule,
  type TemporalPrecedenceSchedule,
} from "../analysis/temporal-precedence.js";
import {
  analyzeTemporalResourceSchedule,
  type TemporalResourceSchedule,
} from "../analysis/temporal-resource.js";
import {
  analyzeDocument as analyzeBaseDocument,
  type AnalysisResult,
} from "./analyze.js";
import {
  selectNextTasksFromAnalysis,
  type NextOptions,
  type NextResultV3,
} from "./next.js";
import {
  projectRelativeCalendarValue,
  type CalendarUnavailableCause,
} from "../model/calendar-arithmetic.js";
import type { DeclaredCalendarValue } from "../model/calendar.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import {
  ZERO,
  compare,
  divide,
  multiply,
  rational,
} from "../model/rational.js";
import { fieldNamed } from "../model/syntax.js";
import type { TargetCalendarValue } from "../model/target-calendar.js";
import type { DurationUnit, Velocity } from "../model/units.js";
import type {
  TargetGrammar3Capability,
  TargetGrammar4Capability,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar4Document,
  validateTargetGrammar3Document,
  type TargetGrammar3ValidatedDocument,
  type TargetGrammar4ValidatedDocument,
  type TargetGrammar5ValidatedDocument,
  type TargetValidationOptions,
} from "../semantic/target-validator.js";
import {
  projectTargetTemporalInputs,
  type TargetEffectiveProjection,
  type TargetReleaseInput,
  type TargetTemporalCause,
  type TargetTemporalExactValue,
  type TargetTemporalInputProjection,
} from "./target-temporal-input.js";

type TargetTemporalCapability =
  | TargetGrammar3Capability
  | TargetGrammar4Capability;
type TargetTemporalValidatedDocument =
  | TargetGrammar3ValidatedDocument
  | TargetGrammar4ValidatedDocument
  | TargetGrammar5ValidatedDocument;

function validateTargetTemporalDocument(
  text: string,
  capability: TargetTemporalCapability,
  options: TargetValidationOptions,
) {
  return capability.grammarVersion === 4
    ? validateTargetGrammar4Document(text, capability, options)
    : validateTargetGrammar3Document(text, capability, options);
}

export const TARGET_ANALYSIS_RESULT_SCHEMA_VERSION =
  "Perttool.AnalysisResult.v3" as const;
export const TARGET_NEXT_RESULT_SCHEMA_VERSION =
  "Perttool.NextResult.v4" as const;
export const TARGET_TEMPORAL_INTERFACE_IDENTITY = Object.freeze({
  id: "perttool.temporal-unit-interface" as const,
  version: 2 as const,
});

export interface TargetTemporalPoint {
  readonly state: "not_applicable" | "unavailable" | "available";
  readonly relative: TargetTemporalExactValue | null;
  readonly calendar: TargetCalendarValue | null;
  readonly unavailableCauses:
    readonly (TargetTemporalCause | DeadlineUnavailableCause)[];
}

export interface TargetTemporalScheduleTask {
  readonly taskId: string;
  readonly declaredNotBefore: TargetCalendarValue | null;
  readonly releaseState: TargetReleaseInput["state"];
  readonly releaseBound: TargetTemporalExactValue | null;
  readonly start: TargetTemporalPoint;
  readonly finish: TargetTemporalPoint;
  readonly unavailableCauses:
    readonly (TargetTemporalCause | DeadlineUnavailableCause)[];
}

export interface TargetTemporalScheduleMilestone {
  readonly milestoneId: string;
  readonly reach: TargetTemporalPoint;
  readonly unavailableCauses:
    readonly (TargetTemporalCause | DeadlineUnavailableCause)[];
}

export interface TargetTemporalScheduleProjection {
  readonly state: "absent" | "unavailable" | "available";
  readonly view: "precedence" | "resource";
  readonly algorithm: {
    readonly id: string;
    readonly version: number;
    readonly optimal: boolean | null;
    readonly schedulerId: string | null;
    readonly schedulerVersion: number | null;
  } | null;
  readonly conditionalOnBlocksResolved: boolean;
  readonly blockedTaskIds: readonly string[];
  readonly unavailableCauses:
    readonly (TargetTemporalCause | DeadlineUnavailableCause)[];
  readonly tasks: readonly TargetTemporalScheduleTask[];
  readonly milestones: readonly TargetTemporalScheduleMilestone[];
}

export interface TargetTemporalAnalysis {
  readonly interface: typeof TARGET_TEMPORAL_INTERFACE_IDENTITY;
  readonly calendar: TargetTemporalInputProjection["calendar"];
  readonly deadline: {
    readonly id: "perttool.deadline-evaluation";
    readonly version: 1;
  };
  readonly anchor: TargetCalendarValue | null;
  readonly precedence: TargetTemporalScheduleProjection;
  readonly resource: TargetTemporalScheduleProjection;
  readonly deadlineEvaluations: readonly DeadlineEvaluation[];
}

export interface TargetAnalysisResultV3 {
  readonly schemaVersion: typeof TARGET_ANALYSIS_RESULT_SCHEMA_VERSION;
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly base: AnalysisResult | null;
  readonly temporal: TargetTemporalAnalysis | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface TargetTemporalAnalysisOptions extends TargetValidationOptions {
  readonly capacityOverrides?: ReadonlyMap<string, number>;
  readonly maxPaths?: number;
  readonly precision?: number;
}

export interface TargetTimeEligibilityFact {
  readonly id: string;
  readonly kind: "temporal_release_bound";
  readonly value: {
    readonly state:
      | "eligible"
      | "not_yet_eligible"
      | "not_applicable"
      | "unavailable";
    readonly releaseBound: TargetTemporalExactValue | null;
  };
  readonly entityRefs: readonly {
    readonly kind: "task";
    readonly id: string;
  }[];
}

export interface TargetTimeEligibility {
  readonly state:
    | "eligible"
    | "not_yet_eligible"
    | "not_applicable"
    | "unavailable";
  readonly releaseBound: TargetTemporalExactValue | null;
  readonly explanation: {
    readonly code:
      | "no_not_before"
      | "not_before_reached"
      | "not_before_future"
      | "task_already_started"
      | "temporal_eligibility_unavailable";
    readonly factIds: readonly string[];
  };
  readonly facts: readonly TargetTimeEligibilityFact[];
  readonly unavailableCauses: readonly TargetTemporalCause[];
}

export interface TargetNextTemporalTask {
  readonly taskId: string;
  readonly declaredNotBefore: TargetCalendarValue | null;
  readonly timeEligibility: TargetTimeEligibility;
  readonly taskDeadline: TargetCalendarValue | null;
  readonly destinationMilestoneId: string;
  readonly destinationDeadline: TargetCalendarValue | null;
  readonly precedenceStart: TargetTemporalPoint | null;
  readonly precedenceFinish: TargetTemporalPoint | null;
  readonly resourceStart: TargetTemporalPoint | null;
  readonly resourceFinish: TargetTemporalPoint | null;
  readonly taskDeadlineEvaluation: DeadlineEvaluation | null;
  readonly destinationDeadlineEvaluation: DeadlineEvaluation | null;
}

export interface TargetNextResultV4
  extends Omit<NextResultV3, "groups"> {
  readonly schemaVersion: typeof TARGET_NEXT_RESULT_SCHEMA_VERSION;
  readonly grammarVersion: 1 | 2 | 3 | 4;
  readonly groups: NextResultV3["groups"];
  readonly temporal: {
    readonly authority: {
      readonly policy: "recommendation_v1_plus_release_gate";
      readonly recommendationAlgorithm: {
        readonly id: string;
        readonly version: number;
      };
      readonly deadlineFactsUsedForRanking: false;
      readonly timeEligibleTaskIds: readonly string[];
      readonly timeIneligibleTaskIds: readonly string[];
      readonly timeEligibilityUnavailableTaskIds: readonly string[];
      readonly startableRecommendedTaskIds: readonly string[];
      readonly delayedRecommendedTaskIds: readonly string[];
      readonly unavailableRecommendedTaskIds: readonly string[];
    };
    readonly tasks: readonly TargetNextTemporalTask[];
  };
}

function declaredCalendar(
  value: TargetCalendarValue,
): DeclaredCalendarValue {
  return value.kind === "date"
    ? {
        kind: "date",
        sourceText: value.sourceText ?? "",
        year: value.year,
        month: value.month,
        day: value.day,
      }
    : {
        kind: "date_time",
        sourceText: value.sourceText ?? "",
        year: value.year,
        month: value.month,
        day: value.day,
        hour: value.hour,
        minute: value.minute,
        second: rational(
          BigInt(value.second.numerator),
          BigInt(value.second.denominator),
        ),
        offsetMinutes: value.offsetMinutes,
      };
}

function exactValue(
  value: Rational,
  unit: DurationUnit,
): TargetTemporalExactValue {
  return Object.freeze({
    numerator: value.numerator,
    denominator: value.denominator,
    unit,
  });
}

function projectionVelocity(
  projection: TargetEffectiveProjection,
): Velocity | null {
  return projection.velocity === null
    ? null
    : {
        points: projection.velocity.points,
        period: projection.velocity.period,
        periodUnit: projection.velocity.period.unit,
      };
}

function effectiveRelative(
  value: Rational,
  projection: TargetEffectiveProjection,
): Rational {
  if (projection.baseUnit !== "point") return value;
  const velocity = projectionVelocity(projection)!;
  return multiply(value, divide(velocity.period, velocity.points));
}

function temporalCause(
  cause: CalendarUnavailableCause,
  subjectKind: "task" | "milestone",
  subjectId: string,
  taskId: string | null,
): TargetTemporalCause {
  return Object.freeze({
    cause,
    underlyingCause: null,
    subjectKind,
    subjectId,
    taskId,
  });
}

function temporalPoint(
  value: Rational,
  inputs: TargetTemporalInputProjection,
  subjectKind: "task" | "milestone",
  subjectId: string,
): TargetTemporalPoint {
  if (inputs.anchor === null) {
    return Object.freeze({
      state: "unavailable",
      relative: exactValue(value, inputs.effectiveProjection.baseUnit),
      calendar: null,
      unavailableCauses: Object.freeze([
        temporalCause(
          "missing_temporal_anchor",
          subjectKind,
          subjectId,
          subjectKind === "task" ? subjectId : null,
        ),
      ]),
    });
  }
  const projected = projectRelativeCalendarValue(
    declaredCalendar(inputs.anchor),
    inputs.effectiveProjection.effectiveUnit,
    effectiveRelative(value, inputs.effectiveProjection),
  );
  if (projected.state === "unavailable") {
    return Object.freeze({
      state: "unavailable",
      relative: exactValue(value, inputs.effectiveProjection.baseUnit),
      calendar: null,
      unavailableCauses: Object.freeze(
        projected.unavailableCauses.map((cause) =>
          temporalCause(
            cause,
            subjectKind,
            subjectId,
            subjectKind === "task" ? subjectId : null,
          )
        ),
      ),
    });
  }
  return Object.freeze({
    state: "available",
    relative: exactValue(value, inputs.effectiveProjection.baseUnit),
    calendar: projected.value,
    unavailableCauses: Object.freeze(
      projected.unavailableCauses.map((cause) =>
        temporalCause(
          cause,
          subjectKind,
          subjectId,
          subjectKind === "task" ? subjectId : null,
        )
      ),
    ),
  });
}

function notApplicablePoint(): TargetTemporalPoint {
  return Object.freeze({
    state: "not_applicable",
    relative: null,
    calendar: null,
    unavailableCauses: Object.freeze([]),
  });
}

function hasTemporalSource(inputs: TargetTemporalInputProjection): boolean {
  return (
    inputs.anchor !== null ||
    inputs.milestoneDeadlines.length > 0 ||
    inputs.tasks.some((task) =>
      task.declaredNotBefore !== null || task.deadline !== null
    )
  );
}

export function projectTargetTemporalSchedule(
  validated: TargetTemporalValidatedDocument,
  inputs: TargetTemporalInputProjection,
  schedule: TemporalPrecedenceSchedule | TemporalResourceSchedule,
  view: "precedence" | "resource",
): TargetTemporalScheduleProjection {
  if (!hasTemporalSource(inputs)) {
    return Object.freeze({
      state: "absent",
      view,
      algorithm: null,
      conditionalOnBlocksResolved: false,
      blockedTaskIds: Object.freeze([]),
      unavailableCauses: Object.freeze([]),
      tasks: Object.freeze([]),
      milestones: Object.freeze([]),
    });
  }
  const inputByTask = new Map(
    inputs.tasks.map((task) => [task.taskId, task]),
  );
  const reached = new Set(
    validated.document.declarations
      .filter((declaration) =>
        declaration.kind === "milestone" &&
        fieldNamed(declaration, "state")?.value === "reached"
      )
      .map(({ id }) => id),
  );
  const algorithm = view === "precedence"
    ? {
        id: schedule.algorithm.id,
        version: schedule.algorithm.version,
        optimal: null,
        schedulerId: null,
        schedulerVersion: null,
      }
    : {
        id: schedule.algorithm.id,
        version: schedule.algorithm.version,
        optimal: false,
        schedulerId: "scheduler" in schedule
          ? schedule.scheduler.id
          : "parallel-sgs",
        schedulerVersion: "scheduler" in schedule
          ? schedule.scheduler.version
          : 1,
      };
  if (schedule.state === "unavailable") {
    return Object.freeze({
      state: "unavailable",
      view,
      algorithm: Object.freeze(algorithm),
      conditionalOnBlocksResolved:
        schedule.conditionalOnBlocksResolved,
      blockedTaskIds: schedule.blockedTaskIds,
      unavailableCauses: schedule.unavailableCauses,
      tasks: Object.freeze(inputs.tasks.map((input) =>
        Object.freeze({
          taskId: input.taskId,
          declaredNotBefore: input.declaredNotBefore,
          releaseState: input.release.state,
          releaseBound: input.release.bound,
          start: Object.freeze({
            state: "unavailable" as const,
            relative: null,
            calendar: null,
            unavailableCauses: input.release.unavailableCauses,
          }),
          finish: Object.freeze({
            state: "unavailable" as const,
            relative: null,
            calendar: null,
            unavailableCauses: input.release.unavailableCauses,
          }),
          unavailableCauses: input.release.unavailableCauses,
        })
      )),
      milestones: Object.freeze([]),
    });
  }
  const tasks = schedule.tasks.map((task): TargetTemporalScheduleTask => {
    const input = inputByTask.get(task.id)!;
    const start = task.status === "active"
      ? notApplicablePoint()
      : temporalPoint(task.start, inputs, "task", task.id);
    const finish = temporalPoint(task.finish, inputs, "task", task.id);
    return Object.freeze({
      taskId: task.id,
      declaredNotBefore: input.declaredNotBefore,
      releaseState: input.release.state,
      releaseBound: input.release.bound,
      start,
      finish,
      unavailableCauses: Object.freeze([
        ...input.release.unavailableCauses,
        ...start.unavailableCauses,
        ...finish.unavailableCauses,
      ]),
    });
  });
  const milestones = schedule.milestones.map(
    (milestone): TargetTemporalScheduleMilestone => {
      const reach = reached.has(milestone.id)
        ? notApplicablePoint()
        : temporalPoint(
            milestone.reach,
            inputs,
            "milestone",
            milestone.id,
          );
      return Object.freeze({
        milestoneId: milestone.id,
        reach,
        unavailableCauses: reach.unavailableCauses,
      });
    },
  );
  return Object.freeze({
    state: "available",
    view,
    algorithm: Object.freeze(algorithm),
    conditionalOnBlocksResolved: schedule.conditionalOnBlocksResolved,
    blockedTaskIds: schedule.blockedTaskIds,
    unavailableCauses: Object.freeze([]),
    tasks: Object.freeze(tasks),
    milestones: Object.freeze(milestones),
  });
}

function failure(
  documentId: string | null,
  grammarVersion: number | null,
  diagnostics: readonly Diagnostic[],
  diagnosticsTruncated: boolean,
): TargetAnalysisResultV3 {
  return Object.freeze({
    schemaVersion: TARGET_ANALYSIS_RESULT_SCHEMA_VERSION,
    ok: false,
    documentId,
    grammarVersion,
    base: null,
    temporal: null,
    diagnostics,
    diagnosticsTruncated,
  });
}

export function analyzeTargetTemporalDocument(
  text: string,
  capability: TargetTemporalCapability,
  options: TargetTemporalAnalysisOptions = {},
): TargetAnalysisResultV3 {
  const checked = validateTargetTemporalDocument(text, capability, options);
  if (!checked.ok || checked.validatedDocument === null) {
    return failure(
      checked.documentId,
      checked.grammarVersion,
      checked.diagnostics,
      checked.diagnosticsTruncated,
    );
  }
  const validated = checked.validatedDocument;
  const inputs = projectTargetTemporalInputs(validated);
  const base = analyzeBaseDocument(text, options);
  if (!base.ok || base.document === null) {
    return failure(
      base.documentId,
      validated.grammarVersion,
      base.diagnostics,
      base.diagnosticsTruncated,
    );
  }
  const precedenceSchedule = analyzeTemporalPrecedenceSchedule(
    validated,
    inputs,
  );
  const resourceSchedule = analyzeTemporalResourceSchedule(
    validated,
    inputs,
    {
      ...(options.capacityOverrides === undefined
        ? {}
        : { capacityOverrides: options.capacityOverrides }),
      ...(options.maxPaths === undefined
        ? {}
        : { maxPaths: options.maxPaths }),
    },
  );
  const deadlineEvaluations = evaluateTemporalDeadlines(
    validated,
    inputs,
    precedenceSchedule,
    resourceSchedule,
  );
  return Object.freeze({
    schemaVersion: TARGET_ANALYSIS_RESULT_SCHEMA_VERSION,
    ok: true,
    documentId: checked.documentId,
    grammarVersion: validated.grammarVersion,
    base,
    temporal: Object.freeze({
      interface: TARGET_TEMPORAL_INTERFACE_IDENTITY,
      calendar: inputs.calendar,
      deadline: Object.freeze({
        id: "perttool.deadline-evaluation" as const,
        version: 1 as const,
      }),
      anchor: inputs.anchor,
      precedence: projectTargetTemporalSchedule(
        validated,
        inputs,
        precedenceSchedule,
        "precedence",
      ),
      resource: projectTargetTemporalSchedule(
        validated,
        inputs,
        resourceSchedule,
        "resource",
      ),
      deadlineEvaluations,
    }),
    diagnostics: base.diagnostics,
    diagnosticsTruncated: base.diagnosticsTruncated,
  });
}

export function projectTargetTimeEligibility(
  input: TargetTemporalInputProjection["tasks"][number],
): TargetTimeEligibility {
  const factId = `temporal:task:${input.taskId}:release`;
  let state: TargetTimeEligibility["state"];
  let code: TargetTimeEligibility["explanation"]["code"];
  if (
    input.status === "active" ||
    input.status === "suspended" ||
    input.status === "done"
  ) {
    state = "not_applicable";
    code = "task_already_started";
  } else if (input.declaredNotBefore === null) {
    state = "eligible";
    code = "no_not_before";
  } else if (input.release.state === "unavailable") {
    state = "unavailable";
    code = "temporal_eligibility_unavailable";
  } else if (
    input.release.bound !== null &&
    compare(input.release.bound, ZERO) > 0
  ) {
    state = "not_yet_eligible";
    code = "not_before_future";
  } else {
    state = "eligible";
    code = input.declaredNotBefore === null
      ? "no_not_before"
      : "not_before_reached";
  }
  const fact = Object.freeze({
    id: factId,
    kind: "temporal_release_bound" as const,
    value: Object.freeze({
      state,
      releaseBound: input.release.bound,
    }),
    entityRefs: Object.freeze([
      Object.freeze({ kind: "task" as const, id: input.taskId }),
    ]),
  });
  return Object.freeze({
    state,
    releaseBound: input.release.bound,
    explanation: Object.freeze({
      code,
      factIds: Object.freeze([factId]),
    }),
    facts: Object.freeze([fact]),
    unavailableCauses:
      state === "unavailable" ? input.release.unavailableCauses : [],
  });
}

export function projectTargetNextTemporalTasks(
  validated: TargetTemporalValidatedDocument,
  inputs: TargetTemporalInputProjection,
  analysis: TargetTemporalAnalysis,
): readonly TargetNextTemporalTask[] {
  const declarationById = new Map(
    validated.document.declarations
      .filter(({ kind }) => kind === "task")
      .map((declaration) => [declaration.id, declaration]),
  );
  const milestoneDeadlineById = new Map(
    inputs.milestoneDeadlines.map((item) => [
      item.milestoneId,
      item.deadline.deadline,
    ]),
  );
  const evaluationBySubject = new Map(
    analysis.deadlineEvaluations.map((evaluation) => [
      `${evaluation.subject.kind}:${evaluation.subject.id}`,
      evaluation,
    ]),
  );
  const taskByView = (
    projection: TargetTemporalScheduleProjection,
    id: string,
  ) => projection.tasks.find(({ taskId }) => taskId === id) ?? null;
  return Object.freeze(inputs.tasks
    .filter(({ status }) => status !== "done")
    .map((input): TargetNextTemporalTask => {
      const declaration = declarationById.get(input.taskId)!;
      const destinationMilestoneId = declaration.to!;
      const precedence = taskByView(analysis.precedence, input.taskId);
      const resource = taskByView(analysis.resource, input.taskId);
      return Object.freeze({
        taskId: input.taskId,
        declaredNotBefore: input.declaredNotBefore,
        timeEligibility: projectTargetTimeEligibility(input),
        taskDeadline: input.deadline?.deadline ?? null,
        destinationMilestoneId,
        destinationDeadline:
          milestoneDeadlineById.get(destinationMilestoneId) ?? null,
        precedenceStart: precedence?.start ?? null,
        precedenceFinish: precedence?.finish ?? null,
        resourceStart: resource?.start ?? null,
        resourceFinish: resource?.finish ?? null,
        taskDeadlineEvaluation:
          evaluationBySubject.get(`task:${input.taskId}`) ?? null,
        destinationDeadlineEvaluation:
          evaluationBySubject.get(
            `milestone:${destinationMilestoneId}`,
          ) ?? null,
      });
    }));
}

export function selectTargetTemporalTasks(
  text: string,
  capability: TargetTemporalCapability,
  options: TargetTemporalAnalysisOptions & NextOptions = {},
): TargetNextResultV4 | TargetAnalysisResultV3 {
  const analyzed = analyzeTargetTemporalDocument(text, capability, options);
  if (!analyzed.ok || analyzed.base === null || analyzed.temporal === null) {
    return analyzed;
  }
  const sourceDigest = options.sourceDigest ??
    `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
  const base = selectNextTasksFromAnalysis(
    analyzed.base,
    sourceDigest,
    options,
  );
  if (!base.ok || base.recommendation === null) {
    return failure(
      analyzed.documentId,
      analyzed.grammarVersion,
      base.diagnostics,
      base.diagnosticsTruncated,
    );
  }
  const checked = validateTargetTemporalDocument(text, capability, options);
  const validated = checked.validatedDocument!;
  const inputs = projectTargetTemporalInputs(validated);
  const tasks = projectTargetNextTemporalTasks(
    validated,
    inputs,
    analyzed.temporal,
  );
  const eligibilityById = new Map(
    tasks.map((task) => [task.taskId, task.timeEligibility]),
  );
  const ids = (state: TargetTimeEligibility["state"]) =>
    tasks
      .filter(({ timeEligibility }) => timeEligibility.state === state)
      .map(({ taskId }) => taskId);
  const recommended = base.recommendation.recommendedTaskIds;
  const startable = recommended.filter((id) =>
    eligibilityById.get(id)?.state === "eligible"
  );
  const delayed = recommended.filter((id) =>
    eligibilityById.get(id)?.state === "not_yet_eligible"
  );
  const unavailable = recommended.filter((id) =>
    eligibilityById.get(id)?.state === "unavailable"
  );
  const runnableNow = base.groups.runnableNow.filter((id) =>
    eligibilityById.get(id)?.state === "eligible"
  );
  return Object.freeze({
    ...base,
    schemaVersion: TARGET_NEXT_RESULT_SCHEMA_VERSION,
    grammarVersion: validated.grammarVersion,
    groups: Object.freeze({
      ...base.groups,
      runnableNow: Object.freeze(runnableNow),
    }),
    temporal: Object.freeze({
      authority: Object.freeze({
        policy: "recommendation_v1_plus_release_gate" as const,
        recommendationAlgorithm: Object.freeze({
          id: base.recommendation.algorithm.id,
          version: base.recommendation.algorithm.version,
        }),
        deadlineFactsUsedForRanking: false as const,
        timeEligibleTaskIds: Object.freeze(ids("eligible")),
        timeIneligibleTaskIds: Object.freeze(ids("not_yet_eligible")),
        timeEligibilityUnavailableTaskIds:
          Object.freeze(ids("unavailable")),
        startableRecommendedTaskIds: Object.freeze(startable),
        delayedRecommendedTaskIds: Object.freeze(delayed),
        unavailableRecommendedTaskIds: Object.freeze(unavailable),
      }),
      tasks,
    }),
  });
}
