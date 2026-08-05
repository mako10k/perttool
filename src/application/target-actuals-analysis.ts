import { sha256DigestUtf8 } from "../model/sha256.js";
import {
  projectActualsSourceModel,
  workEventsForTask,
} from "../actuals/source.js";
import {
  reduceTaskLifecycle,
  taskStatus,
  validateStoredLifecycleState,
  type ActualsCoverage,
  type TaskLifecycleState,
} from "../actuals/lifecycle.js";
import {
  evaluateTemporalDeadlines,
  type DeadlineEvaluation,
} from "../analysis/temporal-deadline.js";
import {
  analyzeTemporalPrecedenceSchedule,
} from "../analysis/temporal-precedence.js";
import {
  analyzeTemporalResourceSchedule,
} from "../analysis/temporal-resource.js";
import type { PrecedenceResult } from "../analysis/precedence.js";
import type { ResourceScheduleResult } from "../analysis/resource.js";
import {
  compareStableStrings,
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import type {
  DeclarationNode,
  DocumentNode,
  FieldNode,
  TargetDeclarationKind,
} from "../model/syntax.js";
import type {
  TargetGrammar5Capability,
  TargetGrammar6Capability,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar5Document,
  validateTargetGrammar6Document,
  type TargetGrammar5ValidatedDocument,
  type TargetGrammar6ValidatedDocument,
} from "../semantic/target-validator.js";
import {
  analyzeValidatedDocument,
  type AnalysisResult,
  type AnalyzeOptions,
} from "./analyze.js";
import {
  selectNextTasksFromAnalysis,
  type NextGroups,
  type NextOptions,
  type NextResultV3,
  type NextTask,
} from "./next.js";
import {
  projectTargetNextTemporalTasks,
  projectTargetTemporalSchedule,
  type TargetNextTemporalTask,
  type TargetTemporalAnalysis,
  TARGET_TEMPORAL_INTERFACE_IDENTITY,
} from "./target-temporal-analysis.js";
import {
  projectTargetTemporalInputs,
} from "./target-temporal-input.js";

export const TARGET_ACTUALS_ANALYSIS_RESULT_SCHEMA_VERSION =
  "Perttool.AnalysisResult.v4" as const;
export const TARGET_ACTUALS_NEXT_RESULT_SCHEMA_VERSION =
  "Perttool.NextResult.v5" as const;

type TargetActualsCapability =
  | TargetGrammar5Capability
  | TargetGrammar6Capability;
type TargetActualsValidatedDocument =
  | TargetGrammar5ValidatedDocument
  | TargetGrammar6ValidatedDocument;

function validateTargetActualsDocument(
  text: string,
  capability: TargetActualsCapability,
  options: AnalyzeOptions & NextOptions = {},
) {
  return capability.grammarVersion === 6
    ? validateTargetGrammar6Document(text, capability, options)
    : validateTargetGrammar5Document(text, capability, options);
}

export interface TargetTaskActualsCoverage {
  readonly taskId: string;
  readonly status: TaskLifecycleState;
  readonly coverage: ActualsCoverage;
}

interface SuspensionCondition {
  readonly conditionalOnSuspensionsResumed: boolean;
  readonly suspendedTaskIds: readonly string[];
}

export type TargetActualsPrecedenceResult =
  PrecedenceResult & SuspensionCondition;
export type TargetActualsResourceScheduleResult =
  ResourceScheduleResult & SuspensionCondition;

export type TargetActualsTemporalAnalysis =
  Omit<TargetTemporalAnalysis, "precedence" | "resource"> & {
    readonly precedence:
      TargetTemporalAnalysis["precedence"] & SuspensionCondition;
    readonly resource:
      TargetTemporalAnalysis["resource"] & SuspensionCondition;
    readonly deadlineEvaluations: readonly (
      DeadlineEvaluation & SuspensionCondition
    )[];
  };

export interface TargetActualsAnalysisResultV4 {
  readonly schemaVersion:
    typeof TARGET_ACTUALS_ANALYSIS_RESULT_SCHEMA_VERSION;
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly base: AnalysisResult | null;
  readonly taskActuals: readonly TargetTaskActualsCoverage[];
  readonly precedence: TargetActualsPrecedenceResult | null;
  readonly resource: TargetActualsResourceScheduleResult | null;
  readonly temporal: TargetActualsTemporalAnalysis | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface TargetActualsNextTask
  extends Omit<NextTask, "status" | "classification"> {
  readonly status: TaskLifecycleState;
  readonly classification:
    | NextTask["classification"]
    | "suspended";
}

export interface TargetActualsNextGroups extends NextGroups {
  readonly suspended: readonly string[];
}

export interface TargetActualsNextResultV5
  extends Omit<NextResultV3, "document" | "groups" | "tasks"> {
  readonly schemaVersion: typeof TARGET_ACTUALS_NEXT_RESULT_SCHEMA_VERSION;
  readonly grammarVersion: 1 | 2 | 3 | 4 | 5 | 6;
  readonly document: DocumentNode<TargetDeclarationKind>;
  readonly groups: TargetActualsNextGroups;
  readonly tasks: readonly TargetActualsNextTask[];
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

function failure(
  checked: ReturnType<typeof validateTargetActualsDocument>,
  additionalDiagnostics: readonly Diagnostic[] = [],
  maximum = normalizeMaxDiagnostics(undefined),
): TargetActualsAnalysisResultV4 {
  const limited = limitDiagnostics(
    sortDiagnostics([...checked.diagnostics, ...additionalDiagnostics]),
    maximum,
  );
  return Object.freeze({
    schemaVersion: TARGET_ACTUALS_ANALYSIS_RESULT_SCHEMA_VERSION,
    ok: false,
    documentId: checked.documentId,
    grammarVersion: checked.grammarVersion,
    base: null,
    taskActuals: Object.freeze([]),
    precedence: null,
    resource: null,
    temporal: null,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated:
      checked.diagnosticsTruncated || limited.truncated,
  });
}

function projectField(
  field: FieldNode,
  statusProjection: "planned" | "blocked",
): FieldNode {
  return field.name !== "status" || field.value !== "suspended"
    ? field
    : Object.freeze({
        ...field,
        rawValue: statusProjection,
        value: statusProjection,
      });
}

function projectTask(
  declaration: DeclarationNode<TargetDeclarationKind>,
  statusProjection: "planned" | "blocked",
): DeclarationNode {
  return Object.freeze({
    ...declaration,
    kind: declaration.kind as "project" | "resource" | "milestone" | "task" | "gate",
    fields: Object.freeze(
      declaration.fields.map((field) =>
        projectField(field, statusProjection)
      ),
    ),
  });
}

function projectAnalysisDocument(
  validated: TargetActualsValidatedDocument,
  statusProjection: "planned" | "blocked",
): DocumentNode {
  return Object.freeze({
    text: validated.document.text,
    declarations: Object.freeze(
      validated.document.declarations
        .filter(({ kind }) => kind !== "work_event")
        .map((declaration) =>
          projectTask(declaration, statusProjection)
        ),
    ),
    trivia: validated.document.trivia,
  });
}

function projectValidatedDocument(
  validated: TargetActualsValidatedDocument,
  statusProjection: "planned" | "blocked",
): TargetActualsValidatedDocument {
  return Object.freeze({
    ...validated,
    document: projectAnalysisDocument(validated, statusProjection),
  }) as TargetActualsValidatedDocument;
}

function taskActuals(
  validated: TargetActualsValidatedDocument,
): readonly TargetTaskActualsCoverage[] {
  const model = projectActualsSourceModel(
    validated as unknown as TargetGrammar5ValidatedDocument,
  );
  return Object.freeze(
    validated.document.declarations
      .filter(({ kind }) => kind === "task")
      .sort((left, right) => compareStableStrings(left.id, right.id))
      .map((task) => {
        const reduction = reduceTaskLifecycle(
          workEventsForTask(model, task.id),
        );
        if (!reduction.ok) {
          throw new Error(
            `validated lifecycle reduction failed for ${task.id}`,
          );
        }
        return Object.freeze({
          taskId: task.id,
          status: taskStatus(task),
          coverage: reduction.coverage,
        });
      }),
  );
}

function suspensionCondition(
  suspendedTaskIds: readonly string[],
): SuspensionCondition {
  return Object.freeze({
    conditionalOnSuspensionsResumed: suspendedTaskIds.length > 0,
    suspendedTaskIds,
  });
}

export function analyzeTargetActualsDocument(
  text: string,
  capability: TargetActualsCapability,
  options: AnalyzeOptions = {},
): TargetActualsAnalysisResultV4 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const checked = validateTargetActualsDocument(
    text,
    capability,
    { maxDiagnostics: maximum },
  );
  if (!checked.ok || checked.validatedDocument === null) {
    return failure(checked, [], maximum);
  }
  const lifecycleDiagnostics = validateStoredLifecycleState(
    checked.validatedDocument as unknown as TargetGrammar5ValidatedDocument,
  );
  if (lifecycleDiagnostics.length > 0) {
    return failure(checked, lifecycleDiagnostics, maximum);
  }
  const suspendedTaskIds = Object.freeze(
    checked.validatedDocument.document.declarations
      .filter(
        (declaration) =>
          declaration.kind === "task" &&
          taskStatus(declaration) === "suspended",
      )
      .map(({ id }) => id)
      .sort(compareStableStrings),
  );
  const condition = suspensionCondition(suspendedTaskIds);
  const projected = projectValidatedDocument(
    checked.validatedDocument,
    "planned",
  );
  const temporalProjected =
    projected as unknown as TargetGrammar5ValidatedDocument;
  const base = analyzeValidatedDocument(
    projected.document as DocumentNode,
    checked.documentId!,
    checked.diagnostics,
    checked.diagnosticsTruncated,
    options,
  );
  if (!base.ok) {
    return Object.freeze({
      schemaVersion: TARGET_ACTUALS_ANALYSIS_RESULT_SCHEMA_VERSION,
      ok: false,
      documentId: checked.documentId,
      grammarVersion: checked.grammarVersion,
      base,
      taskActuals: Object.freeze([]),
      precedence: null,
      resource: null,
      temporal: null,
      diagnostics: base.diagnostics,
      diagnosticsTruncated: base.diagnosticsTruncated,
    });
  }
  const inputs = projectTargetTemporalInputs(temporalProjected);
  const temporalPrecedence = analyzeTemporalPrecedenceSchedule(
    temporalProjected,
    inputs,
  );
  const temporalResource = analyzeTemporalResourceSchedule(
    temporalProjected,
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
    temporalProjected,
    inputs,
    temporalPrecedence,
    temporalResource,
  );
  const temporal = Object.freeze({
    interface: TARGET_TEMPORAL_INTERFACE_IDENTITY,
    calendar: inputs.calendar,
    deadline: Object.freeze({
      id: "perttool.deadline-evaluation" as const,
      version: 1 as const,
    }),
    anchor: inputs.anchor,
    precedence: Object.freeze({
      ...projectTargetTemporalSchedule(
        temporalProjected,
        inputs,
        temporalPrecedence,
        "precedence",
      ),
      ...condition,
    }),
    resource: Object.freeze({
      ...projectTargetTemporalSchedule(
        temporalProjected,
        inputs,
        temporalResource,
        "resource",
      ),
      ...condition,
    }),
    deadlineEvaluations: Object.freeze(
      deadlineEvaluations.map((evaluation) =>
        Object.freeze({ ...evaluation, ...condition })
      ),
    ),
  }) satisfies TargetActualsTemporalAnalysis;
  return Object.freeze({
    schemaVersion: TARGET_ACTUALS_ANALYSIS_RESULT_SCHEMA_VERSION,
    ok: true,
    documentId: checked.documentId,
    grammarVersion: checked.grammarVersion,
    base,
    taskActuals: taskActuals(checked.validatedDocument),
    precedence: base.precedence === null
      ? null
      : Object.freeze({ ...base.precedence, ...condition }),
    resource: base.resource === null
      ? null
      : Object.freeze({ ...base.resource, ...condition }),
    temporal,
    diagnostics: base.diagnostics,
    diagnosticsTruncated: base.diagnosticsTruncated,
  });
}

function digest(text: string): string {
  return sha256DigestUtf8(text);
}

export function selectTargetActualsTasks(
  text: string,
  capability: TargetActualsCapability,
  options: AnalyzeOptions & NextOptions = {},
): TargetActualsNextResultV5 | TargetActualsAnalysisResultV4 {
  const analyzed = analyzeTargetActualsDocument(text, capability, options);
  if (!analyzed.ok || analyzed.base === null || analyzed.temporal === null) {
    return analyzed;
  }
  const checked = validateTargetActualsDocument(text, capability, options);
  if (!checked.ok || checked.validatedDocument === null) {
    return failure(checked);
  }
  const suspendedTaskIds = analyzed.precedence?.suspendedTaskIds ??
    analyzed.resource?.suspendedTaskIds ??
    Object.freeze([]);
  const suspended = new Set(suspendedTaskIds);
  const classificationDocument = projectAnalysisDocument(
    checked.validatedDocument,
    "blocked",
  );
  const selected = selectNextTasksFromAnalysis(
    Object.freeze({
      ...analyzed.base,
      document: classificationDocument,
    }),
    options.sourceDigest ?? digest(text),
    options,
  );
  if (!selected.ok || selected.recommendation === null) {
    return Object.freeze({
      ...analyzed,
      ok: false,
      diagnostics: selected.diagnostics,
      diagnosticsTruncated: selected.diagnosticsTruncated,
    });
  }
  const tasks = Object.freeze(
    selected.tasks.map((task): TargetActualsNextTask =>
      suspended.has(task.id)
        ? Object.freeze({
            ...task,
            status: "suspended",
            classification: "suspended",
            runnableNow: false,
            resourceRejections: Object.freeze([]),
          })
        : task,
    ),
  );
  const ids = (
    classification: TargetActualsNextTask["classification"],
  ): readonly string[] =>
    tasks
      .filter((task) => task.classification === classification)
      .map(({ id }) => id);
  const temporalValidated = checked.validatedDocument as unknown as
    TargetGrammar5ValidatedDocument;
  const inputs = projectTargetTemporalInputs(temporalValidated);
  const temporalTasks = projectTargetNextTemporalTasks(
    temporalValidated,
    inputs,
    analyzed.temporal,
  );
  const eligibilityById = new Map(
    temporalTasks.map((task) => [task.taskId, task.timeEligibility.state]),
  );
  const temporalIds = (
    state: "eligible" | "not_yet_eligible" | "unavailable",
  ) =>
    temporalTasks
      .filter((task) => task.timeEligibility.state === state)
      .map(({ taskId }) => taskId);
  const recommended = selected.recommendation.recommendedTaskIds;
  const recommendedFor = (
    state: "eligible" | "not_yet_eligible" | "unavailable",
  ) => recommended.filter((id) => eligibilityById.get(id) === state);
  return Object.freeze({
    ...selected,
    schemaVersion: TARGET_ACTUALS_NEXT_RESULT_SCHEMA_VERSION,
    grammarVersion: checked.validatedDocument.grammarVersion,
    document: checked.validatedDocument.document,
    groups: Object.freeze({
      active: ids("active"),
      ready: ids("ready"),
      runnableNow: tasks
        .filter(
          (task) =>
            task.runnableNow &&
            eligibilityById.get(task.id) === "eligible",
        )
        .map(({ id }) => id),
      blockedNow: ids("blocked_now"),
      upcoming: ids("upcoming"),
      suspended: ids("suspended"),
    }),
    tasks,
    temporal: Object.freeze({
      authority: Object.freeze({
        policy: "recommendation_v1_plus_release_gate" as const,
        recommendationAlgorithm: Object.freeze({
          id: selected.recommendation.algorithm.id,
          version: selected.recommendation.algorithm.version,
        }),
        deadlineFactsUsedForRanking: false as const,
        timeEligibleTaskIds: Object.freeze(temporalIds("eligible")),
        timeIneligibleTaskIds:
          Object.freeze(temporalIds("not_yet_eligible")),
        timeEligibilityUnavailableTaskIds:
          Object.freeze(temporalIds("unavailable")),
        startableRecommendedTaskIds:
          Object.freeze(recommendedFor("eligible")),
        delayedRecommendedTaskIds:
          Object.freeze(recommendedFor("not_yet_eligible")),
        unavailableRecommendedTaskIds:
          Object.freeze(recommendedFor("unavailable")),
      }),
      tasks: temporalTasks,
    }),
  });
}
