import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER,
} from "../dist/model/declaration-fields.js";
import {
  TARGET_GRAMMAR_2_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  formatTargetDocument,
} from "../dist/formatter/target-source-formatter.js";
import {
  validateTargetDocument,
} from "../dist/semantic/target-validator.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(
  testDirectory,
  "fixtures",
  "temporal-units",
);

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

function semanticDocument(result) {
  const document = result.validatedDocument?.document;
  assert.ok(document);
  return document.declarations.map((declaration) => ({
    kind: declaration.kind,
    id: declaration.id,
    from: declaration.from,
    to: declaration.to,
    fields: declaration.fields.map((field) => ({
      name: field.name,
      value: semanticValue(field.value),
      children: field.children?.map((child) => ({
        name: child.name,
        value: semanticValue(child.value),
      })),
    })),
  }));
}

function temporalTokens(result) {
  const document = result.validatedDocument?.document;
  assert.ok(document);
  return document.declarations.flatMap((declaration) =>
    declaration.fields
      .filter(({ name }) =>
        name === "as_of" || name === "deadline" || name === "not_before")
      .map((field) => ({
        path: `${declaration.kind}.${declaration.id}.${field.name}`,
        token: field.rawValue,
      })),
  );
}

test("target formatter is internal and uses the shared Grammar 2 field order", () => {
  assert.equal("formatTargetDocument" in publicApi, false);
  assert.equal("GRAMMAR_1_DECLARATION_FIELD_ORDER" in publicApi, false);
  assert.equal("TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER" in publicApi, false);
  assert.equal(Object.isFrozen(TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER), true);
  assert.equal(
    Object.isFrozen(TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER.task),
    true,
  );
  assert.deepEqual(
    TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER.milestone,
    ["title", "description", "state", "deadline", "tags"],
  );
  assert.deepEqual(
    TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER.task,
    [
      "title",
      "description",
      "duration",
      "estimate",
      "not_before",
      "deadline",
      "status",
      "priority",
      "requires",
      "owner",
      "tags",
      "blocked_reason",
      "source",
    ],
  );
  assert.throws(
    () => formatTargetDocument("", {
      id: "perttool.target-grammar-2-source",
      version: 1,
      grammarVersion: 2,
    }),
    /target Grammar 2 source capability is required/,
  );
});

