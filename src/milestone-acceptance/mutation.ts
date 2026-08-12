import { evaluateGovernanceAuthority, governanceDecisionDiagnostics, normalizeGovernanceRequest } from "../governance/authority.js";
import type { GovernanceDecisionV1, GovernanceRequestInput } from "../governance/types.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { replaceValidatedDocumentFile, type DocumentWriteResult } from "../io/safe-write.js";
import { evaluateMilestoneAcceptance, type MilestoneAcceptanceModelResultV1 } from "./evaluate.js";
import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  milestoneCriterionSetCommitment,
  normalizeCallerAssertedUtcZ,
  parseMilestoneAcceptanceSource,
  type AcceptanceReceiptAction,
  type CriterionEvidenceKind,
  type MilestoneAcceptanceReceiptSourceV1,
  type MilestoneAcceptanceSourceRecordV1,
  type MilestoneCriterionSourceV1,
  type MilestoneCriterionSetSourceV1,
} from "./source.js";

export interface CriterionReplacementInputV1 {
  readonly setId: string;
  readonly milestoneId: string;
  readonly revisionId: string;
  readonly criteria: readonly {
    readonly criterionId: string;
    readonly required: boolean;
    readonly evidenceKind: CriterionEvidenceKind;
    readonly description: string;
  }[];
}

export interface ReceiptMutationInputV1 {
  readonly receiptId: string;
  readonly setId: string;
  readonly criterionId: string;
  readonly action: AcceptanceReceiptAction;
  readonly evidenceKind?: CriterionEvidenceKind;
  readonly evidenceReference?: string;
  readonly evidenceRevision?: string;
  readonly verifier?: string;
  readonly occurredAt?: string;
  readonly reason?: string;
  readonly revokes?: string;
}

export interface MilestoneAcceptanceMutationOptionsV1 {
  readonly governance?: GovernanceRequestInput;
}

export interface MilestoneAcceptanceMutationResultV1 {
  readonly modelVersion: 1;
  readonly operation: "replace" | AcceptanceReceiptAction;
  readonly ok: boolean;
  readonly changed: boolean;
  readonly replayed: boolean;
  readonly originalDigest: `sha256:${string}`;
  readonly updatedDigest: `sha256:${string}` | null;
  readonly updatedText: string | null;
  readonly governance: GovernanceDecisionV1 | null;
  readonly evaluation: MilestoneAcceptanceModelResultV1 | null;
  readonly diagnostics: readonly string[];
}

const idPattern = /^[A-Za-z][A-Za-z0-9_-]*$/u;

function governanceMetadata(text: string) {
  const owner = /^  dag_owner ([A-Za-z][A-Za-z0-9_-]*)$/mu.exec(text)?.[1] ?? "user";
  const delegates = /^  dag_delegates(?: ([A-Za-z][A-Za-z0-9_-]*(?: [A-Za-z][A-Za-z0-9_-]*)*))?$/mu.exec(text)?.[1]?.split(" ") ?? [];
  return { owner, delegates: new Set(delegates) };
}

function decision(text: string, digest: `sha256:${string}`, input: GovernanceRequestInput | undefined): { readonly value: GovernanceDecisionV1 | null; readonly diagnostics: readonly string[] } {
  const normalized = normalizeGovernanceRequest(input);
  if (!normalized.ok) return { value: null, diagnostics: Object.freeze(normalized.diagnostics.map(({ code }) => code)) };
  const metadata = governanceMetadata(text);
  const value = evaluateGovernanceAuthority({
    originalDigest: digest,
    effective: {
      goalOwner: "user", goalDelegates: new Set(),
      dagOwner: metadata.owner, dagDelegates: metadata.delegates,
    },
  }, ["dag"], normalized.request);
  return { value, diagnostics: Object.freeze(governanceDecisionDiagnostics(value).map(({ code }) => code)) };
}

function failure(operation: MilestoneAcceptanceMutationResultV1["operation"], text: string, diagnostics: readonly string[], governance: GovernanceDecisionV1 | null = null): MilestoneAcceptanceMutationResultV1 {
  return Object.freeze({ modelVersion: 1, operation, ok: false, changed: false, replayed: false, originalDigest: sha256DigestUtf8(text), updatedDigest: null, updatedText: null, governance, evaluation: null, diagnostics: Object.freeze([...diagnostics]) });
}

