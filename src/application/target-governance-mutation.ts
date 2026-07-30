import { createHash } from "node:crypto";
import {
  classifyGovernanceScopes,
  evaluateGovernanceAuthority,
  governanceDecisionDiagnostics,
  normalizeGovernanceRequest,
} from "../governance/authority.js";
import { governanceSourceSnapshot } from "../governance/source.js";
import type {
  GovernanceDecisionV1,
  GovernanceRequestInput,
} from "../governance/types.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
} from "../model/diagnostics.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type {
  TargetGovernanceBatchMutation,
  TargetGovernanceMutation,
} from "../mutation/target-types.js";
import type {
  MutationOptions,
  MutationResult,
} from "../mutation/types.js";
import {
  planValidatedAdvance,
  type AdvanceDocumentValidation,
  type AdvanceResult,
} from "../mutation/advance.js";
import type { TargetGrammar4Capability } from "../parser/document-parser.js";
import {
  validateTargetGrammar4Document,
  type TargetGrammar4ValidatedDocument,
} from "../semantic/target-validator.js";
import {
  planTargetGrammar4BatchMutation,
  planTargetGrammar4Mutation,
} from "./target-mutate.js";

export interface TargetGovernanceMutationOptions extends MutationOptions {
  readonly governance?: GovernanceRequestInput;
}

export interface TargetGovernanceMutationResultV2 extends MutationResult {
  readonly schemaVersion: "Perttool.MutationResult.v2";
  readonly governance: GovernanceDecisionV1 | null;
}

export interface TargetGovernanceAdvanceResultV2
  extends AdvanceResult {
  readonly schemaVersion: "Perttool.MutationResult.v2";
  readonly governance: GovernanceDecisionV1 | null;
}

interface ValidOriginal {
  readonly validated: TargetGrammar4ValidatedDocument;
  readonly documentId: string | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

function digest(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function mutationOptions(
  options: TargetGovernanceMutationOptions,
): MutationOptions {
  return {
    ...(options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics }),
    ...(options.originalLabel === undefined
      ? {}
      : { originalLabel: options.originalLabel }),
    ...(options.updatedLabel === undefined
      ? {}
      : { updatedLabel: options.updatedLabel }),
  };
}

function validOriginal(
  text: string,
  capability: TargetGrammar4Capability,
  maximum: number,
): ValidOriginal | null {
  const checked = validateTargetGrammar4Document(
    text,
    capability,
    { maxDiagnostics: maximum },
  );
  if (!checked.ok || checked.validatedDocument === null) return null;
  return {
    validated: checked.validatedDocument,
    documentId: checked.documentId,
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  };
}

function requestFailure(
  text: string,
  original: ValidOriginal,
  diagnostic: Diagnostic,
  maximum: number,
): TargetGovernanceMutationResultV2 {
  const limited = limitDiagnostics(
    sortDiagnostics([...original.diagnostics, diagnostic]),
    maximum,
  );
  return Object.freeze({
    schemaVersion: "Perttool.MutationResult.v2",
    ok: false,
    documentId: original.documentId,
    changed: false,
    originalDigest: digest(text),
    updatedDigest: null,
    updatedText: null,
    diff: null,
    edits: Object.freeze([]),
    governance: null,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated:
      original.diagnosticsTruncated || limited.truncated,
  });
}

function governedResult<Result extends MutationResult>(
  original: ValidOriginal,
  base: Result,
  capability: TargetGrammar4Capability,
  options: TargetGovernanceMutationOptions,
): Result & {
  readonly schemaVersion: "Perttool.MutationResult.v2";
  readonly governance: GovernanceDecisionV1 | null;
} {
  if (
    !base.ok ||
    base.updatedText === null ||
    base.updatedDigest === null
  ) {
    return Object.freeze({
      ...base,
      schemaVersion: "Perttool.MutationResult.v2",
      governance: null,
    });
  }
  const normalized = normalizeGovernanceRequest(options.governance);
  if (!normalized.ok) {
    throw new Error(
      "governance request must be normalized before candidate planning",
    );
  }
  const candidate = validateTargetGrammar4Document(
    base.updatedText,
    capability,
    options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics },
  );
  if (!candidate.ok || candidate.validatedDocument === null) {
    throw new Error("governance candidate lost target validation");
  }
  const snapshot = governanceSourceSnapshot(
    original.validated,
    base.originalDigest,
  );
  const scopes = classifyGovernanceScopes(
    original.validated.document,
    candidate.validatedDocument.document,
  );
  const governance = evaluateGovernanceAuthority(
    snapshot,
    scopes,
    normalized.request,
  );
  const decisionDiagnostics = governanceDecisionDiagnostics(governance);
  if (decisionDiagnostics.length === 0) {
    return Object.freeze({
      ...base,
      schemaVersion: "Perttool.MutationResult.v2",
      governance,
    });
  }
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const limited = limitDiagnostics(
    sortDiagnostics([...base.diagnostics, ...decisionDiagnostics]),
    maximum,
  );
  return Object.freeze({
    ...base,
    schemaVersion: "Perttool.MutationResult.v2",
    ok: !decisionDiagnostics.some(({ severity }) => severity === "error"),
    governance,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated:
      base.diagnosticsTruncated || limited.truncated,
  });
}

