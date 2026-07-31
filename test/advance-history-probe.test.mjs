import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  checkDocument,
  planAdvance,
} from "../dist/index.js";
import {
  ADVANCE_HISTORY_SAFETY_MODEL_VERSION,
  assessAdvanceHistorySafety,
  deriveAdvanceDestructiveRecords,
  rawByteEditsV1,
} from "../dist/history/advance-history.js";
import {
  ADVANCE_HISTORY_BASELINE_MODEL_VERSION,
  captureAdvanceHistoryBaseline,
} from "../dist/history/git-probe.js";
import {
  digestDocumentBytes,
  documentContentFromBytes,
} from "../dist/io/document-file.js";
import { parseDocument } from "../dist/parser/document-parser.js";

const encoder = new TextEncoder();

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
  const result = spawnSync(
    "git",
    ["-C", repository, ...args],
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
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")}: ${result.stderr}`,
  );
  return result.stdout.trim();
}

function initialize(repository) {
  git(repository, "init", "-b", "main");
  git(repository, "config", "user.name", "Perttool Test");
  git(repository, "config", "user.email", "perttool@example.invalid");
}

let commitSequence = 0;

function commit(repository, message) {
  commitSequence += 1;
  git(repository, "add", "-A");
  const minute = String(commitSequence % 60).padStart(2, "0");
  const recordedAt = `2026-07-31T12:${minute}:00+09:00`;
  const result = spawnSync(
    "git",
    ["-C", repository, "commit", "-m", message],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: recordedAt,
        GIT_COMMITTER_DATE: recordedAt,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_TERMINAL_PROMPT: "0",
        LC_ALL: "C",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return git(repository, "rev-parse", "HEAD");
}

async function write(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}

async function temporaryRepository(t) {
  const root = await mkdtemp(join(tmpdir(), "perttool-advance-history."));
  t.after(() => rm(root, { recursive: true, force: true }));
  initialize(root);
  return root;
}

async function gitState(repository) {
  const gitDirectory = git(
    repository,
    "rev-parse",
    "--path-format=absolute",
    "--git-dir",
  );
  return {
    head: git(repository, "rev-parse", "HEAD"),
    refs: git(
      repository,
      "for-each-ref",
      "--format=%(refname):%(objectname)",
    ),
    status: git(
      repository,
      "status",
      "--porcelain=v2",
      "--untracked-files=all",
    ),
    index: await readFile(join(gitDirectory, "index")),
  };
}

function planRecords(source) {
  const checked = checkDocument(source);
  const advanced = planAdvance(source);
  assert.equal(checked.ok, true);
  assert.equal(advanced.ok, true);
  assert.ok(advanced.advance);
  return {
    document: checked.document,
    records: deriveAdvanceDestructiveRecords(
      source,
      checked.document,
      advanced.advance,
    ),
  };
}

function assess(currentText, headText, indexText) {
  const current = planRecords(currentText);
  const head = checkDocument(headText);
  assert.equal(head.ok, true);
  return assessAdvanceHistorySafety({
    currentText,
    currentDocument: current.document,
    currentSource: encoder.encode(currentText),
    headText,
    headDocument: head.document,
    headSource: encoder.encode(headText),
    indexSource: encoder.encode(indexText),
    destructiveRecords: current.records,
  });
}

test("raw-byte model 1 produces deterministic shortest edits", () => {
  assert.deepEqual(
    rawByteEditsV1(encoder.encode("abc"), encoder.encode("aXbc")),
    [{ startOffset: 1, endOffset: 1, insertedBytes: 1 }],
  );
  assert.deepEqual(
    rawByteEditsV1(encoder.encode("abc"), encoder.encode("ac")),
    [{ startOffset: 1, endOffset: 2, insertedBytes: 0 }],
  );
  assert.deepEqual(
    rawByteEditsV1(encoder.encode("abc"), encoder.encode("aXc")),
    [{ startOffset: 1, endOffset: 2, insertedBytes: 1 }],
  );
  assert.deepEqual(
    rawByteEditsV1(encoder.encode("aaaa"), encoder.encode("aaXaa")),
    [{ startOffset: 2, endOffset: 2, insertedBytes: 1 }],
  );
});

test("raw-byte model 1 is minimal for every short binary sequence", () => {
  function sequences(maximumLength) {
    const values = [];
    for (let length = 0; length <= maximumLength; length += 1) {
      for (let value = 0; value < 2 ** length; value += 1) {
        values.push(Uint8Array.from(
          Array.from(
            { length },
            (_, index) => (value >> index) & 1,
          ),
        ));
      }
    }
    return values;
  }

  function lcsLength(left, right) {
    const rows = Array.from(
      { length: left.length + 1 },
      () => Array(right.length + 1).fill(0),
    );
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      for (
        let rightIndex = 1;
        rightIndex <= right.length;
        rightIndex += 1
      ) {
        rows[leftIndex][rightIndex] =
          left[leftIndex - 1] === right[rightIndex - 1]
            ? rows[leftIndex - 1][rightIndex - 1] + 1
            : Math.max(
                rows[leftIndex - 1][rightIndex],
                rows[leftIndex][rightIndex - 1],
              );
      }
    }
    return rows[left.length][right.length];
  }

  const values = sequences(5);
  for (const before of values) {
    for (const after of values) {
      const edits = rawByteEditsV1(before, after);
      const cost = edits.reduce(
        (total, edit) =>
          total +
          edit.endOffset -
          edit.startOffset +
          edit.insertedBytes,
        0,
      );
      assert.equal(
        cost,
        before.length +
          after.length -
          2 * lcsLength(before, after),
      );
      for (let index = 1; index < edits.length; index += 1) {
        assert.ok(
          edits[index - 1].endOffset <= edits[index].startOffset,
        );
      }
    }
  }
});

