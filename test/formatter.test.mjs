import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocument, formatDocument } from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

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
