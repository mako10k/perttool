import type { Diagnostic } from "../model/diagnostics.js";
import { compareStableStrings } from "../model/diagnostics.js";
import type {
  DeclarationNode,
  DocumentNode,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type { GovernanceSourceSnapshot, PrincipalId } from "./source.js";
import type {
  GovernanceDecisionV1,
  GovernanceDenialCause,
  GovernanceRequest,
  GovernanceRequestInput,
  GovernanceScope,
  GovernanceScopeDecision,
} from "./types.js";

const principalPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const canonicalScopes = ["goal", "dag"] as const;

export type GovernanceRequestErrorCause =
  | "invalid_intent"
  | "invalid_actor"
  | "invalid_accepted_by_owner"
  | "duplicate_accepted_by_owner"
  | "unsupported_field";

export interface GovernanceRequestNormalizationSuccess {
  readonly ok: true;
  readonly request: GovernanceRequest;
  readonly diagnostics: readonly [];
}

export interface GovernanceRequestNormalizationFailure {
  readonly ok: false;
  readonly request: null;
  readonly diagnostics: readonly [Diagnostic];
}

export type GovernanceRequestNormalization =
  | GovernanceRequestNormalizationSuccess
  | GovernanceRequestNormalizationFailure;

function requestDiagnostic(cause: GovernanceRequestErrorCause): Diagnostic {
  return Object.freeze({
    code: "PTGOV-102",
    severity: "error",
    message: "invalid governance caller assertions",
    helpTopic: "editing",
    data: Object.freeze({ cause }),
  });
}

function requestFailure(
  cause: GovernanceRequestErrorCause,
): GovernanceRequestNormalizationFailure {
  return Object.freeze({
    ok: false,
    request: null,
    diagnostics: Object.freeze([requestDiagnostic(cause)]) as readonly [Diagnostic],
  });
}

export function normalizeGovernanceRequest(
  input: unknown = {},
): GovernanceRequestNormalization {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return requestFailure("unsupported_field");
  }
  const record = input as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (field) => !["intent", "actor", "acceptedByOwner"].includes(field),
    )
  ) {
    return requestFailure("unsupported_field");
  }
  const intent = record["intent"] ?? "preview";
  if (intent !== "preview" && intent !== "persist") {
    return requestFailure("invalid_intent");
  }
  const actor = record["actor"] ?? null;
  if (
    actor !== null &&
    (typeof actor !== "string" || !principalPattern.test(actor))
  ) {
    return requestFailure("invalid_actor");
  }
  const accepted = record["acceptedByOwner"] ?? [];
  if (
    !Array.isArray(accepted) ||
    accepted.some(
      (principal) =>
        typeof principal !== "string" || !principalPattern.test(principal),
    )
  ) {
    return requestFailure("invalid_accepted_by_owner");
  }
  if (new Set(accepted).size !== accepted.length) {
    return requestFailure("duplicate_accepted_by_owner");
  }
  const normalized = Object.freeze({
    intent,
    actor: actor as PrincipalId | null,
    acceptedByOwner: Object.freeze(
      [...accepted].sort(compareStableStrings) as PrincipalId[],
    ),
  });
  return Object.freeze({
    ok: true,
    request: normalized,
    diagnostics: Object.freeze([]) as readonly [],
  });
}

function comparableField(
  declaration: DeclarationNode | undefined,
  name: string,
): unknown {
  const field = declaration === undefined ? undefined : fieldNamed(declaration, name);
  if (field === undefined) return undefined;
  return Array.isArray(field.value) ? [...field.value] : field.value;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }
  return left === right;
}

function projectOf(document: DocumentNode): DeclarationNode | undefined {
  return document.declarations.find(({ kind }) => kind === "project");
}

function structuralDeclarations(
  document: DocumentNode,
): ReadonlyMap<string, DeclarationNode> {
  const result = new Map<string, DeclarationNode>();
  for (const declaration of document.declarations) {
    if (
      declaration.kind === "task" ||
      declaration.kind === "gate" ||
      declaration.kind === "milestone"
    ) {
      result.set(`${declaration.kind}\u0000${declaration.id}`, declaration);
    }
  }
  return result;
}

function hasStructuralDagChange(
  original: DocumentNode,
  candidate: DocumentNode,
): boolean {
  const originalDeclarations = structuralDeclarations(original);
  const candidateDeclarations = structuralDeclarations(candidate);
  if (originalDeclarations.size !== candidateDeclarations.size) return true;
  for (const [key, before] of originalDeclarations) {
    const after = candidateDeclarations.get(key);
    if (after === undefined) return true;
    if (
      (before.kind === "task" || before.kind === "gate") &&
      (before.from !== after.from || before.to !== after.to)
    ) {
      return true;
    }
  }
  return false;
}

