import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planMilestoneAcceptanceAdvance } from "../dist/milestone-acceptance/advance.js";
import { planMilestoneAcceptanceMigration } from "../dist/milestone-acceptance/migration.js";
import { planAcceptanceReceiptMutation, planCriterionSetReplacement } from "../dist/milestone-acceptance/mutation.js";
import { sha256DigestUtf8 } from "../dist/model/sha256.js";

const base = `project P:\n  version 6\n  title "P"\n  duration_unit point\n  finish DONE\n  dag_owner user\n\nmilestone START:\n  title "Start"\n  state reached\n\nmilestone MID:\n  title "Mid"\n\nmilestone DONE:\n  title "Done"\n\ntask BUILD START -> MID:\n  title "Build"\n  duration 1p\n  status done\n\ntask SHIP MID -> DONE:\n  title "Ship"\n  duration 1p\n`;
const proof = { repositoryId: "repo", repositoryRelativePath: "p.pert", objectFormat: "sha1", headCommit: "a".repeat(40), headBlob: "b".repeat(40), stage0Blob: "b".repeat(40), sourceDigest: sha256DigestUtf8(base) };
const grammar7 = planMilestoneAcceptanceMigration(base, proof).candidateText;
const replacement = { setId: "MID_R1", milestoneId: "MID", revisionId: "R1", criteria: [{ criterionId: "BUILD_OK", required: true, evidenceKind: "command", description: "Build is accepted" }] };
const pending = planCriterionSetReplacement(grammar7, replacement).updatedText;

function accepted() {
  return planAcceptanceReceiptMutation(pending, { receiptId: "MID_OK", setId: "MID_R1", criterionId: "BUILD_OK", action: "verify", evidenceKind: "command", evidenceReference: "npm test", evidenceRevision: "abc", verifier: "codex", occurredAt: "2026-08-12T12:00:00Z" }).updatedText;
}

test("Grammar 7 is required and provisional planning identifies exact affected milestones", () => {
  const old = planMilestoneAcceptanceAdvance(base);
  assert.equal(old.ok, false);
  assert.equal(old.diagnostics[0].code, "PTMAC-101");
  const result = planMilestoneAcceptanceAdvance(pending);
  assert.equal(result.ok, false);
  assert.equal(result.persistable, false);
  assert.deepEqual(result.acceptanceGuard.affectedMilestoneIds, ["START", "MID"]);
  assert.deepEqual(result.acceptanceGuard.grandfatheredMilestoneIds, ["START"]);
  assert.deepEqual(result.acceptanceGuard.blockedMilestones, [{ milestoneId: "MID", acceptance: "pending", blockingRequiredCriterionIds: ["BUILD_OK"] }]);
  assert.match(result.provisional.updatedText, /state reached/u);
  assert.equal(result.canonical, null);
});

test("one blocker preserves an explanatory candidate but blocks all canonical composition", () => {
  let canonicalCalls = 0;
  const result = planMilestoneAcceptanceAdvance(pending, { canonicalPlanner: () => { canonicalCalls += 1; throw new Error("must not run"); } });
  assert.equal(canonicalCalls, 0);
  assert.equal(result.diagnostics[0].code, "PTMAC-108");
  assert.equal(result.provisional.edits.length > 0, true);
  assert.match(result.provisional.diff, /status done|state reached/u);
  assert.deepEqual(result.provisional.advance.removedTaskIds, ["BUILD"]);
  assert.equal(result.provisional.updatedText.includes("task BUILD"), false);
});

test("accepted milestone promotes the exact provisional candidate before later guards", () => {
  const source = accepted();
  const preview = planMilestoneAcceptanceAdvance(source);
  assert.equal(preview.ok, true);
  assert.equal(preview.acceptanceGuard.status, "passed");
  assert.deepEqual(preview.acceptanceGuard.acceptedMilestoneIds, ["MID"]);
  assert.equal(preview.canonical.updatedText, preview.provisional.updatedText);
  assert.equal(preview.canonical.updatedDigest, preview.provisional.updatedDigest);
  let canonicalCalls = 0;
  const composed = planMilestoneAcceptanceAdvance(source, { canonicalPlanner: () => { canonicalCalls += 1; return preview.canonical; } });
  assert.equal(composed.ok, true);
  assert.equal(canonicalCalls, 1);
});

