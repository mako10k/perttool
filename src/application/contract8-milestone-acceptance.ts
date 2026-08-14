import { computeEffectiveReached } from "../analysis/graph.js";
import { evaluateMilestoneAcceptance, type MilestoneAcceptanceModelResultV1 } from "../milestone-acceptance/evaluate.js";
import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  milestoneAcceptanceBaseText,
  parseMilestoneAcceptanceSource,
} from "../milestone-acceptance/source.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import { applyTextEdits } from "../mutation/text-edits.js";
import type { AnalyzeOptions } from "./analyze.js";
import {
  planFormat as planContract7Format,
  type FormatPreviewResultV7,
} from "./contract7-source.js";
import {
  planUnitMigration as planContract7UnitMigration,
  type UnitMigrationOptions,
  type UnitMigrationResult,
} from "./contract7-unit-migration.js";
import type { NextOptions } from "./next.js";
import type { UnitMigrationRequest } from "../migration/request.js";
import {
  analyzeDocument as analyzeContract7Document,
  checkDocument as checkContract7Document,
  selectNextTasks as selectContract7NextTasks,
  type AnalysisResultV5,
  type CheckResultV4,
  type Contract7NextResultV6,
} from "./contract7-assurance.js";
import {
  planAssuranceMutation as planContract7AssuranceMutation,
  planBatchMutation as planContract7BatchMutation,
  planFinishActuals as planContract7FinishActuals,
  planLifecycle as planContract7Lifecycle,
  planMutation as planContract7Mutation,
  type AdvanceResultV2,
  type LifecycleResultV4,
  type MutationResultV4,
} from "./contract7-mutation.js";
import {
  getProjectMetadata as getContract7ProjectMetadata,
  type ProjectMetadataResult,
} from "./contract7-project.js";
import type { CheckOptions } from "./check.js";
import {
  inspectTargetPlanAssurance as inspectContract7PlanAssurance,
  type PlanAssuranceInspectionRequest,
  type TargetPlanAssuranceInspectionResultV1,
} from "./target-assurance-inspection.js";
import type { TargetGrammar6Capability } from "../parser/document-parser.js";

export const CHECK_RESULT_V5 = "Perttool.CheckResult.v5" as const;
export const ANALYSIS_RESULT_V6 = "Perttool.AnalysisResult.v6" as const;
export const NEXT_RESULT_V7 = "Perttool.NextResult.v7" as const;

export interface CheckResultV5 extends Omit<CheckResultV4, "schemaVersion"> {
  readonly schemaVersion: typeof CHECK_RESULT_V5;
  readonly acceptance: MilestoneAcceptanceModelResultV1 | null;
}

export interface AnalysisResultV6 extends Omit<AnalysisResultV5, "schemaVersion"> {
  readonly schemaVersion: typeof ANALYSIS_RESULT_V6;
  readonly acceptance: MilestoneAcceptanceModelResultV1 | null;
}

export type NextResultV7 = Omit<Contract7NextResultV6, "schemaVersion"> & {
  readonly schemaVersion: typeof NEXT_RESULT_V7;
  readonly acceptance: MilestoneAcceptanceModelResultV1 | null;
};

export interface Contract8CandidateOptions {
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
}

export type Contract8LiftedCandidate<T> =
  T extends { readonly schemaVersion: "Perttool.MutationResult.v4" }
    ? Omit<T, "schemaVersion"> & { readonly schemaVersion: "Perttool.MutationResult.v5" }
    : T extends { readonly schemaVersion: "Perttool.AdvanceResult.v2" }
      ? Omit<T, "schemaVersion"> & { readonly schemaVersion: "Perttool.AdvanceResult.v3" }
      : T;

export type MutationResultV5 = Contract8LiftedCandidate<MutationResultV4>;
export type LifecycleResultV5 = Contract8LiftedCandidate<LifecycleResultV4>;
export type AdvanceResultV3 = Contract8LiftedCandidate<AdvanceResultV2>;

function contract8CandidateIdentity<T>(value: T): Contract8LiftedCandidate<T> {
  if (typeof value !== "object" || value === null || !("schemaVersion" in value)) {
    return value as Contract8LiftedCandidate<T>;
  }
  const schemaVersion = value.schemaVersion === "Perttool.MutationResult.v4"
    ? "Perttool.MutationResult.v5"
    : value.schemaVersion === "Perttool.AdvanceResult.v2"
      ? "Perttool.AdvanceResult.v3"
      : value.schemaVersion;
  return Object.freeze({ ...value, schemaVersion }) as Contract8LiftedCandidate<T>;
}

