import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  checkDocument,
  planAdvance,
} from "../dist/index.js";
import {
  assessAdvanceHistorySafety,
  deriveAdvanceDestructiveRecords,
} from "../dist/history/advance-history.js";

const encoder = new TextEncoder();
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function diagnosticText(result) {
  return result.diagnostics
    .map(({ code, message }) => `${code} ${message}`)
    .join("; ");
}

function eventfulCompleteSource({
  lineEnding = "\n",
  bom = false,
  finalNewline = true,
  separatorBlankLines = 1,
  standaloneComment = false,
} = {}) {
  const separator = Array(separatorBlankLines).fill("");
  const lines = [
    "project CLEAN:",
    "  version 5",
    '  title "clean"',
    "  as_of 2026-07-31",
    "  duration_unit point",
    "  velocity 1p/1d",
    "  finish DONE",
    "",
    "milestone START:",
    '  title "start"',
    "  state reached",
    "",
    "milestone DONE:",
    '  title "done"',
    ...separator,
    "task WORK START -> DONE:",
    '  title "work"',
    "  duration 1p",
    "  status done",
    ...separator,
    "work_event WE-start:",
    "  model 1",
    "  task WORK",
    "  kind start",
    "  occurred_at 2026-07-31T10:00:00+09:00",
    "  planned_value 1p",
    ...(standaloneComment
      ? ["", "# retained terminal note", ""]
      : separator),
    "work_event WE-finish:",
    "  model 1",
    "  task WORK",
    "  kind finish",
    "  occurred_at 2026-07-31T11:00:00+09:00",
    "  active_time 1h",
    "  effort 1ph",
  ];
  return `${bom ? "\uFEFF" : ""}${lines.join(lineEnding)}${
    finalNewline ? lineEnding : ""
  }`;
}

function checked(source) {
  const result = checkDocument(source);
  assert.equal(result.ok, true, diagnosticText(result));
  return result;
}

function trailingLineEndings(text) {
  return text.match(/(?:\r?\n)+$/)?.[0].match(/\n/g)?.length ?? 0;
}

test("ACC-001 and ACC-002 remove an eventful terminal suffix cleanly", () => {
  const source = eventfulCompleteSource({ separatorBlankLines: 2 });
  const result = planAdvance(source);

  assert.equal(result.ok, true, diagnosticText(result));
  assert.equal(result.changed, true);
  assert.deepEqual(result.advance.removedTaskIds, ["WORK"]);
  assert.deepEqual(result.advance.removedWorkEventIds, [
    "WE-finish",
    "WE-start",
  ]);
  assert.doesNotMatch(result.updatedText, /task WORK|work_event WE-/);
  assert.match(result.updatedText, /  state reached\n$/);
  assert.equal(trailingLineEndings(result.updatedText), 1);
  assert.equal(result.edits.every(
    (edit, index) => index === 0 ||
      result.edits[index - 1].endOffset <= edit.startOffset,
  ), true);

  const repeated = planAdvance(result.updatedText);
  assert.equal(repeated.ok, true, diagnosticText(repeated));
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.edits, []);
});

