import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  planTargetUnitMigrationCandidate,
} from "../dist/application/target-unit-migration-candidate.js";
import {
  prepareTargetUnitMigrationRequest,
} from "../dist/application/target-unit-migration-request.js";
import {
  replaceTargetGrammar3DocumentFile,
} from "../dist/io/target-safe-write.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar3Document,
} from "../dist/semantic/target-validator.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, "fixtures", "temporal-units");

async function fixture(name) {
  return readFile(path.join(fixtureDirectory, name), "utf8");
}

function applyEdits(text, edits) {
  let updated = text;
  for (const edit of [...edits].reverse()) {
    updated = `${updated.slice(0, edit.startOffset)}${edit.replacement}${updated.slice(edit.endOffset)}`;
  }
  return updated;
}

function assertValidCandidate(result, grammarVersion) {
  assert.equal(
    result.ok,
    true,
    result.unavailableCauses.map(({ cause }) => cause).join(", "),
  );
  const checked = validateTargetGrammar3Document(
    result.updatedText,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(
    checked.ok,
    true,
    checked.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.equal(checked.validatedDocument.grammarVersion, grammarVersion);
  return checked.validatedDocument.document;
}

function temporalProjection(document) {
  const entries = [];
  for (const declaration of document.declarations) {
    for (const field of declaration.fields) {
      if (
        (declaration.kind === "project" && field.name === "as_of") ||
        (declaration.kind === "milestone" && field.name === "deadline") ||
        (declaration.kind === "task" &&
          (field.name === "not_before" || field.name === "deadline"))
      ) {
        entries.push([
          `${declaration.kind}.${declaration.id}.${field.name}`,
          field.rawValue,
        ]);
      }
    }
  }
  return entries;
}

function prepare(text, request) {
  const result = prepareTargetUnitMigrationRequest(
    text,
    request,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(
    result.ok,
    true,
    result.unavailableCauses.map(({ cause }) => cause).join(", "),
  );
  return result;
}

function exactDurationProjection(text, unit) {
  return prepare(text, { targetUnit: unit }).durationInventory.map(
    ({ fieldPath, sourceValue }) => ({
      fieldPath,
      numerator: sourceValue.numerator,
      denominator: sourceValue.denominator,
    }),
  );
}

function nonTimingProjection(document) {
  return document.declarations.map((declaration) => {
    const excludedFields =
      declaration.kind === "project"
        ? new Set([
            "version",
            "as_of",
            "duration_unit",
            "velocity",
            "critical_epsilon",
            "target_duration",
          ])
        : declaration.kind === "milestone"
          ? new Set(["deadline"])
          : declaration.kind === "task"
            ? new Set(["duration", "estimate", "not_before", "deadline"])
            : new Set();
    return {
      kind: declaration.kind,
      id: declaration.id,
      from: declaration.from ?? null,
      to: declaration.to ?? null,
      fields: declaration.fields
        .filter(({ name }) => !excludedFields.has(name))
        .map(({ name, rawValue }) => ({ name, rawValue })),
    };
  });
}

test("unit-migration candidate remains internal and changes no Contract 3 surface", () => {
  assert.equal("planTargetUnitMigrationCandidate" in publicApi, false);
});

test("TUE-012 produces one exact source-preserving Point-to-day candidate", async () => {
  const source = await fixture("migration-point-v2.pert");
  const original = validateTargetGrammar3Document(
    source,
    TARGET_GRAMMAR_3_CAPABILITY,
  ).validatedDocument.document;
  const result = planTargetUnitMigrationCandidate(
    source,
    { targetUnit: "day" },
    TARGET_GRAMMAR_3_CAPABILITY,
    { originalLabel: "plan.pert", updatedLabel: "candidate" },
  );

  const candidate = assertValidCandidate(result, 2);
  assert.equal(result.changed, true);
  assert.equal(applyEdits(source, result.edits), result.updatedText);
  assert.match(result.diff, /^--- plan\.pert\n\+\+\+ candidate\n@@ /);
  assert.deepEqual(
    result.convertedFields.map(({ fieldPath, canonicalToken }) => [
      fieldPath,
      canonicalToken,
    ]),
    [
      ["project.critical_epsilon", "0.25d"],
      ["project.target_duration", "6d"],
      ["task.FIXED.duration", "2d"],
      ["task.ESTIMATED.estimate.optimistic", "1d"],
      ["task.ESTIMATED.estimate.most_likely", "2d"],
      ["task.ESTIMATED.estimate.pessimistic", "3d"],
    ],
  );
  assert.ok(result.updatedText.includes("  duration_unit day\n"));
  assert.ok(result.updatedText.includes("  velocity 20p/10d\n"));
  assert.deepEqual(temporalProjection(candidate), temporalProjection(original));
  assert.equal(result.reversibility, "exact");
  assert.deepEqual(result.qualifications, []);
});

test("TUE-013 inserts canonical velocity in project-field order", async () => {
  const source = (await fixture("migration-hour-v2.pert")).replaceAll(
    "\n",
    "\r\n",
  );
  const result = planTargetUnitMigrationCandidate(
    source,
    {
      targetUnit: "point",
      replacementVelocity: "08.00p/04.0h",
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );

  assertValidCandidate(result, 2);
  assert.equal(result.velocityDisposition, "inserted");
  assert.ok(result.updatedText.includes(
    "  duration_unit point\r\n" +
    "  velocity 8p/4h\r\n" +
    "  critical_epsilon 1p\r\n",
  ));
  assert.equal(result.updatedText.replaceAll("\r\n", "").includes("\n"), false);
  assert.equal(result.reversibility, "values_exact_metadata_changed");
  assert.deepEqual(result.qualifications, ["velocity_inserted"]);
});

test("Grammar 1 inserts version 3 atomically when a Fraction is required", () => {
  const source = [
    "project MIGRATION_V1:",
    '  title "Grammar 1 fraction upgrade"',
    "  duration_unit point",
    "  velocity 3p/1d",
    "  finish FINISH",
    "",
    "milestone START:",
    '  title "start"',
    "  state reached",
    "",
    "milestone FINISH:",
    '  title "finish"',
    "",
    "task WORK START -> FINISH:",
    '  title "work"',
    "  duration 1p",
    "",
  ].join("\n");
  const result = planTargetUnitMigrationCandidate(
    source,
    { targetUnit: "day" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );

  assertValidCandidate(result, 3);
  assert.ok(result.updatedText.startsWith(
    "project MIGRATION_V1:\n" +
    "  version 3\n" +
    '  title "Grammar 1 fraction upgrade"\n',
  ));
  assert.ok(result.updatedText.includes("  duration 1/3d\n"));
});

test("an equal replacement retains the declared velocity bytes", async () => {
  const source = (await fixture("migration-point-v2.pert")).replace(
    "  velocity 20p/10d",
    "  velocity 20.00p/10.0d",
  );
  const result = planTargetUnitMigrationCandidate(
    source,
    {
      targetUnit: "day",
      replacementVelocity: "2p/1d",
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );

  assertValidCandidate(result, 2);
  assert.equal(result.velocityDisposition, "retained");
  assert.ok(result.updatedText.includes("  velocity 20.00p/10.0d\n"));
  assert.doesNotMatch(result.updatedText, /  velocity 2p\/1d/);
});

test("TUE-015 upgrades version and every Duration in the same candidate", async () => {
  const source = await fixture("migration-nonrepresentable-v2.pert");
  const result = planTargetUnitMigrationCandidate(
    source,
    { targetUnit: "day" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );

  assertValidCandidate(result, 3);
  assert.equal(result.targetGrammarVersion, 3);
  assert.equal(result.grammarDisposition, "upgraded_for_exact_fraction");
  assert.ok(result.updatedText.includes("  version 3\n"));
  assert.ok(result.updatedText.includes("  duration_unit day\n"));
  assert.ok(result.updatedText.includes("  critical_epsilon 1/3d\n"));
  assert.ok(result.updatedText.includes("    most_likely 2/3d\n"));
  assert.deepEqual(result.qualifications, [
    "grammar_upgraded_for_exact_fraction",
  ]);
});

test("same-unit no-op returns the original source and no edits", async () => {
  const source = await fixture("migration-hour-v2.pert");
  const result = planTargetUnitMigrationCandidate(
    source,
    { targetUnit: "hour" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );

  assert.equal(result.ok, true);
  assert.equal(result.changed, false);
  assert.equal(result.updatedText, source);
  assert.equal(result.updatedDigest, result.originalDigest);
  assert.equal(result.diff, "");
  assert.deepEqual(result.edits, []);
  assert.deepEqual(result.convertedFields, []);
  assert.equal(result.reversibility, "not_applicable");
});

test("TUE-016 repeating a completed target is the same no-op and never rescales", async () => {
  const source = await fixture("migration-point-v2.pert");
  const first = planTargetUnitMigrationCandidate(
    source,
    { targetUnit: "day" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(first.ok, true);
  assert.equal(first.changed, true);

  const repeated = planTargetUnitMigrationCandidate(
    first.updatedText,
    { targetUnit: "day" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.updatedText, first.updatedText);
  assert.equal(repeated.originalDigest, first.updatedDigest);
  assert.equal(repeated.updatedDigest, first.updatedDigest);
  assert.deepEqual(repeated.edits, []);
  assert.equal(repeated.diff, "");
  assert.deepEqual(repeated.convertedFields, []);
  assert.equal(repeated.reversibility, "not_applicable");
});

test("TUE-017 exact inverse restores Rational values without restoring lexical padding", async () => {
  const preservedTrivia = "# round-trip source marker 😀\n\n";
  const source = (await fixture("migration-point-v2.pert")).replace(
    "task FIXED START -> MID:",
    `${preservedTrivia}task FIXED START -> MID:`,
  );
  const original = assertValidCandidate(
    planTargetUnitMigrationCandidate(
      source,
      { targetUnit: "point" },
      TARGET_GRAMMAR_3_CAPABILITY,
    ),
    2,
  );
  const forward = planTargetUnitMigrationCandidate(
    source,
    { targetUnit: "day" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(forward.ok, true);
  const inverse = planTargetUnitMigrationCandidate(
    forward.updatedText,
    { targetUnit: "point" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  const restored = assertValidCandidate(inverse, 2);

  assert.equal(inverse.changed, true);
  assert.equal(inverse.sourceUnit, "day");
  assert.equal(inverse.targetUnit, "point");
  assert.equal(inverse.velocityDisposition, "retained");
  assert.deepEqual(inverse.effectiveVelocity, forward.effectiveVelocity);
  assert.equal(inverse.reversibility, "exact");
  assert.deepEqual(inverse.qualifications, []);
  assert.deepEqual(
    exactDurationProjection(inverse.updatedText, "point"),
    exactDurationProjection(source, "point"),
  );
  assert.deepEqual(temporalProjection(restored), temporalProjection(original));
  assert.deepEqual(
    nonTimingProjection(restored),
    nonTimingProjection(original),
  );
  assert.ok(source.includes("  duration 4.00p\n"));
  assert.ok(inverse.updatedText.includes("  duration 4p\n"));
  assert.ok(inverse.updatedText.includes(preservedTrivia));
  assert.notEqual(inverse.updatedText, source);
});

test("TUE-015 inverse restores values while retaining an exact-fraction Grammar 3 upgrade", async () => {
  const source = await fixture("migration-nonrepresentable-v2.pert");
  const forward = planTargetUnitMigrationCandidate(
    source,
    { targetUnit: "day" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(forward.ok, true);
  assert.equal(forward.targetGrammarVersion, 3);
  assert.equal(forward.reversibility, "values_exact_metadata_changed");
  assert.deepEqual(forward.qualifications, [
    "grammar_upgraded_for_exact_fraction",
  ]);

  const inverse = planTargetUnitMigrationCandidate(
    forward.updatedText,
    { targetUnit: "point" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assertValidCandidate(inverse, 3);
  assert.equal(inverse.targetGrammarVersion, 3);
  assert.equal(inverse.grammarDisposition, "retained");
  assert.equal(inverse.reversibility, "values_exact_metadata_changed");
  assert.deepEqual(inverse.qualifications, [
    "grammar_version_retained_on_inverse",
  ]);
  assert.deepEqual(
    exactDurationProjection(inverse.updatedText, "point"),
    exactDurationProjection(source, "point"),
  );
  assert.ok(inverse.updatedText.includes("  version 3\n"));
});

test("inserted velocity qualifies the round trip without inventing historical provenance", async () => {
  const source = await fixture("migration-hour-v2.pert");
  const forward = planTargetUnitMigrationCandidate(
    source,
    {
      targetUnit: "point",
      replacementVelocity: "8p/4h",
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(forward.ok, true);
  assert.equal(forward.velocityDisposition, "inserted");
  assert.equal(forward.reversibility, "values_exact_metadata_changed");
  assert.deepEqual(forward.qualifications, ["velocity_inserted"]);

  const inverse = planTargetUnitMigrationCandidate(
    forward.updatedText,
    { targetUnit: "hour" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assertValidCandidate(inverse, 2);
  assert.equal(inverse.velocityDisposition, "retained");
  assert.deepEqual(inverse.effectiveVelocity, forward.effectiveVelocity);
  assert.equal(inverse.reversibility, "exact");
  assert.deepEqual(inverse.qualifications, []);
  assert.deepEqual(
    exactDurationProjection(inverse.updatedText, "hour"),
    exactDurationProjection(source, "hour"),
  );
  assert.ok(inverse.updatedText.includes("  velocity 8p/4h\n"));
  assert.notEqual(inverse.updatedText, source);
});

test("replaced velocity qualifies the round trip without reconstructing its former value", async () => {
  const source = await fixture("migration-point-v2.pert");
  const forward = planTargetUnitMigrationCandidate(
    source,
    {
      targetUnit: "day",
      replacementVelocity: "4p/1d",
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(forward.ok, true);
  assert.equal(forward.velocityDisposition, "replaced");
  assert.equal(forward.reversibility, "values_exact_metadata_changed");
  assert.deepEqual(forward.qualifications, ["velocity_replaced"]);

  const inverse = planTargetUnitMigrationCandidate(
    forward.updatedText,
    { targetUnit: "point" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assertValidCandidate(inverse, 2);
  assert.equal(inverse.velocityDisposition, "retained");
  assert.deepEqual(inverse.effectiveVelocity, forward.effectiveVelocity);
  assert.equal(inverse.reversibility, "exact");
  assert.deepEqual(inverse.qualifications, []);
  assert.deepEqual(
    exactDurationProjection(inverse.updatedText, "point"),
    exactDurationProjection(source, "point"),
  );
  assert.ok(inverse.updatedText.includes("  velocity 4p/1d\n"));
  assert.notEqual(inverse.updatedText, source);
});

test("request and source failures expose no partial candidate", async () => {
  const source = await fixture("migration-point-v2.pert");
  const unsupported = planTargetUnitMigrationCandidate(
    source,
    { targetUnit: "hour" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(unsupported.ok, false);
  assert.deepEqual(
    unsupported.unavailableCauses.map(({ cause }) => cause),
    ["velocity_period_mismatch"],
  );
  assert.equal(unsupported.updatedText, null);
  assert.equal(unsupported.updatedDigest, null);
  assert.equal(unsupported.diff, null);
  assert.deepEqual(unsupported.edits, []);
  assert.deepEqual(unsupported.convertedFields, []);

  const invalid = planTargetUnitMigrationCandidate(
    source.replace("  duration 4.00p", "  duration invalid"),
    { targetUnit: "day" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(invalid.ok, false);
  assert.deepEqual(
    invalid.unavailableCauses.map(({ cause }) => cause),
    ["invalid_original"],
  );
  assert.ok(invalid.diagnostics.some(({ code }) => code === "PTDSL-007"));
  assert.equal(invalid.updatedText, null);
  assert.deepEqual(invalid.edits, []);
});

test("candidate output is deterministic and reuses target safe writes", async () => {
  const source = `\uFEFF${(await fixture("migration-point-v2.pert")).replace(
    '  title "Point-to-day exact migration"',
    '  title "Point-to-day exact migration 😀"',
  )}`;
  const first = planTargetUnitMigrationCandidate(
    source,
    { targetUnit: "day" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  const second = planTargetUnitMigrationCandidate(
    source,
    { targetUnit: "day" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  assert.ok(first.updatedText.startsWith("\uFEFF"));

  const directory = await mkdtemp(
    path.join(tmpdir(), "perttool-unit-migration-"),
  );
  try {
    const target = path.join(directory, "plan.pert");
    await writeFile(target, source, "utf8");
    const written = await replaceTargetGrammar3DocumentFile(
      target,
      first.updatedText,
      TARGET_GRAMMAR_3_CAPABILITY,
      {
        initialDigest: first.originalDigest,
        expectedDigest: first.originalDigest,
      },
    );
    assert.equal(written.written, true);
    assert.equal(written.digest, first.updatedDigest);
    assert.equal(await readFile(target, "utf8"), first.updatedText);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