function insertAtEnd(text: string, block: string): string {
  return `${text}${text.endsWith("\n") ? "" : "\n"}${text.endsWith("\n\n") ? "" : "\n"}${block}`;
}

function removeSpans(text: string, spans: readonly { readonly start: { readonly offset: number }; readonly end: { readonly offset: number } }[]): string {
  let result = text;
  for (const span of [...spans].sort((a, b) => b.start.offset - a.start.offset)) {
    let start = span.start.offset;
    let end = span.end.offset;
    if (start > 0 && text.slice(Math.max(0, start - 1), start) === "\n" && text.slice(Math.max(0, start - 2), start) === "\n\n") start -= 1;
    result = result.slice(0, start) + result.slice(end);
  }
  return result;
}

function criterionCommitment(input: CriterionReplacementInputV1, criterion: CriterionReplacementInputV1["criteria"][number]): `sha256:${string}` {
  return sha256DigestUtf8(JSON.stringify(["Perttool.MilestoneCriterion.v1", input.milestoneId, input.revisionId, criterion.criterionId, criterion.required, criterion.evidenceKind, criterion.description]));
}

function replacementBlock(input: CriterionReplacementInputV1): string {
  const criteria = input.criteria.map((criterion) => ({ ...criterion, commitment: criterionCommitment(input, criterion) }));
  const commitment = milestoneCriterionSetCommitment(input.milestoneId, input.revisionId, criteria);
  return `milestone_criterion_set ${input.setId}:\n  milestone ${input.milestoneId}\n  revision ${input.revisionId}\n  commitment ${commitment}\n${criteria.map((criterion) => `  criterion ${criterion.criterionId} ${criterion.required ? "required" : "optional"} ${criterion.evidenceKind} ${JSON.stringify(criterion.description)}\n`).join("")}`;
}

