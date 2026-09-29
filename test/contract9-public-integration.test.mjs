import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist/cli.js");
const run = (...args) => JSON.parse(execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" }));

test("Contract 11 is atomic across root, CLI discovery, Guide, and schema inventory", async () => {
  assert.equal(Object.keys(publicApi).length, 155);
  assert.equal(publicApi.COMMAND_REGISTRY.length, 75);
  assert.equal(publicApi.getCommandDiscovery({ resource: null, action: null }).cliContractVersion, 11);
  assert.equal(publicApi.getGuide(null, "index").cliContractVersion, 11);
  const catalog = publicApi.getJsonSchemaCatalog();
  assert.equal(catalog.length, 31);
  for (const identity of ["Perttool.ProjectResult.v5", "Perttool.CheckResult.v6", "Perttool.AnalysisResult.v7",
    "Perttool.NextResult.v9", "Perttool.MutationResult.v6", "Perttool.PlanAssuranceResult.v2",
    "Perttool.PlanningPoolResult.v1", "Perttool.PlanningReshapePreflightResult.v1",
    "Perttool.PlanningMutationResult.v1", "Perttool.AdvanceResult.v4",
    "Perttool.UnitMigrationResult.v5"]) assert.ok(catalog.some(({ schemaId }) => schemaId === identity), identity);
  assert.deepEqual(run("help", "calendar", "--format", "json").commands.map(({ operation }) => operation),
    ["calendar.add", "calendar.set", "calendar.remove"]);
  assert.equal(run("schema", "--format", "json").cli_contract_version, 11);
  const migration = run("project", "migrate-unit", "plans/temporal-public-contract.pert",
    "--to-unit", "point", "--format", "json");
  assert.equal(migration.schema_version, "Perttool.UnitMigrationResult.v5");
  assert.equal(migration.cli_contract_version, 11);
  assert.deepEqual(migration.unit_migration, { id: "perttool.unit-migration", version: 5 });
  assert.match(await readFile(path.join(root, "adapters/vscode/syntaxes/pert.tmLanguage.json"), "utf8"), /calendar/u);
});

test("Contract 9 remains the explicit pre-switch implementation basis", async () => {
  const source = await readFile(path.join(root, "src/application/contract10-runtime.ts"), "utf8");
  assert.match(source, /contract9-runtime/u);
  assert.doesNotMatch(await readFile(path.join(root, "src/index.ts"), "utf8"),
    /ASSURANCE_COMMAND_REGISTRY as COMMAND_REGISTRY/u);
});
