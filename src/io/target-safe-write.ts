import type {
  TargetGrammar2Capability,
} from "../parser/document-parser.js";
import {
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