test("target formatter preserves source structure and exact temporal tokens", () => {
  const input = [
    "\uFEFFproject   TEMPORAL_FORMAT:  ",
    "  version   0002  ",
    '  title  "temporal format"  ',
    "  as_of   2026-07-25T09:00:00.5000+09:30  ",
    "  duration_unit day",
    "  finish FINISH",
    "",
    "milestone START:",
    '  title "start"',
    "  state reached",
    "",
    "milestone FINISH:",
    "  tags [ release ]",
    "  # keep deadline comment  ",
    "  deadline   2026-07-26T00:00:00Z  ",
    '  title "finish"',
    "",
    "task  WORK   START  ->   FINISH: ",
    "  tags [one,\"two words\"]",
    "  deadline   2026-07-25T18:30:00.000-04:00  ",
    '  title "work"',
    "  not_before   2026-07-25  ",
    "  duration 01.000d",
  ].join("\r\n");
  const before = validateTargetDocument(
    input,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(
    before.ok,
    true,
    before.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );

  const formatted = formatTargetDocument(
    input,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(formatted.ok, true);
  assert.equal(formatted.changed, true);
  assert.ok(formatted.formattedText.startsWith("\uFEFFproject TEMPORAL_FORMAT:\r\n"));
  assert.ok(formatted.formattedText.includes("  # keep deadline comment  \r\n"));
  assert.deepEqual(
    temporalTokens(before).map(({ token }) => token),
    [
      "2026-07-25T09:00:00.5000+09:30",
      "2026-07-26T00:00:00Z",
      "2026-07-25T18:30:00.000-04:00",
      "2026-07-25",
    ],
  );

  const after = validateTargetDocument(
    formatted.formattedText,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(after.ok, true);
  assert.deepEqual(temporalTokens(after), temporalTokens(before));
  assert.deepEqual(semanticDocument(after), semanticDocument(before));
  assert.deepEqual(
    after.validatedDocument.document.declarations.map(({ id }) => id),
    before.validatedDocument.document.declarations.map(({ id }) => id),
  );
  assert.deepEqual(
    after.validatedDocument.document.declarations.map(({ fields }) =>
      fields.map(({ name }) => name)),
    before.validatedDocument.document.declarations.map(({ fields }) =>
      fields.map(({ name }) => name)),
  );

  const repeated = formatTargetDocument(
    formatted.formattedText,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.edits, []);
  assert.equal(repeated.formattedText, formatted.formattedText);
});

test("active Contract 5 formatter retains Grammar 2", async () => {
  const source = await readFile(
    path.join(fixtureDirectory, "calendar-offset-v2.pert"),
    "utf8",
  );
  const active = publicApi.formatDocument(source);
  assert.equal(active.ok, true);
  assert.equal(active.formattedText, formatTargetDocument(
    source,
    TARGET_GRAMMAR_2_CAPABILITY,
  ).formattedText);
  assert.deepEqual(
    active.diagnostics.map(({ code, severity }) => [code, severity]),
    [["PTSEM-114", "warning"]],
  );
});

test("target formatter exposes no candidate for invalid temporal source", () => {
  const source = `project INVALID_FORMAT:
  version 2
  title "invalid format"
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"
  deadline 2026-07-26

task WORK START -> FINISH:
  title "work"
  duration 1d
  not_before 2026-07-25
`;
  const result = formatTargetDocument(
    source,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(result.ok, false);
  assert.equal(result.changed, false);
  assert.equal(result.formattedText, null);
  assert.deepEqual(result.edits, []);
  assert.deepEqual(
    result.diagnostics.map(({ code }) => code),
    ["PTSEM-112", "PTSEM-112"],
  );
});

test("all target fixtures round trip with equivalent ASTs and temporal tokens", async () => {
  const names = (await readdir(fixtureDirectory))
    .filter((name) => name.endsWith("-v2.pert"))
    .sort();
  assert.equal(names.length, 9);
  for (const name of names) {
    const source = await readFile(path.join(fixtureDirectory, name), "utf8");
    const before = validateTargetDocument(
      source,
      TARGET_GRAMMAR_2_CAPABILITY,
    );
    assert.equal(before.ok, true, name);
    const formatted = formatTargetDocument(
      source,
      TARGET_GRAMMAR_2_CAPABILITY,
    );
    assert.equal(
      formatted.ok,
      true,
      `${name}: ${formatted.diagnostics
        .map(({ code, message }) => `${code} ${message}`)
        .join("; ")}`,
    );
    const after = validateTargetDocument(
      formatted.formattedText,
      TARGET_GRAMMAR_2_CAPABILITY,
    );
    assert.equal(after.ok, true, name);
    assert.deepEqual(semanticDocument(after), semanticDocument(before), name);
    assert.deepEqual(temporalTokens(after), temporalTokens(before), name);

    const repeated = formatTargetDocument(
      formatted.formattedText,
      TARGET_GRAMMAR_2_CAPABILITY,
    );
    assert.equal(repeated.ok, true, name);
    assert.equal(repeated.changed, false, name);
    assert.deepEqual(repeated.edits, [], name);
  }
});

test("TUE-012 and TUE-013 retain all six temporal field occurrences", async () => {
  for (const name of ["migration-point-v2.pert", "migration-hour-v2.pert"]) {
    const source = await readFile(path.join(fixtureDirectory, name), "utf8");
    const before = validateTargetDocument(
      source,
      TARGET_GRAMMAR_2_CAPABILITY,
    );
    assert.equal(before.ok, true, name);
    assert.equal(temporalTokens(before).length, 6, name);

    const formatted = formatTargetDocument(
      source,
      TARGET_GRAMMAR_2_CAPABILITY,
    );
    assert.equal(formatted.ok, true, name);
    const after = validateTargetDocument(
      formatted.formattedText,
      TARGET_GRAMMAR_2_CAPABILITY,
    );
    assert.deepEqual(temporalTokens(after), temporalTokens(before), name);
  }
});
