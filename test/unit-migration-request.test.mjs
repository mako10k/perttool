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
  normalizeUnitMigrationRequest,
  prepareUnitMigrationRequest,
  UNIT_MIGRATION_DIAGNOSTIC_CODES,
  UNIT_MIGRATION_IDENTITY,
} from "../dist/migration/request.js";
import {
  CONTRACT3_COMMAND_REGISTRY,
} from "../dist/command/discovery.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, "fixtures", "temporal-units");

async function fixture(name) {
  return readFile(path.join(fixtureDirectory, name), "utf8");
}

function prepare(source, request) {
  return prepareTargetUnitMigrationRequest(
    source,
    request,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
}

function causeProjection(result) {
  return result.unavailableCauses.map(
    ({ cause, diagnosticCode }) => [cause, diagnosticCode],
  );
}

test("unit-migration request preparation is internal and capability-checked", async () => {
  const source = await fixture("migration-point-v2.pert");
  assert.equal("prepareTargetUnitMigrationRequest" in publicApi, false);
  assert.equal("UNIT_MIGRATION_IDENTITY" in publicApi, false);
  assert.deepEqual(UNIT_MIGRATION_IDENTITY, {
    id: "perttool.unit-migration",
    version: 2,
  });
  assert.equal(CONTRACT3_COMMAND_REGISTRY.length, 27);
  assert.equal(
    JSON.stringify(CONTRACT3_COMMAND_REGISTRY).includes("project migrate-unit"),
    false,
  );
  assert.equal("PTMIG-408" in UNIT_MIGRATION_DIAGNOSTIC_CODES, false);
  assert.throws(
    () => prepareTargetUnitMigrationRequest(
      source,
      { targetUnit: "day" },
      {
        id: "perttool.target-grammar-3-source",
        version: 1,
        grammarVersion: 3,
      },
    ),
    /target Grammar 3 source capability is required/,
  );
  assert.throws(
    () => prepareTargetUnitMigrationRequest(
      source,
      { targetUnit: "week" },
      TARGET_GRAMMAR_3_CAPABILITY,
    ),
    /targetUnit must be day, hour, or point/,
  );
  assert.throws(
    () => prepareTargetUnitMigrationRequest(
      source,
      { targetUnit: "day", hiddenInput: "forecast" },
      TARGET_GRAMMAR_3_CAPABILITY,
    ),
    /field hiddenInput is unsupported/,
  );
});

test("TUE-012 inventories Point source fields in declaration and field order", async () => {
  const source = await fixture("migration-point-v2.pert");
  const result = prepare(source, { targetUnit: "day" });

  assert.equal(result.ok, true);
  assert.equal(result.sourceGrammarVersion, 2);
  assert.equal(result.sourceUnit, "point");
  assert.equal(result.targetUnit, "day");
  assert.equal(result.changed, true);
  assert.equal(result.velocityDisposition, "retained");
  assert.deepEqual(result.effectiveVelocity, {
    points: { numerator: 20n, denominator: 1n },
    period: { numerator: 10n, denominator: 1n },
    periodUnit: "day",
    inputToken: "20p/10d",
  });
  assert.deepEqual(
    result.durationInventory.map(({ fieldPath }) => fieldPath),
    [
      "project.critical_epsilon",
      "project.target_duration",
      "task.FIXED.duration",
      "task.ESTIMATED.estimate.optimistic",
      "task.ESTIMATED.estimate.most_likely",
      "task.ESTIMATED.estimate.pessimistic",
    ],
  );
  assert.deepEqual(
    result.durationInventory.map(
      ({ fieldPath, sourceToken, sourceValue, sourceUnit }) => ({
        fieldPath,
        sourceToken,
        sourceValue,
        sourceUnit,
      }),
    ),
    [
      {
        fieldPath: "project.critical_epsilon",
        sourceToken: "0.5p",
        sourceValue: { numerator: 1n, denominator: 2n },
        sourceUnit: "point",
      },
      {
        fieldPath: "project.target_duration",
        sourceToken: "12p",
        sourceValue: { numerator: 12n, denominator: 1n },
        sourceUnit: "point",
      },
      {
        fieldPath: "task.FIXED.duration",
        sourceToken: "4.00p",
        sourceValue: { numerator: 4n, denominator: 1n },
        sourceUnit: "point",
      },
      {
        fieldPath: "task.ESTIMATED.estimate.optimistic",
        sourceToken: "2p",
        sourceValue: { numerator: 2n, denominator: 1n },
        sourceUnit: "point",
      },
      {
        fieldPath: "task.ESTIMATED.estimate.most_likely",
        sourceToken: "4p",
        sourceValue: { numerator: 4n, denominator: 1n },
        sourceUnit: "point",
      },
      {
        fieldPath: "task.ESTIMATED.estimate.pessimistic",
        sourceToken: "6p",
        sourceValue: { numerator: 6n, denominator: 1n },
        sourceUnit: "point",
      },
    ],
  );
  assert.deepEqual(
    result.preservedTemporalFields.map(
      ({ fieldPath, sourceToken }) => [fieldPath, sourceToken],
    ),
    [
      ["project.as_of", "2026-07-25T09:00:00+09:00"],
      ["milestone.MID.deadline", "2026-07-27T09:00:00+09:00"],
      ["milestone.FINISH.deadline", "2026-07-30T09:00:00+09:00"],
      ["task.FIXED.not_before", "2026-07-25T09:00:00+09:00"],
      ["task.FIXED.deadline", "2026-07-27T09:00:00+09:00"],
      ["task.ESTIMATED.deadline", "2026-07-30T09:00:00+09:00"],
    ],
  );
  assert.equal(result.validatedDocument?.grammarVersion, 2);
  assert.deepEqual(result.unavailableCauses, []);
});

test("TUE-013 inserts a valid exact replacement for a time source", async () => {
  const source = await fixture("migration-hour-v2.pert");
  const result = prepare(source, {
    targetUnit: "point",
    replacementVelocity: "8p/4h",
  });

  assert.equal(result.ok, true);
  assert.equal(result.sourceUnit, "hour");
  assert.equal(result.velocityDisposition, "inserted");
  assert.deepEqual(result.effectiveVelocity, {
    points: { numerator: 8n, denominator: 1n },
    period: { numerator: 4n, denominator: 1n },
    periodUnit: "hour",
    inputToken: "8p/4h",
  });
  assert.deepEqual(
    result.durationInventory.map(({ fieldPath, sourceToken }) => [
      fieldPath,
      sourceToken,
    ]),
    [
      ["project.critical_epsilon", "0.5h"],
      ["project.target_duration", "4h"],
      ["task.FIXED.duration", "2.5h"],
      ["task.ESTIMATED.estimate.optimistic", "1h"],
      ["task.ESTIMATED.estimate.most_likely", "2h"],
      ["task.ESTIMATED.estimate.pessimistic", "3h"],
    ],
  );
});

test("equal velocity rates retain source bytes while different rates replace", async () => {
  const source = await fixture("migration-point-v2.pert");
  const equal = prepare(source, {
    targetUnit: "day",
    replacementVelocity: "2p/1d",
  });
  assert.equal(equal.ok, true);
  assert.equal(equal.velocityDisposition, "retained");
  assert.equal(equal.effectiveVelocity?.inputToken, "20p/10d");

  const replaced = prepare(source, {
    targetUnit: "day",
    replacementVelocity: "4p/1d",
  });
  assert.equal(replaced.ok, true);
  assert.equal(replaced.velocityDisposition, "replaced");
  assert.equal(replaced.effectiveVelocity?.inputToken, "4p/1d");

  const changedPeriod = prepare(source, {
    targetUnit: "hour",
    replacementVelocity: "2p/1h",
  });
  assert.equal(changedPeriod.ok, true);
  assert.equal(changedPeriod.velocityDisposition, "replaced");
  assert.equal(changedPeriod.effectiveVelocity?.periodUnit, "hour");
});

test("Grammar 1 and Grammar 3 share the complete exact inventory", async () => {
  const point = await fixture("migration-point-v2.pert");
  const grammar1 = point
    .replace("  version 2\n", "")
    .replace("  as_of 2026-07-25T09:00:00+09:00\n", "")
    .replace(/  (?:not_before|deadline) [^\n]+\n/g, "");
  const grammar1Result = prepare(grammar1, { targetUnit: "day" });
  assert.equal(grammar1Result.ok, true);
  assert.equal(grammar1Result.sourceGrammarVersion, 1);
  assert.equal(grammar1Result.durationInventory.length, 6);
  assert.deepEqual(grammar1Result.preservedTemporalFields, []);

  const nonrepresentable = await fixture(
    "migration-nonrepresentable-v2.pert",
  );
  const grammar3 = nonrepresentable
    .replace("  version 2", "  version 3")
    .replace("  critical_epsilon 1p", "  critical_epsilon 1/3p")
    .replace("  target_duration 2p", "  target_duration 2/3p")
    .replace("  duration 1p", "  duration 1/3p")
    .replace("    optimistic 1p", "    optimistic 1/3p")
    .replace("    most_likely 2p", "    most_likely 2/3p");
  const grammar3Result = prepare(grammar3, { targetUnit: "day" });
  assert.equal(grammar3Result.ok, true);
  assert.equal(grammar3Result.sourceGrammarVersion, 3);
  assert.deepEqual(
    grammar3Result.durationInventory.map(({ sourceValue }) => sourceValue),
    [
      { numerator: 1n, denominator: 3n },
      { numerator: 2n, denominator: 3n },
      { numerator: 1n, denominator: 3n },
      { numerator: 1n, denominator: 3n },
      { numerator: 2n, denominator: 3n },
      { numerator: 3n, denominator: 1n },
    ],
  );
});

test("task status does not remove deterministic or three-point fields", async () => {
  const source = (await fixture("migration-point-v2.pert"))
    .replace("  status planned", "  status done")
    .replace(
      "  status planned",
      "  status blocked\n  blocked_reason \"external hold\"",
    );
  const result = prepare(source, { targetUnit: "day" });
  assert.equal(
    result.ok,
    true,
    result.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.deepEqual(
    result.durationInventory.map(({ fieldPath }) => fieldPath),
    [
      "project.critical_epsilon",
      "project.target_duration",
      "task.FIXED.duration",
      "task.ESTIMATED.estimate.optimistic",
      "task.ESTIMATED.estimate.most_likely",
      "task.ESTIMATED.estimate.pessimistic",
    ],
  );
});

test("TUE-014 rejects direction, velocity, and same-unit failures distinctly", async () => {
  const point = await fixture("migration-point-v2.pert");
  const hour = await fixture("migration-hour-v2.pert");
  const day = hour
    .replace("duration_unit hour", "duration_unit day")
    .replace(/([0-9])h(?=\s|$)/gm, "$1d");

  assert.deepEqual(
    causeProjection(prepare(point, { targetUnit: "hour" })),
    [["velocity_period_mismatch", "PTMIG-405"]],
  );
  assert.deepEqual(
    causeProjection(prepare(day, { targetUnit: "hour" })),
    [["unsupported_direction", "PTMIG-404"]],
  );
  assert.deepEqual(
    causeProjection(prepare(hour, {
      targetUnit: "point",
      replacementVelocity: "10p/5d",
    })),
    [["velocity_period_mismatch", "PTMIG-405"]],
  );
  assert.deepEqual(
    causeProjection(prepare(hour, {
      targetUnit: "hour",
      replacementVelocity: "8p/4h",
    })),
    [["same_unit_velocity_change", "PTMIG-406"]],
  );
  assert.deepEqual(
    causeProjection(prepare(hour, { targetUnit: "point" })),
    [["missing_velocity", "PTMIG-403"]],
  );
});

test("invalid replacement velocity is fail-closed before semantic selection", async () => {
  const source = await fixture("migration-point-v2.pert");
  for (const replacementVelocity of [
    "",
    "0p/1d",
    "1p/0d",
    "1/3p/1d",
    "1p/1w",
    " 1p/1d",
  ]) {
    const result = prepare(source, {
      targetUnit: "day",
      replacementVelocity,
    });
    assert.equal(result.ok, false, replacementVelocity);
    assert.deepEqual(
      causeProjection(result),
      [["invalid_replacement_velocity", "PTMIG-402"]],
    );
    assert.equal(result.validatedDocument, null);
    assert.deepEqual(result.durationInventory, []);
  }
});

test("same-unit no-op succeeds without velocity or rescaling", async () => {
  const source = await fixture("migration-hour-v2.pert");
  const result = prepare(source, { targetUnit: "hour" });
  assert.equal(result.ok, true);
  assert.equal(result.changed, false);
  assert.equal(result.effectiveVelocity, null);
  assert.equal(result.velocityDisposition, null);
  assert.equal(result.durationInventory.length, 6);
  assert.deepEqual(result.unavailableCauses, []);
});

test("invalid original source returns ordinary diagnostics and PTMIG-401", async () => {
  const source = (await fixture("migration-nonrepresentable-v2.pert"))
    .replace("  critical_epsilon 1p", "  critical_epsilon 1/3p");
  const result = prepare(source, { targetUnit: "day" });
  assert.equal(result.ok, false);
  assert.deepEqual(
    causeProjection(result),
    [["invalid_original", "PTMIG-401"]],
  );
  assert.ok(result.diagnostics.some(({ code }) => code === "PTDSL-007"));
  assert.equal(result.sourceGrammarVersion, null);
  assert.equal(result.sourceUnit, null);
  assert.equal(result.validatedDocument, null);
  assert.deepEqual(result.durationInventory, []);
});

test("a future unlisted base-unit field fails closed as PTMIG-407", async () => {
  const source = await fixture("migration-point-v2.pert");
  const checked = prepare(source, { targetUnit: "day" });
  assert.equal(checked.ok, true);
  const validated = checked.validatedDocument;
  assert.ok(validated);
  const project = validated.document.declarations.find(
    ({ kind }) => kind === "project",
  );
  const epsilon = project.fields.find(
    ({ name }) => name === "critical_epsilon",
  );
  assert.ok(epsilon);
  const futureDocument = {
    ...validated.document,
    declarations: validated.document.declarations.map((declaration) =>
      declaration === project
        ? {
            ...declaration,
            fields: [
              ...declaration.fields,
              {
                ...epsilon,
                name: "future_duration",
                rawValue: "1p",
                value: {
                  text: "1p",
                  digits: 1n,
                  scale: 0,
                  suffix: "p",
                },
              },
            ],
          }
        : declaration
    ),
  };
  const result = prepareUnitMigrationRequest(
    {
      grammarVersion: 3,
      document: futureDocument,
    },
    normalizeUnitMigrationRequest({ targetUnit: "day" }),
  );
  assert.equal(result.ok, false);
  assert.deepEqual(causeProjection(result), [
    ["unsupported_duration_field", "PTMIG-407"],
  ]);
  assert.deepEqual(result.unavailableCauses[0].fieldPaths, [
    "project.MIGRATION_POINT.future_duration",
  ]);
  assert.deepEqual(result.durationInventory, []);
});

test("request preparation is deterministic for the same source and request", async () => {
  const source = await fixture("migration-point-v2.pert");
  const request = {
    targetUnit: "day",
    replacementVelocity: "2p/1d",
  };
  assert.deepEqual(prepare(source, request), prepare(source, request));
});
