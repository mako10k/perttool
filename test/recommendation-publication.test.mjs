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

test("NextResult.v3 publishes the same complete recommendation from Core and CLI", async () => {
  const source = await readFile(path.join(root, fixture));
  const sourceDigest = digestDocumentBytes(source);
  const core = selectNextTasks(source.toString("utf8"), { sourceDigest });
  assert.equal(core.ok, true);
  assert.ok(core.recommendation);

  const command = run(["dag", "next", fixture, "--format=json"]);
  assert.equal(command.status, 0, command.stderr);
  const json = JSON.parse(command.stdout);
  assert.equal(json.schema_version, "Perttool.NextResult.v3");
  assert.equal(json.recommendation_interface_version, 1);
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

test("NextResult.v3 complete empty recommendation matches its JSON golden", async () => {
  const command = run([
    "dag",
    "next",
    "test/fixtures/recommendation/rec-007-no-ready.pert",
    "--format=json",
  ]);
  assert.equal(command.status, 0, command.stderr);
  const expected = JSON.parse(
    await readFile(
      path.join(testDirectory, "golden/recommendation/v3-empty.expected.json"),
      "utf8",
    ),
  );
  assert.deepEqual(JSON.parse(command.stdout), expected);
  assert.equal(expected.recommendation.task_decisions.length, 0);
  assert.equal(expected.recommendation.result_decision.recommended_task_ids.length, 0);
});

test("dag next text publishes four tier sections and preserves operational sections", async () => {
  const command = run(["dag", "next", fixture, "--color=never"]);
  assert.equal(command.status, 0, command.stderr);
  const expected = await readFile(
    path.join(testDirectory, "golden/recommendation/v3-text.expected.txt"),
    "utf8",
  );
  assert.equal(command.stdout, expected);
});

test("NextResult.v3 JSON is byte deterministic for the same snapshot and options", () => {
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

test("dag next command help identifies the breaking v3 consumer boundary", () => {
  const command = run(["dag", "next", "--help"]);
  assert.equal(command.status, 0, command.stderr);
  assert.match(command.stdout, /Perttool\.NextResult\.v3/);
  assert.match(command.stdout, /CLI contract: 3/);
  assert.match(command.stdout, /Output: formats=text,json/);
});

test("text derives a later parallel recommendation rule from the Core summary", () => {
  const command = run([
    "dag",
    "next",
    "test/fixtures/recommendation/rec-004-parallel-set.pert",
    "--color=never",
  ]);
  assert.equal(command.status, 0, command.stderr);
  assert.match(
    command.stdout,
    /^PARALLEL_B tier=recommended rule=joint_resource_feasibility /m,
  );
  assert.match(
    command.stdout,
    /PARALLEL_B is recommended by rule joint_resource_feasibility\./,
  );
});

test("recommendation invariant failure exposes no partial v3 Core result", async () => {
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
