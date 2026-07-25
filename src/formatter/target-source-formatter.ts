import {
  TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER,
} from "../model/declaration-fields.js";
import type {
  TargetGrammar3Capability,
  TargetGrammar2Capability,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar3Document,
  validateTargetDocument,
  type TargetValidationOptions,
} from "../semantic/target-validator.js";
import {
  formatValidatedSource,
  type FormatResult,
  type FormatValidation,
} from "./source-formatter.js";

export interface TargetFormatOptions extends TargetValidationOptions {}

function targetValidation(
  text: string,
  capability: TargetGrammar2Capability,
  options: TargetFormatOptions,
): FormatValidation {
  const checked = validateTargetDocument(text, capability, options);
  const document = checked.validatedDocument?.document ?? null;
  const project = document?.declarations.find(
    (declaration) => declaration.kind === "project",
  );
  return {
    ok: checked.ok,
    document,
    documentId: project?.id ?? null,
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  };
}

export function formatTargetDocument(
  text: string,
  capability: TargetGrammar2Capability,
  options: TargetFormatOptions = {},
): FormatResult {
  const checked = targetValidation(text, capability, options);
  return formatValidatedSource(
    text,
    checked,
    (candidate) => targetValidation(candidate, capability, options),
    { fieldOrder: TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER },
  );
}

function targetGrammar3Validation(
  text: string,
  capability: TargetGrammar3Capability,
  options: TargetFormatOptions,
): FormatValidation {
  const checked = validateTargetGrammar3Document(text, capability, options);
  const document = checked.validatedDocument?.document ?? null;
  const project = document?.declarations.find(
    (declaration) => declaration.kind === "project",
  );
  return {
    ok: checked.ok,
    document,
    documentId: project?.id ?? null,
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  };
}

export function formatTargetGrammar3Document(
  text: string,
  capability: TargetGrammar3Capability,
  options: TargetFormatOptions = {},
): FormatResult {
  const checked = targetGrammar3Validation(text, capability, options);
  return formatValidatedSource(
    text,
    checked,
    (candidate) => targetGrammar3Validation(candidate, capability, options),
    { fieldOrder: TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER },
  );
}