test("pure assessment distinguishes destructive and retained dirty ranges", () => {
  const passed = assess(baseSource, baseSource, baseSource);
  assert.deepEqual(passed, {
    modelVersion: ADVANCE_HISTORY_SAFETY_MODEL_VERSION,
    status: "passed",
    cause: "baseline_matches",
    destructiveEntityIds: ["DONE", "MID", "START"],
    overlappingEntityIds: [],
  });

  const changedDone = baseSource.replace(
    'title "done"',
    'title "changed done"',
  );
  assert.deepEqual(assess(changedDone, baseSource, baseSource), {
    modelVersion: ADVANCE_HISTORY_SAFETY_MODEL_VERSION,
    status: "blocked",
    cause: "destructive_overlap",
    destructiveEntityIds: ["DONE", "MID", "START"],
    overlappingEntityIds: ["DONE"],
  });

  const changedComment = baseSource.replace("# owned", "# changed");
  assert.deepEqual(
    assess(changedComment, baseSource, baseSource).overlappingEntityIds,
    ["DONE"],
  );

  const changedRetained = baseSource.replace(
    'title "next"',
    'title "changed next"',
  );
  const invalidStagedRetained = baseSource.replace(
    'title "next"',
    "  invalid staged syntax",
  );
  assert.equal(
    assess(changedRetained, baseSource, invalidStagedRetained).status,
    "passed",
  );

  const stagedDone = baseSource.replace(
    'title "done"',
    'title "staged done"',
  );
  assert.deepEqual(
    assess(baseSource, baseSource, stagedDone).overlappingEntityIds,
    ["DONE"],
  );
});

test("pure assessment covers correspondence, BOM, and CRLF", () => {
  const event = [
    "",
    "work_event WE-uncommitted:",
    "  model 1",
    "  task DONE",
    "  kind finish",
    "  occurred_at 2026-07-31T12:00:00+09:00",
    "",
  ].join("\n");
  const currentText = `${baseSource}${event}`;
  const currentDocument = parseDocument(currentText).document;
  const headDocument = parseDocument(baseSource).document;
  const records = deriveAdvanceDestructiveRecords(
    currentText,
    currentDocument,
    {
      removedTaskIds: [],
      removedGateIds: [],
      removedMilestoneIds: [],
      removedWorkEventIds: ["WE-uncommitted"],
      stateChangedMilestoneIds: [],
    },
  );
  const missing = assessAdvanceHistorySafety({
    currentText,
    currentDocument,
    currentSource: encoder.encode(currentText),
    headText: baseSource,
    headDocument,
    headSource: encoder.encode(baseSource),
    indexSource: encoder.encode(baseSource),
    destructiveRecords: records,
  });
  assert.equal(missing.status, "blocked");
  assert.equal(missing.cause, "correspondence_missing");

  const bomCrlf = `\uFEFF${baseSource.replaceAll("\n", "\r\n")}`;
  assert.equal(assess(bomCrlf, bomCrlf, bomCrlf).status, "passed");
});

