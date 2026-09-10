import { compareStableStrings } from "../model/diagnostics.js";
import type { GovernanceSourceSnapshot } from "../governance/source.js";
import type { PlanReviewAuthorityDecisionV1 } from "./mutation-types.js";

export function evaluatePlanReviewAuthority(
  requestId: string,
  sourceDigest: string,
  candidateDigest: string,
  actor: string,
  acceptedOwners: readonly string[],
  effective: GovernanceSourceSnapshot["effective"],
): PlanReviewAuthorityDecisionV1 {
  const delegates = Object.freeze([...effective.dagDelegates].sort(compareStableStrings));
  const actorDirect = actor === effective.dagOwner || effective.dagDelegates.has(actor);
  const ownerConfirmationSatisfied = acceptedOwners.includes(effective.dagOwner);
  return Object.freeze({
    model_version: 1,
    request_id: requestId,
    source_digest: sourceDigest,
    candidate_digest: candidateDigest,
    actor,
    effective_dag_owner: effective.dagOwner,
    effective_dag_delegates: delegates,
    actor_direct: actorDirect,
    owner_confirmation_required: !actorDirect,
    owner_confirmation_satisfied: ownerConfirmationSatisfied,
    authorized: actorDirect || ownerConfirmationSatisfied,
  });
}
