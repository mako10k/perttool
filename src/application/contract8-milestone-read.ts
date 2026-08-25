import { computeEffectiveReached } from "../analysis/graph.js";
import {
  evaluateMilestoneAcceptance,
  type MilestoneAcceptanceModelResultV1,
} from "../milestone-acceptance/evaluate.js";
import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  milestoneAcceptanceBaseText,
  parseMilestoneAcceptanceSource,
} from "../milestone-acceptance/source.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { AnalyzeOptions } from "./analyze.js";
import {
  analyzeDocument as analyzeContract7Document,
  checkDocument as checkContract7Document,
  selectNextTasks as selectContract7NextTasks,
  type AnalysisResultV5,
  type CheckResultV4,
  type Contract7NextResultV6,
} from "./contract7-assurance.js";
import type { NextOptions } from "./next.js";

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

function milestoneIds(text: string): readonly string[] {
  return Object.freeze([...text.matchAll(/^milestone ([A-Za-z][A-Za-z0-9_-]*):$/gmu)]
    .map((match) => match[1]!));
}

function acceptanceProjection(text: string): MilestoneAcceptanceModelResultV1 | null {
  const source = parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  if (!source.ok || source.grammarVersion !== 7) return null;
  const base = checkContract7Document(milestoneAcceptanceBaseText(text));
  if (!base.ok) return null;
  const reached = computeEffectiveReached(base.document as never);
  return evaluateMilestoneAcceptance({
    source,
    milestoneIds: milestoneIds(text),
    closureReachedMilestoneIds: reached,
  });
}

export function contract8MilestoneSourceDiagnostics(text: string): readonly Diagnostic[] {
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

function missingCriterionWarnings(
  text: string,
  acceptance: MilestoneAcceptanceModelResultV1 | null,
): readonly Diagnostic[] {
  if (acceptance === null || acceptance.grammarVersion !== 7) return Object.freeze([]);
  return Object.freeze(acceptance.milestones
    .filter(({ acceptance: state, grandfathered }) =>
      state === "not_declared" && !grandfathered
    )
    .map(({ milestoneId }): Diagnostic => Object.freeze({
      code: "PTMAC-102",
      severity: "warning",
      message: `Milestone ${milestoneId} has no declared acceptance criterion set; use milestone acceptance replace`,
      entityId: milestoneId,
      helpTopic: "editing",
      data: Object.freeze({ milestone_id: milestoneId }),
    })));
}

export function checkDocument(
  text: string,
  options: Parameters<typeof checkContract7Document>[1] = {},
): CheckResultV5 {
  const baseText = milestoneAcceptanceBaseText(text);
  const base = checkContract7Document(baseText, options);
  const acceptance = acceptanceProjection(text);
  const extra = [
    ...contract8MilestoneSourceDiagnostics(text),
    ...missingCriterionWarnings(text, acceptance),
  ];
  const diagnostics = Object.freeze([...base.diagnostics, ...extra]);
  const extraErrors = extra.filter(({ severity }) => severity === "error").length;
  const extraWarnings = extra.filter(({ severity }) => severity === "warning").length;
  return Object.freeze({
    ...base,
    schemaVersion: CHECK_RESULT_V5,
    ok: base.ok && extraErrors === 0,
    grammarVersion: parseMilestoneAcceptanceSource(
      text,
      MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
    ).grammarVersion,
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

export function analyzeDocument(
  text: string,
  options: AnalyzeOptions = {},
): AnalysisResultV6 {
  const base = analyzeContract7Document(milestoneAcceptanceBaseText(text), options);
  const acceptance = acceptanceProjection(text);
  const diagnostics = Object.freeze([
    ...base.diagnostics,
    ...contract8MilestoneSourceDiagnostics(text),
  ]);
  return Object.freeze({
    ...base,
    schemaVersion: ANALYSIS_RESULT_V6,
    ok: base.ok && (acceptance === null || acceptance.ok) &&
      !diagnostics.some(({ severity }) => severity === "error"),
    grammarVersion: parseMilestoneAcceptanceSource(
      text,
      MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
    ).grammarVersion,
    diagnostics,
    acceptance,
  });
}

export function selectNextTasks(
  text: string,
  options: AnalyzeOptions & NextOptions = {},
): NextResultV7 {
  const base = selectContract7NextTasks(milestoneAcceptanceBaseText(text), options);
  const acceptance = acceptanceProjection(text);
  const diagnostics = Object.freeze([
    ...base.diagnostics,
    ...contract8MilestoneSourceDiagnostics(text),
  ]);
  return Object.freeze({
    ...base,
    schemaVersion: NEXT_RESULT_V7,
    ok: base.ok && (acceptance === null || acceptance.ok) &&
      !diagnostics.some(({ severity }) => severity === "error"),
    grammarVersion: parseMilestoneAcceptanceSource(
      text,
      MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
    ).grammarVersion,
    diagnostics,
    acceptance,
  });
}
