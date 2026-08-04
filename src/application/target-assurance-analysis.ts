import { createHash } from "node:crypto";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import { fieldNamed } from "../model/syntax.js";
import type { TargetGrammar6Capability } from "../parser/document-parser.js";
import {
  validateTargetGrammar6Document,
} from "../semantic/target-validator.js";
import {
  composePlanAssuranceNextAuthority,
  projectPlanAssuranceAnalysis,
  projectPlanAssuranceCheck,
  type PlanAssuranceAnalysisCompositionV1,
  type PlanAssuranceBaseAuthorityInputV1,
  type PlanAssuranceCheckCompositionV1,
  type PlanAssuranceNextCompositionV1,
} from "../assurance/authority.js";
import { evaluatePlanAssurance } from "../assurance/evaluate.js";
import { projectPlanAssuranceInput } from "../assurance/source.js";
import type { PlanAssuranceEvaluationV1 } from "../assurance/types.js";

export interface TargetPlanAssuranceAnalysisCoreV1 {
  readonly modelVersion: 1;
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly sourceDigest: string;
  readonly activeTaskIds: readonly string[];
  readonly evaluation: PlanAssuranceEvaluationV1 | null;
  readonly check: PlanAssuranceCheckCompositionV1 | null;
  readonly analysis: PlanAssuranceAnalysisCompositionV1 | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface TargetPlanAssuranceNextCoreV1 {
  readonly modelVersion: 1;
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly sourceDigest: string;
  readonly next: PlanAssuranceNextCompositionV1 | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

function digest(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function activeTaskIds(
  document: NonNullable<ReturnType<typeof validateTargetGrammar6Document>["validatedDocument"]>["document"],
): readonly string[] {
  return Object.freeze(document.declarations
    .filter((declaration) =>
      declaration.kind === "task" &&
      fieldNamed(declaration, "status")?.value === "active"
    )
    .map(({ id }) => id));
}

function uniqueDiagnostics(
  diagnostics: readonly Diagnostic[],
): readonly Diagnostic[] {
  const byIdentity = new Map<string, Diagnostic>();
  for (const diagnostic of diagnostics) {
    const identity = [
      diagnostic.code,
      diagnostic.severity,
      diagnostic.message,
      diagnostic.entityId ?? null,
    ].join("\u0000");
    if (!byIdentity.has(identity)) byIdentity.set(identity, diagnostic);
  }
  return [...byIdentity.values()];
}

export function analyzeTargetPlanAssuranceDocument(
  text: string,
  capability: TargetGrammar6Capability,
  options: { readonly maxDiagnostics?: number } = {},
): TargetPlanAssuranceAnalysisCoreV1 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const checked = validateTargetGrammar6Document(
    text,
    capability,
    { maxDiagnostics: maximum },
  );
  if (!checked.ok || checked.validatedDocument === null) {
    return Object.freeze({
      modelVersion: 1 as const,
      ok: false,
      documentId: checked.documentId,
      grammarVersion: checked.grammarVersion,
      sourceDigest: digest(text),
      activeTaskIds: Object.freeze([]),
      evaluation: null,
      check: null,
      analysis: null,
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    });
  }
  const evaluation = evaluatePlanAssurance(
    projectPlanAssuranceInput(checked.validatedDocument),
  );
  const active = activeTaskIds(checked.validatedDocument.document);
  const check = projectPlanAssuranceCheck(evaluation, active);
  const analysis = projectPlanAssuranceAnalysis(evaluation, active);
  const limited = limitDiagnostics(sortDiagnostics([
    ...checked.diagnostics,
    ...analysis.diagnostics,
  ]), maximum);
  return Object.freeze({
    modelVersion: 1 as const,
    ok: evaluation.ok,
    documentId: checked.documentId,
    grammarVersion: checked.grammarVersion,
    sourceDigest: digest(text),
    activeTaskIds: active,
    evaluation,
    check,
    analysis,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated || limited.truncated,
  });
}

export function selectTargetPlanAssuranceAuthority(
  text: string,
  capability: TargetGrammar6Capability,
  baseAuthority: PlanAssuranceBaseAuthorityInputV1,
  options: { readonly maxDiagnostics?: number } = {},
): TargetPlanAssuranceNextCoreV1 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const analyzed = analyzeTargetPlanAssuranceDocument(
    text,
    capability,
    { maxDiagnostics: maximum },
  );
  if (
    analyzed.evaluation === null ||
    analyzed.analysis?.assurance === null
  ) {
    return Object.freeze({
      modelVersion: 1 as const,
      ok: false,
      documentId: analyzed.documentId,
      grammarVersion: analyzed.grammarVersion,
      sourceDigest: analyzed.sourceDigest,
      next: null,
      diagnostics: analyzed.diagnostics,
      diagnosticsTruncated: analyzed.diagnosticsTruncated,
    });
  }
  const next = composePlanAssuranceNextAuthority(
    analyzed.evaluation,
    baseAuthority,
    analyzed.activeTaskIds,
  );
  const limited = limitDiagnostics(sortDiagnostics(uniqueDiagnostics([
    ...analyzed.diagnostics,
    ...next.diagnostics,
  ])), maximum);
  return Object.freeze({
    modelVersion: 1 as const,
    ok: next.ok,
    documentId: analyzed.documentId,
    grammarVersion: analyzed.grammarVersion,
    sourceDigest: analyzed.sourceDigest,
    next,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated: analyzed.diagnosticsTruncated || limited.truncated,
  });
}
