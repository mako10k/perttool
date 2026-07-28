import type { SourceSpan } from "../model/diagnostics.js";
import type {
  DocumentNode,
  TargetDeclarationKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type { TargetGrammar4ValidatedDocument } from "../semantic/target-validator.js";

export type PrincipalId = string;

export interface DeclaredGovernance {
  readonly goalOwner: PrincipalId | null;
  readonly goalDelegates: readonly PrincipalId[] | null;
  readonly dagOwner: PrincipalId | null;
  readonly dagDelegates: readonly PrincipalId[] | null;
}

export interface EffectiveGovernance {
  readonly goalOwner: PrincipalId;
  readonly goalDelegates: ReadonlySet<PrincipalId>;
  readonly dagOwner: PrincipalId;
  readonly dagDelegates: ReadonlySet<PrincipalId>;
}

export interface GovernanceMetadata {
  readonly declared: DeclaredGovernance;
  readonly effective: EffectiveGovernance;
}

export interface GovernanceFieldSource {
  readonly fieldSpan: SourceSpan;
  readonly valueSpan: SourceSpan;
}

export interface GovernanceSourceSnapshot extends GovernanceMetadata {
  readonly originalDigest: string;
  readonly grammarVersion: 1 | 2 | 3 | 4;
  readonly sourceSpans: {
    readonly goalOwner: GovernanceFieldSource | null;
    readonly goalDelegates: GovernanceFieldSource | null;
    readonly dagOwner: GovernanceFieldSource | null;
    readonly dagDelegates: GovernanceFieldSource | null;
  };
}

class ImmutablePrincipalSet implements ReadonlySet<PrincipalId> {
  readonly #values: Set<PrincipalId>;

  constructor(values: readonly PrincipalId[]) {
    this.#values = new Set(values);
    Object.freeze(this);
  }

  get size(): number {
    return this.#values.size;
  }

  has(value: PrincipalId): boolean {
    return this.#values.has(value);
  }

  entries(): SetIterator<[PrincipalId, PrincipalId]> {
    return this.#values.entries();
  }

  keys(): SetIterator<PrincipalId> {
    return this.#values.keys();
  }

  values(): SetIterator<PrincipalId> {
    return this.#values.values();
  }

  forEach(
    callbackfn: (
      value: PrincipalId,
      value2: PrincipalId,
      set: ReadonlySet<PrincipalId>,
    ) => void,
    thisArg?: unknown,
  ): void {
    for (const value of this.#values) {
      callbackfn.call(thisArg, value, value, this);
    }
  }

  [Symbol.iterator](): SetIterator<PrincipalId> {
    return this.values();
  }
}

function declaredOwner(
  document: DocumentNode<TargetDeclarationKind>,
  fieldName: "goal_owner" | "dag_owner",
): PrincipalId | null {
  const project = document.declarations.find(({ kind }) => kind === "project");
  const value = project === undefined
    ? undefined
    : fieldNamed(project, fieldName)?.value;
  if (value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`validated governance field ${fieldName} is not a principal`);
  }
  return value;
}

function declaredDelegates(
  document: DocumentNode<TargetDeclarationKind>,
  fieldName: "goal_delegates" | "dag_delegates",
): readonly PrincipalId[] | null {
  const project = document.declarations.find(({ kind }) => kind === "project");
  const value = project === undefined
    ? undefined
    : fieldNamed(project, fieldName)?.value;
  if (value === undefined) return null;
  if (
    !Array.isArray(value) ||
    value.some((principal) => typeof principal !== "string")
  ) {
    throw new Error(
      `validated governance field ${fieldName} is not a principal list`,
    );
  }
  return Object.freeze([...value] as PrincipalId[]);
}

function immutableSet(
  values: readonly PrincipalId[],
): ReadonlySet<PrincipalId> {
  return new ImmutablePrincipalSet(values);
}

export function governanceMetadataFromDocument(
  document: DocumentNode<TargetDeclarationKind>,
): GovernanceMetadata {
  const declared = Object.freeze({
    goalOwner: declaredOwner(document, "goal_owner"),
    goalDelegates: declaredDelegates(document, "goal_delegates"),
    dagOwner: declaredOwner(document, "dag_owner"),
    dagDelegates: declaredDelegates(document, "dag_delegates"),
  });
  const effective = Object.freeze({
    goalOwner: declared.goalOwner ?? "user",
    goalDelegates: immutableSet(declared.goalDelegates ?? []),
    dagOwner: declared.dagOwner ?? "user",
    dagDelegates: immutableSet(declared.dagDelegates ?? []),
  });
  return Object.freeze({ declared, effective });
}

function fieldSource(
  document: DocumentNode<TargetDeclarationKind>,
  fieldName:
    | "goal_owner"
    | "goal_delegates"
    | "dag_owner"
    | "dag_delegates",
): GovernanceFieldSource | null {
  const project = document.declarations.find(({ kind }) => kind === "project");
  const field = project === undefined ? undefined : fieldNamed(project, fieldName);
  return field === undefined
    ? null
    : Object.freeze({
        fieldSpan: field.span,
        valueSpan: field.valueSpan,
      });
}

export function governanceSourceSnapshot(
  validated: TargetGrammar4ValidatedDocument,
  originalDigest: string,
): GovernanceSourceSnapshot {
  if (typeof originalDigest !== "string" || originalDigest.length === 0) {
    throw new TypeError("originalDigest must be a nonempty string");
  }
  const metadata = governanceMetadataFromDocument(validated.document);
  return Object.freeze({
    originalDigest,
    grammarVersion: validated.grammarVersion,
    declared: metadata.declared,
    effective: metadata.effective,
    sourceSpans: Object.freeze({
      goalOwner: fieldSource(validated.document, "goal_owner"),
      goalDelegates: fieldSource(validated.document, "goal_delegates"),
      dagOwner: fieldSource(validated.document, "dag_owner"),
      dagDelegates: fieldSource(validated.document, "dag_delegates"),
    }),
  });
}
