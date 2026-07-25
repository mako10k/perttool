import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  formatTargetDocument,
  formatTargetGrammar3Document,
} from "../dist/formatter/target-source-formatter.js";
import {
  TARGET_GRAMMAR_2_CAPABILITY,
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  rational,
} from "../dist/model/rational.js";
import {
  validateTargetGrammar3Document,
} from "../dist/semantic/target-validator.js";

const source = [
  "\uFEFFproject   EXACT_FORMAT:  ",
  "  version   0003  ",
  '  title  "exact format"  ',
  "  as_of   2026-07-25  ",
  "  duration_unit day",
  "  finish FINISH",
  "  critical_epsilon   0/7d  ",
  "  target_duration   1/2d  ",
  "",
  "milestone START:",
  '  title "start"',
  "  state reached",
  "",
  "milestone FINISH:",
  '  title "finish"',
  "",
  "task  WORK   START  ->   FINISH: ",
  "  # retain estimate ownership  ",
  "  estimate:",
  "    optimistic   2/6d  ",
  "    most_likely   4/6d  ",
  "    pessimistic   6/6d  ",
  '  title "work"',
].join("\r\n");

function durationTokens(result) {
  const document = result.validatedDocument?.document;
  assert.ok(document);
  return Object.fromEntries(
    document.declarations.flatMap((declaration) =>
      declaration.fields.flatMap((field) => {
        if (field.children !== undefined) {
          return field.children.map((child) => [
            `${declaration.id}.${field.name}.${child.name}`,
            child.rawValue,
          ]);
        }
        return [
          "critical_epsilon",
          "target_duration",
          "duration",
        ].includes(field.name)
          ? [[`${declaration.id}.${field.name}`, field.rawValue]]
          : [];
      })),
  );
}

function exactDurationValues(result) {
  const document = result.validatedDocument?.document;
  assert.ok(document);
  return Object.fromEntries(
    document.declarations.flatMap((declaration) =>
      declaration.fields.flatMap((field) => {
        const values = field.children ?? (
          [
            "critical_epsilon",
            "target_duration",
            "duration",
          ].includes(field.name)
            ? [field]
            : []
        );
        return values.map((value) => {
          const exact = "numerator" in value.value
            ? rational(value.value.numerator, value.value.denominator)
            : rational(
                value.value.digits,
                10n ** BigInt(value.value.scale),
              );
          return [
            `${declaration.id}.${field.name}.${value.name}`,
            `${exact.numerator}/${exact.denominator}${value.value.suffix}`,
          ];
        });
      })),
  );
}

test("Grammar 3 formatter remains an internal identity-checked boundary", () => {
  assert.equal("formatTargetGrammar3Document" in publicApi, false);
  assert.throws(
    () => formatTargetGrammar3Document("", {
      id: "perttool.target-grammar-3-source",
      version: 1,
      grammarVersion: 3,
    }),
    /target Grammar 3 source capability is required/,
  );
  const grammar2 = formatTargetDocument(source, TARGET_GRAMMAR_2_CAPABILITY);
  assert.equal(grammar2.ok, false);
  assert.equal(grammar2.formattedText, null);
});

test("TUE-019 explicit Grammar 3 formatting uses exact canonical tokens", () => {
  const before = validateTargetGrammar3Document(
    source,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(before.ok, true);

  const formatted = formatTargetGrammar3Document(
    source,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(formatted.ok, true);
  assert.equal(formatted.changed, true);
  assert.ok(formatted.formattedText.startsWith(
    "\uFEFFproject EXACT_FORMAT:\r\n",
  ));
  assert.ok(formatted.formattedText.includes(
    "  # retain estimate ownership  \r\n",
  ));

  const after = validateTargetGrammar3Document(
    formatted.formattedText,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(after.ok, true);
  assert.deepEqual(exactDurationValues(after), exactDurationValues(before));
  assert.deepEqual(durationTokens(after), {
    "EXACT_FORMAT.critical_epsilon": "0d",
    "EXACT_FORMAT.target_duration": "0.5d",
    "WORK.estimate.optimistic": "1/3d",
    "WORK.estimate.most_likely": "2/3d",
    "WORK.estimate.pessimistic": "1d",
  });

  const repeated = formatTargetGrammar3Document(
    formatted.formattedText,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.formattedText, formatted.formattedText);
  assert.deepEqual(repeated.edits, []);
});

test("Grammar 3 formatter exposes no candidate for malformed source", () => {
  const malformed = source.replace("2/6d", "2/0d");
  const result = formatTargetGrammar3Document(
    malformed,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(result.ok, false);
  assert.equal(result.changed, false);
  assert.equal(result.formattedText, null);
  assert.deepEqual(result.edits, []);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["PTDSL-007"]);
});
