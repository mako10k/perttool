import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  prepareTargetUnitMigrationRequest,
} from "../dist/application/target-unit-migration-request.js";
import {
  convertPreparedUnitMigrationRequest,
} from "../dist/migration/conversion.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, "fixtures", "temporal-units");

async function fixture(name) {
  return readFile(path.join(fixtureDirectory, name), "utf8");
}

function prepare(source, request) {
  const prepared = prepareTargetUnitMigrationRequest(
    source,
    request,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(
    prepared.ok,
    true,
    prepared.unavailableCauses.map(({ cause }) => cause).join(", "),
  );
  return prepared;
}

function exact(numerator, denominator, unit) {
  return { numerator: BigInt(numerator), denominator: BigInt(denominator), unit };
}

function tokenProjection(converted) {
  return Object.fromEntries(
    converted.convertedFields.map(({ fieldPath, canonicalToken }) => [
      fieldPath,
      canonicalToken,
    ]),
  );
}

test("exact unit conversion remains an internal Contract 3 input", async () => {
  assert.equal("convertPreparedUnitMigrationRequest" in publicApi, false);
  const source = await readFile(
    path.join(testDirectory, "..", "src/migration/conversion.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /formatDecimal|precision|Math\.|Number\(/);
});

test("TUE-012 converts the complete Point inventory to exact day records", async () => {
  const prepared = prepare(
    await fixture("migration-point-v2.pert"),
    { targetUnit: "day" },
  );
  const converted = convertPreparedUnitMigrationRequest(prepared);

  assert.equal(converted.sourceGrammarVersion, 2);
  assert.equal(converted.targetGrammarVersion, 2);
  assert.equal(converted.grammarDisposition, "retained");
  assert.equal(converted.reversibility, "exact");
  assert.deepEqual(converted.qualifications, []);
  assert.deepEqual(tokenProjection(converted), {
    "project.critical_epsilon": "0.25d",
    "project.target_duration": "6d",
    "task.FIXED.duration": "2d",
    "task.ESTIMATED.estimate.optimistic": "1d",
    "task.ESTIMATED.estimate.most_likely": "2d",
    "task.ESTIMATED.estimate.pessimistic": "3d",
  });
  assert.deepEqual(converted.convertedFields[0], {
    entityKind: "project",
    entityId: "MIGRATION_POINT",
    fieldPath: "project.critical_epsilon",
    original: exact(1, 2, "point"),
    converted: exact(1, 4, "day"),
    canonicalToken: "0.25d",
    tokenClassification: "decimal",
  });
});

test("TUE-013 converts hour to Point and qualifies inserted velocity", async () => {
  const prepared = prepare(
    await fixture("migration-hour-v2.pert"),
    { targetUnit: "point", replacementVelocity: "8p/4h" },
  );
  const converted = convertPreparedUnitMigrationRequest(prepared);

  assert.deepEqual(tokenProjection(converted), {
    "project.critical_epsilon": "1p",
    "project.target_duration": "8p",
    "task.FIXED.duration": "5p",
    "task.ESTIMATED.estimate.optimistic": "2p",
    "task.ESTIMATED.estimate.most_likely": "4p",
    "task.ESTIMATED.estimate.pessimistic": "6p",
  });
  assert.equal(converted.grammarDisposition, "retained");
  assert.equal(converted.reversibility, "values_exact_metadata_changed");
  assert.deepEqual(converted.qualifications, ["velocity_inserted"]);
});

test("TUE-015 uses reduced fractions and selects Grammar 3 atomically", async () => {
  const prepared = prepare(
    await fixture("migration-nonrepresentable-v2.pert"),
    { targetUnit: "day" },
  );
  const converted = convertPreparedUnitMigrationRequest(prepared);

  assert.deepEqual(tokenProjection(converted), {
    "project.critical_epsilon": "1/3d",
    "project.target_duration": "2/3d",
    "task.FIXED.duration": "1/3d",
    "task.ESTIMATED.estimate.optimistic": "1/3d",
    "task.ESTIMATED.estimate.most_likely": "2/3d",
    "task.ESTIMATED.estimate.pessimistic": "1d",
  });
  assert.equal(converted.targetGrammarVersion, 3);
  assert.equal(converted.grammarDisposition, "upgraded_for_exact_fraction");
  assert.equal(converted.reversibility, "values_exact_metadata_changed");
  assert.deepEqual(converted.qualifications, [
    "grammar_upgraded_for_exact_fraction",
  ]);
});

test("same-unit no-op produces no conversion records or rescaling", async () => {
  const prepared = prepare(
    await fixture("migration-hour-v2.pert"),
    { targetUnit: "hour" },
  );
  const converted = convertPreparedUnitMigrationRequest(prepared);

  assert.equal(converted.changed, false);
  assert.deepEqual(converted.convertedFields, []);
  assert.equal(converted.sourceGrammarVersion, 2);
  assert.equal(converted.targetGrammarVersion, 2);
  assert.equal(converted.grammarDisposition, "retained");
  assert.equal(converted.reversibility, "not_applicable");
  assert.deepEqual(converted.qualifications, []);
});

test("conversion preserves inventory order and three-point constraints", async () => {
  const prepared = prepare(
    await fixture("migration-point-v2.pert"),
    { targetUnit: "day" },
  );
  const converted = convertPreparedUnitMigrationRequest(prepared);

  assert.deepEqual(
    converted.convertedFields.map(({ fieldPath }) => fieldPath),
    prepared.durationInventory.map(({ fieldPath }) => fieldPath),
  );
  const estimate = converted.convertedFields
    .filter(({ fieldPath }) => fieldPath.includes(".estimate."))
    .map(({ converted: value }) => value.numerator * 1n / value.denominator);
  assert.deepEqual(estimate, [1n, 2n, 3n]);
  assert.ok(
    converted.convertedFields.every(
      ({ original, converted: value }) =>
        original.numerator >= 0n && value.numerator >= 0n,
    ),
  );
});

test("different velocity and Grammar 3 retention compose stable qualifications", async () => {
  const source = (await fixture("migration-point-v2.pert"))
    .replace("  version 2", "  version 3");
  const prepared = prepare(source, {
    targetUnit: "day",
    replacementVelocity: "4p/1d",
  });
  const converted = convertPreparedUnitMigrationRequest(prepared);

  assert.equal(converted.targetGrammarVersion, 3);
  assert.equal(converted.grammarDisposition, "retained");
  assert.equal(converted.reversibility, "values_exact_metadata_changed");
  assert.deepEqual(converted.qualifications, [
    "grammar_version_retained_on_inverse",
    "velocity_replaced",
  ]);
});

test("exact conversion is invertible over reduced Rational values", () => {
  const inventory = [
    {
      entityKind: "task",
      entityId: "T",
      fieldPath: "task.T.duration",
      sourceUnit: "point",
      sourceToken: "10/7p",
      sourceValue: { numerator: 10n, denominator: 7n },
      valueSpan: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 5, line: 1, column: 6 },
      },
    },
  ];
  const velocity = {
    points: { numerator: 3n, denominator: 2n },
    period: { numerator: 5n, denominator: 4n },
    periodUnit: "day",
    inputToken: "1.5p/1.25d",
  };
  const forward = convertPreparedUnitMigrationRequest({
    ok: true,
    sourceGrammarVersion: 3,
    sourceUnit: "point",
    targetUnit: "day",
    changed: true,
    effectiveVelocity: velocity,
    velocityDisposition: "retained",
    durationInventory: inventory,
  });
  const backward = convertPreparedUnitMigrationRequest({
    ok: true,
    sourceGrammarVersion: 3,
    sourceUnit: "day",
    targetUnit: "point",
    changed: true,
    effectiveVelocity: velocity,
    velocityDisposition: "retained",
    durationInventory: [
      {
        ...inventory[0],
        sourceUnit: "day",
        sourceToken: forward.convertedFields[0].canonicalToken,
        sourceValue: forward.convertedFields[0].converted,
      },
    ],
  });

  assert.deepEqual(
    backward.convertedFields[0].converted,
    exact(10, 7, "point"),
  );
});

test("malformed prepared inputs fail instead of inferring a conversion", () => {
  const base = {
    ok: true,
    sourceGrammarVersion: 2,
    sourceUnit: "day",
    targetUnit: "hour",
    changed: true,
    effectiveVelocity: {
      points: { numerator: 1n, denominator: 1n },
      period: { numerator: 1n, denominator: 1n },
      periodUnit: "day",
      inputToken: "1p/1d",
    },
    velocityDisposition: "retained",
    durationInventory: [],
  };
  assert.throws(
    () => convertPreparedUnitMigrationRequest({
      ...base,
      ok: false,
      sourceUnit: "day",
      targetUnit: "day",
      changed: false,
      effectiveVelocity: null,
      velocityDisposition: null,
      durationInventory: [],
    }),
    /requires a successful prepared request/,
  );
  assert.throws(
    () => convertPreparedUnitMigrationRequest(base),
    /time migration source must match/,
  );
  assert.throws(
    () => convertPreparedUnitMigrationRequest({
      ...base,
      targetUnit: "point",
      effectiveVelocity: {
        ...base.effectiveVelocity,
        points: { numerator: 0n, denominator: 1n },
      },
    }),
    /velocity points must be positive/,
  );
  assert.throws(
    () => convertPreparedUnitMigrationRequest({
      ...base,
      sourceUnit: "day",
      targetUnit: "day",
      changed: false,
      effectiveVelocity: null,
      velocityDisposition: null,
      durationInventory: null,
    }),
    /durationInventory must be an array/,
  );
});

test("conversion records are deterministic for the same prepared request", async () => {
  const prepared = prepare(
    await fixture("migration-point-v2.pert"),
    { targetUnit: "day" },
  );
  assert.deepEqual(
    convertPreparedUnitMigrationRequest(prepared),
    convertPreparedUnitMigrationRequest(prepared),
  );
});
