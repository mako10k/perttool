import type {
  TargetGrammar3Capability,
  TargetGrammar2Capability,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar3Document,
  validateTargetDocument,
} from "../semantic/target-validator.js";
import {
  createValidatedDocumentFile,
  replaceValidatedDocumentFile,
  type CreateDocumentOptions,
  type DocumentCandidateValidator,
  type DocumentWriteResult,
  type ReplaceDocumentOptions,
} from "./safe-write.js";

function targetValidator(
  capability: TargetGrammar2Capability,
): DocumentCandidateValidator {
  return (text) => {
    const checked = validateTargetDocument(text, capability);
    return {
      ok: checked.ok,
      diagnostics: checked.diagnostics,
    };
  };
}

function targetGrammar3Validator(
  capability: TargetGrammar3Capability,
): DocumentCandidateValidator {
  return (text) => {
    const checked = validateTargetGrammar3Document(text, capability);
    return {
      ok: checked.ok,
      diagnostics: checked.diagnostics,
    };
  };
}

export async function replaceTargetDocumentFile(
  target: string,
  candidateText: string,
  capability: TargetGrammar2Capability,
  options: ReplaceDocumentOptions,
): Promise<DocumentWriteResult> {
  return replaceValidatedDocumentFile(
    target,
    candidateText,
    options,
    targetValidator(capability),
  );
}

export async function createTargetDocumentFile(
  target: string,
  candidateText: string,
  capability: TargetGrammar2Capability,
  options: CreateDocumentOptions = {},
): Promise<DocumentWriteResult> {
  return createValidatedDocumentFile(
    target,
    candidateText,
    targetValidator(capability),
    options,
  );
}

export async function replaceTargetGrammar3DocumentFile(
  target: string,
  candidateText: string,
  capability: TargetGrammar3Capability,
  options: ReplaceDocumentOptions,
): Promise<DocumentWriteResult> {
  return replaceValidatedDocumentFile(
    target,
    candidateText,
    options,
    targetGrammar3Validator(capability),
  );
}

export async function createTargetGrammar3DocumentFile(
  target: string,
  candidateText: string,
  capability: TargetGrammar3Capability,
  options: CreateDocumentOptions = {},
): Promise<DocumentWriteResult> {
  return createValidatedDocumentFile(
    target,
    candidateText,
    targetGrammar3Validator(capability),
    options,
  );
}
