import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { planFormat } from "../dist/application/format.js";
import { checkDocument, formatDocument } from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

function digest(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function applyEdits(text, edits) {
  let candidate = text;
  for (const edit of [...edits].reverse()) {
    candidate =
      candidate.slice(0, edit.startOffset) +
      edit.replacement +
      candidate.slice(edit.endOffset);
  }
  return candidate;
}

function semanticValue(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(semanticValue);
  if (typeof value !== "object" || value === null) return value;
  if (
    typeof value.digits === "bigint" &&
    typeof value.scale === "number" &&
    typeof value.suffix === "string"
  ) {
    let digits = value.digits;
    let scale = value.scale;
    while (scale > 0 && digits % 10n === 0n) {
      digits /= 10n;
      scale -= 1;
    }
    return { digits: digits.toString(), scale, suffix: value.suffix };
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "text" && key !== "span" && !key.endsWith("Span"))
      .map(([key, nested]) => [key, semanticValue(nested)]),
  );
}

function semanticField(field) {
  return {
    name: field.name,
    value: semanticValue(field.value),
    children: field.children?.map(semanticField),
  };
}

function semanticDocument(document) {
  return document.declarations.map((declaration) => ({
    kind: declaration.kind,
    id: declaration.id,
    from: declaration.from,
    to: declaration.to,
    fields: declaration.fields.map(semanticField),
  }));
}

test("source formatter normalizes lexical forms while preserving source structure", () => {
  const input = [
    "\uFEFFproject   FORMAT:  ",
    "  version   0001  ",
    "  title  \"\\u30d5\\u30a9\\u30fc\\u30de\\u30c3\\u30c8\"  ",
    "  description   |  ",
    "      first  ",
    "        nested",
    "",
    "      final",
    "  duration_unit day",
    "  velocity 005.00p/002.0d",
    "  finish DONE",
    "  critical_epsilon 00.5000d",
    "",
    "resource  TEAM: ",
    "  title \"team\"",
    "  # keep comment spaces  ",
    "  capacity 0002",
    "  tags [ alpha , \"日本\" ]",
    "  ",
    "milestone NOW:",
    "  title \"now\"",
    "  state reached",
    "",
    "milestone DONE:",
    "  title \"done\"",
    "",
    "task  WORK   NOW  ->   DONE: ",
    "  title \"work\"",
    "  estimate:",
    "    optimistic   01.000d  ",
    "    most_likely 02.500d",
    "    pessimistic 04.000d",
    "  priority 000",
    "  requires:",
    "    TEAM    01",
    "  tags [one,\"two words\"]",
  ].join("\r\n");

  const expected = [
    "\uFEFFproject FORMAT:",
    "  version 1",
    "  title \"フォーマット\"",
    "  description |",
    "    first  ",
    "      nested",
    "",
    "    final",
    "  duration_unit day",
    "  velocity 5p/2d",
    "  finish DONE",
    "  critical_epsilon 0.5d",
    "",
    "resource TEAM:",
    "  title \"team\"",
    "  # keep comment spaces  ",
    "  capacity 2",
    "  tags [alpha, \"日本\"]",
    "  ",
    "milestone NOW:",
    "  title \"now\"",
    "  state reached",
    "",
    "milestone DONE:",
    "  title \"done\"",
    "",
    "task WORK NOW -> DONE:",
    "  title \"work\"",
    "  estimate:",
    "    optimistic 1d",
    "    most_likely 2.5d",
    "    pessimistic 4d",
    "  priority 0",
    "  requires:",
    "    TEAM 1",
    "  tags [one, \"two words\"]",
    "",
  ].join("\r\n");

  const result = formatDocument(input);
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.formattedText, expected);
  assert.ok(result.edits.length > 0);
  for (let index = 1; index < result.edits.length; index += 1) {
    assert.ok(result.edits[index].startOffset >= result.edits[index - 1].endOffset);
  }
  assert.ok(result.formattedText.startsWith("\uFEFF"));
  assert.ok(result.formattedText.includes("  # keep comment spaces  \r\n"));
  assert.ok(result.formattedText.includes("\r\n  \r\n"));

  const unchanged = formatDocument(expected);
  assert.equal(unchanged.ok, true);
  assert.equal(unchanged.changed, false);
  assert.deepEqual(unchanged.edits, []);
});

test("source formatter rejects invalid input without producing a candidate", () => {
  const input = `project INVALID:\n  title "invalid"\n  duration_unit day\n  finish MISSING\n`;
  const result = formatDocument(input);
  assert.equal(result.ok, false);
  assert.equal(result.changed, false);
  assert.equal(result.formattedText, null);
  assert.deepEqual(result.edits, []);
  assert.ok(result.diagnostics.some(({ severity }) => severity === "error"));
});

