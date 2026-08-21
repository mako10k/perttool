import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { digestDocumentBytes } from "../dist/io/document-file.js";

const root = resolve(import.meta.dirname, "..");
const cli = join(root, "dist", "cli.js");

function run(cwd, executable, args, env = {}) {
  return spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
      NO_COLOR: "1",
      ...env,
    },
  });
}

function git(repository, ...args) {
  const result = run(repository, "git", args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function runCli(repository, ...args) {
  return run(repository, process.execPath, [cli, ...args]);
}

function currentSource() {
  return [
    "project CURRENT_OBSERVATION:",
    "  version 5",
    '  title "current observation"',
    "  as_of 2026-08-13",
    "  duration_unit point",
    "  velocity 1p/1d",
    "  finish DONE",
    "",
    "milestone NOW:",
    '  title "now"',
    "  state reached",
    "",
    "milestone DONE:",
    '  title "done"',
    "",
    "task WORK NOW -> DONE:",
    '  title "work"',
    "  duration 4p",
    "  status active",
    "",
    "work_event WE-start:",
    "  model 1",
    "  task WORK",
    "  kind start",
    "  occurred_at 2026-08-13T09:00:00+09:00",
    "  planned_value 4p",
    "",
  ].join("\n");
}

function candidate(result, id) {
  return result.observation.candidates.find((value) => value.id === id);
}

test("declared velocity observes an uncommitted eventful finish while Git evidence remains revision-bound", async (t) => {
  const repository = await mkdtemp(
    join(tmpdir(), "perttool-current-observation."),
  );
  t.after(() => rm(repository, { recursive: true, force: true }));
  git(repository, "init", "-b", "main");
  git(repository, "config", "user.name", "Perttool Test");
  git(repository, "config", "user.email", "perttool@example.invalid");

  const plan = join(repository, "plan.pert");
  const committed = Buffer.from(currentSource(), "utf8");
  await writeFile(plan, committed);
  git(repository, "add", "plan.pert");
  const committedAt = "2026-08-13T00:00:00Z";
  const commitResult = run(
    repository,
    "git",
    ["commit", "-m", "record active work"],
    {
      GIT_AUTHOR_DATE: committedAt,
      GIT_COMMITTER_DATE: committedAt,
    },
  );
  assert.equal(commitResult.status, 0, commitResult.stderr);
  const head = git(repository, "rev-parse", "HEAD");
  const indexBlob = git(repository, "rev-parse", ":plan.pert");

  const finish = runCli(
    repository,
    "task",
    "finish",
    plan,
    "WORK",
    "--at",
    "2026-08-13T17:00:00+09:00",
    "--active-time",
    "8",
    "--effort",
    "8",
    "--write",
    "--format=json",
  );
  assert.equal(finish.status, 0, finish.stderr);
  assert.equal(JSON.parse(finish.stdout).write.written, true);

  const current = await readFile(plan);
  const currentDigest = digestDocumentBytes(current);
  const committedDigest = digestDocumentBytes(committed);
  assert.notEqual(currentDigest, committedDigest);
  assert.equal(git(repository, "rev-parse", "HEAD"), head);
  assert.equal(git(repository, "rev-parse", ":plan.pert"), indexBlob);
  assert.match(git(repository, "status", "--short"), /^M plan\.pert$/u);

  const declaredCommand = runCli(
    repository,
    "project",
    "observe-velocity",
    plan,
    "--task",
    "WORK",
    "--evidence",
    "declared",
    "--format=json",
  );
  assert.equal(declaredCommand.status, 0, declaredCommand.stderr);
  const declared = JSON.parse(declaredCommand.stdout);
  assert.equal(declared.ok, true);
  assert.equal(declared.source_digest, currentDigest);
  assert.equal(declared.history.source_digest, committedDigest);
  assert.deepEqual(declared.history.inspected_commit_ids, [head]);
  assert.deepEqual(declared.observation.selected_task_ids, ["WORK"]);
  const elapsed = candidate(declared, "declared_elapsed_hour_throughput");
  assert.equal(elapsed.state, "available");
  assert.deepEqual(elapsed.included_task_ids, ["WORK"]);
  assert.deepEqual(elapsed.rate, {
    numerator: "1",
    denominator: "2",
    unit: "point_per_hour",
  });
  assert.equal(elapsed.adoptable_velocity_token, "1p/2h");
  assert.equal(elapsed.baseline_sources[0].commit_id, null);

  const adoptionPreview = runCli(
    repository,
    "project",
    "set",
    plan,
    "--velocity",
    elapsed.adoptable_velocity_token,
    "--format=json",
  );
  assert.equal(adoptionPreview.status, 0, adoptionPreview.stderr);
  assert.match(
    JSON.parse(adoptionPreview.stdout).updated_text,
    /  velocity 1p\/2h/u,
  );

  const recordedCommand = runCli(
    repository,
    "project",
    "observe-velocity",
    plan,
    "--task",
    "WORK",
    "--evidence",
    "git-recorded",
    "--format=json",
  );
  assert.equal(recordedCommand.status, 0, recordedCommand.stderr);
  const recorded = JSON.parse(recordedCommand.stdout);
  assert.equal(recorded.source_digest, committedDigest);
  assert.equal(recorded.history.source_digest, committedDigest);
  assert.equal(
    candidate(recorded, "git_recorded_elapsed_hour_throughput").state,
    "unavailable",
  );

  const allCommand = runCli(
    repository,
    "project",
    "observe-velocity",
    plan,
    "--task",
    "WORK",
    "--evidence",
    "all",
    "--format=json",
  );
  assert.equal(allCommand.status, 0, allCommand.stderr);
  const all = JSON.parse(allCommand.stdout);
  assert.equal(all.source_digest, currentDigest);
  assert.equal(all.history.source_digest, committedDigest);
  assert.equal(
    candidate(all, "declared_elapsed_hour_throughput").state,
    "available",
  );
  assert.equal(
    candidate(all, "git_recorded_elapsed_hour_throughput").state,
    "unavailable",
  );
  assert.deepEqual(await readFile(plan), current);
  assert.equal(git(repository, "rev-parse", "HEAD"), head);
  assert.equal(git(repository, "rev-parse", ":plan.pert"), indexBlob);
});

test("current observation contract, Guide, backlog, and acceptance record agree", async () => {
  const [specification, design, requirements, examples, backlog, acceptance] =
    await Promise.all([
      readFile(join(root, "docs/specs/project-actuals.md"), "utf8"),
      readFile(join(root, "docs/basic-design.md"), "utf8"),
      readFile(join(root, "docs/requirements.md"), "utf8"),
      readFile(join(root, "docs/examples/project-actuals.md"), "utf8"),
      readFile(join(root, "docs/backlog.md"), "utf8"),
      readFile(
        join(root, "docs/process/issue-8-current-velocity-acceptance.md"),
        "utf8",
      ),
    ]);
  assert.match(specification, /exact current operand bytes/u);
  assert.match(specification, /history\.source_digest/u);
  assert.match(design, /current operand bytes are reduced/u);
  assert.match(design, /selected first-parent history result/u);
  assert.match(requirements, /valid uncommitted finish written by `task finish`/u);
  assert.match(
    examples,
    /ACT003-001: Current declared observation correction/u,
  );
  assert.match(backlog, /ACT-003: Observe current declared actuals before commit/u);
  assert.match(backlog, /github\.com\/mako10k\/perttool\/issues\/8/u);
  assert.match(acceptance, /Document status: Accepted 1\.0/u);
  assert.match(acceptance, /public `observeProjectVelocity`/u);

  const guideCommand = runCli(
    root,
    "guide",
    "actuals",
    "--level",
    "quick",
    "--format=json",
  );
  assert.equal(guideCommand.status, 0, guideCommand.stderr);
  const guide = JSON.parse(guideCommand.stdout);
  const observation = guide.sections.find(
    ({ id }) => id === "read-only-observation",
  );
  assert.match(observation.body, /exact current operand/u);
  assert.match(observation.body, /nested history source digest/u);
});
