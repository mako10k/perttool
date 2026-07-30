import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
import { pathToFileURL } from "node:url";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  GIT_HISTORY_PROBE_MODEL_VERSION,
  parseGitCommitMetadata,
  probeGitHistory,
} from "../dist/history/git-probe.js";
import { digestDocumentBytes } from "../dist/io/document-file.js";

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
  const recordedAt = `2026-07-28T12:${minute}:00+09:00`;
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
  const root = await mkdtemp(join(tmpdir(), "perttool-git-probe."));
  t.after(() => rm(root, { recursive: true, force: true }));
  initialize(root);
  return root;
}

function bufferDigest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function gitState(repository) {
  const gitDirectory = git(
    repository,
    "rev-parse",
    "--path-format=absolute",
    "--git-dir",
  );
  let indexDigest = null;
  try {
    indexDigest = bufferDigest(await readFile(join(gitDirectory, "index")));
  } catch (error) {
    assert.equal(error.code, "ENOENT");
  }
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
    indexDigest,
  };
}

function availabilityCauses(result) {
  return result.availability.map(({ cause }) => cause);
}

test("Git commit metadata accepts strict ISO UTC from Git 2.54", () => {
  const parent = "a".repeat(40);
  assert.deepEqual(
    parseGitCommitMetadata(
      `${parent}\0${"2026-07-29T09:00:00Z"}`,
      "sha1",
    ),
    {
      parentCommitIds: [parent],
      recordedAt: "2026-07-29T09:00:00Z",
    },
  );
  assert.deepEqual(
    parseGitCommitMetadata(
      `\0${"2026-07-29T18:00:00+09:00"}`,
      "sha1",
    ),
    {
      parentCommitIds: [],
      recordedAt: "2026-07-29T18:00:00+09:00",
    },
  );
  assert.equal(
    parseGitCommitMetadata(`${"\0"}2026-07-29T09:00:00`, "sha1"),
    null,
  );
});

test("Git history probe returns deterministic first-parent path snapshots without changing Git", async (t) => {
  const repository = await temporaryRepository(t);
  const plan = join(repository, "plans", "demo.pert");
  const source1 = "\uFEFFproject DEMO:\r\n  title \"one\"\r\n";
  const source2 = "project DEMO:\r\n  title \"two\"\r\n";
  const source3 = "project DEMO:\n  title \"three\"\n";
  await write(plan, source1);
  const commit1 = commit(repository, "add plan");
  await write(plan, source2);
  const commit2 = commit(repository, "update plan");

  git(repository, "switch", "-c", "side");
  await write(plan, source3);
  const sideCommit = commit(repository, "side plan change");
  git(repository, "switch", "main");
  await write(join(repository, "main.txt"), "main\n");
  const mainCommit = commit(repository, "main change");
  git(repository, "merge", "--no-ff", "side", "-m", "merge side");
  const resolvedHead = git(repository, "rev-parse", "HEAD");

  const before = await gitState(repository);
  const first = await probeGitHistory({
    targetPath: plan,
    expectedSourceDigest: digestDocumentBytes(Buffer.from(source3)),
  });
  const second = await probeGitHistory({
    targetPath: plan,
    expectedSourceDigest: digestDocumentBytes(Buffer.from(source3)),
  });
  const after = await gitState(repository);

  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  assert.equal(first.modelVersion, GIT_HISTORY_PROBE_MODEL_VERSION);
  assert.equal(first.status, "complete");
  assert.equal(first.traversal, "first_parent");
  assert.equal(first.objectFormat, "sha1");
  assert.equal(
    first.repositorySnapshotId,
    `git:sha1:${resolvedHead}`,
  );
  assert.equal(first.repositoryRelativePath, "plans/demo.pert");
  assert.equal(first.requestedRevision, "HEAD");
  assert.equal(first.resolvedRevision, resolvedHead);
  assert.equal(first.headCommitId, resolvedHead);
  assert.deepEqual(first.inspectedCommitIds, [
    commit1,
    commit2,
    resolvedHead,
  ]);
  assert.equal(first.inspectedCommitIds.includes(sideCommit), false);
  assert.deepEqual(
    first.snapshots.map(({ source }) =>
      source === null ? null : Buffer.from(source).toString("utf8")
    ),
    [source1, source2, source3],
  );
  assert.deepEqual(
    first.snapshots.map(({ commitId }) => commitId),
    first.inspectedCommitIds,
  );
  assert.equal(first.snapshots[0].parentCommitIds.length, 0);
  assert.deepEqual(first.snapshots.at(-1).parentCommitIds, [
    mainCommit,
    sideCommit,
  ]);
  assert.equal(
    first.selectedSourceDigest,
    digestDocumentBytes(Buffer.from(source3)),
  );
  assert.deepEqual(first.availability, []);
  assert.deepEqual(after, before);
  assert.equal(JSON.stringify(first).includes(repository), false);

  const historical = await probeGitHistory({
    targetPath: plan,
    revision: commit2,
  });
  assert.equal(historical.ok, true);
  assert.equal(historical.status, "complete");
  assert.equal(historical.resolvedRevision, commit2);
  assert.deepEqual(historical.inspectedCommitIds, [commit1, commit2]);
  assert.equal(
    Buffer.from(historical.snapshots.at(-1).source).toString("utf8"),
    source2,
  );
});

