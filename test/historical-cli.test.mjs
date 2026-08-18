import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  getJsonSchemaCatalog,
} from "../dist/index.js";
import { planTargetPlanAssuranceAdvance } from "../dist/assurance/advance.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");

function runGit(repository, args, options = {}) {
  return spawnSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
      ...(options.env ?? {}),
    },
  });
}

function git(repository, ...args) {
  const result = runGit(repository, args);
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

let commitOrdinal = 0;

function commit(repository, message) {
  commitOrdinal += 1;
  git(repository, "add", "-A");
  const minute = String(commitOrdinal % 60).padStart(2, "0");
  const result = runGit(repository, ["commit", "-m", message], {
    env: {
      GIT_AUTHOR_DATE: `2026-08-06T14:${minute}:00+09:00`,
      GIT_COMMITTER_DATE: `2026-08-06T14:${minute}:00+09:00`,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return git(repository, "rev-parse", "HEAD");
}

function initialize(repository) {
  git(repository, "init", "-b", "main");
  git(repository, "config", "user.name", "Perttool Historical CLI Test");
  git(repository, "config", "user.email", "historical-cli@example.invalid");
}

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(
    result.status,
    expectedStatus,
    `${args.join(" ")}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  return result;
}

function runJson(args, expectedStatus = 0) {
  const result = run([...args, "--format=json"], expectedStatus);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function advanceSource() {
  return `${[
    "project ADVANCE:",
    "  version 5",
    "  title \"Advance history\"",
    "  as_of 2026-08-06",
    "  duration_unit point",
    "  velocity 1p/1d",
    "  finish DONE",
    "",
    "milestone START:",
    "  title \"Start\"",
    "  state reached",
    "",
    "milestone DONE:",
    "  title \"Done\"",
    "",
    "task WORK START -> DONE:",
    "  title \"Work\"",
    "  duration 1p",
    "  status done",
    "",
    "work_event WE_START:",
    "  model 1",
    "  task WORK",
    "  kind start",
    "  occurred_at 2026-08-06T10:00:00+09:00",
    "  planned_value 1p",
    "",
    "work_event WE_FINISH:",
    "  model 1",
    "  task WORK",
    "  kind finish",
    "  occurred_at 2026-08-06T11:00:00+09:00",
    "  active_time 1h",
    "  effort 1ph",
  ].join("\n")}\n`;
}

function repositoryState(repository, target) {
  return {
    head: git(repository, "rev-parse", "HEAD"),
    status: git(repository, "status", "--porcelain=v2", "--untracked-files=all"),
    source: createHash("sha256").update(readFileSync(target)).digest("hex"),
  };
}

function temporaryRepository(t) {
  const repository = mkdtempSync(path.join(tmpdir(), "perttool-historical-cli."));
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  initialize(repository);
  const target = path.join(repository, "plans", "plan.pert");
  mkdirSync(path.dirname(target), { recursive: true });
  return { repository, target };
}

test("HCLI-001 discovers one additive Contract 7 command and schema", () => {
  const fixture = JSON.parse(readFileSync(
    path.join(root, "test", "fixtures", "historical-cli-v1.json"),
    "utf8",
  ));
  assert.equal(fixture.schema_version, "Perttool.HistoricalCliCases.v1");
  const accepted = new Set();
  for (const acceptanceCase of fixture.cases) {
    assert.equal(
      acceptanceCase.depends_on.every((id) => accepted.has(id)),
      true,
      acceptanceCase.id,
    );
    accepted.add(acceptanceCase.id);
  }
  assert.deepEqual(
    [...accepted],
    Array.from({ length: 12 }, (_, index) =>
      `HCLI-${String(index + 1).padStart(3, "0")}`
    ),
  );
  const descriptor = COMMAND_REGISTRY.find(({ operation }) =>
    operation === "dag.history"
  );
  assert.notEqual(descriptor, undefined);
  assert.equal(COMMAND_REGISTRY.length, 56);
  assert.deepEqual(descriptor.path, ["dag", "history"]);
  assert.equal(descriptor.effect, "read");
  assert.equal(descriptor.stdin.document, false);
  assert.deepEqual(descriptor.resultSchemas, [
    "Perttool.HistoricalGraphResult.v1",
    "Perttool.CliError.v1",
  ]);
  assert.equal(getJsonSchemaCatalog().length, 23);

  const help = runJson(["help", "dag", "history"]);
  assert.equal(help.ok, true);
  assert.equal(help.commands[0].operation, "dag.history");
  const guide = runJson(["guide", "historical-dag"]);
  assert.equal(guide.ok, true);
  assert.equal(guide.topic_id, "historical-dag");
});

test("HCLI-002 through HCLI-006 bind snapshot, lineage, timeline, analysis, and canonical advance", (t) => {
  const { repository, target } = temporaryRepository(t);
  const beforeAdvance = advanceSource();
  writeFileSync(target, beforeAdvance, "utf8");
  const completedCommit = commit(repository, "record completed work");
  const preview = planTargetPlanAssuranceAdvance(
    beforeAdvance,
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  assert.equal(preview.ok, true);
  assert.notEqual(preview.updatedText, null);
  writeFileSync(target, preview.updatedText, "utf8");
  const advancedCommit = commit(repository, "canonical advance");
  const stateBefore = repositoryState(repository, target);

  const lineage = runJson([
    "dag", "history", target,
    "--rev", advancedCommit,
    "--base", completedCommit,
    "--history", "first-parent",
    "--view", "lineage",
  ]);
  assert.equal(lineage.ok, true);
  assert.equal(lineage.status, "complete");
  assert.deepEqual(lineage.evidence.inspected_commit_ids, [
    completedCommit,
    advancedCommit,
  ]);
  assert.equal(lineage.lineage.canonical_advance_proofs.length, 1);
  assert.ok(lineage.lineage.retired_occurrence_ids.length > 0);
  assert.equal(lineage.snapshot, null);
  assert.equal(lineage.timeline, null);
  assert.ok(lineage.source_bindings.length > 0);
  assert.equal(
    lineage.source_bindings.every(({ repository_id, commit_id, blob_id, source_digest }) =>
      repository_id === lineage.evidence.repository_id &&
      [completedCommit, advancedCommit].includes(commit_id) &&
      blob_id !== "" && source_digest.startsWith("sha256:")
    ),
    true,
  );

  const snapshot = runJson([
    "dag", "history", target,
    "--rev", advancedCommit,
    "--base", completedCommit,
    "--view", "snapshot",
    "--snapshot", completedCommit,
    "--analysis", "both",
  ]);
  assert.equal(snapshot.status, "complete");
  assert.equal(snapshot.selected_snapshot_commit_id, completedCommit);
  assert.equal(snapshot.snapshot.commit_id, completedCommit);
  assert.equal(snapshot.analysis.status, "complete");
  assert.equal(snapshot.analysis.mode, "both");
  assert.equal(snapshot.analysis.checkpoint_commit_id, completedCommit);
  assert.equal(snapshot.lineage, null);

  const timeline = runJson([
    "dag", "history", target,
    "--rev", advancedCommit,
    "--base", completedCommit,
    "--view", "timeline",
  ]);
  assert.equal(timeline.status, "complete");
  assert.deepEqual(
    timeline.timeline.entries.map(({ commit_id }) => commit_id),
    [completedCommit, advancedCommit],
  );
  assert.equal(timeline.timeline.segments.length, 1);
  assert.equal(timeline.lineage, null);
  assert.deepEqual(repositoryState(repository, target), stateBefore);
});

test("HCLI-007 retains a typed incomplete timeline and warning policy", (t) => {
  const { repository, target } = temporaryRepository(t);
  writeFileSync(target, advanceSource(), "utf8");
  const validCommit = commit(repository, "valid plan");
  writeFileSync(target, "project BROKEN:\n  title [\n", "utf8");
  const invalidCommit = commit(repository, "invalid plan");
  const stateBefore = repositoryState(repository, target);

  const result = runJson([
    "dag", "history", target,
    "--rev", invalidCommit,
    "--base", validCommit,
    "--view", "timeline",
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.status, "incomplete");
  assert.equal(result.timeline.entries.at(-1).validity, "syntax_invalid");
  assert.ok(result.causes.some(({ cause }) => cause === "syntax_invalid"));
  assert.ok(result.diagnostics.some(({ code }) => code === "PTHDG-102"));

  const strict = runJson([
    "dag", "history", target,
    "--rev", invalidCommit,
    "--base", validCommit,
    "--view", "timeline",
    "--warnings-as-errors",
  ], 1);
  assert.equal(strict.ok, false);
  assert.equal(strict.status, "incomplete");
  assert.deepEqual(repositoryState(repository, target), stateBefore);
});

test("HCLI-008 fails closed for three-way and invalid snapshot requests", () => {
  const unsupported = runJson([
    "dag", "history", "/path/that/need/not/exist.pert",
    "--history", "three-way",
  ], 1);
  assert.equal(unsupported.status, "unavailable");
  assert.equal(unsupported.request.ancestry_profile, "three_way");
  assert.equal(unsupported.diagnostics[0].code, "PTHDG-106");

  const conflict = run([
    "dag", "history", "plan.pert",
    "--view", "lineage",
    "--snapshot", "a".repeat(40),
    "--format=json",
  ], 2);
  assert.equal(JSON.parse(conflict.stdout).schema_version, "Perttool.CliError.v1");
  const abbreviated = run([
    "dag", "history", "plan.pert",
    "--view", "snapshot",
    "--snapshot", "abc123",
    "--format=json",
  ], 2);
  assert.equal(JSON.parse(abbreviated.stdout).schema_version, "Perttool.CliError.v1");
  const stdin = run([
    "dag", "history", "-", "--format=json",
  ], 2);
  assert.equal(JSON.parse(stdin.stdout).schema_version, "Perttool.CliError.v1");
});
