import { sha256DigestUtf8 } from "../model/sha256.js";
import { validateStoredLifecycleState } from "../actuals/lifecycle.js";
import {
  classifyGovernanceScopes,
  evaluateGovernanceAuthority,
  governanceDecisionDiagnostics,
  normalizeGovernanceRequest,
} from "../governance/authority.js";
import { governanceMetadataFromDocument } from "../governance/source.js";
import type {
  GovernanceDecisionV1,
} from "../governance/types.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
} from "../model/diagnostics.js";
import {
  planValidatedAdvance,
  type ActualsAdvanceDetails,
  type AdvanceDocumentValidation,
  type AdvanceResult,
} from "../mutation/advance.js";
import type {
  TargetGrammar5Capability,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar5Document,
} from "../semantic/target-validator.js";
import type {
  TargetActualsMutationOptions,
} from "./target-actuals-mutation.js";

export interface TargetActualsAdvanceResultV3
  extends Omit<AdvanceResult, "advance"> {
  readonly schemaVersion: "Perttool.MutationResult.v3";
  readonly governance: GovernanceDecisionV1 | null;
  readonly lifecycle: null;
  readonly advance: ActualsAdvanceDetails | null;
}

function actualsAdvanceValidator(
  capability: TargetGrammar5Capability,
): (text: string, maxDiagnostics: number) => AdvanceDocumentValidation {
  return (text, maxDiagnostics) => {
    const checked = validateTargetGrammar5Document(
      text,
      capability,
      { maxDiagnostics },
    );
    const lifecycleDiagnostics =
      checked.validatedDocument === null
        ? []
        : validateStoredLifecycleState(checked.validatedDocument);
    const diagnostics = sortDiagnostics([
      ...checked.diagnostics,
      ...lifecycleDiagnostics,
    ]);
    return {
      ok: checked.ok && lifecycleDiagnostics.length === 0,
      document: checked.document,
      documentId: checked.documentId,
      diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  };
}

export function planTargetActualsAdvance(
  text: string,
  capability: TargetGrammar5Capability,
  options: TargetActualsMutationOptions = {},
): TargetActualsAdvanceResultV3 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const original = validateTargetGrammar5Document(
    text,
    capability,
    { maxDiagnostics: maximum },
  );
  if (!original.ok || original.validatedDocument === null) {
    const base = planValidatedAdvance(
      text,
      actualsAdvanceValidator(capability),
      options,
      { removeTaskOwnedWorkEvents: true },
    );
    return Object.freeze({
      ...base,
      schemaVersion: "Perttool.MutationResult.v3",
      governance: null,
      lifecycle: null,
      advance: base.advance as ActualsAdvanceDetails | null,
    });
  }
  const lifecycleDiagnostics = validateStoredLifecycleState(
    original.validatedDocument,
  );
  if (lifecycleDiagnostics.length > 0) {
    const base = planValidatedAdvance(
      text,
      actualsAdvanceValidator(capability),
      options,
      { removeTaskOwnedWorkEvents: true },
    );
    return Object.freeze({
      ...base,
      schemaVersion: "Perttool.MutationResult.v3",
      governance: null,
      lifecycle: null,
      advance: null,
    });
  }
  const normalized = normalizeGovernanceRequest(options.governance);
  if (!normalized.ok) {
    const limited = limitDiagnostics(
      sortDiagnostics([
        ...original.diagnostics,
        ...normalized.diagnostics,
      ]),
      maximum,
    );
    return Object.freeze({
      schemaVersion: "Perttool.MutationResult.v3",
      ok: false,
      documentId: original.documentId,
      changed: false,
      originalDigest: digest(text),
      updatedDigest: null,
      updatedText: null,
      diff: null,
      edits: Object.freeze([]),
      diagnostics: limited.diagnostics,
      diagnosticsTruncated:
        original.diagnosticsTruncated || limited.truncated,
      governance: null,
      lifecycle: null,
      advance: null,
    });
  }
  const base = planValidatedAdvance(
    text,
    actualsAdvanceValidator(capability),
    options,
    { removeTaskOwnedWorkEvents: true },
  );
  if (
    !base.ok ||
    base.updatedText === null ||
    base.updatedDigest === null ||
    base.advance === null
  ) {
    return Object.freeze({
      ...base,
      schemaVersion: "Perttool.MutationResult.v3",
      governance: null,
      lifecycle: null,
      advance: base.advance as ActualsAdvanceDetails | null,
    });
  }
  const candidate = validateTargetGrammar5Document(
    base.updatedText,
    capability,
    { maxDiagnostics: maximum },
  );
  if (!candidate.ok || candidate.validatedDocument === null) {
    throw new Error("actuals advance candidate lost Grammar 5 validation");
  }
  const metadata = governanceMetadataFromDocument(
    original.validatedDocument.document,
  );
  const governance = evaluateGovernanceAuthority(
    {
      originalDigest: base.originalDigest,
      effective: metadata.effective,
    },
    classifyGovernanceScopes(
      original.validatedDocument.document,
      candidate.validatedDocument.document,
    ),
    normalized.request,
  );
  const decisionDiagnostics = governanceDecisionDiagnostics(governance);
  const diagnostics = [...base.diagnostics, ...decisionDiagnostics];
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maximum);
  return Object.freeze({
    ...base,
    schemaVersion: "Perttool.MutationResult.v3",
    ok: !decisionDiagnostics.some(({ severity }) => severity === "error"),
    governance,
    lifecycle: null,
    advance: base.advance as ActualsAdvanceDetails,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated:
      base.diagnosticsTruncated || limited.truncated,
  });
}

function digest(text: string): string {
  return sha256DigestUtf8(text);
}