test("Git history probe represents deletion snapshots without inventing source", async (t) => {
  const repository = await temporaryRepository(t);
  const plan = join(repository, "plan.pert");
  const source1 = "project DELETE:\n  title \"one\"\n";
  const source2 = "project DELETE:\n  title \"two\"\n";
  await write(plan, source1);
  const added = commit(repository, "add plan");
  await rm(plan);
  const removed = commit(repository, "remove plan");
  await write(plan, source2);
  const restored = commit(repository, "restore plan");

  const result = await probeGitHistory({ targetPath: plan });

  assert.equal(result.ok, true);
  assert.equal(result.status, "complete");
  assert.deepEqual(result.inspectedCommitIds, [added, removed, restored]);
  assert.deepEqual(
    result.snapshots.map(({ sourceDigest }) => sourceDigest),
    [
      digestDocumentBytes(Buffer.from(source1)),
      null,
      digestDocumentBytes(Buffer.from(source2)),
    ],
  );
  assert.deepEqual(
    result.snapshots.map(({ source }) =>
      source === null ? null : Buffer.from(source).toString("utf8")
    ),
    [source1, null, source2],
  );
});

test("Git history probe remains outside the active package root", async () => {
  for (const name of [
    "GIT_HISTORY_PROBE_MODEL_VERSION",
    "probeGitHistory",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
  const declarations = await readFile(
    new URL("../dist/index.d.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(declarations, /probeGitHistory/);
  assert.doesNotMatch(declarations, /GitHistoryProbeResult/);
});

test("Git history probe returns typed unavailable domain boundaries", async (t) => {
  const outside = await mkdtemp(join(tmpdir(), "perttool-no-repo."));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const outsidePlan = join(outside, "plan.pert");
  await write(outsidePlan, "project OUTSIDE:\n  title \"outside\"\n");
  const noRepository = await probeGitHistory({ targetPath: outsidePlan });
  assert.equal(noRepository.ok, true);
  assert.equal(noRepository.status, "unavailable");
  assert.deepEqual(availabilityCauses(noRepository), ["no_repository"]);

  const empty = await temporaryRepository(t);
  const emptyPlan = join(empty, "plan.pert");
  await write(emptyPlan, "project EMPTY:\n  title \"empty\"\n");
  const noHead = await probeGitHistory({ targetPath: emptyPlan });
  assert.equal(noHead.ok, true);
  assert.equal(noHead.status, "unavailable");
  assert.deepEqual(availabilityCauses(noHead), ["no_head"]);

  const repository = await temporaryRepository(t);
  const tracked = join(repository, "tracked.pert");
  await write(tracked, "project TRACKED:\n  title \"tracked\"\n");
  commit(repository, "tracked");

  const unknownRevision = await probeGitHistory({
    targetPath: tracked,
    revision: "does-not-exist",
  });
  assert.equal(unknownRevision.ok, true);
  assert.equal(unknownRevision.status, "unavailable");
  assert.deepEqual(availabilityCauses(unknownRevision), [
    "unknown_revision",
  ]);

  const untracked = join(repository, "untracked.pert");
  await write(untracked, "project UNTRACKED:\n  title \"untracked\"\n");
  const untrackedTarget = await probeGitHistory({ targetPath: untracked });
  assert.equal(untrackedTarget.ok, true);
  assert.equal(untrackedTarget.status, "unavailable");
  assert.deepEqual(availabilityCauses(untrackedTarget), [
    "untracked_target",
  ]);

  const staleSource = await probeGitHistory({
    targetPath: tracked,
    expectedSourceDigest: `sha256:${"0".repeat(64)}`,
  });
  assert.equal(staleSource.ok, true);
  assert.equal(staleSource.status, "unavailable");
  assert.deepEqual(availabilityCauses(staleSource), ["target_changed"]);

  const link = join(repository, "linked.pert");
  await symlink(tracked, link);
  const ambiguous = await probeGitHistory({ targetPath: link });
  assert.equal(ambiguous.ok, true);
  assert.equal(ambiguous.status, "unavailable");
  assert.deepEqual(availabilityCauses(ambiguous), ["ambiguous_path"]);

  const unavailableProcess = await probeGitHistory(
    { targetPath: tracked },
    { gitExecutable: join(repository, "missing-git") },
  );
  assert.deepEqual(unavailableProcess, {
    ok: false,
    modelVersion: GIT_HISTORY_PROBE_MODEL_VERSION,
    kind: "git_process_start",
    operation: "repository_root",
  });
});

test("Git history probe binds SHA-256 object repositories", async (t) => {
  const repository = await mkdtemp(
    join(tmpdir(), "perttool-sha256-probe."),
  );
  t.after(() => rm(repository, { recursive: true, force: true }));
  git(repository, "init", "--object-format=sha256", "-b", "main");
  git(repository, "config", "user.name", "Perttool Test");
  git(repository, "config", "user.email", "perttool@example.invalid");
  const plan = join(repository, "plan.pert");
  await write(plan, "project SHA256:\n  title \"sha256\"\n");
  const head = commit(repository, "add SHA-256 plan");

  const result = await probeGitHistory({ targetPath: plan });
  assert.equal(result.ok, true);
  assert.equal(result.status, "complete");
  assert.equal(result.objectFormat, "sha256");
  assert.equal(head.length, 64);
  assert.equal(result.repositorySnapshotId, `git:sha256:${head}`);
});

test("Git history probe qualifies shallow and renamed histories without guessing", async (t) => {
  const origin = await temporaryRepository(t);
  const originalPath = join(origin, "plans", "old.pert");
  const currentPath = join(origin, "plans", "current.pert");
  await write(originalPath, "project HISTORY:\n  title \"one\"\n");
  commit(origin, "add old path");
  git(origin, "mv", "plans/old.pert", "plans/current.pert");
  commit(origin, "rename plan");
  await write(currentPath, "project HISTORY:\n  title \"two\"\n");
  commit(origin, "update renamed plan");

  const renamed = await probeGitHistory({ targetPath: currentPath });
  assert.equal(renamed.ok, true);
  assert.equal(renamed.status, "incomplete");
  assert.deepEqual(availabilityCauses(renamed), ["unsupported_rename"]);
  assert.equal(renamed.snapshots.length, 2);
  assert.equal(
    renamed.snapshots.some(({ source: snapshotSource }) =>
      snapshotSource !== null &&
      Buffer.from(snapshotSource).toString("utf8").includes('title "one"')
    ),
    true,
  );

  const shallowRoot = await mkdtemp(
    join(tmpdir(), "perttool-shallow-probe."),
  );
  t.after(() => rm(shallowRoot, { recursive: true, force: true }));
  const clone = join(shallowRoot, "clone");
  const cloneResult = spawnSync(
    "git",
    [
      "clone",
      "--depth=1",
      pathToFileURL(origin).href,
      clone,
    ],
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
  assert.equal(cloneResult.status, 0, cloneResult.stderr);
  const shallow = await probeGitHistory({
    targetPath: join(clone, "plans", "current.pert"),
  });
  assert.equal(shallow.ok, true);
  assert.equal(shallow.status, "incomplete");
  assert.deepEqual(availabilityCauses(shallow), ["shallow_boundary"]);
  assert.equal(shallow.snapshots.length, 1);
});

test("Git history probe supports linked worktrees and detects source and HEAD races", async (t) => {
  const repository = await temporaryRepository(t);
  const plan = join(repository, "plans", "work.pert");
  const source = "project WORK:\n  title \"work\"\n";
  await write(plan, source);
  commit(repository, "add work plan");

  const worktreeRoot = await mkdtemp(
    join(tmpdir(), "perttool-linked-worktree."),
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
  const worktree = await probeGitHistory({
    targetPath: join(worktreeRoot, "plans", "work.pert"),
  });
  assert.equal(worktree.ok, true);
  assert.equal(worktree.status, "complete");
  assert.equal(worktree.repositoryRelativePath, "plans/work.pert");

  const targetRace = await probeGitHistory(
    { targetPath: plan },
    {
      afterSnapshots: async () => {
        await write(plan, `${source}# changed\n`);
      },
    },
  );
  assert.equal(targetRace.ok, true);
  assert.equal(targetRace.status, "unavailable");
  assert.deepEqual(availabilityCauses(targetRace), ["target_changed"]);
  await write(plan, source);

  const headRace = await probeGitHistory(
    { targetPath: plan },
    {
      afterSnapshots: async () => {
        await write(join(repository, "race.txt"), "race\n");
        commit(repository, "move head during probe");
      },
    },
  );
  assert.equal(headRace.ok, true);
  assert.equal(headRace.status, "unavailable");
  assert.deepEqual(availabilityCauses(headRace), ["head_changed"]);
});
