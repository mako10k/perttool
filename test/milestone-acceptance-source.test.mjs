import assert from "node:assert/strict";
import test from "node:test";
import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  milestoneCriterionSetCommitment,
  parseMilestoneAcceptanceSource,
} from "../dist/milestone-acceptance/source.js";
import {
  planMilestoneAcceptanceMigration,
  recheckCommittedMigrationProof,
} from "../dist/milestone-acceptance/migration.js";
import { sha256DigestUtf8 } from "../dist/model/sha256.js";
import { readFile } from "node:fs/promises";

const base = `project P:\n  version 6\n  title "P"\n  as_of 2026-08-12\n  duration_unit point\n  velocity 1p/1d\n  finish DONE\n  dag_owner user\n\nmilestone START:\n  title "Start"\n  state reached\n\nmilestone DONE:\n  title "Done"\n\ntask WORK START -> DONE:\n  title "Work"\n  duration 1p\n`;

const sha1 = "a".repeat(40);
const blob = "b".repeat(40);

function proof(text = base) {
  return {
    repositoryId: "repo-1",
    repositoryRelativePath: "plans/p.pert",
    objectFormat: "sha1",
    headCommit: sha1,
    headBlob: blob,
    stage0Blob: blob,
    sourceDigest: sha256DigestUtf8(text),
  };
}

test("Grammar 7 criterion sets retain exact spans, commitments, and canonical order", () => {
  const criterion = {
    criterionId: "BUILD",
    required: true,
    evidenceKind: "command",
    description: "Complete repository gate passes",
  };
  const criterionCommitment = sha256DigestUtf8(JSON.stringify([
    "Perttool.MilestoneCriterion.v1", "DONE", "R1", "BUILD", true,
    "command", criterion.description,
  ]));
  const commitment = milestoneCriterionSetCommitment("DONE", "R1", [{
    ...criterion,
    commitment: criterionCommitment,
  }]);
  const source = `${base.replace("version 6", "version 7")}\nmilestone_criterion_set DONE_R1:\n  milestone DONE\n  revision R1\n  commitment ${commitment}\n  criterion BUILD required command ${JSON.stringify(criterion.description)}\n`;
  const result = parseMilestoneAcceptanceSource(source, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  assert.equal(result.ok, true);
  assert.equal(result.grammarVersion, 7);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].kind, "milestone_criterion_set");
  assert.equal(result.records[0].span.start.offset, source.indexOf("milestone_criterion_set"));
  assert.equal(result.canonicalText, source);
});

test("criterion replacement input rejects optional-only and commitment mismatch", () => {
  const source = `${base.replace("version 6", "version 7")}\nmilestone_criterion_set DONE_R1:\n  milestone DONE\n  revision R1\n  commitment sha256:${"0".repeat(64)}\n  criterion NOTE optional owner "Review"\n`;
  const result = parseMilestoneAcceptanceSource(source, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["PTMAC-103"]);
});

