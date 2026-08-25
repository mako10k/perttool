import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as coreApi from "../dist/core/index.js";
import * as nodeApi from "../dist/node/index.js";
import * as rootApi from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

test("planning-pool contract fixes one Work-centered Grammar 9 boundary", async () => {
  const [specification, requirements, design, backlog, grammar, plan] =
    await Promise.all([
      repositoryText("docs/specs/planning-pool.md"),
      repositoryText("docs/requirements.md"),
      repositoryText("docs/basic-design.md"),
      repositoryText("docs/backlog.md"),
      repositoryText("docs/specs/dsl-grammar.md"),
      repositoryText("plans/planning-pool.pert"),
    ]);

  assert.match(specification, /- Status: Normative 1\.0/u);
  assert.match(specification, /Target source grammar: 9/u);
  assert.match(specification, /Target CLI contract: 10/u);
  assert.match(specification, /Perttool\.PlanningPoolModel\.v1/u);
  assert.match(specification, /Perttool\.PlanningReshapeRequest\.v1/u);
  assert.match(specification, /perttool\.planning-reshape-normalization@1/u);
  assert.match(specification, /preflight_token/u);
  assert.match(specification, /3,600 seconds/u);
  assert.match(specification, /user_response_required: true/u);
  assert.match(specification, /Add residual description/u);
  assert.match(specification, /--add-residual-description/u);
  assert.match(specification, /PTPOOL-112/u);
  assert.match(specification, /PTPOOL-117/u);
  assert.match(specification, /same-identity strict Milestone/u);
  assert.match(specification, /same-identity strict Task/u);
  assert.match(specification, /shared Event projects once to one Milestone/u);
  assert.match(specification, /shared Activity projects once to one Task/u);
  assert.match(specification, /no new `planning_owner`/u);
  assert.match(specification, /active catalog moves from 56 to 67 commands/u);
  assert.match(specification, /active root catalog therefore moves from 23 to 26/u);
  assert.match(specification, /document migrate --target-grammar 9/u);
  assert.match(specification, /--archive-empty-work/u);

  assert.match(
    requirements,
    /25\. \[ \] Implement the Work-centered planning pool and bounded Windows/u,
  );
  assert.match(requirements, /\[Work-centered Planning Pool and Window Contract\]\(specs\/planning-pool\.md\)/u);
  assert.match(design, /### Post-MVP Slice 8: Work-centered planning pool and bounded Windows/u);
  assert.match(backlog, /normative Grammar 9 and CLI Contract 10 planning-pool contract\s+accepted/u);
  assert.match(grammar, /Accepted Grammar 9 target: \[Work-centered Planning Pool and Window Contract\]/u);
  assert.match(plan, /milestone PLANNING_POOL_SOURCE_READY:[\s\S]*?state reached/u);
  assert.match(plan, /task PLANNING_POOL_RESHAPE_CORE/u);
  assert.doesNotMatch(plan, /task PLANNING_POOL_CONTRACT|task PLANNING_POOL_SOURCE_CORE/u);
});

test("all forty planning-pool cases are dependency ordered and closed", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/planning-pool-contract-v1.json"),
  );

  assert.equal(
    fixture.schema_version,
    "Perttool.PlanningPoolContractCases.v1",
  );
  assert.equal(fixture.contract_id, "PLAN-POOL-001");
  assert.equal(fixture.target.grammar_version, 9);
  assert.equal(fixture.target.cli_contract_version, 10);
  assert.equal(fixture.target.source_model, "Perttool.PlanningPoolModel.v1");
  assert.equal(
    fixture.target.normalization_contract,
    "perttool.planning-reshape-normalization@1",
  );
  assert.equal(fixture.target.new_commands.length, 11);
  assert.equal(fixture.target.active_command_count_after_public_activation, 67);
  assert.equal(fixture.target.active_root_schema_count_after_public_activation, 26);
  assert.deepEqual(
    fixture.target.diagnostics,
    Array.from({ length: 17 }, (_, index) => `PTPOOL-${101 + index}`),
  );
  assert.deepEqual(fixture.target.unchanged_runtime, {
    package_version: "0.10.5",
    grammar_version: 8,
    cli_contract_version: 9,
    commands: 56,
    root_schemas: 23,
    root_exports: 129,
    node_exports: 129,
    core_exports: 45,
  });
  assert.equal(fixture.target.hard_limits.preflight_token_lifetime_seconds, 3600);
  assert.equal(fixture.target.hard_limits.unexpired_preflight_tokens, 256);
  assert.equal(fixture.target.hard_limits.first_parent_commits, 2048);
  assert.deepEqual(
    fixture.cases.map(({ id }) => id),
    expectedIds("PPC", 40),
  );

  const accepted = new Set();
  for (const contractCase of fixture.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      `${contractCase.id}: dependencies must precede the case`,
    );
    assert.equal(typeof contractCase.area, "string");
    assert.equal(typeof contractCase.given, "string");
    assert.equal(typeof contractCase.when, "string");
    assert.equal(typeof contractCase.then, "string");
    accepted.add(contractCase.id);
  }
});

