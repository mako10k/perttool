import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocument, computeEffectiveReached, selectNextTasks } from "../dist/index.js";
import { planAdvance } from "../dist/mutation/advance.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function diagnosticText(result) {
  return result.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; ");
}

function checked(text) {
  const result = checkDocument(text);
  assert.equal(result.ok, true, diagnosticText(result));
  return result;
}

test("advance computes the canonical partial-join keep/remove set", async () => {
  const beforeText = await readFile(
    path.join(root, "docs/examples/advance-partial-before.pert"),
    "utf8",
  );
  const normativeAfterText = await readFile(
    path.join(root, "docs/examples/advance-partial-after.pert"),
    "utf8",
  );
  const result = planAdvance(beforeText, {
    originalLabel: "before.pert",
    updatedLabel: "after.pert",
  });

  assert.equal(result.ok, true, diagnosticText(result));
  assert.equal(result.changed, true);
  assert.equal(result.documentId, "ADVANCE_PARTIAL");
  assert.match(result.originalDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(result.updatedDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(result.diff, /^--- before\.pert\n\+\+\+ after\.pert\n/);
  assert.deepEqual(result.advance, {
    keptTaskIds: ["A_JOIN_WORK", "BRANCH_B", "RELEASE"],
    keptGateIds: [],
    keptMilestoneIds: ["A_DONE", "JOINED", "NOW", "RELEASED"],
    removedTaskIds: ["BRANCH_A"],
    removedGateIds: [],
    removedMilestoneIds: [],
    stateChangedMilestoneIds: ["A_DONE"],
    retainedSatisfiedEdges: [
      { id: "A_JOIN_WORK", kind: "task", reason: "partial_satisfaction" },
    ],
    frontierBefore: ["A_DONE", "NOW"],
    frontierAfter: ["A_DONE", "NOW"],
    readyBefore: [],
    readyAfter: [],
  });
  assert.doesNotMatch(result.updatedText, /task BRANCH_A /);
  assert.match(result.updatedText, /milestone A_DONE:[\s\S]*?  state reached/);

  const beforeNext = selectNextTasks(beforeText);
  const candidateNext = selectNextTasks(result.updatedText);
  const normativeNext = selectNextTasks(normativeAfterText);
  assert.equal(candidateNext.ok, true, diagnosticText(candidateNext));
  assert.deepEqual(candidateNext.groups, beforeNext.groups);
  assert.deepEqual(candidateNext.groups, normativeNext.groups);
  assert.deepEqual(
    [...computeEffectiveReached(checked(result.updatedText).document)].sort(),
    [...computeEffectiveReached(checked(normativeAfterText).document)].sort(),
  );
});

test("advance is idempotent after the canonical rewrite", async () => {
  const text = await readFile(
    path.join(root, "docs/examples/advance-partial-before.pert"),
    "utf8",
  );
  const first = planAdvance(text);
  assert.equal(first.ok, true, diagnosticText(first));

  const repeated = planAdvance(first.updatedText);
  assert.equal(repeated.ok, true, diagnosticText(repeated));
  assert.equal(repeated.changed, false);
  assert.equal(repeated.updatedText, first.updatedText);
  assert.equal(repeated.originalDigest, repeated.updatedDigest);
  assert.equal(repeated.diff, "");
  assert.deepEqual(repeated.edits, []);
  assert.deepEqual(repeated.advance.removedTaskIds, []);
  assert.deepEqual(repeated.advance.removedGateIds, []);
  assert.deepEqual(repeated.advance.removedMilestoneIds, []);
  assert.deepEqual(repeated.advance.stateChangedMilestoneIds, []);
  assert.deepEqual(repeated.advance.retainedSatisfiedEdges, [
    { id: "A_JOIN_WORK", kind: "task", reason: "partial_satisfaction" },
  ]);
});

test("advance retains a satisfied gate entering an unreached join", () => {
  const text = [
    "project PARTIAL_GATE:",
    "  title \"partial gate\"",
    "  duration_unit day",
    "  finish JOINED",
    "",
    "milestone NOW:",
    "  title \"now\"",
    "  state reached",
    "",
    "milestone JOINED:",
    "  title \"joined\"",
    "",
    "gate APPROVAL NOW -> JOINED:",
    "  reason \"approved\"",
    "",
    "task WORK NOW -> JOINED:",
    "  title \"work\"",
    "  duration 1d",
    "  status active",
    "",
  ].join("\n");
  checked(text);

  const result = planAdvance(text);
  assert.equal(result.ok, true, diagnosticText(result));
  assert.equal(result.changed, false);
  assert.deepEqual(result.advance.keptGateIds, ["APPROVAL"]);
  assert.deepEqual(result.advance.retainedSatisfiedEdges, [
    { id: "APPROVAL", kind: "gate", reason: "partial_satisfaction" },
  ]);
  assert.deepEqual(result.advance.frontierBefore, ["NOW"]);
  assert.deepEqual(result.advance.frontierAfter, ["NOW"]);
});

test("completed project advances to the reached finish and preserves resources", () => {
  const input = [
    "\uFEFFproject COMPLETE:",
    "  title \"complete\"",
    "  duration_unit day",
    "  finish DONE",
    "",
    "resource DEV:",
    "  title \"developers\"",
    "  capacity 1",
    "",
    "milestone NOW:",
    "  title \"now\"",
    "  state reached",
    "",
    "milestone DONE:",
    "  title \"done\"",
    "",
    "# completed work documentation",
    "task WORK NOW -> DONE:",
    "  title \"work\"",
    "  duration 1d",
    "  status done",
    "  requires:",
    "    DEV 1",
    "",
  ].join("\r\n");
  checked(input);

  const result = planAdvance(input);
  assert.equal(result.ok, true, diagnosticText(result));
  assert.equal(result.updatedText.startsWith("\uFEFFproject COMPLETE:"), true);
  assert.match(result.updatedText, /resource DEV:\r\n/);
  assert.doesNotMatch(result.updatedText, /completed work documentation/);
  assert.doesNotMatch(result.updatedText, /milestone NOW:/);
  assert.doesNotMatch(result.updatedText, /task WORK /);
  assert.match(result.updatedText, /milestone DONE:\r\n  title \"done\"\r\n  state reached/);
  assert.match(result.updatedText, /  state reached\r\n$/);
  assert.doesNotMatch(result.updatedText, /\r\n\r\n$/);
  assert.deepEqual(result.advance.removedTaskIds, ["WORK"]);
  assert.deepEqual(result.advance.removedMilestoneIds, ["NOW"]);
  assert.deepEqual(result.advance.keptMilestoneIds, ["DONE"]);
  assert.deepEqual(result.advance.stateChangedMilestoneIds, ["DONE"]);
  assert.deepEqual(result.advance.frontierBefore, ["DONE"]);
  assert.deepEqual(result.advance.frontierAfter, ["DONE"]);
  assert.equal(checked(result.updatedText).summary.resources, 1);
});

test("invalid input does not expose an advance candidate", () => {
  const result = planAdvance("project BROKEN:\n  title \"broken\"\n");
  assert.equal(result.ok, false);
  assert.equal(result.changed, false);
  assert.equal(result.updatedDigest, null);
  assert.equal(result.updatedText, null);
  assert.equal(result.diff, null);
  assert.deepEqual(result.edits, []);
  assert.equal(result.advance, null);
  assert.equal(result.diagnostics.some(({ severity }) => severity === "error"), true);
});
