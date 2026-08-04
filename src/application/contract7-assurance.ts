import {
  projectActualsSourceModel,
  type ProjectActualsSourceModel,
} from "../actuals/source.js";
import { validateStoredLifecycleState } from "../actuals/lifecycle.js";
import {
  countDiagnostics,
  hasErrors,
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import type { DocumentNode, TargetDeclarationKind } from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  projectDeclaredCalendarValue,
  type TargetCalendarValue,
} from "../model/target-calendar.js";
import {
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar6Document,
  type TargetGrammar5ValidatedDocument,
} from "../semantic/target-validator.js";
import {
  analyzeDocument as analyzeBaseDocument,
  type AnalysisResult,
  type AnalyzeOptions,
} from "./analyze.js";
import type {
  CheckOptions,
  CheckSummary,
  MilestoneDeadlineInput,
  TaskTemporalConstraint,
  TemporalInputs,
} from "./check.js";
import {
  analyzeTargetActualsDocument,
  selectTargetActualsTasks,
  type TargetActualsAnalysisResultV4,
  type TargetActualsNextResultV5,
} from "./target-actuals-analysis.js";
import {
  analyzeTargetPlanAssuranceDocument,
  selectTargetPlanAssuranceAuthority,
} from "./target-assurance-analysis.js";
import {
  selectNextTasks as selectBaseNextTasks,
  type NextGroups,
  type NextOptions,
  type NextResultV3,
} from "./next.js";
import type {
  PlanAssuranceProjectionV1,
  PlanAssuranceStartAuthorityV1,
  PlanAssuranceStateCountsV1,
} from "../assurance/authority.js";

export const CHECK_RESULT_V4 = "Perttool.CheckResult.v4" as const;
export const ANALYSIS_RESULT_V5 = "Perttool.AnalysisResult.v5" as const;
export const NEXT_RESULT_V6 = "Perttool.NextResult.v6" as const;

export interface CheckResultV4 {
  readonly schemaVersion: typeof CHECK_RESULT_V4;
  readonly ok: boolean;
  readonly document: DocumentNode<TargetDeclarationKind>;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
  readonly summary: CheckSummary;
  readonly temporalInputs: TemporalInputs | null;
  readonly actualsInputs: ProjectActualsSourceModel | null;
  readonly assurance: PlanAssuranceProjectionV1 | null;
  readonly assuranceStateCounts: PlanAssuranceStateCountsV1;
}

export interface AnalysisResultV5
  extends Omit<AnalysisResult, "precedence" | "resource"> {
  readonly schemaVersion: typeof ANALYSIS_RESULT_V5;
  readonly grammarVersion: number | null;
  readonly taskActuals: TargetActualsAnalysisResultV4["taskActuals"];
  readonly precedence: TargetActualsAnalysisResultV4["precedence"];
  readonly resource: TargetActualsAnalysisResultV4["resource"];
  readonly temporal: TargetActualsAnalysisResultV4["temporal"];
  readonly assurance: PlanAssuranceProjectionV1 | null;
}

type Contract7TemporalAuthority = Omit<
  TargetActualsNextResultV5["temporal"]["authority"],
  "policy" | "recommendationAlgorithm" | "startableRecommendedTaskIds"
> & PlanAssuranceStartAuthorityV1;

export interface NextResultV6
  extends Omit<TargetActualsNextResultV5, "schemaVersion" | "temporal"> {
  readonly schemaVersion: typeof NEXT_RESULT_V6;
  readonly assurance: PlanAssuranceProjectionV1 | null;
  readonly temporal: Omit<TargetActualsNextResultV5["temporal"], "authority"> & {
    readonly authority: Contract7TemporalAuthority;
  };
}

export interface NextResultV6Failure
  extends Omit<NextResultV3, "groups"> {
  readonly schemaVersion: typeof NEXT_RESULT_V6;
  readonly grammarVersion: number | null;
  readonly temporal: null;
  readonly groups: NextGroups & { readonly suspended: readonly string[] };
  readonly assurance: null;
}

export type Contract7NextResultV6 = NextResultV6 | NextResultV6Failure;