test("ACC-004 and ACC-005 preserve comments, encodings, and final-newline variants", () => {
  for (const variant of [
    { lineEnding: "\n", bom: false, finalNewline: true },
    { lineEnding: "\r\n", bom: false, finalNewline: true },
    { lineEnding: "\n", bom: true, finalNewline: true },
    { lineEnding: "\n", bom: false, finalNewline: false },
  ]) {
    const source = eventfulCompleteSource(variant);
    const result = planAdvance(source);
    assert.equal(result.ok, true, diagnosticText(result));
    assert.equal(result.updatedText.startsWith(variant.bom ? "\uFEFF" : "project"), true);
    assert.equal(result.updatedText.includes(variant.lineEnding), true);
    assert.equal(trailingLineEndings(result.updatedText), 1);
    assert.doesNotMatch(result.updatedText, /\r?\n\r?\n$/);
  }

  const withComment = planAdvance(eventfulCompleteSource({
    standaloneComment: true,
  }));
  assert.equal(withComment.ok, true, diagnosticText(withComment));
  assert.match(withComment.updatedText, /# retained terminal note\n$/);
  assert.equal(trailingLineEndings(withComment.updatedText), 1);
});

test("ACC-003 uses the candidate deletion ranges as destructive provenance", () => {
  const source = eventfulCompleteSource({ separatorBlankLines: 2 });
  const checkedSource = checked(source);
  const result = planAdvance(source);
  assert.equal(result.ok, true, diagnosticText(result));
  const records = deriveAdvanceDestructiveRecords(
    source,
    checkedSource.document,
    result.advance,
  );

  for (const record of records.filter(({ field }) => field === "declaration")) {
    assert.equal(
      result.edits.some(
        ({ startOffset, endOffset, replacement }) =>
          startOffset === record.startOffset &&
          endOffset === record.endOffset &&
          replacement === "",
      ),
      true,
      `${record.entityKind}:${record.entityId}`,
    );
  }

  const assessment = assessAdvanceHistorySafety({
    currentText: source,
    currentDocument: checkedSource.document,
    currentSource: encoder.encode(source),
    headText: source,
    headDocument: checkedSource.document,
    headSource: encoder.encode(source),
    indexSource: encoder.encode(source),
    destructiveRecords: records,
  });
  assert.equal(assessment.status, "passed");
  assert.equal(assessment.cause, "baseline_matches");
});

test("ACC-003 blocks current or staged changes in an owned terminal separator", () => {
  const headText = eventfulCompleteSource();
  const currentText = headText.replace(
    "\n\nwork_event WE-start:",
    "\n\n\nwork_event WE-start:",
  );
  const currentChecked = checked(currentText);
  const headChecked = checked(headText);
  const currentPlan = planAdvance(currentText);
  assert.equal(currentPlan.ok, true, diagnosticText(currentPlan));
  const currentRecords = deriveAdvanceDestructiveRecords(
    currentText,
    currentChecked.document,
    currentPlan.advance,
  );
  const currentMismatch = assessAdvanceHistorySafety({
    currentText,
    currentDocument: currentChecked.document,
    currentSource: encoder.encode(currentText),
    headText,
    headDocument: headChecked.document,
    headSource: encoder.encode(headText),
    indexSource: encoder.encode(headText),
    destructiveRecords: currentRecords,
  });
  assert.equal(currentMismatch.status, "blocked");
  assert.equal(currentMismatch.cause, "destructive_overlap");
  assert.deepEqual(currentMismatch.overlappingEntityIds, ["WE-start"]);

  const headPlan = planAdvance(headText);
  const headRecords = deriveAdvanceDestructiveRecords(
    headText,
    headChecked.document,
    headPlan.advance,
  );
  const stagedText = headText.replace(
    "\n\nwork_event WE-start:",
    "\nwork_event WE-start:",
  );
  const stagedMismatch = assessAdvanceHistorySafety({
    currentText: headText,
    currentDocument: headChecked.document,
    currentSource: encoder.encode(headText),
    headText,
    headDocument: headChecked.document,
    headSource: encoder.encode(headText),
    indexSource: encoder.encode(stagedText),
    destructiveRecords: headRecords,
  });
  assert.equal(stagedMismatch.status, "blocked");
  assert.equal(stagedMismatch.cause, "destructive_overlap");
  assert.deepEqual(stagedMismatch.overlappingEntityIds, ["WE-start"]);
});

test("Core acceptance remains internal and leaves final acceptance open", async () => {
  const [requirements, backlog, acceptance] = await Promise.all([
    readFile(path.join(root, "docs/requirements.md"), "utf8"),
    readFile(path.join(root, "docs/backlog.md"), "utf8"),
    readFile(
      path.join(
        root,
        "docs/process/advance-clean-candidate-core-acceptance.md",
      ),
      "utf8",
    ),
  ]);

  assert.equal("planAdvanceDeclarationDeletions" in publicApi, false);
  assert.match(requirements, /shared terminal deletion-range planner/);
  assert.match(requirements, /- \[ \] Accept the real tracked CLI write/);
  assert.match(
    backlog,
    /Status: Core accepted \(2026-07-31; end-to-end pending; release blocker\)/,
  );
  assert.match(acceptance, /- Document status: Accepted internal 1\.0/);
  assert.match(acceptance, /All 31 focused tests passed/);
  assert.match(acceptance, /`ACC-007`[\s\S]*\| Pending \|/);
  assert.match(acceptance, /`ACC-008`[\s\S]*\| Pending \|/);
});
