import {
  canonicalizeExactDurationSourceToken,
  type ExactDurationSourceToken,
} from "../model/exact-duration-source.js";

export type MigrationGrammarVersion = 1 | 2 | 3 | 4 | 5;

export type MigrationGrammarDisposition =
  | "retained"
  | "upgraded_for_exact_fraction";

export type MigrationVelocityDisposition =
  | "retained"
  | "replaced"
  | "inserted";

export type MigrationReversibility =
  | "exact"
  | "values_exact_metadata_changed"
  | "not_applicable";

export type MigrationQualification =
  | "grammar_upgraded_for_exact_fraction"
  | "grammar_version_retained_on_inverse"
  | "velocity_replaced"
  | "velocity_inserted";

export interface ExactDurationGrammarBoundaryContext {
  readonly migrationChanged: boolean;
  readonly velocityDisposition: MigrationVelocityDisposition | null;
}

export interface ExactDurationGrammarSelection {
  readonly sourceGrammarVersion: MigrationGrammarVersion;
  readonly targetGrammarVersion: MigrationGrammarVersion;
  readonly grammarDisposition: MigrationGrammarDisposition;
  readonly requiresVersionUpgrade: boolean;
  readonly reversibility: MigrationReversibility;
  readonly qualifications: readonly MigrationQualification[];
}

function requireGrammarVersion(
  value: number,
): asserts value is MigrationGrammarVersion {
  if (
    value !== 1 &&
    value !== 2 &&
    value !== 3 &&
    value !== 4 &&
    value !== 5
  ) {
    throw new RangeError(
      "source grammar version must be 1, 2, 3, 4, or 5",
    );
  }
}

function requireContext(context: ExactDurationGrammarBoundaryContext): void {
  if (typeof context.migrationChanged !== "boolean") {
    throw new TypeError("migrationChanged must be boolean");
  }
  if (
    context.velocityDisposition !== null &&
    context.velocityDisposition !== "retained" &&
    context.velocityDisposition !== "replaced" &&
    context.velocityDisposition !== "inserted"
  ) {
    throw new TypeError("velocityDisposition is invalid");
  }
  if (
    context.migrationChanged &&
    context.velocityDisposition === null
  ) {
    throw new TypeError(
      "a changing migration requires a velocity disposition",
    );
  }
  if (
    !context.migrationChanged &&
    (context.velocityDisposition === "replaced" ||
      context.velocityDisposition === "inserted")
  ) {
    throw new TypeError(
      "a no-op migration cannot replace or insert velocity",
    );
  }
}

function requireCanonicalGeneratedToken(
  value: ExactDurationSourceToken,
): void {
  if (
    value === null ||
    typeof value !== "object" ||
    (value.classification !== "decimal" &&
      value.classification !== "fraction") ||
    typeof value.token !== "string"
  ) {
    throw new TypeError("generated Duration token is invalid");
  }
  const canonical = canonicalizeExactDurationSourceToken(value.token);
  if (
    canonical === null ||
    canonical.token !== value.token ||
    canonical.classification !== value.classification
  ) {
    throw new TypeError("generated Duration token must be canonical");
  }
}

export function selectExactDurationGrammarBoundary(
  sourceGrammarVersion: number,
  generatedTokens: readonly ExactDurationSourceToken[],
  context: ExactDurationGrammarBoundaryContext,
): ExactDurationGrammarSelection {
  requireGrammarVersion(sourceGrammarVersion);
  if (!Array.isArray(generatedTokens)) {
    throw new TypeError("generatedTokens must be an array");
  }
  requireContext(context);
  for (const token of generatedTokens) requireCanonicalGeneratedToken(token);

  const fractionRequired = generatedTokens.some(
    ({ classification }) => classification === "fraction",
  );
  if (
    !context.migrationChanged &&
    sourceGrammarVersion !== 3 &&
    sourceGrammarVersion !== 4 &&
    sourceGrammarVersion !== 5 &&
    fractionRequired
  ) {
    throw new TypeError("a no-op migration cannot require a grammar upgrade");
  }
  const requiresVersionUpgrade =
    sourceGrammarVersion !== 3 &&
    sourceGrammarVersion !== 4 &&
    sourceGrammarVersion !== 5 &&
    fractionRequired;
  const targetGrammarVersion = requiresVersionUpgrade
    ? 3
    : sourceGrammarVersion;
  const qualifications: MigrationQualification[] = [];
  if (requiresVersionUpgrade) {
    qualifications.push("grammar_upgraded_for_exact_fraction");
  } else if (
    context.migrationChanged &&
    (
      sourceGrammarVersion === 3 ||
      sourceGrammarVersion === 4 ||
      sourceGrammarVersion === 5
    ) &&
    generatedTokens.length > 0 &&
    !fractionRequired
  ) {
    qualifications.push("grammar_version_retained_on_inverse");
  }
  if (context.velocityDisposition === "replaced") {
    qualifications.push("velocity_replaced");
  } else if (context.velocityDisposition === "inserted") {
    qualifications.push("velocity_inserted");
  }

  const reversibility: MigrationReversibility =
    !context.migrationChanged
      ? "not_applicable"
      : qualifications.length > 0
        ? "values_exact_metadata_changed"
        : "exact";

  return Object.freeze({
    sourceGrammarVersion,
    targetGrammarVersion,
    grammarDisposition: requiresVersionUpgrade
      ? "upgraded_for_exact_fraction"
      : "retained",
    requiresVersionUpgrade,
    reversibility,
    qualifications: Object.freeze(qualifications),
  });
}
