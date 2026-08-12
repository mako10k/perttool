import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");
const acceptanceScript = path.join(
  root,
  "scripts",
  "check-advance-clean-candidate.mjs",
);

test("ACC-006 and ACC-007 keep one tracked CLI candidate repository-clean", (t) => {
  const temporaryRoot = mkdtempSync(
    path.join(tmpdir(), "perttool-advance-clean-candidate."),
  );
  t.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));
  const workspace = path.join(temporaryRoot, "repository");
  const result = spawnSync(
    process.execPath,
    [acceptanceScript, cli, workspace],
    { cwd: root, encoding: "utf8" },
  );

  assert.equal(
    result.status,
    0,
    `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    source_bytes: 1569,
    candidate_bytes: 764,
    diff_added_lines: 4,
    diff_removed_lines: 38,
    removed_task_ids: ["WORK"],
    removed_work_event_ids: ["WE-finish", "WE-start"],
    history_guard_status: "passed",
    history_guard_cause: "baseline_matches",
    preview_equals_separate_output: true,
    preview_equals_in_place_write: true,
    trailing_blank_physical_lines: 0,
    git_diff_check_exit: 0,
    head_unchanged: true,
    index_unchanged: true,
    refs_unchanged: true,
  });
});