function finalResult(operation: MilestoneAcceptanceMutationResultV1["operation"], text: string, candidate: string, governance: GovernanceDecisionV1, replayed = false): MilestoneAcceptanceMutationResultV1 {
  const parsed = parseMilestoneAcceptanceSource(candidate, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  if (!parsed.ok) return failure(operation, text, parsed.diagnostics.map(({ code }) => code), governance);
  const milestoneIds = [...candidate.matchAll(/^milestone ([A-Za-z][A-Za-z0-9_-]*):$/gmu)].map((match) => match[1]!);
  const evaluation = evaluateMilestoneAcceptance({ source: parsed, milestoneIds, closureReachedMilestoneIds: new Set() });
  if (!evaluation.ok) return failure(operation, text, evaluation.diagnostics.map(({ code }) => code), governance);
  const diagnostics = governanceDecisionDiagnostics(governance).map(({ code }) => code);
  const denied = diagnostics.includes("PTGOV-101");
  return Object.freeze({ modelVersion: 1, operation, ok: !denied, changed: candidate !== text, replayed, originalDigest: sha256DigestUtf8(text), updatedDigest: sha256DigestUtf8(candidate), updatedText: candidate, governance, evaluation, diagnostics: Object.freeze(diagnostics) });
}

export function planCriterionSetReplacement(text: string, input: CriterionReplacementInputV1, options: MilestoneAcceptanceMutationOptionsV1 = {}): MilestoneAcceptanceMutationResultV1 {
  const parsed = parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  if (!parsed.ok) return failure("replace", text, parsed.diagnostics.map(({ code }) => code));
  if (![input.setId, input.milestoneId, input.revisionId].every((id) => idPattern.test(id)) || input.criteria.length === 0 || !input.criteria.some(({ required }) => required) || new Set(input.criteria.map(({ criterionId }) => criterionId)).size !== input.criteria.length || input.criteria.some(({ criterionId, description }) => !idPattern.test(criterionId) || description.length === 0)) return failure("replace", text, ["invalid_replacement"]);
  const originalDigest = sha256DigestUtf8(text);
  const governed = decision(text, originalDigest, options.governance);
  if (governed.value === null) return failure("replace", text, governed.diagnostics);
  const ownedSets = parsed.records.filter((record): record is MilestoneCriterionSetSourceV1 => record.kind === "milestone_criterion_set" && record.milestoneId === input.milestoneId);
  const ownedIds = new Set(ownedSets.map(({ id }) => id));
  const owned = parsed.records.filter((record) => ownedIds.has(record.kind === "milestone_acceptance_receipt" ? record.setId : record.id));
  const candidate = insertAtEnd(removeSpans(text, owned.map(({ span }) => span)), replacementBlock(input));
  return finalResult("replace", text, candidate, governed.value);
}

function receiptBlock(set: MilestoneCriterionSetSourceV1, criterion: MilestoneCriterionSourceV1, input: ReceiptMutationInputV1): string | null {
  const time = input.occurredAt === undefined ? null : normalizeCallerAssertedUtcZ(input.occurredAt);
  if (input.action === "verify" && (input.evidenceKind !== criterion.evidenceKind || !input.evidenceReference || !input.evidenceRevision || !input.verifier || time === null)) return null;
  if (input.action === "revoke" && !input.revokes) return null;
  if (input.action === "waive" && (!criterion.required || !input.reason)) return null;
  let block = `milestone_acceptance_receipt ${input.receiptId}:\n  model 1\n  set ${set.id}\n  set_commitment ${set.commitment}\n  criterion ${criterion.criterionId}\n  criterion_commitment ${criterion.commitment}\n  action ${input.action}\n`;
  if (input.action === "verify") block += `  evidence_kind ${input.evidenceKind}\n  evidence_reference ${JSON.stringify(input.evidenceReference)}\n  evidence_revision ${input.evidenceRevision}\n  verifier ${input.verifier}\n  occurred_at ${time}\n`;
  if (input.reason !== undefined) block += `  reason ${JSON.stringify(input.reason)}\n`;
  if (input.revokes !== undefined) block += `  revokes ${input.revokes}\n`;
  return block;
}

export function planAcceptanceReceiptMutation(text: string, input: ReceiptMutationInputV1, options: MilestoneAcceptanceMutationOptionsV1 = {}): MilestoneAcceptanceMutationResultV1 {
  const parsed = parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  if (!parsed.ok) return failure(input.action, text, parsed.diagnostics.map(({ code }) => code));
  if (![input.receiptId, input.setId, input.criterionId].every((id) => idPattern.test(id))) return failure(input.action, text, ["invalid_receipt"]);
  const set = parsed.records.find((record): record is MilestoneCriterionSetSourceV1 => record.kind === "milestone_criterion_set" && record.id === input.setId);
  const criterion = set?.criteria.find(({ criterionId }) => criterionId === input.criterionId);
  if (set === undefined || criterion === undefined) return failure(input.action, text, ["unknown_criterion"]);
  const block = receiptBlock(set, criterion, input);
  if (block === null) return failure(input.action, text, ["invalid_receipt"]);
  const existing = parsed.records.find((record): record is MilestoneAcceptanceReceiptSourceV1 => record.kind === "milestone_acceptance_receipt" && record.id === input.receiptId);
  if (existing !== undefined) {
    const canonicalExisting = text.slice(existing.span.start.offset, existing.span.end.offset);
    if (canonicalExisting === block) {
      const governed = decision(text, sha256DigestUtf8(text), options.governance);
      return governed.value === null ? failure(input.action, text, governed.diagnostics) : finalResult(input.action, text, text, governed.value, true);
    }
    return failure(input.action, text, ["conflicting_receipt_identity"]);
  }
  const governed = decision(text, sha256DigestUtf8(text), options.governance);
  if (governed.value === null) return failure(input.action, text, governed.diagnostics);
  return finalResult(input.action, text, insertAtEnd(text, block), governed.value);
}

export function showMilestoneAcceptance(text: string, closureReachedMilestoneIds: readonly string[]): MilestoneAcceptanceModelResultV1 {
  const source = parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  const milestoneIds = [...text.matchAll(/^milestone ([A-Za-z][A-Za-z0-9_-]*):$/gmu)].map((match) => match[1]!);
  return evaluateMilestoneAcceptance({ source, milestoneIds, closureReachedMilestoneIds: new Set(closureReachedMilestoneIds) });
}

export async function persistMilestoneAcceptanceMutation(path: string, result: MilestoneAcceptanceMutationResultV1, expectedDigest?: string): Promise<DocumentWriteResult> {
  if (!result.ok || !result.changed || result.updatedText === null || result.governance?.intent !== "persist" || !result.governance.writeAuthorized) throw new TypeError("milestone acceptance mutation is not persistable");
  return replaceValidatedDocumentFile(path, result.updatedText, { initialDigest: result.originalDigest, ...(expectedDigest === undefined ? {} : { expectedDigest }) }, (candidate) => {
    const parsed = parseMilestoneAcceptanceSource(candidate, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
    return { ok: parsed.ok, diagnostics: [] };
  });
}
