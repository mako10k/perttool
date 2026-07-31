import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
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
import {
  prepareAdvanceHistory,
  withAdvanceHistoryRace,
} from "../dist/application/advance-history.js";
import {
  recheckAdvanceHistoryBaseline,
} from "../dist/history/git-probe.js";

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

function temporaryPlan(t, { repository = true } = {}) {
  const directory = mkdtempSync(
    path.join(tmpdir(), "perttool-advance-history-cli."),
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const pathname = path.join(directory, "plan.pert");
  writeFileSync(pathname, baseSource, "utf8");
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

test("preview and separate output expose AdvanceResult without Git", (t) => {
  const { directory, pathname } = temporaryPlan(t, { repository: false });
  const preview = runJson(["dag", "advance", pathname]);
  assert.equal(preview.schema_version, "Perttool.AdvanceResult.v1");
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

test("clean and retained-dirty tracked advances pass without Git mutation", (t) => {
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

test("unstaged and staged destructive edits block while retained staged syntax passes", (t) => {
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

test("unavailable proof blocks, force warns, and strict force never writes", (t) => {
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

test("governance denial precedes Git and force option usage is closed", (t) => {
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

test("post-assessment source, HEAD, and index rechecks become PTADV-102", async (t) => {
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
