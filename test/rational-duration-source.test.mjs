import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  parseTargetDocument,
  parseTargetGrammar3Document,
  TARGET_GRAMMAR_2_CAPABILITY,
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar3Document,
} from "../dist/semantic/target-validator.js";

function sourceWithDuration(literal, version = 3) {
  return `project RATIONAL:
  version ${version}
  title "rational duration"
  as_of 2026-07-25
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"

task WORK START -> FINISH:
  title "work"
  duration ${literal}
`;
}

function declaration(result, id) {
  const found = result.document.declarations.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(found, id);
  return found;
}

function field(result, id, name) {
  const found = declaration(result, id).fields.find(
    (candidate) => candidate.name === name,
  );
  assert.ok(found, `${id}.${name}`);
  return found;
}

test("target Grammar 3 source capability is internal and identity-checked", () => {
  for (const name of [
    "TARGET_GRAMMAR_3_CAPABILITY",
    "parseTargetGrammar3Document",
    "validateTargetGrammar3Document",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
  assert.equal(Object.isFrozen(TARGET_GRAMMAR_3_CAPABILITY), true);
  assert.throws(
    () => parseTargetGrammar3Document("", {
      id: "perttool.target-grammar-3-source",
      version: 1,
      grammarVersion: 3,
    }),
    /target Grammar 3 source capability is required/,
  );
  assert.throws(
    () => validateTargetGrammar3Document("", TARGET_GRAMMAR_2_CAPABILITY),
    /target Grammar 3 source capability is required/,
  );
});

test("Grammar 3 capability keeps Grammar 1 and Grammar 2 source closure", () => {
  const grammar1 = sourceWithDuration("1d", 1);
  assert.deepEqual(
    parseTargetGrammar3Document(
      grammar1,
      TARGET_GRAMMAR_3_CAPABILITY,
    ),
    publicApi.parseDocument(grammar1),
  );

  const grammar2 = sourceWithDuration("1d", 2).replace(
    'milestone FINISH:\n  title "finish"',
    'milestone FINISH:\n  title "finish"\n  deadline 2026-07-26',
  );
  assert.deepEqual(
    parseTargetGrammar3Document(
      grammar2,
      TARGET_GRAMMAR_3_CAPABILITY,
    ),
    parseTargetDocument(grammar2, TARGET_GRAMMAR_2_CAPABILITY),
  );

  const grammar2Fraction = parseTargetGrammar3Document(
    sourceWithDuration("1/3d", 2),
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.deepEqual(
    grammar2Fraction.diagnostics.map(({ code }) => code),
    ["PTDSL-007"],
  );
});

test("TUE-019 Grammar 3 retains exact Decimal and Fraction source values", () => {
  const text = `project EXACT:
  version 3
  title "exact duration source"
  as_of 2026-07-25
  duration_unit day
  finish FINISH
  critical_epsilon 0/7d
  target_duration 4/6d

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"

task FRACTION START -> FINISH:
  title "fraction"
  duration 1/3d

task DECIMAL START -> FINISH:
  title "decimal"
  duration 0.5d
`;
  const parsed = parseTargetGrammar3Document(
    text,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(field(parsed, "EXACT", "critical_epsilon").value, {
    text: "0/7d",
    numerator: 0n,
    denominator: 1n,
    suffix: "d",
  });
  assert.deepEqual(field(parsed, "EXACT", "target_duration").value, {
    text: "4/6d",
    numerator: 2n,
    denominator: 3n,
    suffix: "d",
  });
  assert.deepEqual(field(parsed, "FRACTION", "duration").value, {
    text: "1/3d",
    numerator: 1n,
    denominator: 3n,
    suffix: "d",
  });
  assert.deepEqual(field(parsed, "DECIMAL", "duration").value, {
    text: "0.5d",
    digits: 5n,
    scale: 1,
    suffix: "d",
  });

  for (const [id, name] of [
    ["EXACT", "critical_epsilon"],
    ["EXACT", "target_duration"],
    ["FRACTION", "duration"],
    ["DECIMAL", "duration"],
  ]) {
    const duration = field(parsed, id, name);
    assert.equal(
      text.slice(duration.valueSpan.start.offset, duration.valueSpan.end.offset),
      duration.rawValue,
    );
    assert.equal(duration.value.text, duration.rawValue);
  }

  const checked = validateTargetGrammar3Document(
    text,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(
    checked.ok,
    true,
    checked.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.equal(checked.validatedDocument?.grammarVersion, 3);
  assert.equal(Object.isFrozen(checked.validatedDocument), true);
});

test("TUE-020 malformed Grammar 3 fractions fail as PTDSL-007", () => {
  for (const literal of [
    "1/0d",
    "-1/3d",
    "1/-3d",
    "1 /3d",
    "1/ 3d",
    "1.5/3d",
    "1/3.0d",
    "1/2/3d",
    "1e0/3d",
  ]) {
    const text = sourceWithDuration(literal);
    const parsed = parseTargetGrammar3Document(
      text,
      TARGET_GRAMMAR_3_CAPABILITY,
    );
    assert.deepEqual(
      parsed.diagnostics.map(({ code, entityId }) => ({ code, entityId })),
      [{ code: "PTDSL-007", entityId: "WORK" }],
      literal,
    );
    const duration = field(parsed, "WORK", "duration");
    assert.equal(duration.rawValue, literal);
    assert.equal(duration.value, literal);
    assert.equal(
      text.slice(duration.valueSpan.start.offset, duration.valueSpan.end.offset),
      literal,
    );

    const checked = validateTargetGrammar3Document(
      text,
      TARGET_GRAMMAR_3_CAPABILITY,
    );
    assert.equal(checked.ok, false, literal);
    assert.equal(checked.parseFailed, true, literal);
    assert.equal(checked.validatedDocument, null, literal);
    assert.deepEqual(
      checked.diagnostics.map(({ code }) => code),
      ["PTDSL-007"],
      literal,
    );
  }
});

test("Grammar 3 accepts exact fraction velocity components", () => {
  const text = sourceWithDuration("1/3d").replace(
    "  duration_unit day\n",
    "  duration_unit day\n  velocity 1/3p/1d\n",
  );
  const parsed = parseTargetGrammar3Document(
    text,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.deepEqual(parsed.diagnostics, []);
  const velocity = parsed.document?.declarations[0]?.fields.find(
    ({ name }) => name === "velocity",
  )?.value;
  assert.equal(velocity?.points.numerator, 1n);
  assert.equal(velocity?.points.denominator, 3n);
});

test("Grammar 3 applies existing suffix, positivity, and PERT order rules", () => {
  const observations = [
    [sourceWithDuration("1/3h"), "PTSEM-105"],
    [sourceWithDuration("0/7d"), "PTSEM-104"],
    [
      sourceWithDuration("1d").replace(
        "  duration 1d",
        `  estimate:
    optimistic 2/3d
    most_likely 1/2d
    pessimistic 3/4d`,
      ),
      "PTSEM-104",
    ],
  ];
  for (const [text, expectedCode] of observations) {
    const result = validateTargetGrammar3Document(
      text,
      TARGET_GRAMMAR_3_CAPABILITY,
    );
    assert.equal(result.ok, false);
    assert.equal(result.parseFailed, false);
    assert.deepEqual(
      result.diagnostics.map(({ code }) => code),
      [expectedCode],
    );
  }
});

test("Grammar 3 inherits the Grammar 2 temporal anchor rule", () => {
  const text = sourceWithDuration("1/3d").replace(
    "  as_of 2026-07-25\n",
    "",
  ).replace(
    'milestone FINISH:\n  title "finish"',
    'milestone FINISH:\n  title "finish"\n  deadline 2026-07-26',
  );
  const result = validateTargetGrammar3Document(
    text,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(result.ok, false);
  assert.equal(result.parseFailed, false);
  assert.deepEqual(
    result.diagnostics.map(({ code, entityId }) => ({ code, entityId })),
    [{ code: "PTSEM-112", entityId: "FINISH" }],
  );
});
