import type {
  Diagnostic,
  DiagnosticCounts,
} from "../model/diagnostics.js";
import {
  countDiagnostics,
  hasErrors,
  limitDiagnostics,
  normalizeMaxDiagnostics,
} from "../model/diagnostics.js";
import type { DocumentNode } from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  parseTargetDocument,
  type TargetGrammar2Capability,
} from "../parser/document-parser.js";
import { validateTargetDocumentSemantics } from "./validator.js";

export interface TargetValidationOptions {
  readonly maxDiagnostics?: number;
}

const targetValidatedDocumentBrand: unique symbol = Symbol(
  "perttool.target-validated-document",
);

export interface TargetValidatedDocument {
  readonly [targetValidatedDocumentBrand]: true;
  readonly grammarVersion: 1 | 2;
  readonly document: DocumentNode;
}

export interface TargetDocumentValidationResult {
  readonly ok: boolean;
  readonly document: DocumentNode;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly parseFailed: boolean;
  readonly validatedDocument: TargetValidatedDocument | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticCounts: DiagnosticCounts;
  readonly diagnosticsTruncated: boolean;
}

export function validateTargetDocument(
  text: string,
  capability: TargetGrammar2Capability,
  options: TargetValidationOptions = {},
): TargetDocumentValidationResult {
  const maxDiagnostics = normalizeMaxDiagnostics(options.maxDiagnostics);
  const parsed = parseTargetDocument(text, capability, { maxDiagnostics });
  const validatedDiagnostics = validateTargetDocumentSemantics(
    parsed.document,
    parsed.diagnostics,
  );
  const limited = limitDiagnostics(validatedDiagnostics, maxDiagnostics);
  const project = parsed.document.declarations.find(
    (declaration) => declaration.kind === "project",
  );
  const declaredVersion = project === undefined
    ? undefined
    : fieldNamed(project, "version")?.value ?? 1;
  const parseFailed = parsed.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error",
  );
  const diagnosticCounts = parseFailed
    ? parsed.diagnosticCounts
    : countDiagnostics(validatedDiagnostics);
  const ok = !hasErrors(validatedDiagnostics);
  const validatedGrammarVersion =
    declaredVersion === 1 || declaredVersion === 2
      ? declaredVersion
      : undefined;
  return {
    ok,
    document: parsed.document,
    documentId: project?.id ?? null,
    grammarVersion: parseFailed
      ? null
      : typeof declaredVersion === "number"
        ? declaredVersion
        : 1,
    parseFailed,
    validatedDocument: ok && validatedGrammarVersion !== undefined
      ? Object.freeze({
          [targetValidatedDocumentBrand]: true as const,
          grammarVersion: validatedGrammarVersion,
          document: parsed.document,
        })
      : null,
    diagnostics: limited.diagnostics,
    diagnosticCounts,
    diagnosticsTruncated: parsed.diagnosticsTruncated || limited.truncated,
  };
}
