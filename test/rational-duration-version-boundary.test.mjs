import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  planTargetExactDurationGrammarBoundary,
} from "../dist/application/target-grammar-boundary.js";
import {
  selectExactDurationGrammarBoundary,
} from "../dist/migration/grammar-boundary.js";
import {
  serializeExactDurationSource,
} from "../dist/model/exact-duration-source.js";
import {
  rational,
} from "../dist/model/rational.js";
import {
  applyTextEdits,
  normalizeTextEdits,
} from "../dist/mutation/text-edits.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar3Document,
} from "../dist/semantic/target-validator.js";

const decimal = serializeExactDurationSource(rational(1n, 2n), "day");
const fraction = serializeExactDurationSource(rational(1n, 3n), "day");

const grammar2 = `project VERSION_BOUNDARY:
  version 2
  title "version boundary"
  as_of 2026-07-25T09:00:00+09:00
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"
  deadline 2026-07-30T09:00:00+09:00

task WORK START -> FINISH:
  title "work"
  duration 1d
  not_before 2026-07-25T09:00:00+09:00
  deadline 2026-07-29T09:00:00+09:00
`;

const grammar1 = grammar2
  .replace("  version 2\n", "")
  .replace("  as_of 2026-07-25T09:00:00+09:00\n", "")
  .replace("  deadline 2026-07-30T09:00:00+09:00\n", "")
  .replace("  not_before 2026-07-25T09:00:00+09:00\n", "")
  .replace("  deadline 2026-07-29T09:00:00+09:00\n", "");

test("exact Duration grammar selection is deterministic and metadata-complete", () => {
  assert.deepEqual(
    selectExactDurationGrammarBoundary(
      2,
      [decimal],
      { migrationChanged: true, velocityDisposition: "retained" },
    ),
    {
      sourceGrammarVersion: 2,
      targetGrammarVersion: 2,
      grammarDisposition: "retained",
      requiresVersionUpgrade: false,
      reversibility: "exact",
      qualifications: [],
    },
  );
  assert.deepEqual(
    selectExactDurationGrammarBoundary(
      2,
      [decimal, fraction],
      { migrationChanged: true, velocityDisposition: "replaced" },
    ),
    {
      sourceGrammarVersion: 2,
      targetGrammarVersion: 3,
      grammarDisposition: "upgraded_for_exact_fraction",
      requiresVersionUpgrade: true,
      reversibility: "values_exact_metadata_changed",
      qualifications: [
        "grammar_upgraded_for_exact_fraction",
        "velocity_replaced",
      ],
    },
  );
  assert.deepEqual(
    selectExactDurationGrammarBoundary(
      3,
      [fraction],
      { migrationChanged: true, velocityDisposition: "retained" },
    ),
    {
      sourceGrammarVersion: 3,
      targetGrammarVersion: 3,
      grammarDisposition: "retained",
      requiresVersionUpgrade: false,
      reversibility: "exact",
      qualifications: [],
    },
  );
  assert.deepEqual(
    selectExactDurationGrammarBoundary(
      3,
      [decimal],
      { migrationChanged: true, velocityDisposition: "inserted" },
    ),
    {
      sourceGrammarVersion: 3,
      targetGrammarVersion: 3,
      grammarDisposition: "retained",
      requiresVersionUpgrade: false,
      reversibility: "values_exact_metadata_changed",
      qualifications: [
        "grammar_version_retained_on_inverse",
        "velocity_inserted",
      ],
    },
  );
  assert.deepEqual(
    selectExactDurationGrammarBoundary(
      1,
      [],
      { migrationChanged: false, velocityDisposition: null },
    ),
    {
      sourceGrammarVersion: 1,
      targetGrammarVersion: 1,
      grammarDisposition: "retained",
      requiresVersionUpgrade: false,
      reversibility: "not_applicable",
      qualifications: [],
    },
  );
});

test("grammar selection rejects noncanonical generated tokens and invalid context", () => {
  assert.throws(
    () => selectExactDurationGrammarBoundary(
      2,
      [{ classification: "fraction", token: "4/6d" }],
      { migrationChanged: true, velocityDisposition: "retained" },
    ),
    /generated Duration token must be canonical/,
  );
  assert.throws(
    () => selectExactDurationGrammarBoundary(
      4,
      [decimal],
      { migrationChanged: true, velocityDisposition: "retained" },
    ),
    /source grammar version must be 1, 2, or 3/,
  );
  assert.throws(
    () => selectExactDurationGrammarBoundary(
      2,
      [decimal],
      { migrationChanged: true, velocityDisposition: null },
    ),
    /changing migration requires a velocity disposition/,
  );
  assert.throws(
    () => selectExactDurationGrammarBoundary(
      2,
      [decimal],
      { migrationChanged: false, velocityDisposition: "replaced" },
    ),
    /no-op migration cannot replace or insert velocity/,
  );
  assert.throws(
    () => selectExactDurationGrammarBoundary(
      2,
      [fraction],
      { migrationChanged: false, velocityDisposition: null },
    ),
    /no-op migration cannot require a grammar upgrade/,
  );
  assert.deepEqual(
    selectExactDurationGrammarBoundary(
      3,
      [],
      { migrationChanged: true, velocityDisposition: "retained" },
    ).qualifications,
    [],
  );
});

