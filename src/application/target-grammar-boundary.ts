import type { Diagnostic } from "../model/diagnostics.js";
import type { ExactDurationSourceToken } from "../model/exact-duration-source.js";
import type { DocumentNode } from "../model/syntax.js";
import {
  selectExactDurationGrammarBoundary,
  type ExactDurationGrammarBoundaryContext,
  type MigrationGrammarDisposition,
  type MigrationGrammarVersion,
  type MigrationQualification,
  type MigrationReversibility,
} from "../migration/grammar-boundary.js";
import type { TextEdit } from "../mutation/text-edits.js";
import type { TargetGrammar3Capability } from "../parser/document-parser.js";
import {
  validateTargetGrammar3Document,
  type TargetValidationOptions,
} from "../semantic/target-validator.js";
import { planTargetGrammar3Mutation } from "./target-mutate.js";

export interface TargetExactDurationGrammarBoundaryResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly sourceGrammarVersion: MigrationGrammarVersion | null;
  readonly targetGrammarVersion: MigrationGrammarVersion | null;
  readonly grammarDisposition: MigrationGrammarDisposition | null;
  readonly reversibility: MigrationReversibility;
  readonly qualifications: readonly MigrationQualification[];
  readonly versionChanged: boolean;
  readonly versionEdits: readonly TextEdit[];
  readonly versionCandidateText: string | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

function temporalSource(document: DocumentNode): readonly string[] {
  const values: string[] = [];
  for (const declaration of document.declarations) {
    for (const field of declaration.fields) {
      const temporal =
        (declaration.kind === "project" && field.name === "as_of") ||
        (declaration.kind === "milestone" && field.name === "deadline") ||
        (declaration.kind === "task" &&
          (field.name === "not_before" || field.name === "deadline"));
      if (temporal) {
        values.push(
          `${declaration.kind}:${declaration.id}:${field.name}:${field.rawValue}`,
        );
      }
    }
  }
  return values;
}

function failure(
  documentId: string | null,
  diagnostics: readonly Diagnostic[],
  diagnosticsTruncated: boolean,
): TargetExactDurationGrammarBoundaryResult {
  return Object.freeze({
    ok: false,
    documentId,
    sourceGrammarVersion: null,
    targetGrammarVersion: null,
    grammarDisposition: null,
    reversibility: "not_applicable",
    qualifications: Object.freeze([]),
    versionChanged: false,
    versionEdits: Object.freeze([]),
    versionCandidateText: null,
    diagnostics,
    diagnosticsTruncated,
  });
}

export function planTargetExactDurationGrammarBoundary(
  text: string,
  generatedTokens: readonly ExactDurationSourceToken[],
  context: ExactDurationGrammarBoundaryContext,
  capability: TargetGrammar3Capability,
  options: TargetValidationOptions = {},
): TargetExactDurationGrammarBoundaryResult {
  const original = validateTargetGrammar3Document(text, capability, options);
  const validated = original.validatedDocument;
  if (!original.ok || validated === null) {
    return failure(
      original.documentId,
      original.diagnostics,
      original.diagnosticsTruncated,
    );
  }

  const selection = selectExactDurationGrammarBoundary(
    validated.grammarVersion,
    generatedTokens,
    context,
  );
  if (!selection.requiresVersionUpgrade) {
    return Object.freeze({
      ok: true,
      documentId: original.documentId,
      sourceGrammarVersion: selection.sourceGrammarVersion,
      targetGrammarVersion: selection.targetGrammarVersion,
      grammarDisposition: selection.grammarDisposition,
      reversibility: selection.reversibility,
      qualifications: selection.qualifications,
      versionChanged: false,
      versionEdits: Object.freeze([]),
      versionCandidateText: text,
      diagnostics: original.diagnostics,
      diagnosticsTruncated: original.diagnosticsTruncated,
    });
  }

  const planned = planTargetGrammar3Mutation(
    text,
    {
      kind: "project.set",
      set: { version: 3 },
    },
    capability,
    options,
  );
  if (!planned.ok || planned.updatedText === null) {
    return failure(
      planned.documentId,
      planned.diagnostics,
      planned.diagnosticsTruncated,
    );
  }

  const candidate = validateTargetGrammar3Document(
    planned.updatedText,
    capability,
    options,
  );
  if (
    !candidate.ok ||
    candidate.validatedDocument === null ||
    candidate.validatedDocument.grammarVersion !==
      selection.targetGrammarVersion
  ) {
    throw new Error(
      "exact Duration grammar boundary produced an invalid version candidate",
    );
  }
  if (
    JSON.stringify(temporalSource(validated.document)) !==
    JSON.stringify(temporalSource(candidate.validatedDocument.document))
  ) {
    throw new Error(
      "exact Duration grammar boundary changed temporal source",
    );
  }

  return Object.freeze({
    ok: true,
    documentId: planned.documentId,
    sourceGrammarVersion: selection.sourceGrammarVersion,
    targetGrammarVersion: selection.targetGrammarVersion,
    grammarDisposition: selection.grammarDisposition,
    reversibility: selection.reversibility,
    qualifications: selection.qualifications,
    versionChanged: true,
    versionEdits: Object.freeze([...planned.edits]),
    versionCandidateText: planned.updatedText,
    diagnostics: planned.diagnostics,
    diagnosticsTruncated: planned.diagnosticsTruncated,
  });
}