function invalidOriginalResult(
  result: MutationResult,
): TargetGovernanceMutationResultV2 {
  return Object.freeze({
    ...result,
    schemaVersion: "Perttool.MutationResult.v2",
    governance: null,
  });
}

export function planTargetGovernanceMutation(
  text: string,
  mutation: TargetGovernanceMutation,
  capability: TargetGrammar4Capability,
  options: TargetGovernanceMutationOptions = {},
): TargetGovernanceMutationResultV2 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const original = validOriginal(text, capability, maximum);
  const baseOptions = mutationOptions(options);
  if (original === null) {
    return invalidOriginalResult(
      planTargetGrammar4Mutation(
        text,
        mutation,
        capability,
        baseOptions,
      ),
    );
  }
  const normalized = normalizeGovernanceRequest(options.governance);
  if (!normalized.ok) {
    return requestFailure(
      text,
      original,
      normalized.diagnostics[0],
      maximum,
    );
  }
  const base = planTargetGrammar4Mutation(
    text,
    mutation,
    capability,
    baseOptions,
  );
  return governedResult(original, base, capability, {
    ...options,
    governance: normalized.request,
  });
}

export function planTargetGovernanceBatchMutation(
  text: string,
  mutation: TargetGovernanceBatchMutation,
  capability: TargetGrammar4Capability,
  options: TargetGovernanceMutationOptions = {},
): TargetGovernanceMutationResultV2 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const original = validOriginal(text, capability, maximum);
  const baseOptions = mutationOptions(options);
  if (original === null) {
    return invalidOriginalResult(
      planTargetGrammar4BatchMutation(
        text,
        mutation,
        capability,
        baseOptions,
      ),
    );
  }
  const normalized = normalizeGovernanceRequest(options.governance);
  if (!normalized.ok) {
    return requestFailure(
      text,
      original,
      normalized.diagnostics[0],
      maximum,
    );
  }
  const base = planTargetGrammar4BatchMutation(
    text,
    mutation,
    capability,
    baseOptions,
  );
  return governedResult(original, base, capability, {
    ...options,
    governance: normalized.request,
  });
}

function targetAdvanceValidator(
  capability: TargetGrammar4Capability,
): (text: string, maxDiagnostics: number) => AdvanceDocumentValidation {
  return (text, maxDiagnostics) => {
    const checked = validateTargetGrammar4Document(
      text,
      capability,
      { maxDiagnostics },
    );
    return {
      ok: checked.ok,
      document: checked.document,
      documentId: checked.documentId,
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  };
}

function invalidAdvanceRequest(
  failure: TargetGovernanceMutationResultV2,
): TargetGovernanceAdvanceResultV2 {
  return Object.freeze({
    ...failure,
    advance: null,
  });
}

export function planTargetGovernanceAdvance(
  text: string,
  capability: TargetGrammar4Capability,
  options: TargetGovernanceMutationOptions = {},
): TargetGovernanceAdvanceResultV2 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const original = validOriginal(text, capability, maximum);
  const baseOptions = mutationOptions(options);
  if (original === null) {
    const base = planValidatedAdvance(
      text,
      targetAdvanceValidator(capability),
      baseOptions,
    );
    return Object.freeze({
      ...base,
      schemaVersion: "Perttool.MutationResult.v2",
      governance: null,
    });
  }
  const normalized = normalizeGovernanceRequest(options.governance);
  if (!normalized.ok) {
    return invalidAdvanceRequest(
      requestFailure(
        text,
        original,
        normalized.diagnostics[0],
        maximum,
      ),
    );
  }
  const base = planValidatedAdvance(
    text,
    targetAdvanceValidator(capability),
    baseOptions,
  );
  return governedResult(original, base, capability, {
    ...options,
    governance: normalized.request,
  });
}
