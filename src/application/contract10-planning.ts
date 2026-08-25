import { evaluateContract9PlanAssurance } from "./contract9-assurance-evaluate.js";
import { composeContract9AssuranceImpact } from "./contract9-mixed-mutation.js";
import {
  evaluatePlanAssuranceGovernance,
  normalizePlanAssuranceGovernanceRequest,
  planAssuranceGovernanceDiagnostics,
  type PlanAssuranceGovernanceDecisionV2,
} from "../assurance/governance.js";
import type { PlanAssuranceImpactV1 } from "../assurance/mutation.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import { governanceMetadataFromDocument } from "../governance/source.js";
import type { GovernanceRequestInput } from "../governance/types.js";
import { milestoneAcceptanceBaseText } from "../milestone-acceptance/source.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import {
  observePlanningPool,
  PLANNING_OBSERVATION_CORE_CAPABILITY,
} from "../planning-pool/observation.js";
import type {
  PlanningObservationExecutionContext,
  PlanningPoolObservationResult,
} from "../planning-pool/observation-types.js";
import {
  inspectPlanningPool,
  preflightPlanningPoolReshape,
} from "../planning-pool/public-core.js";
export {
  inspectPlanningPool,
  preflightPlanningPoolReshape,
} from "../planning-pool/public-core.js";
export type {
  PlanningPoolReadOperation,
  PlanningPoolReadQuery,
  PlanningPoolReadResult,
} from "../planning-pool/public-core.js";
import {
  auditPlanningProjection,
  PLANNING_PROJECTION_CORE_CAPABILITY,
  type PlanningDestructiveRecord,
  type PlanningOwnershipTransfer,
} from "../planning-pool/projection.js";
import {
  planningReshapeBinding,
  preflightPlanningReshape,
  preparePlanningReshapeApply,
  PLANNING_RESHAPE_CORE_CAPABILITY,
} from "../planning-pool/reshape.js";
import { PlanningReshapeTokenRegistry } from "../planning-pool/reshape-token.js";
import type {
  PlanningReshapeApplyPreparationResult,
  PlanningReshapePreflightResult,
} from "../planning-pool/reshape-types.js";
import {
  planningPoolBaseText,
  scanPlanningDeclarationBlocks,
} from "../planning-pool/source-lexical.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "../planning-pool/source.js";
import {
  auditPlanningWindowMutation,
  PLANNING_WINDOW_CORE_CAPABILITY,
} from "../planning-pool/window.js";
import type { PlanningWindowMutationAuditResult } from "../planning-pool/window-types.js";
import { planningCanonicalRecordsForEdits } from "../planning-pool/history-guard.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";
import {
  scanTemporalDeclarationBlocks,
  temporalScheduleBaseText,
} from "../temporal-schedule/source-lexical.js";
import { selectNextTasks } from "./contract9-temporal.js";

export interface PlanningMutationOptions {
  readonly governance?: GovernanceRequestInput;
}

export interface PlanningReshapeApplicationResult
  extends PlanningReshapeApplyPreparationResult {
  readonly transfers: readonly PlanningOwnershipTransfer[];
  readonly destructiveRecords: readonly PlanningDestructiveRecord[];
  readonly governance: PlanAssuranceGovernanceDecisionV2 | null;
  readonly assuranceImpact: PlanAssuranceImpactV1 | null;
}

function qualified(documentId: string, id: string): string {
  return id.includes("::") ? id : `${documentId}::${id}`;
}

export function strictPlanningExecutionContext(text: string): PlanningObservationExecutionContext {
  const digest = sha256DigestUtf8(text);
  const parsed = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY);
  const documentId = parsed.documentId ?? "";
  const base = parsed.grammarVersion === 9
    ? planningPoolBaseText(text, scanPlanningDeclarationBlocks(text))
    : text;
  const next = selectNextTasks(base, { sourceDigest: digest });
  const recommended = next.recommendation?.recommendedTaskIds ?? [];
  const startable = next.temporal?.authority.startableRecommendedTaskIds ?? [];
  return Object.freeze({
    source_digest: digest,
    evidence_state: next.ok ? "complete" : "unavailable",
    recommended_task_ids: Object.freeze(recommended.map((id) => qualified(documentId, id))),
    startable_task_ids: Object.freeze(startable.map((id) => qualified(documentId, id))),
  });
}

export function observeCurrentPlanningPool(
  text: string,
  input: unknown,
): PlanningPoolObservationResult {
  return observePlanningPool(
    text,
    input,
    strictPlanningExecutionContext(text),
    PLANNING_OBSERVATION_CORE_CAPABILITY,
  );
}

function strictBase(text: string): string {
  const grammar8 = planningPoolBaseText(text, scanPlanningDeclarationBlocks(text));
  const grammar7 = temporalScheduleBaseText(
    grammar8,
    scanTemporalDeclarationBlocks(grammar8),
  );
  return milestoneAcceptanceBaseText(grammar7);
}

function activeTaskIds(text: string): readonly string[] {
  return Object.freeze(scanTemporalDeclarationBlocks(text)
    .filter(({ kind, lines }) =>
      kind === "task" && lines.some(({ text: line }) => line === "  status active")
    )
    .map(({ id }) => id));
}

function assuranceImpact(
  text: string,
  candidate: string,
): PlanAssuranceImpactV1 | null {
  return composeContract9AssuranceImpact(
    evaluateContract9PlanAssurance(
      planningPoolBaseText(text, scanPlanningDeclarationBlocks(text)),
    ),
    evaluateContract9PlanAssurance(
      planningPoolBaseText(candidate, scanPlanningDeclarationBlocks(candidate)),
    ),
    activeTaskIds(text),
    activeTaskIds(candidate),
  );
}