test("receipt provenance is self-asserted but strict UTC Z and evidence fields are required", () => {
  const description = "Build passes";
  const criterionCommitment = sha256DigestUtf8(JSON.stringify(["Perttool.MilestoneCriterion.v1", "DONE", "R1", "BUILD", true, "command", description]));
  const setCommitment = milestoneCriterionSetCommitment("DONE", "R1", [{ criterionId: "BUILD", required: true, evidenceKind: "command", description, commitment: criterionCommitment }]);
  const source = `${base.replace("version 6", "version 7")}\nmilestone_criterion_set DONE_R1:\n  milestone DONE\n  revision R1\n  commitment ${setCommitment}\n  criterion BUILD required command ${JSON.stringify(description)}\n\nmilestone_acceptance_receipt RCPT1:\n  model 1\n  set DONE_R1\n  set_commitment ${setCommitment}\n  criterion BUILD\n  criterion_commitment ${criterionCommitment}\n  action verify\n  evidence_kind command\n  evidence_reference "npm run check"\n  evidence_revision none\n  verifier codex\n  occurred_at 2026-08-12T12:00:00Z\n`;
  const valid = parseMilestoneAcceptanceSource(source.replace("00Z", "00.1200Z"), MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  assert.equal(valid.ok, true);
  assert.equal(valid.records.at(-1).occurredAt, "2026-08-12T12:00:00.12Z");
  const invalid = source.replace("2026-08-12T12:00:00Z", "2026-08-12T12:00:00+09:00");
  assert.deepEqual(parseMilestoneAcceptanceSource(invalid, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY).diagnostics.map(({ code }) => code), ["PTMAC-106"]);
  const impossible = source.replace("2026-08-12T12:00:00Z", "2026-02-31T12:00:00Z");
  assert.deepEqual(parseMilestoneAcceptanceSource(impossible, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY).diagnostics.map(({ code }) => code), ["PTMAC-106"]);
});

test("migration creates only a version and exact committed grandfather baseline", () => {
  const result = planMilestoneAcceptanceMigration(base, proof());
  assert.equal(result.ok, true);
  assert.equal(result.targetGrammarVersion, 7);
  assert.deepEqual(result.grandfatheredMilestoneIds, ["START"]);
  assert.match(result.candidateText, /milestone_acceptance_migration GRAMMAR_7_BASELINE/u);
  assert.doesNotMatch(result.candidateText, /milestone_criterion_set|milestone_acceptance_receipt/u);
  const checked = parseMilestoneAcceptanceSource(result.candidateText, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  assert.equal(checked.ok, true);
  assert.equal(checked.records[0].kind, "milestone_acceptance_migration");
});

test("migration fails closed for dirty, staged, unbound, and raced proof", () => {
  assert.deepEqual(planMilestoneAcceptanceMigration(base + "\n", proof()).diagnostics, ["source_digest_mismatch"]);
  assert.deepEqual(planMilestoneAcceptanceMigration(base, { ...proof(), stage0Blob: "c".repeat(40) }).diagnostics, ["stage0_not_equal_to_head"]);
  assert.deepEqual(planMilestoneAcceptanceMigration(base, { ...proof(), repositoryRelativePath: "../p.pert" }).diagnostics, ["invalid_repository_binding"]);
  assert.equal(recheckCommittedMigrationProof(proof(), proof()), true);
  assert.equal(recheckCommittedMigrationProof(proof(), { ...proof(), headCommit: "d".repeat(40) }), false);
});

test("source capability remains internal while Contract 8 catalogs are active", async () => {
  const root = await import("../dist/index.js");
  assert.equal("MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY" in root, false);
  assert.equal(root.COMMAND_REGISTRY.length, 53);
  assert.equal(root.getJsonSchemaCatalog().length, 23);
  assert.equal(root.checkDocument(base).grammarVersion, 6);
});

test("accepted public activation leaves history and adapters startable", async () => {
  const root = await import("../dist/index.js");
  const plan = await readFile(new URL("../plans/milestone-acceptance.pert", import.meta.url), "utf8");
  assert.match(plan, /task MILESTONE_ACCEPTANCE_SOURCE[\s\S]*?\n  status done\n/u);
  const next = root.selectNextTasks(plan);
  assert.deepEqual(next.groups.ready, [
    "MILESTONE_ACCEPTANCE_HISTORY",
    "MILESTONE_ACCEPTANCE_ADAPTERS",
  ]);
  assert.deepEqual(next.recommendation.recommendedTaskIds, [
    "MILESTONE_ACCEPTANCE_HISTORY",
  ]);
});

test("all twelve source cases are dependency ordered", async () => {
  const fixture = JSON.parse(await readFile(new URL("fixtures/milestone-acceptance-source-v1.json", import.meta.url), "utf8"));
  assert.equal(fixture.schema_version, "Perttool.MilestoneAcceptanceSourceCases.v1");
  const accepted = new Set();
  for (const contractCase of fixture.cases) {
    assert.equal(contractCase.depends_on.every((id) => accepted.has(id)), true, contractCase.id);
    accepted.add(contractCase.id);
  }
  assert.deepEqual([...accepted], Array.from({ length: 12 }, (_, index) => `MAS-${String(index + 1).padStart(3, "0")}`));
});
