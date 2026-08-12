import type {
  MilestoneAcceptanceReceiptSourceV1,
  MilestoneAcceptanceSourceResultV1,
  MilestoneCriterionSetSourceV1,
  MilestoneCriterionSourceV1,
} from "./source.js";

export const MILESTONE_ACCEPTANCE_MODEL_VERSION = 1 as const;

export type CriterionAcceptanceState =
  | "pending" | "satisfied" | "failed" | "unavailable" | "waived";
export type MilestoneAcceptanceState =
  | "not_declared" | "pending" | "accepted" | "failed" | "unavailable";
export type MilestoneClosureState = "unreached" | "reached";

export interface CriterionAcceptanceResultV1 {
  readonly criterionId: string;
  readonly required: boolean;
  readonly evidenceKind: MilestoneCriterionSourceV1["evidenceKind"];
  readonly commitment: `sha256:${string}`;
  readonly state: CriterionAcceptanceState;
  readonly effectiveReceiptId: string | null;
  readonly evidenceReference: string | null;
  readonly evidenceRevision: string | null;
  readonly verifier: string | null;
  readonly assertedAt: string | null;
  readonly waiverReason: string | null;
  readonly revokedReceiptIds: readonly string[];
}

export interface MilestoneAcceptanceEvaluationV1 {
  readonly milestoneId: string;
  readonly closure: MilestoneClosureState;
  readonly acceptance: MilestoneAcceptanceState;
  readonly grandfathered: boolean;
  readonly criterionSetId: string | null;
  readonly criterionRevisionId: string | null;
  readonly criterionSetCommitment: `sha256:${string}` | null;
  readonly criteria: readonly CriterionAcceptanceResultV1[];
  readonly blockingRequiredCriterionIds: readonly string[];
}

export interface MilestoneAcceptanceEvaluationDiagnosticV1 {
  readonly code: "PTMAC-103" | "PTMAC-104" | "PTMAC-105";
  readonly message: string;
  readonly milestoneId: string | null;
  readonly criterionId: string | null;
  readonly receiptIds: readonly string[];
}

export interface MilestoneAcceptanceModelResultV1 {
  readonly ok: boolean;
  readonly modelVersion: 1;
  readonly grammarVersion: number;
  readonly milestones: readonly MilestoneAcceptanceEvaluationV1[];
  readonly diagnostics: readonly MilestoneAcceptanceEvaluationDiagnosticV1[];
}

export interface MilestoneAcceptanceEvaluationInputV1 {
  readonly source: MilestoneAcceptanceSourceResultV1;
  readonly milestoneIds: readonly string[];
  readonly closureReachedMilestoneIds: ReadonlySet<string>;
}

function diagnostic(
  code: MilestoneAcceptanceEvaluationDiagnosticV1["code"],
  message: string,
  milestoneId: string | null,
  criterionId: string | null,
  receiptIds: readonly string[] = [],
): MilestoneAcceptanceEvaluationDiagnosticV1 {
  return { code, message, milestoneId, criterionId, receiptIds };
}

function terminalState(
  receipt: MilestoneAcceptanceReceiptSourceV1,
): CriterionAcceptanceState | null {
  switch (receipt.action) {
    case "verify": return "satisfied";
    case "fail": return "failed";
    case "unavailable": return "unavailable";
    case "waive": return "waived";
    case "revoke": return null;
  }
}

