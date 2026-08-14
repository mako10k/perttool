import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTextEdits,
  normalizeTextEdits,
} from "../dist/mutation/text-edits.js";

test("shared edit normalization still rejects every overlapping range", () => {
  const text = "0123456789";
  assert.throws(() => normalizeTextEdits(text, [
    { startOffset: 2, endOffset: 6, replacement: "" },
    { startOffset: 4, endOffset: 8, replacement: "" },
  ]), /overlapping TextEdit ranges/u);
  assert.throws(() => normalizeTextEdits(text, [
    { startOffset: 2, endOffset: 6, replacement: "" },
    { startOffset: 4, endOffset: 8, replacement: "changed" },
  ]), /overlapping TextEdit ranges/u);
  assert.throws(() => normalizeTextEdits(text, [
    { startOffset: 4, endOffset: 4, replacement: "first" },
    { startOffset: 4, endOffset: 4, replacement: "second" },
  ]), /overlapping TextEdit ranges/u);
});

test("non-overlapping edits retain their shared apply semantics", () => {
  const text = "0123456789";
  const edits = normalizeTextEdits(text, [
    { startOffset: 2, endOffset: 4, replacement: "" },
    { startOffset: 6, endOffset: 8, replacement: "AB" },
  ]);
  assert.equal(applyTextEdits(text, edits), "0145AB89");
});
