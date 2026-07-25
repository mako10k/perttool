import type { Diagnostic } from "../model/diagnostics.js";
import {
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
  readonly validatedDocument: TargetValidatedDocument | null;
  readonly diagnostics: readonly Diagnostic[];
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
  const version = project === undefined
    ? undefined
    : fieldNamed(project, "version")?.value ?? 1;
  const ok = !hasErrors(validatedDiagnostics);
  const grammarVersion = version === 1 || version === 2 ? version : undefined;
  return {
    ok,
    validatedDocument: ok && grammarVersion !== undefined
      ? Object.freeze({
          [targetValidatedDocumentBrand]: true as const,
          grammarVersion,
          document: parsed.document,
        })
      : null,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated: parsed.diagnosticsTruncated || limited.truncated,
  };
}
