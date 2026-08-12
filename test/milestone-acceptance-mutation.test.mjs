import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { planMilestoneAcceptanceMigration } from "../dist/milestone-acceptance/migration.js";
import {
  persistMilestoneAcceptanceMutation,
  planAcceptanceReceiptMutation,
  planCriterionSetReplacement,
  showMilestoneAcceptance,
} from "../dist/milestone-acceptance/mutation.js";
import { sha256DigestUtf8 } from "../dist/model/sha256.js";

const base = `project P:\n  version 6\n  title "P"\n  duration_unit point\n  finish DONE\n  dag_owner user\n\nmilestone START:\n  title "Start"\n  state reached\n\nmilestone DONE:\n  title "Done"\n\ntask WORK START -> DONE:\n  title "Work"\n  duration 1p\n`;
const proof = { repositoryId: "repo", repositoryRelativePath: "p.pert", objectFormat: "sha1", headCommit: "a".repeat(40), headBlob: "b".repeat(40), stage0Blob: "b".repeat(40), sourceDigest: sha256DigestUtf8(base) };
const grammar7 = planMilestoneAcceptanceMigration(base, proof).candidateText;
const replacement = { setId: "DONE_R1", milestoneId: "DONE", revisionId: "R1", criteria: [
  { criterionId: "BUILD", required: true, evidenceKind: "command", description: "Complete gate passes" },
  { criterionId: "NOTE", required: false, evidenceKind: "observation", description: "Optional note" },
] };

function replaced(governance = { intent: "preview" }) {
  return planCriterionSetReplacement(grammar7, replacement, { governance });
}

function verify(text, receiptId = "RCPT1", governance = { intent: "preview" }) {
  return planAcceptanceReceiptMutation(text, { receiptId, setId: "DONE_R1", criterionId: "BUILD", action: "verify", evidenceKind: "command", evidenceReference: "npm run check", evidenceRevision: "abc123", verifier: "codex", occurredAt: "2026-08-12T12:00:00.1200Z" }, { governance });
}

test("replacement is complete, commitment-bound, preview-first, and DAG governed", () => {
  assert.equal(planCriterionSetReplacement(base, replacement).ok, false);
  const result = replaced();
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.deepEqual(result.governance.affectedScopes, ["dag"]);
  assert.equal(result.governance.intent, "preview");
  assert.equal(result.governance.writeAuthorized, false);
  assert.match(result.updatedText, /milestone_criterion_set DONE_R1/u);
  assert.equal(result.evaluation.milestones.find(({ milestoneId }) => milestoneId === "DONE").acceptance, "pending");
});

test("persist authority keeps actor, verifier, and owner assertion distinct", () => {
  const denied = replaced({ intent: "persist", actor: "codex" });
  assert.equal(denied.ok, false);
  assert.equal(denied.updatedText !== null, true);
  assert.deepEqual(denied.diagnostics, ["PTGOV-101"]);
  const approved = replaced({ intent: "persist", actor: "codex", acceptedByOwner: ["user"] });
  assert.equal(approved.ok, true);
  assert.equal(approved.governance.actor, "codex");
  assert.deepEqual(approved.governance.acceptedByOwner, ["user"]);
});

test("verify normalizes provenance, exact replay is idempotent, and conflicting identity fails", () => {
  const first = verify(replaced().updatedText);
  assert.equal(first.ok, true);
  assert.match(first.updatedText, /occurred_at 2026-08-12T12:00:00.12Z/u);
  assert.equal(first.evaluation.milestones.find(({ milestoneId }) => milestoneId === "DONE").acceptance, "accepted");
  const replay = verify(first.updatedText);
  assert.equal(replay.ok, true);
  assert.equal(replay.changed, false);
  assert.equal(replay.replayed, true);
  const conflict = planAcceptanceReceiptMutation(first.updatedText, { receiptId: "RCPT1", setId: "DONE_R1", criterionId: "BUILD", action: "fail" });
  assert.deepEqual(conflict.diagnostics, ["conflicting_receipt_identity"]);
});

