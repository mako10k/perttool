import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as rootApi from "../dist/index.js";
import * as nodeApi from "../dist/node/index.js";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(repository, "dist/cli.js");

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: repository,
    encoding: "utf8",
    ...options,
  });
}

test("Contract 9 activates one exact public registry and closed schema catalog", () => {
  assert.equal(rootApi.COMMAND_REGISTRY.length, 56);
  assert.equal(rootApi.getJsonSchemaCatalog().length, 23);
  assert.equal(rootApi.ADVANCE_RESULT_SCHEMA_VERSION, "Perttool.AdvanceResult.v3");
  assert.equal(typeof rootApi.planMilestoneAcceptanceMigration, "function");
  assert.equal(typeof rootApi.planCriterionSetReplacement, "function");
  assert.equal(typeof rootApi.planMilestoneAcceptanceAdvance, "function");
  assert.equal(Object.keys(rootApi).length, 129);
  assert.equal(Object.keys(nodeApi).length, 129);
});

test("registry validation preserves the exact three-token acceptance command paths", () => {
  const help = run(["help", "milestone", "acceptance", "replace", "--format", "json"]);
  assert.equal(help.status, 0, help.stderr);
  const result = JSON.parse(help.stdout);
  assert.equal(result.cli_contract_version, 9);
  assert.deepEqual(result.commands.map(({ path }) => path), [["milestone", "acceptance", "replace"]]);

  const legacyAlias = run(["milestone-acceptance", "show", "-", "--format", "json"], { input: "" });
  assert.equal(legacyAlias.status, 2);
});

test("older grammars remain readable but advance fails before Git history inspection", () => {
  const source = "docs/examples/advance-partial-before.pert";
  const checked = run(["document", "check", source, "--format", "json"]);
  assert.equal(checked.status, 0, checked.stderr);
  const checkResult = JSON.parse(checked.stdout);
  assert.equal(checkResult.schema_version, "Perttool.CheckResult.v6");
  assert.equal(checkResult.cli_contract_version, 9);
  assert.equal(checkResult.grammar_version, 1);
  assert.equal(checkResult.acceptance, null);
  assert.equal(checkResult.diagnostics.some(({ code }) => code === "PTMAC-102"), false);

  const advanced = run(["dag", "advance", source, "--format", "json"]);
  assert.equal(advanced.status, 1);
  const advanceResult = JSON.parse(advanced.stdout);
  assert.equal(advanceResult.schema_version, "Perttool.AdvanceResult.v3");
  assert.equal(advanceResult.diagnostics[0].code, "PTMAC-101");
  assert.equal(advanceResult.history_guard, null);
  assert.equal(advanceResult.acceptance_guard, null);
});

test("Grammar 7 check projects the advanced final acceptance without criterion guidance", async () => {
  const source = await readFile(path.join(repository, "plans/milestone-acceptance.pert"), "utf8");
  const checked = rootApi.checkDocument(source);
  assert.equal(checked.schemaVersion, "Perttool.CheckResult.v6");
  assert.equal(checked.grammarVersion, 7);
  assert.equal(checked.acceptance.milestones.length, 1);
  assert.equal(checked.acceptance.milestones.every(({ closure }) =>
    closure === "reached"
  ), true);
  assert.equal(checked.acceptance.milestones.every(({ acceptance }) =>
    acceptance === "accepted"
  ), true);
  assert.equal(checked.diagnostics.some(({ code }) => code === "PTMAC-102"), false);
});

test("public acceptance record closes the source and installed boundary only", async () => {
  const [acceptance, readme, schemaContract] = await Promise.all([
    readFile(path.join(repository, "docs/process/milestone-acceptance-public-contract-acceptance.md"), "utf8"),
    readFile(path.join(repository, "README.md"), "utf8"),
    readFile(path.join(repository, "docs/specs/json-schema.md"), "utf8"),
  ]);
  assert.match(acceptance, /Document status: Accepted 1\.0/);
  assert.match(acceptance, /53 exact command paths/);
  assert.match(acceptance, /23 active root schemas and 22 command-result identities/);
  assert.match(acceptance, /passed 1,020 tests/);
  assert.match(acceptance, /all 37 plans/);
  assert.match(acceptance, /705 files/);
  assert.match(acceptance, /does not authorize either successor, plan advance, release/);
  assert.match(readme, /Version `0\.9\.0` is the published Grammar 7 and CLI Contract 8/);
  assert.match(schemaContract, /Active CLI contract version: 8/);
});