test("canonical composition cannot substitute a different candidate", () => {
  const source = accepted();
  const preview = planMilestoneAcceptanceAdvance(source);
  assert.throws(() => planMilestoneAcceptanceAdvance(source, { canonicalPlanner: () => ({ ...preview.canonical, updatedText: `${preview.canonical.updatedText}\n`, updatedDigest: sha256DigestUtf8(`${preview.canonical.updatedText}\n`) }) }), /preserve the accepted provisional candidate/u);
});

test("waiver passes only through the evaluator and no force option bypass exists", () => {
  const waived = planAcceptanceReceiptMutation(pending, { receiptId: "MID_WAIVED", setId: "MID_R1", criterionId: "BUILD_OK", action: "waive", reason: "Owner accepts residual risk" }).updatedText;
  assert.equal(planMilestoneAcceptanceAdvance(waived).ok, true);
  assert.equal("forceAcceptance" in planMilestoneAcceptanceAdvance, false);
  assert.equal(planMilestoneAcceptanceAdvance.length >= 1, true);
});

test("removed milestones also remove their criterion revisions and receipts", () => {
  const source = accepted();
  const first = planMilestoneAcceptanceAdvance(source);
  const secondSource = first.provisional.updatedText.replace("task SHIP", "task SHIP").replace("  duration 1p\n\n", "  duration 1p\n  status done\n\n");
  const second = planMilestoneAcceptanceAdvance(secondSource);
  assert.equal(second.ok, false);
  assert.equal(second.acceptanceGuard.blockedMilestones.some(({ milestoneId }) => milestoneId === "DONE"), true);
  assert.equal(second.provisional.advance.removedMilestoneIds.includes("MID"), true);
  assert.doesNotMatch(second.provisional.updatedText, /MID_R1|MID_OK|BUILD_OK/u);
});

test("terminal advance removes retired acceptance records and preserves retained milestone evidence", () => {
  const first = planMilestoneAcceptanceAdvance(accepted());
  const doneSet = planCriterionSetReplacement(first.provisional.updatedText, {
    setId: "DONE_R1",
    milestoneId: "DONE",
    revisionId: "R1",
    criteria: [{
      criterionId: "SHIP_OK",
      required: true,
      evidenceKind: "owner",
      description: "Shipping is accepted",
    }],
  });
  assert.equal(doneSet.ok, true);
  const doneAccepted = planAcceptanceReceiptMutation(doneSet.updatedText, {
    receiptId: "DONE_OK",
    setId: "DONE_R1",
    criterionId: "SHIP_OK",
    action: "waive",
    reason: "Accepted terminal advance regression",
  });
  assert.equal(doneAccepted.ok, true);
  const secondSource = doneAccepted.updatedText.replace(
    "  duration 1p\n\n",
    "  duration 1p\n  status done\n\n",
  );
  const second = planMilestoneAcceptanceAdvance(secondSource);
  assert.equal(second.ok, true);
  assert.doesNotMatch(second.canonical.updatedText, /MID_R1|MID_OK|BUILD_OK/u);
  assert.match(second.canonical.updatedText, /DONE_R1|DONE_OK|SHIP_OK/u);
});

test("advance is exported through the Contract 8 public boundary", async () => {
  const root = await import("../dist/index.js");
  assert.equal(typeof root.planMilestoneAcceptanceAdvance, "function");
  assert.equal(root.COMMAND_REGISTRY.length, 53);
  assert.equal(root.getJsonSchemaCatalog().length, 23);
});

test("all twelve advance cases are dependency ordered", async () => {
  const fixture = JSON.parse(await readFile(new URL("fixtures/milestone-acceptance-advance-v1.json", import.meta.url), "utf8"));
  const acceptedIds = new Set();
  for (const item of fixture.cases) { assert.equal(item.depends_on.every((id) => acceptedIds.has(id)), true, item.id); acceptedIds.add(item.id); }
  assert.deepEqual([...acceptedIds], Array.from({ length: 12 }, (_, index) => `MAA-${String(index + 1).padStart(3, "0")}`));
});