function evaluateCriterion(
  milestoneId: string,
  set: MilestoneCriterionSetSourceV1,
  criterion: MilestoneCriterionSourceV1,
  receipts: readonly MilestoneAcceptanceReceiptSourceV1[],
  diagnostics: MilestoneAcceptanceEvaluationDiagnosticV1[],
): CriterionAcceptanceResultV1 {
  const owned = receipts.filter((receipt) =>
    receipt.setId === set.id && receipt.criterionId === criterion.criterionId
  );
  const byId = new Map(owned.map((receipt) => [receipt.id, receipt]));
  const revoked = new Set<string>();
  for (const receipt of owned) {
    if (receipt.action !== "revoke") continue;
    const target = receipt.revokes === null ? undefined : byId.get(receipt.revokes);
    if (
      target === undefined ||
      target.action === "revoke" ||
      target.span.start.offset >= receipt.span.start.offset ||
      revoked.has(target.id)
    ) {
      diagnostics.push(diagnostic(
        "PTMAC-105",
        "A revocation must name one earlier unrevoked terminal receipt for the same criterion",
        milestoneId,
        criterion.criterionId,
        target === undefined ? [receipt.id] : [target.id, receipt.id],
      ));
      continue;
    }
    revoked.add(target.id);
  }
  const active = owned.filter((receipt) =>
    terminalState(receipt) !== null && !revoked.has(receipt.id)
  );
  if (active.length > 1) {
    diagnostics.push(diagnostic(
      "PTMAC-104",
      "A criterion has more than one unrevoked terminal receipt",
      milestoneId,
      criterion.criterionId,
      active.map(({ id }) => id),
    ));
  }
  const effective = active.length === 1 ? active[0]! : null;
  if (effective?.action === "waive" && !criterion.required) {
    diagnostics.push(diagnostic(
      "PTMAC-103",
      "Only a required criterion may be waived",
      milestoneId,
      criterion.criterionId,
      [effective.id],
    ));
  }
  return Object.freeze({
    criterionId: criterion.criterionId,
    required: criterion.required,
    evidenceKind: criterion.evidenceKind,
    commitment: criterion.commitment,
    state: effective === null ? "pending" : terminalState(effective)!,
    effectiveReceiptId: effective?.id ?? null,
    evidenceReference: effective?.evidenceReference ?? null,
    evidenceRevision: effective?.evidenceRevision ?? null,
    verifier: effective?.verifier ?? null,
    assertedAt: effective?.occurredAt ?? null,
    waiverReason: effective?.action === "waive" ? effective.reason : null,
    revokedReceiptIds: Object.freeze(owned.filter(({ id }) => revoked.has(id)).map(({ id }) => id)),
  });
}

function aggregate(criteria: readonly CriterionAcceptanceResultV1[]): MilestoneAcceptanceState {
  const required = criteria.filter((criterion) => criterion.required);
  if (required.some(({ state }) => state === "failed")) return "failed";
  if (required.some(({ state }) => state === "unavailable")) return "unavailable";
  if (required.every(({ state }) => state === "satisfied" || state === "waived")) return "accepted";
  return "pending";
}

export function evaluateMilestoneAcceptance(
  input: MilestoneAcceptanceEvaluationInputV1,
): MilestoneAcceptanceModelResultV1 {
  if (!input.source.ok || input.source.grammarVersion === null) {
    throw new TypeError("milestone acceptance evaluation requires a valid source result");
  }
  if (new Set(input.milestoneIds).size !== input.milestoneIds.length) {
    throw new TypeError("milestoneIds must be unique in document declaration order");
  }
  const diagnostics: MilestoneAcceptanceEvaluationDiagnosticV1[] = [];
  const milestoneSet = new Set(input.milestoneIds);
  for (const reached of input.closureReachedMilestoneIds) {
    if (!milestoneSet.has(reached)) throw new TypeError(`unknown closure milestone ${reached}`);
  }
  const sets = input.source.records.filter(
    (record): record is MilestoneCriterionSetSourceV1 =>
      record.kind === "milestone_criterion_set",
  );
  const receipts = input.source.records.filter(
    (record): record is MilestoneAcceptanceReceiptSourceV1 =>
      record.kind === "milestone_acceptance_receipt",
  );
  const grandfathered = new Set(input.source.records
    .filter((record) => record.kind === "milestone_acceptance_migration")
    .flatMap((record) => record.grandfatheredMilestoneIds));
  const results: MilestoneAcceptanceEvaluationV1[] = [];
  for (const milestoneId of input.milestoneIds) {
    const ownedSets = sets.filter((set) => set.milestoneId === milestoneId);
    if (ownedSets.length > 1) diagnostics.push(diagnostic(
      "PTMAC-104",
      "A milestone has more than one current criterion-set revision",
      milestoneId,
      null,
    ));
    const set = ownedSets.length === 1 ? ownedSets[0]! : null;
    const criteria = set === null
      ? []
      : set.criteria.map((criterion) =>
          evaluateCriterion(milestoneId, set, criterion, receipts, diagnostics)
        );
    const acceptance = set === null ? "not_declared" : aggregate(criteria);
    results.push(Object.freeze({
      milestoneId,
      closure: input.closureReachedMilestoneIds.has(milestoneId) ? "reached" : "unreached",
      acceptance,
      grandfathered: grandfathered.has(milestoneId),
      criterionSetId: set?.id ?? null,
      criterionRevisionId: set?.revisionId ?? null,
      criterionSetCommitment: set?.commitment ?? null,
      criteria: Object.freeze(criteria),
      blockingRequiredCriterionIds: Object.freeze(criteria
        .filter(({ required, state }) => required && state !== "satisfied" && state !== "waived")
        .map(({ criterionId }) => criterionId)),
    }));
  }
  return Object.freeze({
    ok: diagnostics.length === 0,
    modelVersion: 1,
    grammarVersion: input.source.grammarVersion,
    milestones: Object.freeze(results),
    diagnostics: Object.freeze(diagnostics),
  });
}