export function liftMilestoneAcceptanceCandidate<T extends {
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly { readonly startOffset: number; readonly endOffset: number; readonly replacement: string }[];
}>(
  text: string,
  planner: (baseText: string) => T,
  options: Contract8CandidateOptions = {},
): Contract8LiftedCandidate<T> {
  const source = parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  if (source.grammarVersion !== 7) return contract8CandidateIdentity(planner(text));
  if (!source.ok) return contract8CandidateIdentity(planner(text));
  const planned = planner(milestoneAcceptanceBaseText(text));
  if (planned.updatedText === null) {
    return contract8CandidateIdentity(Object.freeze({
      ...planned,
      originalDigest: sha256DigestUtf8(text),
    }));
  }
  const updatedText = applyTextEdits(text, planned.edits);
  const checked = parseMilestoneAcceptanceSource(updatedText, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  if (!checked.ok) throw new Error("Contract 8 mutation lost milestone acceptance source validity");
  return contract8CandidateIdentity(Object.freeze({
    ...planned,
    originalDigest: sha256DigestUtf8(text),
    updatedDigest: sha256DigestUtf8(updatedText),
    updatedText,
    diff: createUnifiedDiff(text, updatedText, {
      ...(options.originalLabel === undefined ? {} : { originalLabel: options.originalLabel }),
      ...(options.updatedLabel === undefined ? {} : { updatedLabel: options.updatedLabel }),
    }),
  }));
}

function milestoneIds(text: string): readonly string[] {
  return Object.freeze([...text.matchAll(/^milestone ([A-Za-z][A-Za-z0-9_-]*):$/gmu)].map((match) => match[1]!));
}

function acceptanceProjection(text: string): MilestoneAcceptanceModelResultV1 | null {
  const source = parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  if (!source.ok || source.grammarVersion !== 7) return null;
  const base = checkContract7Document(milestoneAcceptanceBaseText(text));
  if (!base.ok) return null;
  const reached = computeEffectiveReached(base.document as never);
  return evaluateMilestoneAcceptance({ source, milestoneIds: milestoneIds(text), closureReachedMilestoneIds: reached });
}

function sourceDiagnostics(text: string): readonly Diagnostic[] {
  const parsed = parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  return Object.freeze(parsed.diagnostics.map((item): Diagnostic => Object.freeze({
    code: item.code,
    severity: "error",
    message: item.message,
    span: item.span,
    helpTopic: "editing",
    data: Object.freeze({}),
  })));
}

export function inspectPlanAssurance(
  text: string,
  request: PlanAssuranceInspectionRequest,
  capability: TargetGrammar6Capability,
  options: { readonly maxDiagnostics?: number } = {},
): TargetPlanAssuranceInspectionResultV1 {
  const source = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  if (source.grammarVersion !== 7) {
    return inspectContract7PlanAssurance(text, request, capability, options);
  }

  const base = inspectContract7PlanAssurance(
    milestoneAcceptanceBaseText(text),
    request,
    capability,
    options,
  );
  const extra = sourceDiagnostics(text);
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const limited = limitDiagnostics(
    sortDiagnostics([...base.diagnostics, ...extra]),
    maximum,
  );
  return Object.freeze({
    ...base,
    ok: base.ok && extra.length === 0,
    documentId: source.documentId ?? base.documentId,
    grammarVersion: 7,
    sourceDigest: sha256DigestUtf8(text),
    diagnostics: Object.freeze(limited.diagnostics),
    diagnosticsTruncated:
      base.diagnosticsTruncated || limited.truncated,
  });
}

function missingCriterionWarnings(text: string, acceptance: MilestoneAcceptanceModelResultV1 | null): readonly Diagnostic[] {
  if (acceptance === null || acceptance.grammarVersion !== 7) return Object.freeze([]);
  return Object.freeze(acceptance.milestones
    .filter(({ acceptance: state, grandfathered }) => state === "not_declared" && !grandfathered)
    .map(({ milestoneId }): Diagnostic => Object.freeze({
      code: "PTMAC-102",
      severity: "warning",
      message: `Milestone ${milestoneId} has no declared acceptance criterion set; use milestone acceptance replace`,
      entityId: milestoneId,
      helpTopic: "editing",
      data: Object.freeze({ milestone_id: milestoneId }),
    })));
}

export function checkDocument(text: string, options: Parameters<typeof checkContract7Document>[1] = {}): CheckResultV5 {
  const baseText = milestoneAcceptanceBaseText(text);
  const base = checkContract7Document(baseText, options);
  const acceptance = acceptanceProjection(text);
  const extra = [...sourceDiagnostics(text), ...missingCriterionWarnings(text, acceptance)];
  const diagnostics = Object.freeze([...base.diagnostics, ...extra]);
  const extraErrors = extra.filter(({ severity }) => severity === "error").length;
  const extraWarnings = extra.filter(({ severity }) => severity === "warning").length;
  return Object.freeze({
    ...base,
    schemaVersion: CHECK_RESULT_V5,
    ok: base.ok && extraErrors === 0,
    grammarVersion: parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY).grammarVersion,
    document: { ...base.document, text },
    diagnostics,
    summary: Object.freeze({
      ...base.summary,
      errors: base.summary.errors + extraErrors,
      warnings: base.summary.warnings + extraWarnings,
    }),
    acceptance,
  });
}