function planningGovernance(
  text: string,
  scopes: readonly [] | readonly ["dag"],
  input: GovernanceRequestInput | undefined,
): PlanAssuranceGovernanceDecisionV2 | null {
  const validated = validateTargetGrammar6Document(
    strictBase(text),
    TARGET_GRAMMAR_6_CAPABILITY,
  ).validatedDocument;
  const normalized = normalizePlanAssuranceGovernanceRequest(input);
  if (validated === null || !normalized.ok) return null;
  const metadata = governanceMetadataFromDocument(validated.document);
  return evaluatePlanAssuranceGovernance({
    sourceDigest: sha256DigestUtf8(text),
    goalOwner: metadata.effective.goalOwner,
    goalDelegates: metadata.effective.goalDelegates,
    dagOwner: metadata.effective.dagOwner,
    dagDelegates: metadata.effective.dagDelegates,
  }, scopes, normalized.request);
}

export function preparePlanningPoolReshapeApply(
  text: string,
  input: unknown,
  preflightHash: string,
  preflightToken: string,
  registry: PlanningReshapeTokenRegistry,
  options: PlanningMutationOptions = {},
): PlanningReshapeApplicationResult {
  const prepared = preparePlanningReshapeApply(
    text,
    input,
    preflightHash,
    preflightToken,
    registry,
    PLANNING_RESHAPE_CORE_CAPABILITY,
  );
  if (!prepared.ok || prepared.candidateText === null || prepared.authorityImpact === null) {
    return Object.freeze({
      ...prepared,
      transfers: Object.freeze([]),
      destructiveRecords: Object.freeze([]),
      governance: null,
      assuranceImpact: null,
    });
  }
  const projection = prepared.normalizedRequest?.intent === "reshape"
    ? null
    : auditPlanningProjection(text, input, PLANNING_PROJECTION_CORE_CAPABILITY);
  const canonicalRecords = planningCanonicalRecordsForEdits(
    text,
    prepared.documentId ?? "",
    prepared.edits,
  );
  const destructiveRecords = Object.freeze([
    ...(projection?.destructiveRecords ?? []),
    ...canonicalRecords,
  ].filter((record, index, values) => values.findIndex((candidate) =>
    candidate.entityKind === record.entityKind &&
    candidate.qualifiedId === record.qualifiedId &&
    candidate.startOffset === record.startOffset &&
    candidate.endOffset === record.endOffset) === index));
  const governance = planningGovernance(
    text,
    prepared.authorityImpact.affectedScopes,
    options.governance,
  );
  const governanceDiagnostics = governance === null
    ? []
    : planAssuranceGovernanceDiagnostics(governance);
  const impact = assuranceImpact(text, prepared.candidateText);
  const assuranceDiagnostics = impact?.projection.diagnostics ?? [];
  return Object.freeze({
    ...prepared,
    ok: prepared.ok && ![...governanceDiagnostics, ...assuranceDiagnostics]
      .some(({ severity }) => severity === "error"),
    transfers: projection?.transfers ?? Object.freeze([]),
    destructiveRecords,
    governance,
    assuranceImpact: impact,
    diagnostics: Object.freeze([
      ...prepared.diagnostics,
      ...governanceDiagnostics,
      ...assuranceDiagnostics,
    ]),
  });
}

export function beginPlanningPoolReshapeCommit(
  prepared: PlanningReshapeApplicationResult,
  token: string,
  registry: PlanningReshapeTokenRegistry,
) {
  return registry.beginCommit(token, planningReshapeBinding(prepared));
}

export function settlePlanningPoolReshapeCommit(
  token: string,
  observedDigest: string,
  registry: PlanningReshapeTokenRegistry,
) {
  return registry.settleCommit(token, observedDigest);
}

export function recoverPlanningPoolReshapeCommit(
  token: string,
  observedDigest: string,
  registry: PlanningReshapeTokenRegistry,
) {
  return registry.settleCommit(token, observedDigest);
}

export function planPlanningWindowMutation(
  text: string,
  input: unknown,
  options: PlanningMutationOptions = {},
) {
  const audit = auditPlanningWindowMutation(
    text,
    input,
    PLANNING_WINDOW_CORE_CAPABILITY,
  );
  if (!audit.ok || audit.candidateText === null) {
    return Object.freeze({
      ...audit,
      governance: null,
      assuranceImpact: null,
    });
  }
  const governance = planningGovernance(text, [], options.governance);
  const governanceDiagnostics = governance === null
    ? []
    : planAssuranceGovernanceDiagnostics(governance);
  const impact = assuranceImpact(text, audit.candidateText);
  const assuranceDiagnostics = impact?.projection.diagnostics ?? [];
  return Object.freeze({
    ...audit,
    ok: audit.ok && ![...governanceDiagnostics, ...assuranceDiagnostics]
      .some(({ severity }) => severity === "error"),
    governance,
    assuranceImpact: impact,
    diagnostics: Object.freeze([
      ...audit.diagnostics,
      ...governanceDiagnostics,
      ...assuranceDiagnostics,
    ]),
  });
}

export function planningCandidateProjection(
  text: string,
  candidateText: string,
  edits: readonly { readonly startOffset: number; readonly endOffset: number; readonly replacement: string }[],
) {
  return Object.freeze({
    originalDigest: sha256DigestUtf8(text),
    updatedDigest: sha256DigestUtf8(candidateText),
    updatedText: candidateText,
    changed: candidateText !== text,
    edits: Object.freeze([...edits]),
    diff: createUnifiedDiff(text, candidateText, {
      originalLabel: "original",
      updatedLabel: "candidate",
    }),
  });
}
