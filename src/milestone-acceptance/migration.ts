import { sha256DigestUtf8 } from "../model/sha256.js";
import { fieldNamed } from "../model/syntax.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";
import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  parseMilestoneAcceptanceSource,
} from "./source.js";

export const MILESTONE_ACCEPTANCE_MIGRATION_MODEL_VERSION = 1 as const;

export interface CommittedMigrationProofV1 {
  readonly repositoryId: string;
  readonly repositoryRelativePath: string;
  readonly objectFormat: "sha1" | "sha256";
  readonly headCommit: string;
  readonly headBlob: string;
  readonly stage0Blob: string;
  readonly sourceDigest: `sha256:${string}`;
}

export interface MilestoneAcceptanceMigrationPlanV1 {
  readonly ok: boolean;
  readonly modelVersion: 1;
  readonly changed: boolean;
  readonly sourceGrammarVersion: number | null;
  readonly targetGrammarVersion: 7 | null;
  readonly sourceDigest: `sha256:${string}`;
  readonly candidateDigest: `sha256:${string}` | null;
  readonly grandfatheredMilestoneIds: readonly string[];
  readonly candidateText: string | null;
  readonly diagnostics: readonly string[];
}

function candidateCommitment(
  proof: CommittedMigrationProofV1,
  ids: readonly string[],
): `sha256:${string}` {
  return sha256DigestUtf8(JSON.stringify([
    "Perttool.MilestoneAcceptanceMigrationCandidate.v1",
    proof.repositoryId,
    proof.repositoryRelativePath,
    proof.objectFormat,
    proof.headCommit,
    proof.headBlob,
    proof.sourceDigest,
    ids,
  ]));
}

function replaceVersion(text: string): string | null {
  const pattern = /(^  version )(\d+)(\r?$)/mu;
  if (!pattern.test(text)) return null;
  return text.replace(pattern, "$17$3");
}

function insertionOffset(text: string): number | null {
  const project = /^project [A-Za-z][A-Za-z0-9_-]*:\r?\n(?:^(?:  |\s*$).*\r?\n?)*/mu.exec(text);
  return project === null ? null : project.index + project[0].length;
}

export function planMilestoneAcceptanceMigration(
  text: string,
  proof: CommittedMigrationProofV1,
): MilestoneAcceptanceMigrationPlanV1 {
  const sourceDigest = sha256DigestUtf8(text);
  const diagnostics: string[] = [];
  if (proof.sourceDigest !== sourceDigest) diagnostics.push("source_digest_mismatch");
  if (proof.headBlob !== proof.stage0Blob) diagnostics.push("stage0_not_equal_to_head");
  const objectLength = proof.objectFormat === "sha1" ? 40 : 64;
  if (!new RegExp(`^[0-9a-f]{${objectLength}}$`, "u").test(proof.headCommit)) diagnostics.push("invalid_head");
  if (!new RegExp(`^[0-9a-f]{${objectLength}}$`, "u").test(proof.headBlob)) diagnostics.push("invalid_blob");
  if (proof.repositoryId.length === 0 || proof.repositoryRelativePath.length === 0 || proof.repositoryRelativePath.startsWith("/") || proof.repositoryRelativePath.split("/").includes("..")) diagnostics.push("invalid_repository_binding");

  const checked = validateTargetGrammar6Document(text, TARGET_GRAMMAR_6_CAPABILITY);
  const grammar = checked.validatedDocument?.grammarVersion ?? null;
  if (!checked.ok || grammar === null) diagnostics.push("invalid_source");
  const grandfathered = checked.document.declarations
    .filter((declaration) =>
      declaration.kind === "milestone" && fieldNamed(declaration, "state")?.value === "reached"
    )
    .map((declaration) => declaration.id)
    .sort();
  if (diagnostics.length > 0) return Object.freeze({ ok: false, modelVersion: 1, changed: false, sourceGrammarVersion: grammar, targetGrammarVersion: null, sourceDigest, candidateDigest: null, grandfatheredMilestoneIds: Object.freeze(grandfathered), candidateText: null, diagnostics: Object.freeze(diagnostics) });

  const upgraded = replaceVersion(text);
  const offset = insertionOffset(upgraded ?? "");
  if (upgraded === null || offset === null) return Object.freeze({ ok: false, modelVersion: 1, changed: false, sourceGrammarVersion: grammar, targetGrammarVersion: null, sourceDigest, candidateDigest: null, grandfatheredMilestoneIds: Object.freeze(grandfathered), candidateText: null, diagnostics: Object.freeze(["version_or_project_span_unavailable"]) });
  const commitment = candidateCommitment(proof, grandfathered);
  let record = `\nmilestone_acceptance_migration GRAMMAR_7_BASELINE:\n  model 1\n  repository ${proof.repositoryId}\n  path ${JSON.stringify(proof.repositoryRelativePath)}\n  object_format ${proof.objectFormat}\n  head ${proof.headCommit}\n  blob ${proof.headBlob}\n  source_digest ${proof.sourceDigest}\n  candidate_digest ${commitment}\n`;
  for (const id of grandfathered) record += `  grandfathered ${id}\n`;
  const candidateText = upgraded.slice(0, offset) + record + upgraded.slice(offset);
  const candidate = parseMilestoneAcceptanceSource(candidateText, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  if (!candidate.ok) throw new Error(`migration candidate invariant failed: ${candidate.diagnostics.map(({ code }) => code).join(",")}`);
  return Object.freeze({ ok: true, modelVersion: 1, changed: true, sourceGrammarVersion: grammar, targetGrammarVersion: 7, sourceDigest, candidateDigest: commitment, grandfatheredMilestoneIds: Object.freeze(grandfathered), candidateText, diagnostics: Object.freeze([]) });
}

export function recheckCommittedMigrationProof(
  baseline: CommittedMigrationProofV1,
  current: CommittedMigrationProofV1,
): boolean {
  return baseline.repositoryId === current.repositoryId &&
    baseline.repositoryRelativePath === current.repositoryRelativePath &&
    baseline.objectFormat === current.objectFormat &&
    baseline.headCommit === current.headCommit &&
    baseline.headBlob === current.headBlob &&
    baseline.stage0Blob === current.stage0Blob &&
    baseline.sourceDigest === current.sourceDigest;
}
