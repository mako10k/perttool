// R: Verify recommendation conformance across public library and CLI publication.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  digestDocumentBytes,
  recommendationAnalysisToJson,
  selectNextTasks,
} from "../dist/index.js";
import { recommendationInvariantExitCode } from "../dist/recommendation/failure.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist/cli.js");
const fixture = "test/fixtures/recommendation/rec-001-critical-priority.pert";

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

test("NextResult.v10 publishes the same complete recommendation from Core and CLI", async () => {
  const source = await readFile(path.join(root, fixture));
  const sourceDigest = digestDocumentBytes(source);
  const core = selectNextTasks(source.toString("utf8"), { sourceDigest });
  assert.equal(core.ok, true);
  assert.ok(core.recommendation);

  const command = run(["dag", "next", fixture, "--format=json"]);
  assert.equal(command.status, 0, command.stderr);
  const json = JSON.parse(command.stdout);
  assert.equal(json.schema_version, "Perttool.NextResult.v10");
  assert.equal(json.cli_contract_version, 12);
  assert.equal(json.recommendation_interface_version, 2);
  assert.equal(json.source_digest, sourceDigest);
  assert.deepEqual(
    json.recommendation,
    recommendationAnalysisToJson(core.recommendation),
  );
  assert.equal(json.recommendation.explanation_status.complete, true);
  assert.equal(json.recommendation.explanation_status.truncated, false);
  assert.deepEqual(
    json.recommendation.task_decisions
      .map(({ subject_task_id }) => subject_task_id)
      .sort(),
    [...json.groups.ready].sort(),
  );
});

test("NextResult.v10 complete empty recommendation preserves operational fields and adds assurance authority", async () => {
  const command = run([
    "dag",
    "next",
    "test/fixtures/recommendation/rec-007-no-ready.pert",
    "--format=json",
  ]);
  assert.equal(command.status, 0, command.stderr);
  const contract = JSON.parse(await readFile(path.join(testDirectory, "fixtures/maximum-count-public-contract-v1.json"), "utf8"));
  const actual = JSON.parse(command.stdout);
  assert.deepEqual(actual, { ...contract.empty_example, tool_version: actual.tool_version });
  assert.deepEqual(actual.recommendation.selection.selected_task_ids, []);
  assert.equal(actual.recommendation.selection.maximum_task_count, 0);
});

test("dag next text publishes count-first selection and operational sections", async () => {
  const command = run(["dag", "next", fixture, "--color=never"]);
  assert.equal(command.status, 0, command.stderr);
  const expected = await readFile(
    path.join(testDirectory, "golden/recommendation/v10-text.expected.txt"),
    "utf8",
  );
  const newline = command.stdout.indexOf("\n");
  const projection = command.stdout.slice(0, newline);
  assert.ok(projection.startsWith("PLAN_REVIEW "));
  const json = run(["dag", "next", fixture, "--format=json"]);
  assert.equal(json.status, 0, json.stderr);
  assert.deepEqual(JSON.parse(projection.slice("PLAN_REVIEW ".length)), JSON.parse(json.stdout).plan_review);
  assert.equal(command.stdout.slice(newline + 1), expected);
});

test("NextResult.v6 JSON is byte deterministic for the same snapshot and options", () => {
  const first = run(["dag", "next", fixture, "--format=json"]);
  const second = run(["dag", "next", fixture, "--format=json"]);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
  assert.equal(first.stdout.endsWith("\n"), true);
});

test("CLI recommendation provenance preserves the raw BOM-bound source digest", async () => {
  const source = await readFile(path.join(root, fixture));
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), source]);
  const command = run(["dag", "next", "-", "--format=json"], { input: bytes });
  assert.equal(command.status, 0, command.stderr);
  const json = JSON.parse(command.stdout);
  assert.equal(json.source_digest, digestDocumentBytes(bytes));
  assert.ok(json.recommendation.facts.length > 0);
  assert.ok(
    json.recommendation.facts.every(
      ({ provenance }) => provenance.source_digest === json.source_digest,
    ),
  );
});

test("dag next command help identifies the Contract 12 strict-DAG consumer boundary", () => {
  const command = run(["dag", "next", "--help"]);
  assert.equal(command.status, 0, command.stderr);
  assert.match(command.stdout, /Perttool\.NextResult\.v10/);
  assert.match(command.stdout, /CLI contract: 12/);
  assert.match(command.stdout, /Output: formats=text,json/);
});

test("text renders the exact parallel selection from the shared Core result", () => {
  const command = run([
    "dag",
    "next",
    "test/fixtures/recommendation/rec-004-parallel-set.pert",
    "--color=never",
  ]);
  assert.equal(command.status, 0, command.stderr);
  assert.match(command.stdout, /^MAXIMUM STARTABLE TASKS 2$/m);
  assert.match(command.stdout, /^STARTABLE RECOMMENDED PARALLEL_A PARALLEL_B$/m);
});

test("recommendation invariant failure exposes no partial v4 Core result", async () => {
  const source = await readFile(path.join(root, fixture), "utf8");
  const result = selectNextTasks(source, { sourceDigest: "invalid-digest" });
  const actual = {
    exit_code: recommendationInvariantExitCode(result.diagnostics),
    ok: result.ok,
    recommendation: result.recommendation,
    groups: {
      active: result.groups.active,
      ready: result.groups.ready,
      runnable_now: result.groups.runnableNow,
      blocked_now: result.groups.blockedNow,
      upcoming: result.groups.upcoming,
    },
    tasks: result.tasks,
    diagnostics: result.diagnostics.map(({ code, severity, message }) => ({
      code,
      severity,
      message,
    })),
  };
  const expected = JSON.parse(
    await readFile(
      path.join(
        testDirectory,
        "golden/recommendation/v3-invariant-error.expected.json",
      ),
      "utf8",
    ),
  );
  assert.deepEqual(actual, expected);
});
