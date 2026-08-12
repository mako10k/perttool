import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateMilestoneAcceptance } from "../dist/milestone-acceptance/evaluate.js";

const zero = { start: { offset: 0, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } };
const digest = (character) => `sha256:${character.repeat(64)}`;

function criterion(id, required = true, evidenceKind = "test") {
  return { criterionId: id, required, evidenceKind, description: id, commitment: digest(id === "A" ? "a" : id === "B" ? "b" : "c"), span: zero };
}

function set(criteria = [criterion("A")]) {
  return { kind: "milestone_criterion_set", id: "DONE_R1", milestoneId: "DONE", revisionId: "R1", commitment: digest("d"), criteria, span: { start: { ...zero.start, offset: 10 }, end: { ...zero.end, offset: 20 } }, idSpan: zero };
}

function receipt(id, action, criterionId = "A", offset = 30, extra = {}) {
  return {
    kind: "milestone_acceptance_receipt", id, model: 1, setId: "DONE_R1",
    setCommitment: digest("d"), criterionId,
    criterionCommitment: digest(criterionId === "A" ? "a" : criterionId === "B" ? "b" : "c"),
    action, evidenceKind: action === "verify" ? "test" : null,
    evidenceReference: action === "verify" ? "test:pass" : null,
    evidenceRevision: action === "verify" ? "none" : null,
    verifier: action === "verify" ? "codex" : null,
    occurredAt: action === "verify" ? "2026-08-12T00:00:00Z" : null,
    reason: action === "waive" ? "Owner accepted exception" : null,
    revokes: null, span: { start: { ...zero.start, offset }, end: { ...zero.end, offset: offset + 1 } }, idSpan: zero,
    ...extra,
  };
}

function source(records) {
  return { ok: true, grammarVersion: 7, documentId: "P", records, diagnostics: [], baseDiagnostics: [], canonicalText: "" };
}

function evaluate(records, closure = new Set(["START"])) {
  return evaluateMilestoneAcceptance({ source: source(records), milestoneIds: ["START", "DONE"], closureReachedMilestoneIds: closure });
}

test("closure, not-declared acceptance, and grandfathering remain separate", () => {
  const migration = { kind: "milestone_acceptance_migration", id: "BASE", model: 1, repositoryId: "r", path: "p", objectFormat: "sha1", head: "a".repeat(40), blob: "b".repeat(40), sourceDigest: digest("1"), candidateDigest: digest("2"), grandfatheredMilestoneIds: ["START"], span: zero, idSpan: zero };
  const result = evaluate([migration]);
  assert.deepEqual(result.milestones.map(({ milestoneId, closure, acceptance, grandfathered }) => ({ milestoneId, closure, acceptance, grandfathered })), [
    { milestoneId: "START", closure: "reached", acceptance: "not_declared", grandfathered: true },
    { milestoneId: "DONE", closure: "unreached", acceptance: "not_declared", grandfathered: false },
  ]);
});

test("required states aggregate deterministically and blockers retain declaration order", () => {
  const criteria = [criterion("B"), criterion("A"), criterion("C")];
  const pending = evaluate([set(criteria)]).milestones[1];
  assert.equal(pending.acceptance, "pending");
  assert.deepEqual(pending.blockingRequiredCriterionIds, ["B", "A", "C"]);
  const failed = evaluate([set(criteria), receipt("A_FAIL", "fail", "A"), receipt("C_UNAVAILABLE", "unavailable", "C", 31)]).milestones[1];
  assert.equal(failed.acceptance, "failed");
  const unavailable = evaluate([set(criteria), receipt("C_UNAVAILABLE", "unavailable", "C")]).milestones[1];
  assert.equal(unavailable.acceptance, "unavailable");
});

test("verified and waived required criteria accept while optional failure stays visible", () => {
  const criteria = [criterion("A"), criterion("B"), criterion("C", false)];
  const result = evaluate([set(criteria), receipt("A_OK", "verify"), receipt("B_WAIVE", "waive", "B", 31), receipt("C_FAIL", "fail", "C", 32)]);
  assert.equal(result.ok, true);
  const milestone = result.milestones[1];
  assert.equal(milestone.acceptance, "accepted");
  assert.deepEqual(milestone.criteria.map(({ criterionId, state }) => [criterionId, state]), [["A", "satisfied"], ["B", "waived"], ["C", "failed"]]);
  assert.deepEqual(milestone.blockingRequiredCriterionIds, []);
  assert.equal(milestone.criteria[0].verifier, "codex");
  assert.equal(milestone.criteria[0].assertedAt, "2026-08-12T00:00:00Z");
  assert.equal(milestone.criteria[1].waiverReason, "Owner accepted exception");
});

test("explicit revoke removes only its earlier named terminal receipt", () => {
  const revoked = receipt("REVOKE_A", "revoke", "A", 31, { revokes: "A_FAIL" });
  const result = evaluate([set(), receipt("A_FAIL", "fail"), revoked]);
  assert.equal(result.ok, true);
  assert.equal(result.milestones[1].criteria[0].state, "pending");
  assert.deepEqual(result.milestones[1].criteria[0].revokedReceiptIds, ["A_FAIL"]);
});

test("replacement requires revoke and malformed revoke or optional waiver fails closed", () => {
  const conflict = evaluate([set(), receipt("A_FAIL", "fail"), receipt("A_OK", "verify", "A", 31)]);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.diagnostics[0].code, "PTMAC-104");
  const badRevoke = evaluate([set(), receipt("REVOKE", "revoke", "A", 20, { revokes: "A_FAIL" }), receipt("A_FAIL", "fail", "A", 31)]);
  assert.equal(badRevoke.ok, false);
  assert.equal(badRevoke.diagnostics[0].code, "PTMAC-105");
  const optional = evaluate([set([criterion("C", false), criterion("A")]), receipt("C_WAIVE", "waive", "C")]);
  assert.equal(optional.ok, false);
  assert.equal(optional.diagnostics[0].code, "PTMAC-103");
});

test("evaluator rejects invalid source and unknown closure input", () => {
  assert.throws(() => evaluateMilestoneAcceptance({ source: { ...source([]), ok: false }, milestoneIds: [], closureReachedMilestoneIds: new Set() }), /valid source/u);
  assert.throws(() => evaluateMilestoneAcceptance({ source: source([]), milestoneIds: ["A"], closureReachedMilestoneIds: new Set(["B"]) }), /unknown closure/u);
});

test("all fourteen core cases are ordered and evaluator remains internally owned", async () => {
  const fixture = JSON.parse(await readFile(new URL("fixtures/milestone-acceptance-core-v1.json", import.meta.url), "utf8"));
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  const root = await import("../dist/index.js");
  assert.equal("evaluateMilestoneAcceptance" in root, false);
  assert.equal(root.COMMAND_REGISTRY.length, 53);
  assert.equal(root.getJsonSchemaCatalog().length, 23);
});