test("baseline capture binds HEAD, stage-0 index, source, and Git state", async (t) => {
  const repository = await temporaryRepository(t);
  const plan = join(repository, "plans", "demo.pert");
  await write(plan, baseSource);
  const head = commit(repository, "add plan");
  const dirtyRetained = baseSource.replace(
    'title "next"',
    'title "dirty next"',
  );
  await write(plan, dirtyRetained);

  const before = await gitState(repository);
  const capture = await captureAdvanceHistoryBaseline({
    targetPath: plan,
    expectedSourceDigest: digestDocumentBytes(
      encoder.encode(dirtyRetained),
    ),
  });
  const after = await gitState(repository);

  assert.equal(capture.status, "complete");
  assert.equal(
    capture.modelVersion,
    ADVANCE_HISTORY_BASELINE_MODEL_VERSION,
  );
  assert.equal(capture.repositoryRelativePath, "plans/demo.pert");
  assert.equal(capture.headCommitId, head);
  assert.equal(capture.objectFormat, "sha1");
  assert.equal(
    documentContentFromBytes(capture.currentSource).text,
    dirtyRetained,
  );
  assert.equal(
    documentContentFromBytes(capture.headSource).text,
    baseSource,
  );
  assert.equal(
    documentContentFromBytes(capture.indexSource).text,
    baseSource,
  );
  assert.match(capture.sourceModifiedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(after, before);

  const current = documentContentFromBytes(capture.currentSource);
  const baseline = documentContentFromBytes(capture.headSource);
  const currentPlan = planRecords(current.text);
  const headCheck = checkDocument(baseline.text);
  assert.equal(headCheck.ok, true);
  assert.equal(
    assessAdvanceHistorySafety({
      currentText: current.text,
      currentDocument: currentPlan.document,
      currentSource: capture.currentSource,
      headText: baseline.text,
      headDocument: headCheck.document,
      headSource: capture.headSource,
      indexSource: capture.indexSource,
      destructiveRecords: currentPlan.records,
    }).status,
    "passed",
  );
});

test("baseline capture preserves staged evidence outside and inside destructive ranges", async (t) => {
  const repository = await temporaryRepository(t);
  const plan = join(repository, "plan.pert");
  await write(plan, baseSource);
  commit(repository, "add plan");

  const invalidRetained = baseSource.replace(
    'title "next"',
    "  invalid staged syntax",
  );
  await write(plan, invalidRetained);
  git(repository, "add", "plan.pert");
  await write(plan, baseSource);
  const retainedCapture = await captureAdvanceHistoryBaseline({
    targetPath: plan,
  });
  assert.equal(retainedCapture.status, "complete");
  const sourcePlan = planRecords(baseSource);
  const head = checkDocument(baseSource);
  assert.equal(
    assessAdvanceHistorySafety({
      currentText: baseSource,
      currentDocument: sourcePlan.document,
      currentSource: retainedCapture.currentSource,
      headText: baseSource,
      headDocument: head.document,
      headSource: retainedCapture.headSource,
      indexSource: retainedCapture.indexSource,
      destructiveRecords: sourcePlan.records,
    }).status,
    "passed",
  );

  const stagedDone = baseSource.replace(
    'title "done"',
    'title "staged done"',
  );
  await write(plan, stagedDone);
  git(repository, "add", "plan.pert");
  await write(plan, baseSource);
  const overlapCapture = await captureAdvanceHistoryBaseline({
    targetPath: plan,
  });
  assert.equal(overlapCapture.status, "complete");
  assert.deepEqual(
    assessAdvanceHistorySafety({
      currentText: baseSource,
      currentDocument: sourcePlan.document,
      currentSource: overlapCapture.currentSource,
      headText: baseSource,
      headDocument: head.document,
      headSource: overlapCapture.headSource,
      indexSource: overlapCapture.indexSource,
      destructiveRecords: sourcePlan.records,
    }).overlappingEntityIds,
    ["DONE"],
  );
});

test("baseline capture fails closed for unavailable and ambiguous inputs", async (t) => {
  const outside = await mkdtemp(join(tmpdir(), "perttool-advance-outside."));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const outsidePlan = join(outside, "plan.pert");
  await write(outsidePlan, baseSource);
  assert.equal(
    (await captureAdvanceHistoryBaseline({
      targetPath: outsidePlan,
    })).cause,
    "no_repository",
  );

  const empty = await temporaryRepository(t);
  const emptyPlan = join(empty, "plan.pert");
  await write(emptyPlan, baseSource);
  assert.equal(
    (await captureAdvanceHistoryBaseline({
      targetPath: emptyPlan,
    })).cause,
    "no_head",
  );

  const repository = await temporaryRepository(t);
  const tracked = join(repository, "tracked.pert");
  await write(tracked, baseSource);
  commit(repository, "tracked");
  const untracked = join(repository, "untracked.pert");
  await write(untracked, baseSource);
  assert.equal(
    (await captureAdvanceHistoryBaseline({
      targetPath: untracked,
    })).cause,
    "untracked_target",
  );
  assert.equal(
    (await captureAdvanceHistoryBaseline(
      { targetPath: tracked },
      { gitExecutable: join(repository, "missing-git") },
    )).cause,
    "git_unavailable",
  );
  assert.equal(
    (await captureAdvanceHistoryBaseline({
      targetPath: tracked,
      expectedSourceDigest: `sha256:${"0".repeat(64)}`,
    })).cause,
    "target_changed",
  );

  const renamed = join(repository, "renamed.pert");
  git(repository, "mv", "tracked.pert", "renamed.pert");
  assert.equal(
    (await captureAdvanceHistoryBaseline({
      targetPath: renamed,
    })).cause,
    "untracked_target",
  );
});

test("baseline capture rejects symlinks and supports SHA-256 objects", async (t) => {
  const repository = await temporaryRepository(t);
  const tracked = join(repository, "tracked.pert");
  await write(tracked, baseSource);
  commit(repository, "tracked");
  const linked = join(repository, "linked.pert");
  await symlink(tracked, linked);
  assert.equal(
    (await captureAdvanceHistoryBaseline({
      targetPath: linked,
    })).cause,
    "ambiguous_path",
  );

  const sha256 = await mkdtemp(
    join(tmpdir(), "perttool-advance-sha256."),
  );
  t.after(() => rm(sha256, { recursive: true, force: true }));
  git(sha256, "init", "--object-format=sha256", "-b", "main");
  git(sha256, "config", "user.name", "Perttool Test");
  git(sha256, "config", "user.email", "perttool@example.invalid");
  const sha256Plan = join(sha256, "plan.pert");
  await write(sha256Plan, baseSource);
  const head = commit(sha256, "sha256 plan");
  const captured = await captureAdvanceHistoryBaseline({
    targetPath: sha256Plan,
  });
  assert.equal(captured.status, "complete");
  assert.equal(captured.objectFormat, "sha256");
  assert.equal(captured.headCommitId, head);
  assert.equal(captured.headBlobId.length, 64);
  assert.equal(captured.indexBlobId.length, 64);
});

test("baseline capture supports linked worktrees and rejects unmerged index", async (t) => {
  const repository = await temporaryRepository(t);
  const plan = join(repository, "plan.pert");
  await write(plan, baseSource);
  commit(repository, "base");

  const worktreeRoot = await mkdtemp(
    join(tmpdir(), "perttool-advance-worktree."),
  );
  await rm(worktreeRoot, { recursive: true, force: true });
  t.after(() => {
    spawnSync(
      "git",
      ["-C", repository, "worktree", "remove", "--force", worktreeRoot],
      { encoding: "utf8" },
    );
  });
  git(repository, "branch", "probe-worktree");
  git(repository, "worktree", "add", worktreeRoot, "probe-worktree");
  const worktree = await captureAdvanceHistoryBaseline({
    targetPath: join(worktreeRoot, "plan.pert"),
  });
  assert.equal(worktree.status, "complete");
  assert.equal(worktree.repositoryRelativePath, "plan.pert");

  git(repository, "switch", "-c", "side");
  await write(
    plan,
    baseSource.replace('title "done"', 'title "side"'),
  );
  commit(repository, "side");
  git(repository, "switch", "main");
  await write(
    plan,
    baseSource.replace('title "done"', 'title "main"'),
  );
  commit(repository, "main");
  const merge = spawnSync(
    "git",
    ["-C", repository, "merge", "side"],
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
  assert.equal(
    (await captureAdvanceHistoryBaseline({
      targetPath: plan,
    })).cause,
    "unmerged_index",
  );
});

test("baseline capture detects source, HEAD, and index races", async (t) => {
  const repository = await temporaryRepository(t);
  const plan = join(repository, "plan.pert");
  await write(plan, baseSource);
  commit(repository, "base");

  const sourceRace = await captureAdvanceHistoryBaseline(
    { targetPath: plan },
    {
      afterCapture: async () => {
        await write(plan, `${baseSource}# changed\n`);
      },
    },
  );
  assert.equal(sourceRace.cause, "target_changed");
  await write(plan, baseSource);

  const headRace = await captureAdvanceHistoryBaseline(
    { targetPath: plan },
    {
      afterCapture: async () => {
        await write(join(repository, "race.txt"), "race\n");
        commit(repository, "move head");
      },
    },
  );
  assert.equal(headRace.cause, "head_changed");

  const indexRace = await captureAdvanceHistoryBaseline(
    { targetPath: plan },
    {
      afterCapture: async () => {
        await write(
          plan,
          baseSource.replace('title "done"', 'title "index race"'),
        );
        git(repository, "add", "plan.pert");
      },
    },
  );
  assert.equal(indexRace.cause, "index_changed");
});

test("advance history probe remains outside the active package root", async () => {
  for (const name of [
    "ADVANCE_HISTORY_SAFETY_MODEL_VERSION",
    "assessAdvanceHistorySafety",
    "captureAdvanceHistoryBaseline",
    "deriveAdvanceDestructiveRecords",
    "rawByteEditsV1",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
  const declarations = await readFile(
    new URL("../dist/index.d.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(declarations, /AdvanceHistoryBaseline/);
  assert.doesNotMatch(declarations, /AdvanceHistoryAssessment/);
});
