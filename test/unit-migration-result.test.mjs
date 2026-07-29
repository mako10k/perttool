import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  planTargetUnitMigrationResult,
  TARGET_UNIT_MIGRATION_RESULT_SCHEMA_VERSION,
  withTargetUnitMigrationWrite,
} from "../dist/application/target-unit-migration-result.js";
import {
  replaceTargetGrammar3DocumentFile,
} from "../dist/io/target-safe-write.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, "fixtures", "temporal-units");

async function fixture(name) {
  return readFile(path.join(fixtureDirectory, name), "utf8");
}

function plan(text, request) {
  return planTargetUnitMigrationResult(
    text,
    request,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
}

test("UnitMigrationResult v3 remains an internal Contract 6 implementation boundary", () => {
  assert.equal(
    TARGET_UNIT_MIGRATION_RESULT_SCHEMA_VERSION,
    "Perttool.UnitMigrationResult.v3",
  );
  assert.equal("planTargetUnitMigrationResult" in publicApi, false);
  assert.equal("withTargetUnitMigrationWrite" in publicApi, false);
});

test("TUE-012 projects the complete exact UnitMigrationResult v3 outcome", async () => {
  const source = await fixture("migration-point-v2.pert");
  const result = plan(source, { targetUnit: "day" });

  assert.equal(result.schemaVersion, "Perttool.UnitMigrationResult.v3");
  assert.equal(result.ok, true);
  assert.deepEqual(result.unitMigration, {
    id: "perttool.unit-migration",
    version: 3,
  });
  assert.equal(result.documentId, "MIGRATION_POINT");
  assert.equal(result.sourceGrammarVersion, 2);
  assert.equal(result.targetGrammarVersion, 2);
  assert.equal(result.grammarDisposition, "retained");
  assert.equal(result.sourceUnit, "point");
  assert.equal(result.targetUnit, "day");
  assert.deepEqual(result.effectiveVelocity, {
    points: { numerator: 20n, denominator: 1n, unit: "point" },
    period: { numerator: 10n, denominator: 1n, unit: "day" },
  });
  assert.equal("inputToken" in result.effectiveVelocity, false);
  assert.equal(result.velocityDisposition, "retained");
  assert.equal(result.changed, true);
  assert.deepEqual(
    result.convertedFields.map((field) => ({
      fieldPath: field.fieldPath,
      original: field.original,
      converted: field.converted,
      canonicalToken: field.canonicalToken,
      hasClassification: "tokenClassification" in field,
    })),
    [
      {
        fieldPath: "project.critical_epsilon",
        original: { numerator: 1n, denominator: 2n, unit: "point" },
        converted: { numerator: 1n, denominator: 4n, unit: "day" },
        canonicalToken: "0.25d",
        hasClassification: false,
      },
      {
        fieldPath: "project.target_duration",
        original: { numerator: 12n, denominator: 1n, unit: "point" },
        converted: { numerator: 6n, denominator: 1n, unit: "day" },
        canonicalToken: "6d",
        hasClassification: false,
      },
      {
        fieldPath: "task.FIXED.duration",
        original: { numerator: 4n, denominator: 1n, unit: "point" },
        converted: { numerator: 2n, denominator: 1n, unit: "day" },
        canonicalToken: "2d",
        hasClassification: false,
      },
      {
        fieldPath: "task.ESTIMATED.estimate.optimistic",
        original: { numerator: 2n, denominator: 1n, unit: "point" },
        converted: { numerator: 1n, denominator: 1n, unit: "day" },
        canonicalToken: "1d",
        hasClassification: false,
      },
      {
        fieldPath: "task.ESTIMATED.estimate.most_likely",
        original: { numerator: 4n, denominator: 1n, unit: "point" },
        converted: { numerator: 2n, denominator: 1n, unit: "day" },
        canonicalToken: "2d",
        hasClassification: false,
      },
      {
        fieldPath: "task.ESTIMATED.estimate.pessimistic",
        original: { numerator: 6n, denominator: 1n, unit: "point" },
        converted: { numerator: 3n, denominator: 1n, unit: "day" },
        canonicalToken: "3d",
        hasClassification: false,
      },
    ],
  );
  assert.equal(result.reversibility, "exact");
  assert.deepEqual(result.qualifications, []);
  assert.deepEqual(result.unavailableCauses, []);
  assert.ok(result.updatedText.includes("  duration_unit day\n"));
  assert.ok(result.diff.startsWith("--- original\n+++ updated\n"));
  assert.ok(result.edits.length > 0);
  assert.deepEqual(result.write, {
    mode: "preview",
    target: null,
    written: false,
  });
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.diagnosticsTruncated, false);
});