test("Grammar 1 and Grammar 2 upgrade with one localized version edit", () => {
  for (const [source, sourceVersion] of [
    [grammar1, 1],
    [grammar2, 2],
  ]) {
    const result = planTargetExactDurationGrammarBoundary(
      source,
      [fraction],
      { migrationChanged: true, velocityDisposition: "retained" },
      TARGET_GRAMMAR_3_CAPABILITY,
    );
    assert.equal(result.ok, true);
    assert.equal(result.sourceGrammarVersion, sourceVersion);
    assert.equal(result.targetGrammarVersion, 3);
    assert.equal(result.grammarDisposition, "upgraded_for_exact_fraction");
    assert.equal(result.reversibility, "values_exact_metadata_changed");
    assert.deepEqual(result.qualifications, [
      "grammar_upgraded_for_exact_fraction",
    ]);
    assert.equal(result.versionChanged, true);
    assert.equal(result.versionEdits.length, 1);
    assert.ok(result.versionCandidateText.includes("  version 3\n"));
    assert.equal(
      validateTargetGrammar3Document(
        result.versionCandidateText,
        TARGET_GRAMMAR_3_CAPABILITY,
      ).ok,
      true,
    );
  }

  const omitted = planTargetExactDurationGrammarBoundary(
    grammar1,
    [fraction],
    { migrationChanged: true, velocityDisposition: "retained" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.ok(omitted.versionCandidateText.startsWith(
    `project VERSION_BOUNDARY:
  version 3
  title "version boundary"
`,
  ));
});

test("the version edit composes atomically with a generated Fraction", () => {
  const boundary = planTargetExactDurationGrammarBoundary(
    grammar2,
    [fraction],
    { migrationChanged: true, velocityDisposition: "retained" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(boundary.ok, true);
  const durationOffset = grammar2.indexOf("1d");
  assert.notEqual(durationOffset, -1);
  const edits = normalizeTextEdits(
    grammar2,
    [
      ...boundary.versionEdits,
      {
        startOffset: durationOffset,
        endOffset: durationOffset + 2,
        replacement: fraction.token,
      },
    ],
    "test exact Duration candidate",
  );
  const candidate = applyTextEdits(grammar2, edits);
  const checked = validateTargetGrammar3Document(
    candidate,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(checked.ok, true);
  assert.equal(checked.validatedDocument.grammarVersion, 3);
  assert.equal(publicApi.checkDocument(candidate).ok, false);
  assert.ok(candidate.includes("  duration 1/3d\n"));
  for (const token of [
    "2026-07-25T09:00:00+09:00",
    "2026-07-30T09:00:00+09:00",
    "2026-07-29T09:00:00+09:00",
  ]) {
    assert.equal(
      candidate.split(token).length,
      grammar2.split(token).length,
      token,
    );
  }
});

test("retained grammar exposes no version edit or source rewrite", () => {
  for (const [source, tokens, expected] of [
    [grammar1, [decimal], 1],
    [grammar2, [decimal], 2],
    [grammar2.replace("  version 2", "  version 3"), [fraction], 3],
  ]) {
    const result = planTargetExactDurationGrammarBoundary(
      source,
      tokens,
      { migrationChanged: true, velocityDisposition: "retained" },
      TARGET_GRAMMAR_3_CAPABILITY,
    );
    assert.equal(result.ok, true);
    assert.equal(result.targetGrammarVersion, expected);
    assert.equal(result.versionChanged, false);
    assert.deepEqual(result.versionEdits, []);
    assert.equal(result.versionCandidateText, source);
  }
});

test("the target boundary fails closed and remains internal", () => {
  for (const name of [
    "selectExactDurationGrammarBoundary",
    "planTargetExactDurationGrammarBoundary",
  ]) {
    assert.equal(name in publicApi, false, name);
  }

  const invalid = planTargetExactDurationGrammarBoundary(
    grammar2.replace("  duration 1d", "  duration 0d"),
    [fraction],
    { migrationChanged: true, velocityDisposition: "retained" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(invalid.ok, false);
  assert.equal(invalid.sourceGrammarVersion, null);
  assert.equal(invalid.targetGrammarVersion, null);
  assert.equal(invalid.versionCandidateText, null);
  assert.deepEqual(invalid.versionEdits, []);
  assert.ok(invalid.diagnostics.some(({ code }) => code === "PTSEM-104"));

  assert.throws(
    () => planTargetExactDurationGrammarBoundary(
      grammar2,
      [fraction],
      { migrationChanged: true, velocityDisposition: "retained" },
      {
        id: "perttool.target-grammar-3-source",
        version: 1,
        grammarVersion: 3,
      },
    ),
    /target Grammar 3 source capability is required/,
  );
});