export function analyzeDocument(text: string, options: AnalyzeOptions = {}): AnalysisResultV6 {
  const base = analyzeContract7Document(milestoneAcceptanceBaseText(text), options);
  const acceptance = acceptanceProjection(text);
  const diagnostics = Object.freeze([...base.diagnostics, ...sourceDiagnostics(text)]);
  return Object.freeze({
    ...base,
    schemaVersion: ANALYSIS_RESULT_V6,
    ok: base.ok && (acceptance === null || acceptance.ok) && !diagnostics.some(({ severity }) => severity === "error"),
    grammarVersion: parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY).grammarVersion,
    diagnostics,
    acceptance,
  });
}

export function selectNextTasks(text: string, options: AnalyzeOptions & NextOptions = {}): NextResultV7 {
  const base = selectContract7NextTasks(milestoneAcceptanceBaseText(text), options);
  const acceptance = acceptanceProjection(text);
  const diagnostics = Object.freeze([...base.diagnostics, ...sourceDiagnostics(text)]);
  return Object.freeze({
    ...base,
    schemaVersion: NEXT_RESULT_V7,
    ok: base.ok && (acceptance === null || acceptance.ok) && !diagnostics.some(({ severity }) => severity === "error"),
    grammarVersion: parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY).grammarVersion,
    diagnostics,
    acceptance,
  });
}

export function getProjectMetadata(
  text: string,
  options: CheckOptions = {},
): ProjectMetadataResult {
  const source = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  const base = getContract7ProjectMetadata(
    source.grammarVersion === 7 ? milestoneAcceptanceBaseText(text) : text,
    options,
  );
  if (source.grammarVersion !== 7 || !source.ok || !base.ok || base.project === null) {
    return base;
  }
  return Object.freeze({
    ...base,
    grammarVersion: 7,
    project: Object.freeze({ ...base.project, version: 7 }),
  });
}

export function planFormat(
  text: string,
  options: Parameters<typeof planContract7Format>[1] = {},
): FormatPreviewResultV7 {
  return liftMilestoneAcceptanceCandidate(
    text,
    (baseText) => planContract7Format(baseText, options),
    options,
  );
}

export function planUnitMigration(
  text: string,
  request: UnitMigrationRequest,
  options: UnitMigrationOptions = {},
): UnitMigrationResult {
  const source = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  const result = liftMilestoneAcceptanceCandidate(
    text,
    (baseText) => planContract7UnitMigration(baseText, request, options),
    options,
  );
  return source.grammarVersion === 7 && source.ok
    ? Object.freeze({
        ...result,
        sourceGrammarVersion: 7,
        targetGrammarVersion: result.targetGrammarVersion === null ? null : 7,
        grammarDisposition: result.grammarDisposition === null
          ? null
          : "retained" as const,
      })
    : result;
}

export function planMutation(...args: Parameters<typeof planContract7Mutation>) {
  return liftMilestoneAcceptanceCandidate(
    args[0],
    (baseText) => planContract7Mutation(baseText, args[1], args[2]),
    args[2],
  );
}

export function planBatchMutation(...args: Parameters<typeof planContract7BatchMutation>) {
  return liftMilestoneAcceptanceCandidate(
    args[0],
    (baseText) => planContract7BatchMutation(baseText, args[1], args[2]),
    args[2],
  );
}

export function planLifecycle(...args: Parameters<typeof planContract7Lifecycle>) {
  return liftMilestoneAcceptanceCandidate(
    args[0],
    (baseText) => planContract7Lifecycle(baseText, args[1], args[2]),
    args[2],
  );
}

export function planFinishActuals(...args: Parameters<typeof planContract7FinishActuals>) {
  return liftMilestoneAcceptanceCandidate(
    args[0],
    (baseText) => planContract7FinishActuals(baseText, args[1], args[2]),
    args[2],
  );
}

export function planAssuranceMutation(...args: Parameters<typeof planContract7AssuranceMutation>) {
  return liftMilestoneAcceptanceCandidate(
    args[0],
    (baseText) => planContract7AssuranceMutation(baseText, args[1], args[2]),
    args[2],
  );
}
