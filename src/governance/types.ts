import type { PrincipalId } from "./source.js";

export type GovernancePersistenceIntent = "preview" | "persist";

export interface GovernanceRequestInput {
  readonly intent?: GovernancePersistenceIntent;
  readonly actor?: PrincipalId | null;
  readonly acceptedByOwner?: readonly PrincipalId[];
}

export interface GovernanceRequest {
  readonly intent: GovernancePersistenceIntent;
  readonly actor: PrincipalId | null;
  readonly acceptedByOwner: readonly PrincipalId[];
}

export type GovernanceScope = "goal" | "dag";

export type GovernanceDenialCause =
  | "actor_required"
  | "owner_confirmation_required"
  | "owner_confirmation_mismatch";

export interface GovernanceScopeDecision {
  readonly scope: GovernanceScope;
  readonly requiredOwner: PrincipalId;
  readonly effectiveDelegates: readonly PrincipalId[];
  readonly actorDirect: boolean;
  readonly ownerConfirmationRequired: boolean;
  readonly ownerConfirmationPresent: boolean;
  readonly scopeAuthorized: boolean;
  readonly denialCause: GovernanceDenialCause | null;
}

export interface GovernanceDecisionV1 {
  readonly schemaVersion: "Perttool.GovernanceDecision.v1";
  readonly governanceInterfaceVersion: 1;
  readonly governanceSourceContractVersion: 1;
  readonly governanceSemanticsVersion: 1;
  readonly sourceDigest: string;
  readonly intent: GovernancePersistenceIntent;
  readonly applicable: boolean;
  readonly actor: PrincipalId | null;
  readonly acceptedByOwner: readonly PrincipalId[];
  readonly affectedScopes: readonly GovernanceScope[];
  readonly requiredOwnerConfirmations: readonly PrincipalId[];
  readonly ownerConfirmationRequired: boolean;
  readonly writeAuthorized: boolean;
  readonly scopes: readonly GovernanceScopeDecision[];
}
