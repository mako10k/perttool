import {
  evaluateEditorRepairCandidate,
  type EditorRepairCandidateV1,
  type EditorRepairDocumentBindingV1,
  type EditorRepairInteraction,
} from "../editor/repair.js";
import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  milestoneAcceptanceBaseText,
  parseMilestoneAcceptanceSource,
} from "../milestone-acceptance/source.js";
import { normalizeMaxDiagnostics } from "../model/diagnostics.js";
import type { TargetDeclarationKind } from "../model/syntax.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import { analyzeTargetPlanAssuranceDocument } from
  "./target-assurance-analysis.js";
import {
  checkDocument,
  planUnitMigration,
} from "./contract8-milestone-acceptance.js";

export interface EditorRepairApplicationRequestV1 {
  readonly binding: EditorRepairDocumentBindingV1;
  readonly interaction: EditorRepairInteraction;
  readonly automatic: boolean;
  readonly matchingDiagnosticCount: number;
  readonly requestedRangeIntersectsDiagnostic: boolean;
}

function assurance(text: string, maximum: number) {
  const source = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  if (!source.ok || (source.grammarVersion !== 6 && source.grammarVersion !== 7)) {
    return null;
  }
  return analyzeTargetPlanAssuranceDocument(
    source.grammarVersion === 7 ? milestoneAcceptanceBaseText(text) : text,
    TARGET_GRAMMAR_6_CAPABILITY,
    { maxDiagnostics: maximum },
  ).evaluation;
}

function declarationIdentities(
  text: string,
  declarations: readonly { readonly kind: TargetDeclarationKind; readonly id: string }[],
): readonly string[] {
  const source = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  return Object.freeze([
    ...declarations.map(({ kind, id }) => `${kind}:${id}`),
    ...source.records.map(({ kind, id }) => `${kind}:${id}`),
  ]);
}

function protectedRecordKinds(
  text: string,
  declarations: readonly { readonly kind: TargetDeclarationKind }[],
): readonly string[] {
  const protectedKinds = new Set<string>();
  for (const declaration of declarations) {
    if (
      declaration.kind === "plan_seal" ||
      declaration.kind === "task_outcome" ||
      declaration.kind === "assurance_receipt"
    ) protectedKinds.add(declaration.kind);
  }
  const source = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  for (const record of source.records) {
    if (
      record.kind === "milestone_criterion_set" ||
      record.kind === "milestone_acceptance_receipt"
    ) protectedKinds.add(record.kind);
  }
  return Object.freeze([...protectedKinds].sort());
}

export function planEditorRepair(
  text: string,
  request: EditorRepairApplicationRequestV1,
  options: { readonly maxDiagnostics?: number } = {},
): EditorRepairCandidateV1 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const source = checkDocument(text, { maxDiagnostics: maximum });
  const migration = planUnitMigration(
    text,
    { targetUnit: "point", replacementVelocity: null },
    { maxDiagnostics: maximum },
  );
  const candidateText = migration.updatedText;
  const candidate = candidateText === null
    ? null
    : checkDocument(candidateText, { maxDiagnostics: maximum });
  const sourceProtected = protectedRecordKinds(
    text,
    source.document.declarations,
  );
  const candidateProtected = candidate === null
    ? Object.freeze([])
    : protectedRecordKinds(candidateText!, candidate.document.declarations);

  return evaluateEditorRepairCandidate({
    binding: request.binding,
    sourceText: text,
    sourceOk: source.ok,
    sourceDiagnostics: source.diagnostics,
    sourceDiagnosticsTruncated: source.diagnosticsTruncated,
    migration,
    candidateOk: candidate?.ok ?? false,
    candidateDiagnostics: candidate?.diagnostics ?? Object.freeze([]),
    candidateDiagnosticsTruncated:
      candidate?.diagnosticsTruncated ?? migration.diagnosticsTruncated,
    sourceAssurance: assurance(text, maximum),
    candidateAssurance:
      candidateText === null ? null : assurance(candidateText, maximum),
    sourceDeclarationIdentities: declarationIdentities(
      text,
      source.document.declarations,
    ),
    candidateDeclarationIdentities: candidate === null || candidateText === null
      ? Object.freeze([])
      : declarationIdentities(candidateText, candidate.document.declarations),
    protectedRecordKinds: Object.freeze([
      ...new Set([...sourceProtected, ...candidateProtected]),
    ]),
    interaction: request.interaction,
    automatic: request.automatic,
    matchingDiagnosticCount: request.matchingDiagnosticCount,
    requestedRangeIntersectsDiagnostic:
      request.requestedRangeIntersectsDiagnostic,
  });
}
