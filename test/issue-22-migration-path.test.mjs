import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");

function run(cwd, args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
}

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

const grammar5 = `${[
  "project ISSUE_22:",
  "  version 5",
  '  title "Migration route regression"',
  "  duration_unit point",
  "  finish END",
  "",
  "milestone START:",
  '  title "Start"',
  "  state reached",
  "",
  "milestone END:",
  '  title "End"',
  "",
  "task WORK START -> END:",
  '  title "Work"',
  "  duration 1p",
].join("\n")}\n`;

test("Issue 22 exposes the repository-bound Grammar 5 to 7 CLI route", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-issue-22-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const plan = path.join(directory, "plan.pert");
  writeFileSync(plan, grammar5, "utf8");
  git(directory, "init", "-q");
  git(directory, "config", "user.name", "Perttool Test");
  git(directory, "config", "user.email", "perttool@example.invalid");
  git(directory, "add", "plan.pert");
  git(directory, "commit", "-qm", "baseline");

  const help = run(directory, ["help", "document", "migrate", "--format", "json"]);
  assert.equal(help.status, 0, help.stderr || help.stdout);
  const descriptor = JSON.parse(help.stdout).commands[0];
  assert.deepEqual(descriptor.options.find(({ name }) => name === "target-grammar").enum_values, ["7", "8"]);
  assert.deepEqual(descriptor.result_schemas, [
    "Perttool.MilestoneAcceptanceMigrationResult.v1",
    "Perttool.UnitMigrationResult.v4",
    "Perttool.CliError.v1",
  ]);

  const preview = run(directory, ["document", "migrate", "plan.pert", "--target-grammar", "7", "--format", "json"]);
  assert.equal(preview.status, 0, preview.stderr || preview.stdout);
  const projected = JSON.parse(preview.stdout);
  assert.equal(projected.cli_contract_version, 9);
  assert.equal(projected.source_grammar_version, 5);
  assert.equal(projected.target_grammar_version, 7);
  assert.match(projected.candidate_text, /^  version 7$/mu);
  assert.match(projected.candidate_text, /^milestone_acceptance_migration GRAMMAR_7_BASELINE:/mu);

  const write = run(directory, ["document", "migrate", "plan.pert", "--target-grammar", "7", "--write", "--format", "json"]);
  assert.equal(write.status, 0, write.stderr || write.stdout);
  assert.equal(readFileSync(plan, "utf8"), projected.candidate_text);

  const advance = run(directory, ["dag", "advance", "plan.pert", "--diff", "--format", "json"]);
  assert.doesNotMatch(`${advance.stdout}\n${advance.stderr}`, /PTMAC-101/u);
});

test("Issue 22 retains Grammar 7 to 8 and rejects unsupported targets", () => {
  const grammar7Path = path.join(root, "plans", "milestone-acceptance.pert");
  const temporal = run(root, ["document", "migrate", grammar7Path, "--target-grammar", "8", "--format", "json"]);
  assert.equal(temporal.status, 0, temporal.stderr || temporal.stdout);
  assert.equal(JSON.parse(temporal.stdout).target_grammar_version, 8);

  const unsupported = run(root, ["document", "migrate", grammar7Path, "--target-grammar", "6"]);
  assert.equal(unsupported.status, 2);
  assert.match(unsupported.stderr, /must be one of 7, 8/u);
});
