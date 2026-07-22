import assert from "node:assert/strict";
import test from "node:test";
import { formatDocument } from "../dist/index.js";

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