function fieldChanged(
  original: DeclarationNode | undefined,
  candidate: DeclarationNode | undefined,
  name: string,
): boolean {
  return !valuesEqual(
    comparableField(original, name),
    comparableField(candidate, name),
  );
}

export function classifyGovernanceScopes(
  original: DocumentNode,
  candidate: DocumentNode,
): readonly GovernanceScope[] {
  if (original.text === candidate.text) return Object.freeze([]);
  const before = projectOf(original);
  const after = projectOf(candidate);
  const scopes: GovernanceScope[] = [];
  if (
    fieldChanged(before, after, "finish") ||
    fieldChanged(before, after, "goal_owner") ||
    fieldChanged(before, after, "goal_delegates")
  ) {
    scopes.push("goal");
  }
  if (
    hasStructuralDagChange(original, candidate) ||
    fieldChanged(before, after, "dag_owner") ||
    fieldChanged(before, after, "dag_delegates")
  ) {
    scopes.push("dag");
  }
  return Object.freeze(scopes);
}

function scopeDecision(
  snapshot: GovernanceSourceSnapshot,
  scope: GovernanceScope,
  request: GovernanceRequest,
): GovernanceScopeDecision {
  const requiredOwner =
    scope === "goal"
      ? snapshot.effective.goalOwner
      : snapshot.effective.dagOwner;
  const delegateSet =
    scope === "goal"
      ? snapshot.effective.goalDelegates
      : snapshot.effective.dagDelegates;
  const effectiveDelegates = Object.freeze(
    [...delegateSet].sort(compareStableStrings),
  );
  const actorDirect =
    request.actor !== null &&
    (request.actor === requiredOwner || delegateSet.has(request.actor));
  const ownerConfirmationRequired = !actorDirect;
  const ownerConfirmationPresent =
    request.acceptedByOwner.includes(requiredOwner);
  const scopeAuthorized =
    request.actor !== null &&
    (actorDirect || (ownerConfirmationRequired && ownerConfirmationPresent));
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
}

export function evaluateGovernanceAuthority(
  snapshot: GovernanceSourceSnapshot,
  affectedScopes: readonly GovernanceScope[],
  request: GovernanceRequest,
): GovernanceDecisionV1 {
  const selected = canonicalScopes.filter((scope) => affectedScopes.includes(scope));
  const scopes = Object.freeze(
    selected.map((scope) => scopeDecision(snapshot, scope, request)),
  );
  const requiredOwnerConfirmations: PrincipalId[] = [];
  for (const decision of scopes) {
    if (
      decision.ownerConfirmationRequired &&
      !requiredOwnerConfirmations.includes(decision.requiredOwner)
    ) {
      requiredOwnerConfirmations.push(decision.requiredOwner);
    }
  }
  return Object.freeze({
    schemaVersion: "Perttool.GovernanceDecision.v1",
    governanceInterfaceVersion: 1,
    governanceSourceContractVersion: 1,
    governanceSemanticsVersion: 1,
    sourceDigest: snapshot.originalDigest,
    intent: request.intent,
    applicable: scopes.length > 0,
    actor: request.actor,
    acceptedByOwner: request.acceptedByOwner,
    affectedScopes: Object.freeze([...selected]),
    requiredOwnerConfirmations: Object.freeze(requiredOwnerConfirmations),
    ownerConfirmationRequired: scopes.some(
      ({ ownerConfirmationRequired }) => ownerConfirmationRequired,
    ),
    writeAuthorized: scopes.every(({ scopeAuthorized }) => scopeAuthorized),
    scopes,
  });
}

export function governanceDenialDiagnostic(
  decision: GovernanceDecisionV1,
): Diagnostic | null {
  if (
    decision.intent !== "persist" ||
    !decision.applicable ||
    decision.writeAuthorized
  ) {
    return null;
  }
  return Object.freeze({
    code: "PTGOV-101",
    severity: "error",
    message:
      "required owner-aware write authority was not established against the pre-change document",
    helpTopic: "editing",
    data: Object.freeze({
      governance_semantics_version: 1,
      source_digest: decision.sourceDigest,
      actor: decision.actor,
      accepted_by_owner: decision.acceptedByOwner,
      denied_scopes: Object.freeze(
        decision.scopes
          .filter(({ scopeAuthorized }) => !scopeAuthorized)
          .map(({ scope, requiredOwner, denialCause }) =>
            Object.freeze({
              scope,
              required_owner: requiredOwner,
              cause: denialCause,
            }),
          ),
      ),
    }),
  });
}