test("formatter golden is idempotent and preserves the semantic AST", async () => {
  const source = await readFile(
    path.join(testDirectory, "fixtures/grammar/formatter-roundtrip.pert"),
    "utf8",
  );
  const golden = await readFile(
    path.join(testDirectory, "golden/grammar/formatter-roundtrip.expected.pert"),
    "utf8",
  );
  const before = checkDocument(source);
  assert.equal(
    before.ok,
    true,
    before.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );

  const formatted = formatDocument(source);
  assert.equal(formatted.ok, true);
  assert.equal(formatted.formattedText, golden);

  const after = checkDocument(formatted.formattedText);
  assert.equal(after.ok, true);
  assert.deepEqual(semanticDocument(after.document), semanticDocument(before.document));

  const repeated = formatDocument(formatted.formattedText);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.edits, []);
  assert.equal(repeated.formattedText, golden);
});

test("format application returns a rechecked candidate, UTF-16 edits, digests, and diff", () => {
  const input = [
    "project   FORMAT:",
    "  version 0001",
    '  title "😀 plan"  ',
    "  duration_unit day",
    "  finish DONE",
    "",
    "milestone NOW:",
    '  title "now"',
    "  state reached",
    "",
    "milestone DONE:",
    '  title "done"',
    "",
    "task   WORK   NOW  ->   DONE:",
    '  title "work"',
    "  duration 01.0d",
    "  status done",
  ].join("\n");

  const result = planFormat(input, {
    originalLabel: "plan.pert",
    updatedLabel: "plan.pert (candidate)",
  });
  assert.equal(result.ok, true);
  assert.equal(result.documentId, "FORMAT");
  assert.equal(result.changed, true);
  assert.equal(result.originalDigest, digest(input));
  assert.equal(result.updatedDigest, digest(result.updatedText));
  assert.notEqual(result.originalDigest, result.updatedDigest);
  assert.ok(result.diff.startsWith("--- plan.pert\n+++ plan.pert (candidate)\n@@ "));
  assert.equal(
    result.diff,
    planFormat(input, {
      originalLabel: "plan.pert",
      updatedLabel: "plan.pert (candidate)",
    }).diff,
  );
  assert.ok(result.edits.length > 0);
  assert.ok(
    result.edits.some(
      ({ startOffset }) => startOffset > input.indexOf("😀") + "😀".length,
    ),
  );
  assert.equal(applyEdits(input, result.edits), result.updatedText);
  for (let index = 1; index < result.edits.length; index += 1) {
    assert.ok(result.edits[index].startOffset >= result.edits[index - 1].endOffset);
  }

  const candidate = checkDocument(result.updatedText);
  assert.equal(candidate.ok, true);
  assert.deepEqual(result.diagnostics, candidate.diagnostics);
  assert.ok(result.diagnostics.some(({ code }) => code === "PTDAG-208"));
});

test("format application returns the original candidate and empty diff for a no-op", () => {
  const input = [
    "project FORMAT:",
    "  version 1",
    '  title "format"',
    "  duration_unit day",
    "  finish DONE",
    "",
    "milestone NOW:",
    '  title "now"',
    "  state reached",
    "",
    "milestone DONE:",
    '  title "done"',
    "",
    "task WORK NOW -> DONE:",
    '  title "work"',
    "  duration 1d",
    "",
  ].join("\n");

  const result = planFormat(input);
  assert.equal(result.ok, true);
  assert.equal(result.documentId, "FORMAT");
  assert.equal(result.changed, false);
  assert.equal(result.updatedText, input);
  assert.equal(result.originalDigest, digest(input));
  assert.equal(result.updatedDigest, result.originalDigest);
  assert.equal(result.diff, "");
  assert.deepEqual(result.edits, []);
  assert.deepEqual(result.diagnostics, checkDocument(input).diagnostics);
});

test("format application rejects invalid input without exposing a candidate", () => {
  const input = `project INVALID:\n  title "invalid"\n  duration_unit day\n  finish MISSING\n`;
  const result = planFormat(input);
  assert.equal(result.ok, false);
  assert.equal(result.documentId, "INVALID");
  assert.equal(result.changed, false);
  assert.equal(result.originalDigest, digest(input));
  assert.equal(result.updatedDigest, null);
  assert.equal(result.updatedText, null);
  assert.equal(result.diff, null);
  assert.deepEqual(result.edits, []);
  assert.ok(result.diagnostics.some(({ severity }) => severity === "error"));
});
