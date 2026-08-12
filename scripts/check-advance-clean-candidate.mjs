#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const [cli, workspace] = process.argv.slice(2);
if (cli === undefined || workspace === undefined) {
  process.stderr.write(
    "Usage: node scripts/check-advance-clean-candidate.mjs <cli> <workspace>\n",
  );
  process.exit(2);
}
if (!path.isAbsolute(cli) || !path.isAbsolute(workspace)) {
  process.stderr.write("CLI and workspace must use absolute paths\n");
  process.exit(2);
}
const publicApi = await import(pathToFileURL(
  path.join(path.dirname(realpathSync(cli)), "index.js"),
).href);

function digest(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

const source = [
  "project CLEAN_CANDIDATE:",
  "  version 5",
  '  title "Repository-clean candidate acceptance"',
  "  as_of 2026-07-31",
  "  duration_unit point",
  "  velocity 1p/1d",
  "  finish DONE",
  "",
  "milestone START:",
  '  title "Started"',
  "  state reached",
  "",
  "milestone DONE:",
  '  title "Done"',
  "",
  "task WORK START -> DONE:",
  '  title "Completed work"',
  "  duration 1p",
  "  status done",
  "",
  "",
  "work_event WE-start:",
  "  model 1",
  "  task WORK",
  "  kind start",
  "  occurred_at 2026-07-31T10:00:00+09:00",
  "  planned_value 1p",
  "",
  "",
  "work_event WE-finish:",
  "  model 1",
  "  task WORK",
  "  kind finish",
  "  occurred_at 2026-07-31T11:00:00+09:00",
  "  active_time 1h",
  "  effort 1ph",
  "",
].join("\n");

mkdirSync(workspace);
const planPath = path.join(workspace, "eventful.pert");
const outputPath = path.join(workspace, "candidate.pert");
const migrated = publicApi.planMilestoneAcceptanceMigration(source, {
  repositoryId: "advance-clean-candidate-test",
  repositoryRelativePath: "eventful.pert",
  objectFormat: "sha1",
  headCommit: "a".repeat(40),
  headBlob: "b".repeat(40),
  stage0Blob: "b".repeat(40),
  sourceDigest: digest(source),
});
assert.equal(migrated.ok, true);
const replaced = publicApi.planCriterionSetReplacement(migrated.candidateText, {
  milestoneId: "DONE",
  setId: "DONE_R1",
  revisionId: "R1",
  criteria: [{
    criterionId: "COMPLETE",
    required: true,
    evidenceKind: "owner",
    description: "Completed work is accepted",
  }],
});
assert.equal(replaced.ok, true);
const waived = publicApi.planAcceptanceReceiptMutation(replaced.updatedText, {
  setId: "DONE_R1",
  criterionId: "COMPLETE",
  receiptId: "WAIVE_DONE",
  action: "waive",
  reason: "Accepted repository-clean advance regression",
});
assert.equal(waived.ok, true);
writeFileSync(planPath, waived.updatedText, "utf8");

function invoke(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: workspace,
    encoding: "utf8",
  });
  assert.equal(
    result.error,
    undefined,
    `${args.join(" ")} failed to start: ${result.error?.message}`,
  );
  assert.equal(
    result.status,
    expectedStatus,
    [
      `unexpected exit for: perttool ${args.join(" ")}`,
      `stdout: ${result.stdout}`,
      `stderr: ${result.stderr}`,
    ].join("\n"),
  );
  return result;
}

function invokeJson(args, expectedStatus = 0) {
  const result = invoke([...args, "--format=json"], expectedStatus);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function git(...args) {
  const result = spawnSync("git", ["-C", workspace, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
    },
  });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")}\n${result.stderr}`,
  );
  return result.stdout.trim();
}

git("init", "--quiet", "-b", "main");
git("config", "user.name", "Perttool Acceptance");
git("config", "user.email", "perttool@example.invalid");
git("add", "--", path.basename(planPath));
git("commit", "--quiet", "-m", "acceptance-ready pre-advance snapshot");

const headBefore = git("rev-parse", "HEAD");
const indexBefore = git("ls-files", "--stage", "--", path.basename(planPath));
const refsBefore = git("show-ref", "--head");

const preview = invokeJson(["dag", "advance", planPath]);
assert.equal(preview.schema_version, "Perttool.AdvanceResult.v3");
assert.equal(preview.changed, true);
assert.equal(preview.write.mode, "preview");
assert.equal(preview.write.written, false);
assert.equal(preview.history_guard.status, "not_applicable");
assert.equal(preview.history_guard.cause, "preview");
assert.deepEqual(preview.advance.removed_task_ids, ["WORK"]);
assert.deepEqual(preview.advance.removed_work_event_ids, [
  "WE-finish",
  "WE-start",
]);
assert.doesNotMatch(preview.updated_text, /(?:\r?\n){2,}$/);

const separate = invokeJson([
  "dag",
  "advance",
  planPath,
  "--out",
  outputPath,
  "--actor",
  "user",
]);
assert.equal(separate.history_guard.status, "not_applicable");
assert.equal(separate.history_guard.cause, "separate_output");
assert.equal(separate.updated_text, preview.updated_text);
assert.equal(readFileSync(outputPath, "utf8"), preview.updated_text);

const written = invokeJson([
  "dag",
  "advance",
  planPath,
  "--write",
  "--expect-digest",
  preview.source_digest,
  "--actor",
  "user",
]);
assert.equal(written.history_guard.status, "passed");
assert.equal(written.history_guard.cause, "baseline_matches");
assert.equal(written.history_guard.repository_relative_path, "eventful.pert");
assert.equal(written.history_guard.head_commit_id, headBefore);
assert.equal(written.updated_text, preview.updated_text);
assert.equal(readFileSync(planPath, "utf8"), preview.updated_text);
assert.doesNotMatch(written.updated_text, /(?:\r?\n){2,}$/);
assert.doesNotMatch(written.updated_text, /^(?:task WORK|work_event WE-)/m);

git("diff", "--check", "--", path.basename(planPath));
assert.equal(git("rev-parse", "HEAD"), headBefore);
assert.equal(
  git("ls-files", "--stage", "--", path.basename(planPath)),
  indexBefore,
);
assert.equal(git("show-ref", "--head"), refsBefore);

const repeated = invokeJson(["dag", "advance", planPath, "--write"]);
assert.equal(repeated.changed, false);
assert.equal(repeated.write.written, false);
assert.equal(repeated.history_guard.status, "not_applicable");
assert.equal(repeated.history_guard.cause, "no_change");

process.stdout.write(`${JSON.stringify({
  source_bytes: preview.history_guard.source_bytes,
  candidate_bytes: preview.history_guard.candidate_bytes,
  diff_added_lines: preview.history_guard.diff_added_lines,
  diff_removed_lines: preview.history_guard.diff_removed_lines,
  removed_task_ids: preview.advance.removed_task_ids,
  removed_work_event_ids: preview.advance.removed_work_event_ids,
  history_guard_status: written.history_guard.status,
  history_guard_cause: written.history_guard.cause,
  preview_equals_separate_output: true,
  preview_equals_in_place_write: true,
  trailing_blank_physical_lines: 0,
  git_diff_check_exit: 0,
  head_unchanged: true,
  index_unchanged: true,
  refs_unchanged: true,
})}\n`);
