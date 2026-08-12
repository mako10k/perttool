import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { planAdvance } from "../dist/index.js";
import { planTargetPlanAssuranceMutation } from "../dist/assurance/mutation.js";
import {
  prepareAdvanceHistory,
  withAdvanceHistoryRace,
} from "../dist/application/advance-history.js";
import {
  recheckAdvanceHistoryBaseline,
} from "../dist/history/git-probe.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");

const baseSource = [
  "project DEMO:",
  "  version 5",
  '  title "demo"',
  "  duration_unit point",
  "  velocity 1p/1d",
  "  finish END",
  "",
  "milestone START:",
  '  title "start"',
  "  state reached",
  "",
  "milestone MID:",
  '  title "mid"',
  "  state planned",
  "",
  "milestone END:",
  '  title "end"',
  "",
  "# owned",
  "task DONE START -> MID:",
  '  title "done"',
  "  duration 1p",
  "  status done",
  "",
  "task NEXT MID -> END:",
  '  title "next"',
  "  duration 1p",
  "",
].join("\n");

function terminalReceiptSource() {
  const base = [
    "project RECEIPT_EOF:",
    "  version 5",
    '  title "receipt EOF regression"',
    "  as_of 2026-08-12",
    "  duration_unit point",
    "  velocity 2p/1d",
    "  finish M2",
    "  dag_owner user",
    "",
    "milestone M0:",
    '  title "start"',
    "  state reached",
    "",
    "milestone M1:",
    '  title "frontier"',
    "",
    "milestone M2:",
    '  title "finish"',
    "",
    "task A M0 -> M1:",
    '  title "producer"',
    "  duration 1p",
    "  status done",
    "",
    "task B M1 -> M2:",
    '  title "consumer"',
    "  duration 1p",
    "  status planned",
    "",
  ].join("\n");
  const sealed = planTargetPlanAssuranceMutation(
    base,
    { kind: "plan_assurance.seal", reason: "Accepted regression basis" },
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  assert.equal(sealed.ok, true);
  const outcome = planTargetPlanAssuranceMutation(
    sealed.updatedText,
    {
      kind: "task_outcome.add",
      id: "OUT_A",
      taskId: "A",
      status: "conformant",
      reason: "Accepted producer outcome",
    },
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  assert.equal(outcome.ok, true);
  return [
    outcome.updatedText.trimEnd(),
    "",
    "work_event WE_A_START:",
    "  model 1",
    "  task A",
    "  kind start",
    "  occurred_at 2026-08-12T09:00:00+09:00",
    "  planned_value 1p",
    "",
    "work_event WE_A_FINISH:",
    "  model 1",
    "  task A",
    "  kind finish",
    "  occurred_at 2026-08-12T10:00:00+09:00",
    "  active_time 1h",
    "  effort 1ph",
    "",
  ].join("\n");
}

function git(repository, ...args) {
  const result = spawnSync("git", ["-C", repository, ...args], {
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

function initialize(repository, pathname) {
  git(repository, "init", "--quiet", "-b", "main");
  git(repository, "config", "user.name", "Perttool Test");
  git(repository, "config", "user.email", "perttool@example.invalid");
  git(repository, "add", "--", path.basename(pathname));
  git(repository, "commit", "--quiet", "-m", "baseline");
}

function temporaryPlan(
  t,
  { repository = true, source = baseSource } = {},
) {
  const directory = mkdtempSync(
    path.join(tmpdir(), "perttool-advance-history-cli."),
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const pathname = path.join(directory, "plan.pert");
  writeFileSync(pathname, source, "utf8");
  if (repository) initialize(directory, pathname);
  return { directory, pathname };
}

function run(args, expectedStatus = 0, options = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
  assert.equal(
    result.status,
    expectedStatus,
    `${args.join(" ")}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  return result;
}

function runJson(args, expectedStatus = 0, options = {}) {
  const result = run([...args, "--format=json"], expectedStatus, options);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function realGitPath() {
  const executable = (process.env.PATH ?? "")
    .split(path.delimiter)
    .map((directory) => path.join(directory, "git"))
    .find((candidate) => existsSync(candidate));
  assert.notEqual(executable, undefined, "git executable not found");
  return executable;
}

function raceGitEnvironment(t, directory, pathname, kind) {
  const wrapperDirectory = mkdtempSync(
    path.join(tmpdir(), "perttool-advance-race-git."),
  );
  t.after(() =>
    rmSync(wrapperDirectory, { recursive: true, force: true })
  );
  const wrapper = path.join(wrapperDirectory, "git");
  const state = path.join(wrapperDirectory, "state.json");
  const script = String.raw`#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const {
  existsSync,
  readFileSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const realGit = process.env.PERT_REAL_GIT;
const repository = process.env.PERT_RACE_REPOSITORY;
const target = process.env.PERT_RACE_TARGET;
const statePath = process.env.PERT_RACE_STATE;
const kind = process.env.PERT_RACE_KIND;
const nestedEnvironment = {
  ...process.env,
  GIT_OPTIONAL_LOCKS: "1",
};
const invoke = (nestedArgs) => {
  const nested = spawnSync(realGit, nestedArgs, {
    encoding: null,
    env: nestedEnvironment,
  });
  if (nested.error || nested.status !== 0) {
    process.stderr.write(nested.stderr ?? Buffer.alloc(0));
    process.exit(nested.status ?? 70);
  }
  return nested;
};

const result = spawnSync(realGit, args, {
  encoding: null,
  env: nestedEnvironment,
});
if (result.error) process.exit(70);
process.stdout.write(result.stdout ?? Buffer.alloc(0));
process.stderr.write(result.stderr ?? Buffer.alloc(0));

if (result.status === 0) {
  const counters = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf8"))
    : { root: 0, index: 0 };
  const root =
    args.includes("rev-parse") && args.includes("--show-toplevel");
  const index =
    args.includes("ls-files") && args.includes("--stage");
  if (root) counters.root += 1;
  if (index) counters.index += 1;
  writeFileSync(statePath, JSON.stringify(counters), "utf8");

  if (kind === "source" && root && counters.root === 2) {
    const source = readFileSync(target, "utf8");
    writeFileSync(
      target,
      source.replace('title "next"', 'title "raced next"'),
      "utf8",
    );
  }
  if (kind === "head" && index && counters.index === 2) {
    const marker = path.join(repository, "race.txt");
    writeFileSync(marker, "race\n", "utf8");
    invoke(["-C", repository, "add", "--", "race.txt"]);
    invoke([
      "-C",
      repository,
      "commit",
      "--quiet",
      "-m",
      "race HEAD",
    ]);
  }
  if (kind === "index" && index && counters.index === 2) {
    const source = readFileSync(target, "utf8");
    writeFileSync(
      target,
      source.replace('title "next"', 'title "staged next"'),
      "utf8",
    );
    invoke(["-C", repository, "add", "--", path.basename(target)]);
    writeFileSync(target, source, "utf8");
  }
}
process.exit(result.status ?? 70);
`;
  writeFileSync(wrapper, script, "utf8");
  chmodSync(wrapper, 0o755);
  return {
    ...process.env,
    PATH: `${wrapperDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
    PERT_REAL_GIT: realGitPath(),
    PERT_RACE_REPOSITORY: directory,
    PERT_RACE_TARGET: pathname,
    PERT_RACE_STATE: state,
    PERT_RACE_KIND: kind,
  };
}

test("AHS-001 through AHS-003 preview, out, and no-op avoid Git", (t) => {
  const { directory, pathname } = temporaryPlan(t, { repository: false });
  const preview = runJson(["dag", "advance", pathname]);
  assert.equal(preview.schema_version, "Perttool.AdvanceResult.v2");
  assert.equal(preview.history_guard.status, "not_applicable");
  assert.equal(preview.history_guard.cause, "preview");
  assert.equal(preview.history_guard.repository_snapshot_id, null);
  assert.deepEqual(preview.history_guard.destructive_entity_ids, [
    "DONE",
    "MID",
    "START",
  ]);
  assert.equal(preview.history_guard.source_bytes, Buffer.byteLength(baseSource));
  assert.ok(preview.history_guard.candidate_bytes < preview.history_guard.source_bytes);
  assert.ok(preview.history_guard.diff_removed_lines > 0);

  const output = path.join(directory, "candidate.pert");
  const separate = runJson([
    "dag",
    "advance",
    pathname,
    "--out",
    output,
    "--actor",
    "user",
  ]);
  assert.equal(separate.history_guard.status, "not_applicable");
  assert.equal(separate.history_guard.cause, "separate_output");
  assert.equal(separate.write.written, true);
  assert.equal(readFileSync(output, "utf8"), separate.updated_text);

  const text = run(["dag", "advance", pathname, "--color=never"]);
  assert.match(text.stderr, /^HISTORY_GUARD status=not_applicable cause=preview$/m);
  assert.match(text.stderr, /^HISTORY_CHANGE source_bytes=\d+ candidate_bytes=\d+ added_lines=\d+ removed_lines=\d+$/m);
  assert.match(text.stderr, /^HISTORY_ENTITIES destructive=DONE,MID,START overlapping=-$/m);
});

test("AHS-004 and AHS-007 tracked and retained-dirty writes pass without Git mutation", (t) => {
  for (const retainedDirty of [false, true]) {
    const { directory, pathname } = temporaryPlan(t);
    if (retainedDirty) {
      writeFileSync(
        pathname,
        baseSource.replace('title "next"', 'title "next retained dirty"'),
        "utf8",
      );
    }
    const headBefore = git(directory, "rev-parse", "HEAD");
    const indexBefore = git(directory, "ls-files", "--stage", "--", "plan.pert");
    const result = runJson([
      "dag",
      "advance",
      pathname,
      "--write",
      "--actor",
      "user",
    ]);
    assert.equal(result.ok, true);
    assert.equal(result.write.written, true);
    assert.equal(result.history_guard.status, "passed");
    assert.equal(result.history_guard.cause, "baseline_matches");
    assert.equal(result.history_guard.repository_relative_path, "plan.pert");
    assert.match(result.history_guard.head_commit_id, /^[0-9a-f]{40,64}$/);
    assert.equal(git(directory, "rev-parse", "HEAD"), headBefore);
    assert.equal(
      git(directory, "ls-files", "--stage", "--", "plan.pert"),
      indexBefore,
    );
    if (retainedDirty) {
      assert.match(readFileSync(pathname, "utf8"), /next retained dirty/);
    }

    const repeated = runJson(["dag", "advance", pathname, "--write"]);
    assert.equal(repeated.changed, false);
    assert.equal(repeated.write.written, false);
    assert.equal(repeated.history_guard.status, "not_applicable");
    assert.equal(repeated.history_guard.cause, "no_change");
  }
});

test("Issue 9 EOF receipt candidate is identical across preview, out, and write", (t) => {
  const { directory, pathname } = temporaryPlan(t, {
    source: terminalReceiptSource(),
  });
  const preview = runJson(["dag", "advance", pathname]);
  assert.equal(preview.ok, true);
  assert.match(preview.updated_text, /assurance_receipt AR_A:/);
  assert.doesNotMatch(preview.updated_text, /work_event WE_A_/);

  const output = path.join(directory, "candidate.pert");
  const separate = runJson([
    "dag", "advance", pathname, "--out", output, "--actor", "user",
  ]);
  assert.equal(separate.ok, true);
  assert.equal(separate.updated_text, preview.updated_text);
  assert.equal(readFileSync(output, "utf8"), preview.updated_text);

  const written = runJson([
    "dag", "advance", pathname, "--write", "--actor", "user",
  ]);
  assert.equal(written.ok, true);
  assert.equal(written.updated_text, preview.updated_text);
  assert.equal(readFileSync(pathname, "utf8"), preview.updated_text);
});

test("AHS-005, AHS-006, and AHS-007 destructive overlap blocks while retained staged syntax passes", (t) => {
  {
    const { pathname } = temporaryPlan(t);
    const dirty = baseSource.replace('title "done"', 'title "changed done"');
    writeFileSync(pathname, dirty, "utf8");
    const blocked = runJson([
      "dag",
      "advance",
      pathname,
      "--write",
      "--actor",
      "user",
    ], 1);
    assert.equal(blocked.history_guard.status, "blocked");
    assert.equal(blocked.history_guard.cause, "destructive_overlap");
    assert.deepEqual(blocked.history_guard.overlapping_entity_ids, ["DONE"]);
    assert.equal(blocked.diagnostics.at(-1).code, "PTADV-101");
    assert.equal(readFileSync(pathname, "utf8"), dirty);

    const forced = runJson([
      "dag",
      "advance",
      pathname,
      "--write",
      "--actor",
      "user",
      "--force-history-loss",
    ]);
    assert.equal(forced.history_guard.status, "forced");
    assert.equal(forced.history_guard.cause, "forced_by_option");
    assert.deepEqual(forced.history_guard.overlapping_entity_ids, ["DONE"]);
    assert.equal(forced.write.written, true);
  }

  {
    const { directory, pathname } = temporaryPlan(t);
    writeFileSync(
      pathname,
      baseSource.replace('title "done"', 'title "staged done"'),
      "utf8",
    );
    git(directory, "add", "--", "plan.pert");
    writeFileSync(pathname, baseSource, "utf8");
    const blocked = runJson([
      "dag",
      "advance",
      pathname,
      "--write",
      "--actor",
      "user",
    ], 1);
    assert.equal(blocked.history_guard.cause, "destructive_overlap");
    assert.deepEqual(blocked.history_guard.overlapping_entity_ids, ["DONE"]);
    assert.equal(readFileSync(pathname, "utf8"), baseSource);
  }

  {
    const { directory, pathname } = temporaryPlan(t);
    const invalidRetained = baseSource.replace(
      'title "next"',
      "  invalid staged syntax",
    );
    writeFileSync(pathname, invalidRetained, "utf8");
    git(directory, "add", "--", "plan.pert");
    writeFileSync(pathname, baseSource, "utf8");
    const passed = runJson([
      "dag",
      "advance",
      pathname,
      "--write",
      "--actor",
      "user",
    ]);
    assert.equal(passed.history_guard.status, "passed");
    assert.equal(passed.write.written, true);
  }
});

test("AHS-010 and AHS-015 unavailable proof blocks while force preserves warning policy", (t) => {
  const blockedPlan = temporaryPlan(t, { repository: false });
  const blocked = runJson([
    "dag",
    "advance",
    blockedPlan.pathname,
    "--write",
    "--actor",
    "user",
  ], 1);
  assert.equal(blocked.history_guard.status, "blocked");
  assert.equal(blocked.history_guard.cause, "no_repository");
  assert.deepEqual(blocked.diagnostics.at(-1).data.entity_ids, [
    "DONE",
    "MID",
    "START",
  ]);
  assert.equal(readFileSync(blockedPlan.pathname, "utf8"), baseSource);
  const blockedText = run([
    "dag",
    "advance",
    blockedPlan.pathname,
    "--write",
    "--actor",
    "user",
    "--color=never",
  ], 1);
  assert.equal(blockedText.stdout, "");
  assert.match(blockedText.stderr, /^ADVANCE removed_tasks=DONE /m);
  assert.match(
    blockedText.stderr,
    /^HISTORY_GUARD status=blocked cause=no_repository$/m,
  );
  assert.match(
    blockedText.stderr,
    /^HISTORY_CHANGE source_bytes=\d+ candidate_bytes=\d+ added_lines=\d+ removed_lines=\d+$/m,
  );

  const forcedPlan = temporaryPlan(t, { repository: false });
  const forced = runJson([
    "dag",
    "advance",
    forcedPlan.pathname,
    "--write",
    "--actor",
    "user",
    "--force-history-loss",
  ]);
  assert.equal(forced.history_guard.status, "forced");
  assert.equal(forced.history_guard.cause, "forced_by_option");
  assert.equal(forced.history_guard.force_requested, true);
  assert.equal(forced.diagnostics.at(-1).code, "PTADV-103");
  assert.deepEqual(forced.diagnostics.at(-1).data.entity_ids, [
    "DONE",
    "MID",
    "START",
  ]);
  assert.equal(forced.write.written, true);

  const strictPlan = temporaryPlan(t, { repository: false });
  const strict = runJson([
    "dag",
    "advance",
    strictPlan.pathname,
    "--write",
    "--actor",
    "user",
    "--force-history-loss",
    "--warnings-as-errors",
  ], 1);
  assert.equal(strict.history_guard.status, "forced");
  assert.equal(strict.write.written, false);
  assert.equal(readFileSync(strictPlan.pathname, "utf8"), baseSource);
});

test("AHS-015 governance denial precedes Git and force option usage is closed", (t) => {
  const { pathname } = temporaryPlan(t, { repository: false });
  const denied = runJson([
    "dag",
    "advance",
    pathname,
    "--write",
    "--actor",
    "codex",
  ], 1);
  assert.equal(denied.history_guard.status, "not_applicable");
  assert.equal(denied.history_guard.cause, "authority_denied");
  assert.ok(denied.diagnostics.some(({ code }) => code === "PTGOV-101"));
  assert.equal(
    denied.diagnostics.some(({ code }) => code === "PTADV-101"),
    false,
  );

  for (const args of [
    ["dag", "advance", pathname, "--force-history-loss"],
    ["dag", "advance", pathname, "--diff", "--force-history-loss"],
    ["dag", "advance", pathname, "--out", `${pathname}.out`, "--force-history-loss"],
    ["dag", "advance", "-", "--write", "--force-history-loss"],
  ]) {
    const input = args.includes("-") ? { input: baseSource } : {};
    const usage = runJson(args, 2, input);
    assert.equal(usage.schema_version, "Perttool.CliError.v1");
    assert.equal(usage.diagnostics[0].code, "PTCLI-001");
  }
});

async function preparePassingGuard(pathname) {
  const planned = planAdvance(baseSource, {
    governance: {
      intent: "persist",
      actor: "user",
    },
  });
  const prepared = await prepareAdvanceHistory(
    baseSource,
    planned,
    {
      mode: "in_place",
      sourceBytes: Buffer.from(baseSource, "utf8"),
      sourceModifiedAt: statSync(pathname).mtime.toISOString(),
      targetPath: pathname,
    },
  );
  assert.equal(prepared.result.historyGuard.status, "passed");
  assert.notEqual(prepared.baseline, null);
  return prepared;
}

test("AHS-016 and AHS-017 application rechecks become PTADV-102", async (t) => {
  for (const expectedCause of [
    "target_changed",
    "head_changed",
    "index_changed",
  ]) {
    const { directory, pathname } = temporaryPlan(t);
    const prepared = await preparePassingGuard(pathname);
    if (expectedCause === "target_changed") {
      writeFileSync(
        pathname,
        baseSource.replace('title "next"', 'title "raced next"'),
        "utf8",
      );
    } else if (expectedCause === "head_changed") {
      writeFileSync(path.join(directory, "marker.txt"), "changed HEAD\n", "utf8");
      git(directory, "add", "--", "marker.txt");
      git(directory, "commit", "--quiet", "-m", "change HEAD");
    } else {
      writeFileSync(
        pathname,
        baseSource.replace('title "next"', 'title "staged next"'),
        "utf8",
      );
      git(directory, "add", "--", "plan.pert");
      writeFileSync(pathname, baseSource, "utf8");
    }
    const recheck = await recheckAdvanceHistoryBaseline(
      prepared.baseline,
      pathname,
    );
    assert.equal(recheck.ok, false);
    assert.equal(recheck.cause, expectedCause);
    const raced = withAdvanceHistoryRace(prepared.result, recheck);
    assert.equal(raced.ok, false);
    assert.equal(raced.diagnostics.at(-1).code, "PTADV-102");
  }
});

test("AHS-008 and AHS-009 owned comments and work events block at the CLI", (t) => {
  {
    const { pathname } = temporaryPlan(t);
    const changed = baseSource.replace("# owned", "# uncommitted owned");
    writeFileSync(pathname, changed, "utf8");
    const blocked = runJson([
      "dag",
      "advance",
      pathname,
      "--write",
      "--actor",
      "user",
    ], 1);
    assert.equal(blocked.history_guard.status, "blocked");
    assert.equal(blocked.history_guard.cause, "destructive_overlap");
    assert.deepEqual(blocked.history_guard.overlapping_entity_ids, ["DONE"]);
    assert.equal(blocked.write.written, false);
    assert.equal(readFileSync(pathname, "utf8"), changed);
  }

  {
    const plannedSource = baseSource.replace("  status done\n", "");
    const { pathname } = temporaryPlan(t, { source: plannedSource });
    const started = runJson([
      "task",
      "start",
      pathname,
      "DONE",
      "--at",
      "2026-07-31T09:00:00+09:00",
      "--write",
    ]);
    assert.equal(started.write.written, true);
    const finished = runJson([
      "task",
      "finish",
      pathname,
      "DONE",
      "--at",
      "2026-07-31T10:00:00+09:00",
      "--active-time",
      "1h",
      "--effort",
      "1ph",
      "--write",
    ]);
    assert.equal(finished.write.written, true);
    const before = readFileSync(pathname, "utf8");
    const blocked = runJson([
      "dag",
      "advance",
      pathname,
      "--write",
      "--actor",
      "user",
    ], 1);
    assert.equal(blocked.history_guard.status, "blocked");
    assert.equal(blocked.history_guard.cause, "correspondence_missing");
    assert.ok(
      blocked.history_guard.destructive_entity_ids.some((id) =>
        id.startsWith("WE-")
      ),
    );
    assert.equal(blocked.write.written, false);
    assert.equal(readFileSync(pathname, "utf8"), before);
  }
});

test("AHS-010, AHS-011, and AHS-013 unavailable repositories and paths fail closed", (t) => {
  {
    const { directory, pathname } = temporaryPlan(t, {
      repository: false,
    });
    git(directory, "init", "--quiet", "-b", "main");
    const blocked = runJson([
      "dag",
      "advance",
      pathname,
      "--write",
      "--actor",
      "user",
    ], 1);
    assert.equal(blocked.history_guard.cause, "no_head");
    assert.equal(blocked.write.written, false);
  }

  {
    const { directory, pathname } = temporaryPlan(t, {
      repository: false,
    });
    git(directory, "init", "--quiet", "-b", "main");
    git(directory, "config", "user.name", "Perttool Test");
    git(directory, "config", "user.email", "perttool@example.invalid");
    writeFileSync(path.join(directory, "marker.txt"), "tracked\n", "utf8");
    git(directory, "add", "--", "marker.txt");
    git(directory, "commit", "--quiet", "-m", "tracked marker");
    const blocked = runJson([
      "dag",
      "advance",
      pathname,
      "--write",
      "--actor",
      "user",
    ], 1);
    assert.equal(blocked.history_guard.cause, "untracked_target");
    assert.equal(blocked.write.written, false);
  }

  {
    const { directory, pathname } = temporaryPlan(t);
    git(directory, "branch", "side");
    git(directory, "switch", "--quiet", "side");
    writeFileSync(
      pathname,
      baseSource.replace('title "done"', 'title "side done"'),
      "utf8",
    );
    git(directory, "add", "--", "plan.pert");
    git(directory, "commit", "--quiet", "-m", "side");
    git(directory, "switch", "--quiet", "main");
    writeFileSync(
      pathname,
      baseSource.replace('title "done"', 'title "main done"'),
      "utf8",
    );
    git(directory, "add", "--", "plan.pert");
    git(directory, "commit", "--quiet", "-m", "main");
    const merge = spawnSync(
      "git",
      ["-C", directory, "merge", "side"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_TERMINAL_PROMPT: "0",
          LC_ALL: "C",
        },
      },
    );
    assert.equal(merge.status, 1);
    writeFileSync(pathname, baseSource, "utf8");
    const blocked = runJson([
      "dag",
      "advance",
      pathname,
      "--write",
      "--actor",
      "user",
    ], 1);
    assert.equal(blocked.history_guard.cause, "unmerged_index");
    assert.equal(blocked.write.written, false);
  }

  {
    const { directory, pathname } = temporaryPlan(t);
    git(directory, "mv", "plan.pert", "renamed.pert");
    const renamed = path.join(directory, "renamed.pert");
    const blocked = runJson([
      "dag",
      "advance",
      renamed,
      "--write",
      "--actor",
      "user",
    ], 1);
    assert.ok(
      ["untracked_target", "ambiguous_path"].includes(
        blocked.history_guard.cause,
      ),
    );
    assert.equal(blocked.write.written, false);
    assert.equal(readFileSync(renamed, "utf8"), baseSource);
    assert.equal(existsSync(pathname), false);
  }
});

test("AHS-012 linked worktree and AHS-014 BOM/CRLF writes pass exactly", (t) => {
  {
    const { directory } = temporaryPlan(t);
    const worktreeParent = mkdtempSync(
      path.join(tmpdir(), "perttool-advance-linked-parent."),
    );
    const worktree = path.join(worktreeParent, "linked");
    t.after(() => {
      spawnSync(
        "git",
        ["-C", directory, "worktree", "remove", "--force", worktree],
        { encoding: "utf8" },
      );
      rmSync(worktreeParent, { recursive: true, force: true });
    });
    git(directory, "branch", "linked");
    git(directory, "worktree", "add", "--quiet", worktree, "linked");
    const linkedPlan = path.join(worktree, "plan.pert");
    const headBefore = git(worktree, "rev-parse", "HEAD");
    const indexBefore = git(
      worktree,
      "ls-files",
      "--stage",
      "--",
      "plan.pert",
    );
    const advanced = runJson([
      "dag",
      "advance",
      linkedPlan,
      "--write",
      "--actor",
      "user",
    ]);
    assert.equal(advanced.history_guard.status, "passed");
    assert.equal(
      advanced.history_guard.repository_relative_path,
      "plan.pert",
    );
    assert.equal(git(worktree, "rev-parse", "HEAD"), headBefore);
    assert.equal(
      git(worktree, "ls-files", "--stage", "--", "plan.pert"),
      indexBefore,
    );
  }

  {
    const rawSource = `\uFEFF${baseSource.replaceAll("\n", "\r\n")}`;
    const { pathname } = temporaryPlan(t, { source: rawSource });
    const advanced = runJson([
      "dag",
      "advance",
      pathname,
      "--write",
      "--actor",
      "user",
    ]);
    assert.equal(advanced.history_guard.status, "passed");
    assert.equal(advanced.history_guard.source_bytes, Buffer.byteLength(rawSource));
    assert.ok(advanced.updated_text.startsWith("\uFEFF"));
    assert.ok(advanced.updated_text.includes("\r\n"));
    assert.equal(
      advanced.updated_text.replaceAll("\r\n", "").includes("\n"),
      false,
    );
    assert.equal(readFileSync(pathname, "utf8"), advanced.updated_text);
  }
});

test("AHS-016 and AHS-017 CLI races return exit 5 without candidate writes", (t) => {
  for (const kind of ["source", "head", "index"]) {
    const { directory, pathname } = temporaryPlan(t);
    const raced = runJson([
      "dag",
      "advance",
      pathname,
      "--write",
      "--actor",
      "user",
    ], 5, {
      env: raceGitEnvironment(t, directory, pathname, kind),
    });
    assert.equal(raced.ok, false);
    assert.equal(raced.write.written, false);
    assert.equal(raced.diagnostics.at(-1).code, "PTADV-102");
    assert.equal(
      raced.diagnostics.at(-1).data.cause,
      kind === "source" ? "target_changed" : `${kind}_changed`,
    );
    assert.doesNotMatch(
      readFileSync(pathname, "utf8"),
      /^milestone MID:[\s\S]*state reached/m,
    );
  }
});