test("terminal replacement requires explicit revoke and waiver is required-only", () => {
  const verified = verify(replaced().updatedText).updatedText;
  const conflict = planAcceptanceReceiptMutation(verified, { receiptId: "FAIL1", setId: "DONE_R1", criterionId: "BUILD", action: "fail" });
  assert.equal(conflict.ok, false);
  assert.deepEqual(conflict.diagnostics, ["PTMAC-104"]);
  const revoked = planAcceptanceReceiptMutation(verified, { receiptId: "REVOKE1", setId: "DONE_R1", criterionId: "BUILD", action: "revoke", revokes: "RCPT1" });
  assert.equal(revoked.ok, true);
  const failed = planAcceptanceReceiptMutation(revoked.updatedText, { receiptId: "FAIL1", setId: "DONE_R1", criterionId: "BUILD", action: "fail", reason: "Regression" });
  assert.equal(failed.evaluation.milestones.find(({ milestoneId }) => milestoneId === "DONE").acceptance, "failed");
  const unavailable = planAcceptanceReceiptMutation(revoked.updatedText, { receiptId: "UNAVAILABLE1", setId: "DONE_R1", criterionId: "BUILD", action: "unavailable", reason: "Runner offline" });
  assert.equal(unavailable.evaluation.milestones.find(({ milestoneId }) => milestoneId === "DONE").acceptance, "unavailable");
  const optionalWaiver = planAcceptanceReceiptMutation(replaced().updatedText, { receiptId: "W0", setId: "DONE_R1", criterionId: "NOTE", action: "waive", reason: "Skip" });
  assert.deepEqual(optionalWaiver.diagnostics, ["invalid_receipt"]);
  const waiver = planAcceptanceReceiptMutation(replaced().updatedText, { receiptId: "W1", setId: "DONE_R1", criterionId: "BUILD", action: "waive", reason: "Owner accepts risk" });
  assert.equal(waiver.evaluation.milestones.find(({ milestoneId }) => milestoneId === "DONE").acceptance, "accepted");
});

test("whole-set replacement deletes the prior set and every owned receipt", () => {
  const verified = verify(replaced().updatedText).updatedText;
  const next = planCriterionSetReplacement(verified, { ...replacement, setId: "DONE_R2", revisionId: "R2", criteria: [{ criterionId: "SHIP", required: true, evidenceKind: "artifact", description: "Artifact retained" }] });
  assert.equal(next.ok, true);
  assert.doesNotMatch(next.updatedText, /DONE_R1|RCPT1|BUILD/u);
  assert.match(next.updatedText, /DONE_R2|SHIP/u);
});

test("approved persistence reuses digest-bound safe write and rejects a source race", async () => {
  const directory = await mkdtemp(join(tmpdir(), "perttool-mam-"));
  try {
    const path = join(directory, "p.pert");
    await writeFile(path, grammar7, "utf8");
    const approved = replaced({ intent: "persist", actor: "user" });
    const written = await persistMilestoneAcceptanceMutation(path, approved, approved.originalDigest);
    assert.equal(written.written, true);
    assert.equal(await readFile(path, "utf8"), approved.updatedText);
    const racedPath = join(directory, "race.pert");
    await writeFile(racedPath, grammar7, "utf8");
    await writeFile(racedPath, `${grammar7}\n`, "utf8");
    await assert.rejects(() => persistMilestoneAcceptanceMutation(racedPath, approved, approved.originalDigest), /changed|digest/u);
    const linkPath = join(directory, "link.pert");
    await symlink(path, linkPath);
    await assert.rejects(() => persistMilestoneAcceptanceMutation(linkPath, approved, approved.originalDigest), /symlink/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("show shares the evaluator and mutation is publicly exported", async () => {
  const text = verify(replaced().updatedText).updatedText;
  const shown = showMilestoneAcceptance(text, ["START", "DONE"]);
  assert.equal(shown.ok, true);
  assert.equal(shown.milestones.find(({ milestoneId }) => milestoneId === "DONE").closure, "reached");
  const root = await import("../dist/index.js");
  assert.equal(typeof root.planCriterionSetReplacement, "function");
  assert.equal(root.COMMAND_REGISTRY.length, 53);
  assert.equal(root.getJsonSchemaCatalog().length, 23);
});

test("all fourteen mutation cases are dependency ordered", async () => {
  const fixture = JSON.parse(await readFile(new URL("fixtures/milestone-acceptance-mutation-v1.json", import.meta.url), "utf8"));
  const accepted = new Set();
  for (const item of fixture.cases) { assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id); accepted.add(item.id); }
  assert.deepEqual([...accepted], Array.from({ length: 14 }, (_, index) => `MAM-${String(index + 1).padStart(3, "0")}`));
});
