import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  planTargetUnitMigrationResult,
} from "../dist/application/target-unit-migration-result.js";
import { CONTRACT4_COMMAND_REGISTRY } from "../dist/command/discovery.js";
import {
  convertPreparedUnitMigrationRequest,
} from "../dist/migration/conversion.js";
import {
  UNIT_MIGRATION_DIAGNOSTIC_CODES,
  UNIT_MIGRATION_IDENTITY,
  unitMigrationCause,
} from "../dist/migration/request.js";
import { rational } from "../dist/model/rational.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");
const fixtureDirectory = path.join(testDirectory, "fixtures", "temporal-units");

async function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function fixture(name) {
  return readFile(path.join(fixtureDirectory, name), "utf8");
}

function contiguousIds(prefix) {
  return Array.from(
    { length: 20 },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function plan(source, request) {
  return planTargetUnitMigrationResult(
    source,
    request,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
}

function exactProjection(fields, side) {
  return fields.map((field) => ({
    fieldPath: field.fieldPath,
    numerator: field[side].numerator,
    denominator: field[side].denominator,
    unit: field[side].unit,
  }));
}

test("SU-M4 acceptance traces all interface and example observations", async () => {
  const [acceptance, baselineText] = await Promise.all([
    repositoryFile("docs/process/scheduling-units-m4-acceptance.md"),
    repositoryFile("test/fixtures/temporal-units/cases.json"),
  ]);
  const baseline = JSON.parse(baselineText);

  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.match(acceptance, /There are no open SU-M4 acceptance findings\./);
  assert.match(
    acceptance,
    /No Git push, GitHub release, npm publication, dist-tag change, or Contract 4\s+activation is authorized/,
  );

  const tuiIds = [...acceptance.matchAll(/^\| `(TUI-\d{3})` \|/gm)].map(
    (match) => match[1],
  );
  const tueIds = [...acceptance.matchAll(/^\| `(TUE-\d{3})` \|/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(tuiIds, contiguousIds("TUI"));
  assert.deepEqual(tueIds, contiguousIds("TUE"));
  assert.deepEqual(
    baseline.cases.map(({ case_id: caseId }) => caseId),
    contiguousIds("TUE"),
  );

  for (const evidence of [
    "test/unit-migration-request.test.mjs",
    "test/unit-migration-conversion.test.mjs",
    "test/unit-migration-candidate.test.mjs",
    "test/unit-migration-result.test.mjs",
    "test/rational-duration-source.test.mjs",
    "test/temporal-unit-examples.test.mjs",
    "test/write-safety.test.mjs",
    "scripts/check-package.sh",
  ]) {
    assert.ok(acceptance.includes(evidence), evidence);
  }
});

test("TUE-012 through TUE-017 compose through the complete internal result", async () => {
  const pointSource = await fixture("migration-point-v2.pert");
  const forward = plan(pointSource, { targetUnit: "day" });
  assert.equal(forward.ok, true);
  assert.equal(forward.schemaVersion, "Perttool.UnitMigrationResult.v2");
  assert.deepEqual(forward.unitMigration, {
    id: "perttool.unit-migration",
    version: 2,
  });
  assert.equal(forward.grammarDisposition, "retained");
  assert.equal(forward.velocityDisposition, "retained");
  assert.equal(forward.reversibility, "exact");
  assert.deepEqual(
    forward.convertedFields.map(({ fieldPath, canonicalToken }) => [
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

  const repeated = plan(forward.updatedText, { targetUnit: "day" });
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.updatedText, forward.updatedText);
  assert.equal(repeated.updatedDigest, forward.updatedDigest);
  assert.deepEqual(repeated.edits, []);
  assert.equal(repeated.diff, "");

  const inverse = plan(forward.updatedText, { targetUnit: "point" });
  assert.equal(inverse.ok, true);
  assert.equal(inverse.reversibility, "exact");
  assert.deepEqual(
    exactProjection(inverse.convertedFields, "converted"),
    exactProjection(forward.convertedFields, "original"),
  );
  for (const token of [
    "2026-07-25T09:00:00+09:00",
    "2026-07-27T09:00:00+09:00",
    "2026-07-30T09:00:00+09:00",
  ]) {
    assert.equal(
      inverse.updatedText.split(token).length,
      pointSource.split(token).length,
      token,
    );
  }
  assert.ok(pointSource.includes("  duration 4.00p\n"));
  assert.ok(inverse.updatedText.includes("  duration 4p\n"));
  assert.notEqual(inverse.updatedText, pointSource);

  const inserted = plan(
    await fixture("migration-hour-v2.pert"),
    { targetUnit: "point", replacementVelocity: "8p/4h" },
  );
  assert.equal(inserted.ok, true);
  assert.equal(inserted.velocityDisposition, "inserted");
  assert.equal(inserted.reversibility, "values_exact_metadata_changed");
  assert.deepEqual(inserted.qualifications, ["velocity_inserted"]);
  assert.ok(inserted.updatedText.includes("  velocity 8p/4h\n"));

  const fraction = plan(
    await fixture("migration-nonrepresentable-v2.pert"),
    { targetUnit: "day" },
  );
  assert.equal(fraction.ok, true);
  assert.equal(fraction.targetGrammarVersion, 3);
  assert.equal(fraction.grammarDisposition, "upgraded_for_exact_fraction");
  assert.deepEqual(fraction.qualifications, [
    "grammar_upgraded_for_exact_fraction",
  ]);
  assert.ok(
    fraction.convertedFields.some(
      ({ canonicalToken }) => canonicalToken === "1/3d",
    ),
  );
  assert.equal(
    fraction.diagnostics.some(({ code }) => code === "PTMIG-408"),
    false,
  );
});

test("exact conversion round-trips a Rational and velocity property matrix", () => {
  const values = [
    rational(0n, 1n),
    rational(1n, 2n),
    rational(1n, 3n),
    rational(2n, 5n),
    rational(10n, 7n),
    rational(17n, 11n),
  ];
  const velocities = [
    {
      points: rational(1n, 1n),
      period: rational(1n, 1n),
      periodUnit: "day",
      inputToken: "1p/1d",
    },
    {
      points: rational(3n, 2n),
      period: rational(5n, 4n),
      periodUnit: "day",
      inputToken: "1.5p/1.25d",
    },
    {
      points: rational(7n, 5n),
      period: rational(9n, 10n),
      periodUnit: "day",
      inputToken: "1.4p/0.9d",
    },
  ];

  for (const sourceValue of values) {
    for (const velocity of velocities) {
      const inventory = [{
        entityKind: "task",
        entityId: "PROPERTY",
        fieldPath: "task.PROPERTY.duration",
        sourceUnit: "point",
        sourceToken: "propertyp",
        sourceValue,
        valueSpan: {
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 1, line: 1, column: 2 },
        },
      }];
      const forward = convertPreparedUnitMigrationRequest({
        ok: true,
        unitMigration: UNIT_MIGRATION_IDENTITY,
        sourceGrammarVersion: 3,
        sourceUnit: "point",
        targetUnit: "day",
        changed: true,
        effectiveVelocity: velocity,
        velocityDisposition: "retained",
        durationInventory: inventory,
        preservedTemporalFields: [],
        unavailableCauses: [],
      });
      const backward = convertPreparedUnitMigrationRequest({
        ok: true,
        unitMigration: UNIT_MIGRATION_IDENTITY,
        sourceGrammarVersion: 3,
        sourceUnit: "day",
        targetUnit: "point",
        changed: true,
        effectiveVelocity: velocity,
        velocityDisposition: "retained",
        durationInventory: [{
          ...inventory[0],
          sourceUnit: "day",
          sourceToken: forward.convertedFields[0].canonicalToken,
          sourceValue: forward.convertedFields[0].converted,
        }],
        preservedTemporalFields: [],
        unavailableCauses: [],
      });
      assert.deepEqual(
        backward.convertedFields[0].converted,
        { ...sourceValue, unit: "point" },
      );
    }
  }
});

test("stable failure causes are complete and failures expose no candidate", async () => {
  assert.deepEqual(UNIT_MIGRATION_DIAGNOSTIC_CODES, {
    invalid_original: "PTMIG-401",
    invalid_replacement_velocity: "PTMIG-402",
    missing_velocity: "PTMIG-403",
    unsupported_direction: "PTMIG-404",
    velocity_period_mismatch: "PTMIG-405",
    same_unit_velocity_change: "PTMIG-406",
    unsupported_duration_field: "PTMIG-407",
    invalid_candidate: "PTMIG-409",
  });
  assert.equal(Object.values(UNIT_MIGRATION_DIAGNOSTIC_CODES).includes("PTMIG-408"), false);
  for (const [cause, diagnosticCode] of Object.entries(
    UNIT_MIGRATION_DIAGNOSTIC_CODES,
  )) {
    assert.deepEqual(unitMigrationCause(cause), {
      cause,
      diagnosticCode,
      fieldPaths: [],
    });
  }

  const point = await fixture("migration-point-v2.pert");
  const hour = await fixture("migration-hour-v2.pert");
  const failureCases = [
    {
      source: point.replace("  duration 4.00p", "  duration invalid"),
      request: { targetUnit: "day" },
    },
    {
      source: point,
      request: {
        targetUnit: "day",
        replacementVelocity: "0p/1d",
      },
    },
    { source: hour, request: { targetUnit: "point" } },
    { source: hour, request: { targetUnit: "day" } },
    { source: point, request: { targetUnit: "hour" } },
    {
      source: point,
      request: {
        targetUnit: "point",
        replacementVelocity: "20p/10d",
      },
    },
  ];
  const failures = failureCases.map(({ source, request }) =>
    plan(source, request)
  );
  assert.deepEqual(
    failures.map(({ unavailableCauses }) => unavailableCauses[0].cause),
    [
      "invalid_original",
      "invalid_replacement_velocity",
      "missing_velocity",
      "unsupported_direction",
      "velocity_period_mismatch",
      "same_unit_velocity_change",
    ],
  );
  for (const [index, failure] of failures.entries()) {
    assert.equal(failure.ok, false);
    assert.equal(failure.changed, false);
    assert.equal(failure.updatedText, null);
    assert.equal(failure.updatedDigest, null);
    assert.equal(failure.diff, null);
    assert.deepEqual(failure.edits, []);
    assert.deepEqual(failure.convertedFields, []);
    assert.deepEqual(
      failure,
      plan(failureCases[index].source, failureCases[index].request),
    );
  }
});

test("the active package root hides target helpers while Contract 4 exposes migration", async () => {
  for (const targetName of [
    "TARGET_GRAMMAR_3_CAPABILITY",
    "prepareTargetUnitMigrationRequest",
    "convertPreparedUnitMigrationRequest",
    "planTargetUnitMigrationCandidate",
    "planTargetUnitMigrationResult",
    "withTargetUnitMigrationWrite",
    "replaceTargetGrammar3DocumentFile",
  ]) {
    assert.equal(targetName in publicApi, false, targetName);
  }

  const manifest = JSON.parse(await repositoryFile("package.json"));
  assert.deepEqual(Object.keys(manifest.exports), ["."]);
  assert.equal("planUnitMigration" in publicApi, true);
  assert.equal(CONTRACT4_COMMAND_REGISTRY.length, 28);
  assert.ok(
    CONTRACT4_COMMAND_REGISTRY.every(
      ({ contractVersion }) => contractVersion === 4,
    ),
  );

  const help = runCli(["help", "--format=json"]);
  const guide = runCli(["guide", "--format=json"]);
  const unitGuide = runCli([
    "guide",
    "editing",
    "unit-migration",
    "--format=json",
  ]);
  assert.equal(help.status, 0, help.stderr);
  assert.equal(guide.status, 0, guide.stderr);
  assert.equal(unitGuide.status, 0, unitGuide.stderr);
  const helpJson = JSON.parse(help.stdout);
  const guideJson = JSON.parse(guide.stdout);
  assert.equal(helpJson.schema_version, "Perttool.CommandHelpResult.v1");
  assert.equal(guideJson.schema_version, "Perttool.GuideResult.v1");
  assert.equal(helpJson.cli_contract_version, 4);
  assert.equal(guideJson.cli_contract_version, 4);
  assert.equal(help.stdout.includes("project migrate-unit"), true);
  assert.equal(help.stdout.includes("Perttool.UnitMigrationResult.v2"), true);
  assert.equal(
    JSON.parse(unitGuide.stdout).topic_id,
    "editing.unit-migration",
  );

  const migrated = runCli([
    "project",
    "migrate-unit",
    "test/fixtures/temporal-units/migration-point-v2.pert",
    "--to-unit",
    "day",
    "--format=json",
  ]);
  assert.equal(migrated.status, 0);
  assert.equal(migrated.stderr, "");
  const result = JSON.parse(migrated.stdout);
  assert.equal(result.schema_version, "Perttool.UnitMigrationResult.v2");
  assert.equal(result.cli_contract_version, 4);
  assert.equal(result.operation, "project.migrate-unit");
  assert.equal(result.ok, true);
});

test("the SU-M5 handoff keeps activation and publication separately gated", async () => {
  const acceptance = await repositoryFile(
    "docs/process/scheduling-units-m4-acceptance.md",
  );
  assert.match(
    acceptance,
    /SU-M5 may consume the accepted internal migration planner and Result v2 only\s+as part of the atomic Contract 4 cutover/,
  );
  assert.match(
    acceptance,
    /complete typed\s+descriptor, dispatch, request adapter, JSON and text projections, help,\s+`editing\.unit-migration` Guide topic, README and installed-package workflows/,
  );
  assert.match(
    acceptance,
    /It must not silently activate\s+only the migration command or publish a package before the integrated\s+acceptance and separate release authorization/,
  );
});