function uniqueDiagnostics(values: readonly Diagnostic[]): readonly Diagnostic[] {
  const seen = new Set<string>();
  return Object.freeze(values.filter((diagnostic) => {
    const key = [
      diagnostic.code,
      diagnostic.severity,
      diagnostic.message,
      diagnostic.entityId ?? "",
    ].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}

function temporalInputs(
  document: DocumentNode<TargetDeclarationKind>,
  parseFailed: boolean,
): TemporalInputs | null {
  if (parseFailed) return null;
  const project = document.declarations.find(({ kind }) => kind === "project");
  const anchorField = project === undefined
    ? undefined
    : fieldNamed(project, "as_of");
  const anchor = anchorField === undefined
    ? null
    : projectDeclaredCalendarValue(anchorField.value);
  if (anchorField !== undefined && anchor === null) return null;
  const milestoneDeadlines: MilestoneDeadlineInput[] = [];
  const taskConstraints: TaskTemporalConstraint[] = [];
  for (const declaration of document.declarations) {
    if (declaration.kind === "milestone") {
      const field = fieldNamed(declaration, "deadline");
      if (field === undefined) continue;
      const deadline = projectDeclaredCalendarValue(field.value);
      if (deadline === null) return null;
      milestoneDeadlines.push({ milestoneId: declaration.id, deadline });
      continue;
    }
    if (declaration.kind !== "task") continue;
    const notBeforeField = fieldNamed(declaration, "not_before");
    const deadlineField = fieldNamed(declaration, "deadline");
    if (notBeforeField === undefined && deadlineField === undefined) continue;
    const notBefore: TargetCalendarValue | null = notBeforeField === undefined
      ? null
      : projectDeclaredCalendarValue(notBeforeField.value);
    const deadline: TargetCalendarValue | null = deadlineField === undefined
      ? null
      : projectDeclaredCalendarValue(deadlineField.value);
    if (
      (notBeforeField !== undefined && notBefore === null) ||
      (deadlineField !== undefined && deadline === null)
    ) return null;
    taskConstraints.push({ taskId: declaration.id, notBefore, deadline });
  }
  return Object.freeze({
    anchor,
    milestoneDeadlines: Object.freeze(milestoneDeadlines),
    taskConstraints: Object.freeze(taskConstraints),
  });
}

const emptyStateCounts: PlanAssuranceStateCountsV1 = Object.freeze({
  task: Object.freeze({
    not_applicable: 0,
    unsealed: 0,
    conditional: 0,
    verified: 0,
    review_required: 0,
    unavailable: 0,
  }),
  outcome: Object.freeze({
    unfinished: 0,
    conformant: 0,
    changed: 0,
    unavailable: 0,
  }),
});

export function checkDocument(
  text: string,
  options: CheckOptions = {},
): CheckResultV4 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const checked = validateTargetGrammar6Document(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    { maxDiagnostics: maximum },
  );
  const lifecycle = checked.validatedDocument === null
    ? Object.freeze([])
    : validateStoredLifecycleState(
        checked.validatedDocument as unknown as TargetGrammar5ValidatedDocument,
      );
  const assurance = analyzeTargetPlanAssuranceDocument(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    { maxDiagnostics: maximum },
  );
  const allDiagnostics = uniqueDiagnostics(sortDiagnostics([
    ...assurance.diagnostics,
    ...lifecycle,
  ]));
  const limited = limitDiagnostics(allDiagnostics, maximum);
  const parseFailed = checked.parseFailed;
  const counts = parseFailed
    ? checked.diagnosticCounts
    : countDiagnostics(allDiagnostics);
  const document = checked.document;
  const summary: CheckSummary = Object.freeze({
    resources: parseFailed
      ? 0
      : document.declarations.filter(({ kind }) => kind === "resource").length,
    milestones: parseFailed
      ? 0
      : document.declarations.filter(({ kind }) => kind === "milestone").length,
    tasks: parseFailed
      ? 0
      : document.declarations.filter(({ kind }) => kind === "task").length,
    gates: parseFailed
      ? 0
      : document.declarations.filter(({ kind }) => kind === "gate").length,
    errors: counts.errors,
    warnings: counts.warnings,
  });
  return Object.freeze({
    schemaVersion: CHECK_RESULT_V4,
    ok: checked.ok && assurance.evaluation !== null &&
      assurance.evaluation.ok && !hasErrors(allDiagnostics),
    document,
    documentId: checked.documentId,
    grammarVersion: checked.grammarVersion,
    diagnostics: Object.freeze(limited.diagnostics),
    diagnosticsTruncated:
      checked.diagnosticsTruncated || assurance.diagnosticsTruncated ||
      limited.truncated,
    summary,
    temporalInputs: temporalInputs(document, parseFailed),
    actualsInputs: checked.validatedDocument === null
      ? null
      : projectActualsSourceModel(
          checked.validatedDocument as unknown as TargetGrammar5ValidatedDocument,
        ),
    assurance: assurance.check?.assurance ?? null,
    assuranceStateCounts: assurance.check?.stateCounts ?? emptyStateCounts,
  });
}

export function analyzeDocument(
  text: string,
  options: AnalyzeOptions = {},
): AnalysisResultV5 {
  const actuals = analyzeTargetActualsDocument(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
  const assurance = analyzeTargetPlanAssuranceDocument(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const limited = limitDiagnostics(uniqueDiagnostics(sortDiagnostics([
    ...actuals.diagnostics,
    ...assurance.diagnostics,
  ])), maximum);
  const base = actuals.ok && actuals.base !== null
    ? actuals.base
    : analyzeBaseDocument(text, options);
  return Object.freeze({
    ...base,
    schemaVersion: ANALYSIS_RESULT_V5,
    ok: actuals.ok && actuals.base !== null &&
      assurance.analysis !== null && assurance.analysis.ok &&
      !hasErrors(limited.diagnostics),
    grammarVersion: actuals.grammarVersion,
    taskActuals: actuals.ok ? actuals.taskActuals : Object.freeze([]),
    precedence: actuals.ok ? actuals.precedence : null,
    resource: actuals.ok ? actuals.resource : null,
    temporal: actuals.ok ? actuals.temporal : null,
    assurance: assurance.analysis?.assurance ?? null,
    diagnostics: Object.freeze(limited.diagnostics),
    diagnosticsTruncated:
      actuals.diagnosticsTruncated || assurance.diagnosticsTruncated ||
      limited.truncated,
  });
}

export function selectNextTasks(
  text: string,
  options: AnalyzeOptions & NextOptions = {},
): Contract7NextResultV6 {
  const actuals = selectTargetActualsTasks(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
  if (!("recommendation" in actuals) || actuals.recommendation === null) {
    const base = selectBaseNextTasks(text, options);
    return Object.freeze({
      ...base,
      schemaVersion: NEXT_RESULT_V6,
      grammarVersion: actuals.grammarVersion,
      groups: Object.freeze({
        ...base.groups,
        suspended: Object.freeze([]),
      }),
      temporal: null,
      assurance: null,
      diagnostics: actuals.diagnostics,
      diagnosticsTruncated: actuals.diagnosticsTruncated,
    });
  }
  const recommendation = actuals.recommendation;
  const authority = selectTargetPlanAssuranceAuthority(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    {
      recommendationInterfaceVersion: 1,
      rankingAlgorithm: recommendation.algorithm,
      reasonTaxonomyVersion: recommendation.reasonTaxonomyVersion,
      explanationModelVersion: recommendation.explanationModelVersion,
      expressionVersion: recommendation.expressionVersion,
      descriptionRegistryVersion: recommendation.descriptionRegistryVersion,
      descriptionLocale: recommendation.descriptionLocale,
      temporalPolicy: actuals.temporal.authority.policy,
      traceComplete:
        recommendation.explanationStatus.complete &&
        recommendation.explanationStatus.decisiveChainComplete &&
        !recommendation.explanationStatus.truncated,
      diagnosticsTruncated: actuals.diagnosticsTruncated,
      rawRecommendedTaskIds: recommendation.recommendedTaskIds,
      temporalStartableRecommendedTaskIds:
        actuals.temporal.authority.startableRecommendedTaskIds,
    },
    options,
  );
  if (authority.next === null) {
    const base = selectBaseNextTasks(text, options);
    return Object.freeze({
      ...base,
      schemaVersion: NEXT_RESULT_V6,
      grammarVersion: actuals.grammarVersion,
      ok: false,
      groups: Object.freeze({
        ...base.groups,
        suspended: Object.freeze([]),
      }),
      temporal: null,
      assurance: null,
      diagnostics: authority.diagnostics,
      diagnosticsTruncated: authority.diagnosticsTruncated,
    });
  }
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const limited = limitDiagnostics(uniqueDiagnostics(sortDiagnostics([
    ...actuals.diagnostics,
    ...authority.diagnostics,
  ])), maximum);
  return Object.freeze({
    ...actuals,
    schemaVersion: NEXT_RESULT_V6,
    ok: actuals.ok && authority.ok && !hasErrors(limited.diagnostics),
    assurance: authority.next.assurance,
    temporal: Object.freeze({
      ...actuals.temporal,
      authority: Object.freeze({
        ...actuals.temporal.authority,
        ...authority.next.authority,
      }),
    }),
    diagnostics: Object.freeze(limited.diagnostics),
    diagnosticsTruncated:
      actuals.diagnosticsTruncated || authority.diagnosticsTruncated ||
      limited.truncated,
  });
}