test("planning reshape normalization vectors are fixed SHA-256 bytes", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/planning-pool-contract-v1.json"),
  );

  assert.deepEqual(
    fixture.hash_vectors.map(({ id }) => id),
    ["PPRH-001", "PPRH-002"],
  );
  for (const vector of fixture.hash_vectors) {
    assert.equal(Buffer.byteLength(vector.canonical_utf8, "utf8"), vector.utf8_bytes);
    assert.equal(
      `sha256:${createHash("sha256").update(vector.canonical_utf8).digest("hex")}`,
      vector.preflight_hash,
    );
  }
  assert.notEqual(
    fixture.hash_vectors[0].preflight_hash,
    fixture.hash_vectors[1].preflight_hash,
  );
});

test("contract acceptance does not activate reserved planning runtime", async () => {
  const packageJson = JSON.parse(await repositoryText("package.json"));
  const commands = rootApi.COMMAND_REGISTRY.map(({ path: commandPath }) =>
    commandPath.join(" "),
  );
  const catalog = rootApi.getJsonSchemaCatalog();

  assert.equal(packageJson.version, "0.10.5");
  assert.equal(rootApi.COMMAND_REGISTRY.length, 56);
  assert.equal(catalog.length, 23);
  assert.equal(Object.keys(rootApi).length, 129);
  assert.equal(Object.keys(nodeApi).length, 129);
  assert.equal(Object.keys(coreApi).length, 45);
  assert.equal(commands.some((command) => command.startsWith("work ")), false);
  assert.equal(commands.some((command) => command.startsWith("window ")), false);
  assert.equal(
    catalog.some(({ schemaId }) => schemaId === "Perttool.PlanningPoolResult.v1"),
    false,
  );
  assert.equal("PlanningPoolModel" in rootApi, false);
});

test("accepted Window Core exposes only the Observation Core execution frontier", async () => {
  const [source, acceptance, windowAcceptance, selfUse] = await Promise.all([
    repositoryText("plans/planning-pool.pert"),
    repositoryText("docs/process/planning-pool-contract-acceptance.md"),
    repositoryText("docs/process/planning-pool-window-core-acceptance.md"),
    repositoryText("scripts/check-self-use.sh"),
  ]);
  const checked = rootApi.checkDocument(source);
  const metadata = rootApi.getProjectMetadata(source);
  const analyzed = rootApi.analyzeDocument(source);
  const next = rootApi.selectNextTasks(source);

  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(analyzed.ok, true);
  assert.equal(next.ok, true);
  assert.equal(metadata.project.id, "PLANNING_POOL");
  assert.equal(metadata.grammarVersion, 7);
  assert.match(source, /milestone PLANNING_POOL_SOURCE_READY:[\s\S]*?state reached/u);
  assert.match(source, /task PLANNING_POOL_RESHAPE_CORE[\s\S]*?status done/u);
  assert.match(source, /task PLANNING_POOL_PROJECTION_CORE[\s\S]*?status done/u);
  assert.match(source, /task PLANNING_POOL_WINDOW_CORE[\s\S]*?status done/u);
  assert.match(source, /task_outcome OUTCOME_PLANNING_POOL_WINDOW_CORE:[\s\S]*?status conformant/u);
  assert.deepEqual(next.recommendation.recommendedTaskIds, [
    "PLANNING_POOL_OBSERVATION_CORE",
  ]);
  assert.deepEqual(next.temporal.authority.startableRecommendedTaskIds, [
    "PLANNING_POOL_OBSERVATION_CORE",
  ]);
  assert.deepEqual(next.temporal.authority.assuranceUnavailableRecommendedTaskIds, []);
  assert.deepEqual(next.assurance.requiredActions, []);
  assert.match(acceptance, /Document status: Accepted 1\.0/u);
  assert.match(acceptance, /Runtime status: not implemented/u);
  assert.match(acceptance, /`PPC-001` through `PPC-040`/u);
  assert.match(acceptance, /There are no open normative contract findings/u);
  assert.match(windowAcceptance, /Document status: Accepted 1\.0/u);
  assert.match(windowAcceptance, /complete 1,278-test repository regression gate/u);
  assert.match(selfUse, /plans\/planning-pool\.pert/u);
});
