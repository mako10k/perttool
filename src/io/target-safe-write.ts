import type {
  TargetGrammar4Capability,
  TargetGrammar5Capability,
  TargetGrammar6Capability,
  TargetGrammar3Capability,
  TargetGrammar2Capability,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar4Document,
  validateTargetGrammar5Document,
  validateTargetGrammar6Document,
  validateTargetGrammar3Document,
  validateTargetDocument,
} from "../semantic/target-validator.js";
import {
  createValidatedDocumentFile,
  createValidatedDocumentFileFromSource,
  replaceValidatedDocumentFile,
  type CreateDocumentOptions,
  type CreateDocumentFromSourceOptions,
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

function targetGrammar4Validator(
  capability: TargetGrammar4Capability,
): DocumentCandidateValidator {
  return (text) => {
    const checked = validateTargetGrammar4Document(text, capability);
    return {
      ok: checked.ok,
      diagnostics: checked.diagnostics,
    };
  };
}

function targetGrammar5Validator(
  capability: TargetGrammar5Capability,
): DocumentCandidateValidator {
  return (text) => {
    const checked = validateTargetGrammar5Document(text, capability);
    return {
      ok: checked.ok,
      diagnostics: checked.diagnostics,
    };
  };
}

function targetGrammar6Validator(
  capability: TargetGrammar6Capability,
): DocumentCandidateValidator {
  return (text) => {
    const checked = validateTargetGrammar6Document(text, capability);
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

export async function replaceTargetGrammar4DocumentFile(
  target: string,
  candidateText: string,
  capability: TargetGrammar4Capability,
  options: ReplaceDocumentOptions,
): Promise<DocumentWriteResult> {
  return replaceValidatedDocumentFile(
    target,
    candidateText,
    options,
    targetGrammar4Validator(capability),
  );
}

export async function createTargetGrammar4DocumentFile(
  target: string,
  candidateText: string,
  capability: TargetGrammar4Capability,
  options: CreateDocumentOptions = {},
): Promise<DocumentWriteResult> {
  return createValidatedDocumentFile(
    target,
    candidateText,
    targetGrammar4Validator(capability),
    options,
  );
}

export async function createTargetGrammar4DocumentFileFromSource(
  source: string,
  target: string,
  candidateText: string,
  capability: TargetGrammar4Capability,
  options: CreateDocumentFromSourceOptions,
): Promise<DocumentWriteResult> {
  return createValidatedDocumentFileFromSource(
    source,
    target,
    candidateText,
    targetGrammar4Validator(capability),
    options,
  );
}

export async function replaceTargetGrammar5DocumentFile(
  target: string,
  candidateText: string,
  capability: TargetGrammar5Capability,
  options: ReplaceDocumentOptions,
): Promise<DocumentWriteResult> {
  return replaceValidatedDocumentFile(
    target,
    candidateText,
    options,
    targetGrammar5Validator(capability),
  );
}

export async function createTargetGrammar5DocumentFile(
  target: string,
  candidateText: string,
  capability: TargetGrammar5Capability,
  options: CreateDocumentOptions = {},
): Promise<DocumentWriteResult> {
  return createValidatedDocumentFile(
    target,
    candidateText,
    targetGrammar5Validator(capability),
    options,
  );
}

export async function createTargetGrammar5DocumentFileFromSource(
  source: string,
  target: string,
  candidateText: string,
  capability: TargetGrammar5Capability,
  options: CreateDocumentFromSourceOptions,
): Promise<DocumentWriteResult> {
  return createValidatedDocumentFileFromSource(
    source,
    target,
    candidateText,
    targetGrammar5Validator(capability),
    options,
  );
}

export async function replaceTargetGrammar6DocumentFile(
  target: string,
  candidateText: string,
  capability: TargetGrammar6Capability,
  options: ReplaceDocumentOptions,
): Promise<DocumentWriteResult> {
  return replaceValidatedDocumentFile(
    target,
    candidateText,
    options,
    targetGrammar6Validator(capability),
  );
}

export async function createTargetGrammar6DocumentFile(
  target: string,
  candidateText: string,
  capability: TargetGrammar6Capability,
  options: CreateDocumentOptions = {},
): Promise<DocumentWriteResult> {
  return createValidatedDocumentFile(
    target,
    candidateText,
    targetGrammar6Validator(capability),
    options,
  );
}

export async function createTargetGrammar6DocumentFileFromSource(
  source: string,
  target: string,
  candidateText: string,
  capability: TargetGrammar6Capability,
  options: CreateDocumentFromSourceOptions,
): Promise<DocumentWriteResult> {
  return createValidatedDocumentFileFromSource(
    source,
    target,
    candidateText,
    targetGrammar6Validator(capability),
    options,
  );
}