test("no-op and Grammar 3 upgrade retain their distinct result meanings", async () => {
  const hour = await fixture("migration-hour-v2.pert");
  const noOp = plan(hour, { targetUnit: "hour" });
  assert.equal(noOp.ok, true);
  assert.equal(noOp.changed, false);
  assert.equal(noOp.updatedText, hour);
  assert.equal(noOp.updatedDigest, noOp.originalDigest);
  assert.equal(noOp.effectiveVelocity, null);
  assert.deepEqual(noOp.convertedFields, []);
  assert.equal(noOp.reversibility, "not_applicable");

  const rational = plan(
    await fixture("migration-nonrepresentable-v2.pert"),
    { targetUnit: "day" },
  );
  assert.equal(rational.ok, true);
  assert.equal(rational.targetGrammarVersion, 3);
  assert.equal(
    rational.grammarDisposition,
    "upgraded_for_exact_fraction",
  );
  assert.equal(rational.reversibility, "values_exact_metadata_changed");
  assert.deepEqual(rational.qualifications, [
    "grammar_upgraded_for_exact_fraction",
  ]);
  assert.ok(
    rational.convertedFields.some(
      ({ canonicalToken }) => canonicalToken === "1/3d",
    ),
  );
});

test("invalid UnitMigrationResult v3 projections are complete and deterministic", async () => {
  const source = await fixture("migration-point-v2.pert");
  const first = plan(source, { targetUnit: "hour" });
  const second = plan(source, { targetUnit: "hour" });

  assert.deepEqual(first, second);
  assert.equal(first.ok, false);
  assert.equal(first.schemaVersion, "Perttool.UnitMigrationResult.v3");
  assert.equal(first.documentId, "MIGRATION_POINT");
  assert.equal(first.sourceGrammarVersion, 2);
  assert.equal(first.targetGrammarVersion, null);
  assert.equal(first.grammarDisposition, null);
  assert.equal(first.sourceUnit, "point");
  assert.equal(first.targetUnit, "hour");
  assert.equal(first.effectiveVelocity, null);
  assert.equal(first.velocityDisposition, null);
  assert.equal(first.changed, false);
  assert.deepEqual(first.convertedFields, []);
  assert.equal(first.reversibility, "not_applicable");
  assert.deepEqual(first.qualifications, []);
  assert.deepEqual(first.unavailableCauses, [
    {
      cause: "velocity_period_mismatch",
      diagnosticCode: "PTMIG-405",
      fieldPaths: ["project.velocity", "request.target_unit"],
    },
  ]);
  assert.equal(first.updatedDigest, null);
  assert.equal(first.updatedText, null);
  assert.equal(first.diff, null);
  assert.deepEqual(first.edits, []);
  assert.deepEqual(first.write, {
    mode: "preview",
    target: null,
    written: false,
  });
});

test("successful result attaches only matching target safe-write state", async () => {
  const source = await fixture("migration-point-v2.pert");
  const result = plan(source, { targetUnit: "day" });
  assert.equal(result.ok, true);

  const directory = await mkdtemp(
    path.join(tmpdir(), "perttool-unit-migration-result-"),
  );
  try {
    const target = path.join(directory, "plan.pert");
    await writeFile(target, source, "utf8");
    const output = await replaceTargetGrammar3DocumentFile(
      target,
      result.updatedText,
      TARGET_GRAMMAR_3_CAPABILITY,
      {
        initialDigest: result.originalDigest,
        expectedDigest: result.originalDigest,
      },
    );
    const written = withTargetUnitMigrationWrite(result, output);
    assert.deepEqual(written.write, {
      mode: "in_place",
      target,
      written: true,
    });
    assert.deepEqual(result.write, {
      mode: "preview",
      target: null,
      written: false,
    });
    assert.equal(await readFile(target, "utf8"), result.updatedText);
    assert.throws(
      () => withTargetUnitMigrationWrite(written, output),
      /does not match the candidate/,
    );
    assert.throws(
      () =>
        withTargetUnitMigrationWrite(result, {
          ...output,
          digest: "sha256:invalid",
        }),
      /does not match the candidate/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
