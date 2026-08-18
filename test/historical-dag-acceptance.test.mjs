import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import * as perttool from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function assertDependencyOrder(cases) {
  const accepted = new Set();
  for (const acceptanceCase of cases) {
    assert.equal(
      (acceptanceCase.depends_on ?? []).every((id) => accepted.has(id)),
      true,
      acceptanceCase.id,
    );
    accepted.add(acceptanceCase.id);
  }
  return [...accepted];
}

test("historical DAG acceptance cases are complete and dependency ordered", async () => {
  const fixture = await readJson(
    "test/fixtures/historical-dag-acceptance-cases-v1.json",
  );
  assert.equal(
    fixture.schema_version,
    "Perttool.HistoricalDagAcceptanceCases.v1",
  );
  assert.deepEqual(fixture.runtime_matrix, [22, 24]);
  assert.deepEqual(fixture.published_baseline, {
    version: "0.7.1",
    commands: 44,
    root_schemas: 20,
    root_runtime_exports: 121,
  });
  assert.deepEqual(fixture.accepted_source_boundary, {
    grammar_version: 6,
    cli_contract_version: 7,
    commands: 45,
    root_schemas: 21,
    root_runtime_exports: 122,
    core_runtime_exports: 45,
    root_production_dependencies: 0,
  });
  assert.deepEqual(
    assertDependencyOrder(fixture.cases),
    expectedIds("HDA", 16),
  );
});

test("historical component matrices compose without an uncovered semantic axis", async () => {
  const matrices = [
    ["test/fixtures/historical-dag-contract-v1.json", "HDG", 20],
    ["test/fixtures/historical-transition-model-v1.json", "HTM", 12],
    ["test/fixtures/historical-git-evidence-v1.json", "HGE", 12],
    ["test/fixtures/historical-linear-core-v1.json", "HLR", 12],
    ["test/fixtures/historical-cli-v1.json", "HCLI", 12],
    ["test/fixtures/historical-editor-protocol-cases-v1.json", "HED", 18],
    ["test/fixtures/historical-editor-runtime-cases-v1.json", "HVI", 18],
  ];
  for (const [file, prefix, count] of matrices) {
    const fixture = await readJson(file);
    assert.deepEqual(
      assertDependencyOrder(fixture.cases),
      expectedIds(prefix, count),
      file,
    );
  }
});

test("accepted source exposes the additive history surface and read-only CLI", () => {
  assert.equal(Object.keys(perttool).length, 129);
  assert.equal(Object.keys(core).length, 45);
  assert.equal(perttool.COMMAND_REGISTRY.length, 56);
  assert.equal(perttool.getJsonSchemaCatalog().length, 23);
  assert.deepEqual(
    perttool.COMMAND_REGISTRY.filter(
      ({ path: commandPath }) => commandPath.join(" ") === "dag history",
    ).map(({ operation }) => operation),
    ["dag.history"],
  );
  assert.equal(
    perttool.getJsonSchemaCatalog().some(
      ({ schemaId }) => schemaId === "Perttool.HistoricalGraphResult.v1",
    ),
    true,
  );

  const before = run("git", ["status", "--porcelain=v1", "-z"]);
  assert.equal(before.status, 0, before.stderr);
  const history = run(process.execPath, [
    cli,
    "dag",
    "history",
    "plans/historical-dag.pert",
    "--rev",
    "HEAD",
    "--history",
    "first-parent",
    "--view",
    "lineage",
    "--analysis",
    "none",
    "--format=json",
  ]);
  assert.equal(history.status, 0, history.stderr);
  const result = JSON.parse(history.stdout);
  assert.equal(result.schema_version, "Perttool.HistoricalGraphResult.v1");
  assert.equal(result.request.ancestry_profile, "first_parent");
  assert.equal(result.request.view, "lineage");
  assert.equal(result.request.analysis_mode, "none");
  const after = run("git", ["status", "--porcelain=v1", "-z"]);
  assert.equal(after.status, 0, after.stderr);
  assert.equal(after.stdout, before.stdout);
});

test("historical DAG plan retains the accepted final lifecycle before advance", async () => {
  const source = await readFile(path.join(root, "plans/historical-dag.pert"), "utf8");
  const acceptance = await readFile(
    path.join(root, "docs/process/historical-dag-acceptance.md"),
    "utf8",
  );
  const checked = perttool.checkDocument(source);
  const next = perttool.selectNextTasks(source);

  assert.equal(checked.ok, true);
  assert.match(
    source,
    /task HISTORICAL_DAG_ACCEPTANCE[\s\S]*?status done/u,
  );
  assert.match(
    source,
    /task_outcome OUTCOME_HISTORICAL_DAG_ACCEPTANCE:[\s\S]*?against_basis sha256:cce0e3c757a51cf09215980303509d1aad9e5bbb90d11acf48790e962a894626[\s\S]*?status conformant/u,
  );
  assert.equal(next.ok, true);
  assert.deepEqual(next.groups.ready, []);
  assert.deepEqual(next.groups.runnableNow, []);
  assert.deepEqual(next.recommendation.recommendedTaskIds, []);
  assert.deepEqual(next.temporal.authority.startableRecommendedTaskIds, []);
  assert.deepEqual(next.assurance.directMismatchTaskIds, []);
  assert.deepEqual(next.assurance.inheritedMismatchTaskIds, []);
  assert.deepEqual(next.assurance.replanRequiredTaskIds, []);
  assert.deepEqual(next.assurance.activeAttentionRequiredTaskIds, []);
  assert.deepEqual(next.assurance.requiredActions, []);
  assert.match(acceptance, /passed 961 tests/u);
  assert.match(
    acceptance,
    /final candidate and source digest is\s+`sha256:3a1b78e7e7012ebd0fba568cf10f0a0ca23d20fc33fd834f719b1681a64ea3ef`/u,
  );
  assert.match(acceptance, /intentionally retained before advance/u);
});
