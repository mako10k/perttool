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
import type {
  DocumentNode,
  TargetDeclarationKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  parseTargetGrammar3Document,
  parseTargetGrammar4Document,
  parseTargetGrammar5Document,
  parseTargetDocument,
  type TargetGrammar3Capability,
  type TargetGrammar4Capability,
  type TargetGrammar5Capability,
  type TargetGrammar2Capability,
} from "../parser/document-parser.js";
import {
  validateTargetDocumentSemantics,
  validateTargetGrammar3DocumentSemantics,
  validateTargetGrammar4DocumentSemantics,
  validateTargetGrammar5DocumentSemantics,
} from "./validator.js";

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

const targetGrammar3ValidatedDocumentBrand: unique symbol = Symbol(
  "perttool.target-grammar-3-validated-document",
);

export interface TargetGrammar3ValidatedDocument {
  readonly [targetGrammar3ValidatedDocumentBrand]: true;
  readonly grammarVersion: 1 | 2 | 3;
  readonly document: DocumentNode;
}

export interface TargetGrammar3DocumentValidationResult
  extends Omit<TargetDocumentValidationResult, "validatedDocument"> {
  readonly validatedDocument: TargetGrammar3ValidatedDocument | null;
}

const targetGrammar4ValidatedDocumentBrand: unique symbol = Symbol(
  "perttool.target-grammar-4-validated-document",
);

export interface TargetGrammar4ValidatedDocument {
  readonly [targetGrammar4ValidatedDocumentBrand]: true;
  readonly grammarVersion: 1 | 2 | 3 | 4;
  readonly document: DocumentNode;
}

export interface TargetGrammar4DocumentValidationResult
  extends Omit<TargetDocumentValidationResult, "validatedDocument"> {
  readonly validatedDocument: TargetGrammar4ValidatedDocument | null;
}

const targetGrammar5ValidatedDocumentBrand: unique symbol = Symbol(
  "perttool.target-grammar-5-validated-document",
);

export interface TargetGrammar5ValidatedDocument {
  readonly [targetGrammar5ValidatedDocumentBrand]: true;
  readonly grammarVersion: 1 | 2 | 3 | 4 | 5;
  readonly document: DocumentNode<TargetDeclarationKind>;
}

export interface TargetGrammar5DocumentValidationResult
  extends Omit<
    TargetDocumentValidationResult,
    "document" | "validatedDocument"
  > {
  readonly document: DocumentNode<TargetDeclarationKind>;
  readonly validatedDocument: TargetGrammar5ValidatedDocument | null;
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

export function validateTargetGrammar3Document(
  text: string,
  capability: TargetGrammar3Capability,
  options: TargetValidationOptions = {},
): TargetGrammar3DocumentValidationResult {
  const maxDiagnostics = normalizeMaxDiagnostics(options.maxDiagnostics);
  const parsed = parseTargetGrammar3Document(
    text,
    capability,
    { maxDiagnostics },
  );
  const validatedDiagnostics = validateTargetGrammar3DocumentSemantics(
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
    declaredVersion === 1 ||
    declaredVersion === 2 ||
    declaredVersion === 3
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
          [targetGrammar3ValidatedDocumentBrand]: true as const,
          grammarVersion: validatedGrammarVersion,
          document: parsed.document,
        })
      : null,
    diagnostics: limited.diagnostics,
    diagnosticCounts,
    diagnosticsTruncated: parsed.diagnosticsTruncated || limited.truncated,
  };
}

export function validateTargetGrammar4Document(
  text: string,
  capability: TargetGrammar4Capability,
  options: TargetValidationOptions = {},
): TargetGrammar4DocumentValidationResult {
  const maxDiagnostics = normalizeMaxDiagnostics(options.maxDiagnostics);
  const parsed = parseTargetGrammar4Document(
    text,
    capability,
    { maxDiagnostics },
  );
  const validatedDiagnostics = validateTargetGrammar4DocumentSemantics(
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
    declaredVersion === 1 ||
    declaredVersion === 2 ||
    declaredVersion === 3 ||
    declaredVersion === 4
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
          [targetGrammar4ValidatedDocumentBrand]: true as const,
          grammarVersion: validatedGrammarVersion,
          document: parsed.document,
        })
      : null,
    diagnostics: limited.diagnostics,
    diagnosticCounts,
    diagnosticsTruncated: parsed.diagnosticsTruncated || limited.truncated,
  };
}

export function validateTargetGrammar5Document(
  text: string,
  capability: TargetGrammar5Capability,
  options: TargetValidationOptions = {},
): TargetGrammar5DocumentValidationResult {
  const maxDiagnostics = normalizeMaxDiagnostics(options.maxDiagnostics);
  const parsed = parseTargetGrammar5Document(
    text,
    capability,
    { maxDiagnostics },
  );
  const validatedDiagnostics = validateTargetGrammar5DocumentSemantics(
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
    declaredVersion === 1 ||
    declaredVersion === 2 ||
    declaredVersion === 3 ||
    declaredVersion === 4 ||
    declaredVersion === 5
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
          [targetGrammar5ValidatedDocumentBrand]: true as const,
          grammarVersion: validatedGrammarVersion,
          document: parsed.document,
        })
      : null,
    diagnostics: limited.diagnostics,
    diagnosticCounts,
    diagnosticsTruncated: parsed.diagnosticsTruncated || limited.truncated,
  };
}
