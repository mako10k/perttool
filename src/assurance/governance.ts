import {
  normalizeGovernanceRequest,
  type GovernanceRequestNormalization,
} from "../governance/authority.js";
import type { PrincipalId } from "../governance/source.js";
import type {
  GovernanceDenialCause,
  GovernanceRequest,
  GovernanceRequestInput,
} from "../governance/types.js";
import type { Diagnostic } from "../model/diagnostics.js";
import { compareStableStrings } from "../model/diagnostics.js";

export type PlanAssuranceGovernanceScope = "goal" | "dag" | "plan_assurance";

export interface PlanAssuranceGovernanceScopeDecisionV2 {
  readonly scope: PlanAssuranceGovernanceScope;
  readonly requiredOwner: PrincipalId;
  readonly effectiveDelegates: readonly PrincipalId[];
  readonly actorDirect: boolean;
  readonly ownerConfirmationRequired: boolean;
  readonly ownerConfirmationPresent: boolean;
  readonly scopeAuthorized: boolean;
  readonly denialCause: GovernanceDenialCause | null;
}

export interface PlanAssuranceGovernanceDecisionV2 {
  readonly schemaVersion: "Perttool.GovernanceDecision.v2";
  readonly governanceInterfaceVersion: 2;
  readonly governanceSourceContractVersion: 1;
  readonly governanceSemanticsVersion: 2;
  readonly sourceDigest: string;
  readonly intent: GovernanceRequest["intent"];
  readonly applicable: boolean;
  readonly actor: PrincipalId | null;
  readonly acceptedByOwner: readonly PrincipalId[];
  readonly affectedScopes: readonly PlanAssuranceGovernanceScope[];
  readonly requiredOwnerConfirmations: readonly PrincipalId[];
  readonly ownerConfirmationRequired: boolean;
  readonly writeAuthorized: boolean;
  readonly scopes: readonly PlanAssuranceGovernanceScopeDecisionV2[];
}

export interface PlanAssuranceGovernanceSource {
  readonly sourceDigest: string;
  readonly goalOwner: PrincipalId;
  readonly goalDelegates: ReadonlySet<PrincipalId>;
  readonly dagOwner: PrincipalId;
  readonly dagDelegates: ReadonlySet<PrincipalId>;
}

export function normalizePlanAssuranceGovernanceRequest(
  input: GovernanceRequestInput | undefined,
): GovernanceRequestNormalization {
  return normalizeGovernanceRequest(input);
}

export function evaluatePlanAssuranceGovernance(
  source: PlanAssuranceGovernanceSource,
  affectedScopes: readonly PlanAssuranceGovernanceScope[],
  request: GovernanceRequest,
): PlanAssuranceGovernanceDecisionV2 {
  const canonical = (["goal", "dag", "plan_assurance"] as const)
    .filter((scope) => affectedScopes.includes(scope));
  const scopes: readonly PlanAssuranceGovernanceScopeDecisionV2[] =
    Object.freeze(canonical.map((scope) => {
      const goalScope = scope === "goal";
      const requiredOwner = goalScope ? source.goalOwner : source.dagOwner;
      const delegateSet = goalScope
        ? source.goalDelegates
        : source.dagDelegates;
      const effectiveDelegates = Object.freeze(
        [...delegateSet].sort(compareStableStrings),
      );
      const actorDirect =
        request.actor !== null &&
        (request.actor === requiredOwner || delegateSet.has(request.actor));
      const ownerConfirmationRequired = !actorDirect;
      const ownerConfirmationPresent = request.acceptedByOwner.includes(
        requiredOwner,
      );
      const scopeAuthorized =
        request.actor !== null && (actorDirect || ownerConfirmationPresent);
      const denialCause: GovernanceDenialCause | null = scopeAuthorized
        ? null
        : request.actor === null
          ? "actor_required"
          : request.acceptedByOwner.length === 0
            ? "owner_confirmation_required"
            : "owner_confirmation_mismatch";
      return Object.freeze({
        scope,
        requiredOwner,
        effectiveDelegates,
        actorDirect,
        ownerConfirmationRequired,
        ownerConfirmationPresent,
        scopeAuthorized,
        denialCause,
      });
    }));
  const requiredOwnerConfirmations: PrincipalId[] = [];
  for (const decision of scopes) {
    if (
      decision.ownerConfirmationRequired &&
      !requiredOwnerConfirmations.includes(decision.requiredOwner)
    ) requiredOwnerConfirmations.push(decision.requiredOwner);
  }
  const applicable = scopes.length > 0;
  return Object.freeze({
    schemaVersion: "Perttool.GovernanceDecision.v2",
    governanceInterfaceVersion: 2,
    governanceSourceContractVersion: 1,
    governanceSemanticsVersion: 2,
    sourceDigest: source.sourceDigest,
    intent: request.intent,
    applicable,
    actor: request.actor,
    acceptedByOwner: request.acceptedByOwner,
    affectedScopes: Object.freeze(canonical),
    requiredOwnerConfirmations: Object.freeze(requiredOwnerConfirmations),
    ownerConfirmationRequired: scopes.some(
      ({ ownerConfirmationRequired }) => ownerConfirmationRequired,
    ),
    writeAuthorized: scopes.every(({ scopeAuthorized }) => scopeAuthorized),
    scopes,
  });
}

function diagnostic(
  code: "PTGOV-101" | "PTGOV-103" | "PTGOV-104",
  severity: "error" | "warning",
  message: string,
  decision: PlanAssuranceGovernanceDecisionV2,
): Diagnostic {
  return Object.freeze({
    code,
    severity,
    message,
    helpTopic: "editing",
    data: Object.freeze({
      governance_semantics_version: 2,
      source_digest: decision.sourceDigest,
      actor: decision.actor,
      accepted_by_owner: decision.acceptedByOwner,
      affected_scopes: decision.affectedScopes,
      required_owner_confirmations: decision.requiredOwnerConfirmations,
    }),
  });
}

export function planAssuranceGovernanceDiagnostics(
  decision: PlanAssuranceGovernanceDecisionV2,
): readonly Diagnostic[] {
  if (
    decision.intent === "persist" &&
    decision.applicable &&
    !decision.writeAuthorized
  ) {
    return Object.freeze([diagnostic(
      "PTGOV-101",
      "error",
      "required plan-assurance owner authority was not established against the pre-change document",
      decision,
    )]);
  }
  if (!decision.applicable && decision.acceptedByOwner.length > 0) {
    return Object.freeze([diagnostic(
      "PTGOV-103",
      "warning",
      "owner confirmation assertion is unused because governance is not applicable",
      decision,
    )]);
  }
  if (
    decision.intent === "preview" &&
    decision.applicable &&
    decision.acceptedByOwner.length > 0
  ) {
    return Object.freeze([diagnostic(
      "PTGOV-104",
      "warning",
      "owner confirmation assertion was supplied to a preview and is not persistent authority",
      decision,
    )]);
  }
  return Object.freeze([]);
}
