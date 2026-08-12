import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planTargetPlanAssuranceAdvance } from "../dist/assurance/advance.js";
import { deriveAdvanceDestructiveRecords } from "../dist/history/advance-history.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../dist/parser/document-parser.js";
import { validateTargetGrammar6Document } from "../dist/semantic/target-validator.js";
import { buildIssue11AdvanceSource } from "./support/advance-terminal-issue-11.mjs";

function assertIssue11Candidate(variant) {
  const source = buildIssue11AdvanceSource(variant);
  const checked = validateTargetGrammar6Document(
    source,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(checked.ok, true);
  const result = planTargetPlanAssuranceAdvance(
    source,
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  assert.equal(result.ok, true);
  assert.equal(result.assuranceGuard.status, "passed");
  assert.equal(result.assuranceGuard.cause, "basis_preserved");
  assert.deepEqual(result.assuranceGuard.removedReceiptIds, [
    "AR_OLD_1",
    "AR_OLD_2",
    "AR_OLD_3",
  ]);
  assert.equal(result.assuranceGuard.retainedBasisChecks.every(({ equal }) => equal), true);
  assert.match(result.updatedText, /assurance_receipt AR_A:/u);
  assert.doesNotMatch(result.updatedText, /AR_OLD_|OUT_A|WE_A_/u);
  assert.equal(result.edits.every((edit, index) =>
    index === 0 || result.edits[index - 1].endOffset <= edit.startOffset
  ), true);
  const destructive = deriveAdvanceDestructiveRecords(
    source,
    checked.document,
    result.advance,
  );
  for (const record of destructive.filter(({ field }) => field === "declaration")) {
    assert.equal(result.edits.some((edit) =>
      edit.startOffset === record.startOffset &&
      edit.endOffset === record.endOffset &&
      edit.replacement === ""
    ), true, `${record.entityKind}:${record.entityId}`);
  }
}

test("Issue 11 consecutive terminal ranges are disjoint for every separator variant", () => {
  for (const variant of [
    { separatorBlankLines: 1, lineEnding: "\n", finalNewline: true },
    { separatorBlankLines: 3, lineEnding: "\n", finalNewline: true },
    { separatorBlankLines: 1, lineEnding: "\r\n", finalNewline: true },
    { separatorBlankLines: 1, lineEnding: "\n", finalNewline: false },
  ]) assertIssue11Candidate(variant);
});

test("Issue 11 cases are dependency ordered", async () => {
  const fixture = JSON.parse(await readFile(
    new URL("fixtures/advance-terminal-separator-issue-11-v1.json", import.meta.url),
    "utf8",
  ));
  const accepted = new Set();
  for (const value of fixture.cases) {
    assert.equal(value.depends_on.every((id) => accepted.has(id)), true, value.id);
    accepted.add(value.id);
  }
  assert.equal(accepted.size, 12);
});
