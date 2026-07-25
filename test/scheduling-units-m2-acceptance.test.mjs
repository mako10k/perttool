import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import { CONTRACT3_COMMAND_REGISTRY } from "../dist/command/discovery.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");
const targetFixture = path.join(
  root,
  "test",
  "fixtures",
  "temporal-units",
  "calendar-offset-v2.pert",
);

async function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function contiguousIds(prefix) {
  return Array.from(
    { length: 18 },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("SU-M2 acceptance traces every interface and example observation", async () => {
  const acceptance = await repositoryFile(
    "docs/process/scheduling-units-m2-acceptance.md",
  );

  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.match(acceptance, /There are no open SU-M2 acceptance findings\./);
  assert.match(
    acceptance,
    /No Git push, GitHub release, npm publication, or dist-tag change is authorized/,
  );

  const tuiIds = [...acceptance.matchAll(/^\| `(TUI-\d{3})` \|/gm)].map(
    (match) => match[1],
  );
  const tueIds = [...acceptance.matchAll(/^\| `(TUE-\d{3})` \|/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(tuiIds, contiguousIds("TUI"));
  assert.deepEqual(tueIds, contiguousIds("TUE"));

  for (const evidence of [
    "test/temporal-source-parser.test.mjs",
    "test/temporal-semantic-validator.test.mjs",
    "test/temporal-formatter.test.mjs",
    "test/temporal-mutation.test.mjs",
    "test/temporal-declared-input.test.mjs",
    "test/temporal-unit-examples.test.mjs",
    "scripts/check-package.sh",
  ]) {
    assert.ok(acceptance.includes(evidence), evidence);
  }
});

test("the public package boundary omits every SU-M2 target capability", async () => {
  for (const targetName of [
    "TARGET_GRAMMAR_2_CAPABILITY",
    "parseTargetDocument",
    "validateTargetDocument",
    "formatTargetDocument",
    "planTargetMutation",
    "planTargetBatchMutation",
    "checkTargetDocument",
    "getTargetProjectMetadata",
    "projectDeclaredCalendarValue",
  ]) {
    assert.equal(targetName in publicApi, false, targetName);
  }

  const manifest = JSON.parse(await repositoryFile("package.json"));
  assert.deepEqual(Object.keys(manifest.exports), ["."]);
  assert.deepEqual(Object.keys(manifest.exports["."]), ["types", "import"]);
});

test("the active registry exposes no Contract 4 route, option, or schema", () => {
  assert.equal(CONTRACT3_COMMAND_REGISTRY.length, 27);
  assert.ok(
    CONTRACT3_COMMAND_REGISTRY.every(
      ({ contractVersion }) => contractVersion === 3,
    ),
  );

  const paths = CONTRACT3_COMMAND_REGISTRY.map(({ path: commandPath }) =>
    commandPath.join(" ")
  );
  const options = CONTRACT3_COMMAND_REGISTRY.flatMap(({ options: commandOptions }) =>
    commandOptions.map(({ name }) => name)
  );
  const schemas = CONTRACT3_COMMAND_REGISTRY.flatMap(
    ({ resultSchemas }) => resultSchemas,
  );

  assert.equal(paths.includes("project migrate-unit"), false);
  for (const option of [
    "deadline",
    "not-before",
    "initial-milestone-deadline",
  ]) {
    assert.equal(options.includes(option), false, option);
  }
  for (const schema of [
    "Perttool.CheckResult.v2",
    "Perttool.ProjectResult.v2",
    "Perttool.AnalysisResult.v3",
    "Perttool.NextResult.v4",
    "Perttool.UnitMigrationResult.v1",
    "Perttool.UnitMigrationResult.v2",
  ]) {
    assert.equal(schemas.includes(schema), false, schema);
  }
});

test("active Contract 3 routes reject Grammar 2 under their existing identities", () => {
  const cases = [
    [["document", "check"], "Perttool.CheckResult.v1"],
    [["document", "format"], "Perttool.FormatResult.v1"],
    [["project", "show"], "Perttool.ProjectResult.v1"],
    [["dag", "analyze"], "Perttool.AnalysisResult.v2"],
    [["dag", "next"], "Perttool.NextResult.v3"],
  ];

  for (const [route, schemaVersion] of cases) {
    const result = runCli([...route, targetFixture, "--format=json"]);
    assert.equal(result.status, 1, `${route.join(" ")}: ${result.stderr}`);
    assert.equal(result.stderr, "");
    const json = JSON.parse(result.stdout);
    assert.equal(json.schema_version, schemaVersion);
    assert.equal(json.cli_contract_version, 3);
    assert.equal(json.ok, false);
    assert.equal(json.grammar_version ?? null, null);
    assert.ok(json.diagnostics.length > 0);
    assert.ok(
      json.diagnostics.every(({ code }) => code === "PTDSL-005"),
      route.join(" "),
    );
  }
});

test("the SU-M3 handoff keeps public activation and migration out of scope", async () => {
  const acceptance = await repositoryFile(
    "docs/process/scheduling-units-m2-acceptance.md",
  );
  assert.match(
    acceptance,
    /Create and estimate a\s+new SU-M3 detail plan from the accepted target interfaces/,
  );
  assert.match(acceptance, /target AnalysisResult v3 projection/);
  assert.match(
    acceptance,
    /target NextResult v4 that embeds the unchanged complete v3\s+recommendation graph/,
  );
  assert.match(
    acceptance,
    /SU-M3 must not expose target modules from the package root, add Contract 4\s+descriptors\/help, make NextResult v4 normal authority, implement unit\s+migration, or publish a package\./,
  );
});

test("the accepted rational Duration rollup selects the SU-M4 work package", async () => {
  const source = await repositoryFile("plans/scheduling-units.pert");
  const result = publicApi.selectNextTasks(source);
  assert.equal(result.ok, true);
  assert.ok(result.recommendation);
  assert.deepEqual(result.groups.ready, [
    "SU_M3_DEADLINE_CAPABILITY_WORK_PACKAGE",
    "SU_M4_UNIT_MIGRATION_WORK_PACKAGE",
  ]);
  assert.deepEqual(result.groups.runnableNow, [
    "SU_M3_DEADLINE_CAPABILITY_WORK_PACKAGE",
  ]);
  assert.deepEqual(result.recommendation.recommendedTaskIds, [
    "SU_M4_UNIT_MIGRATION_WORK_PACKAGE",
  ]);
  const jointFact = result.recommendation.facts.find(
    ({ id }) =>
      id === result.recommendation.resultDecision.jointFeasibilityFactId,
  );
  assert.ok(jointFact);
  assert.deepEqual(jointFact.value, { type: "boolean", value: true });
});
