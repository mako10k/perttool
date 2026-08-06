import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  HISTORICAL_GIT_EVIDENCE_LIMITS,
  HISTORICAL_GIT_EVIDENCE_MODEL_VERSION,
  probeHistoricalGitEvidence,
} from "../dist/history/git-probe.js";
import { digestDocumentBytes } from "../dist/io/document-file.js";

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
    input: options.input,
  });
}

function git(repository, ...args) {
  const result = runGit(repository, args);
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

function initialize(repository, objectFormat = "sha1") {
  const arguments_ = ["init", "-b", "main"];
  if (objectFormat === "sha256") arguments_.push("--object-format=sha256");
  const initialized = runGit(repository, arguments_);
  if (initialized.status !== 0) return false;
  git(repository, "config", "user.name", "Perttool Historical Test");
  git(repository, "config", "user.email", "historical@example.invalid");
  return true;
}

let commitSequence = 0;

function commit(repository, message) {
  commitSequence += 1;
  git(repository, "add", "-A");
  const minute = String(commitSequence % 60).padStart(2, "0");
  const recordedAt = `2026-08-06T12:${minute}:00+09:00`;
  const result = runGit(repository, ["commit", "-m", message], {
    env: {
      GIT_AUTHOR_DATE: recordedAt,
      GIT_COMMITTER_DATE: recordedAt,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return git(repository, "rev-parse", "HEAD");
}

async function write(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}

async function temporaryRepository(t, objectFormat = "sha1") {
  const root = await mkdtemp(join(tmpdir(), "perttool-historical-git."));
  t.after(() => rm(root, { recursive: true, force: true }));
  const supported = initialize(root, objectFormat);
  return { root, supported };
}

function plan(id, title) {
  return `project ${id}:\n  title "${title}"\n`;
}

function causes(result) {
  assert.equal(result.ok, true);
  return result.causes.map(({ cause }) => cause);
}

async function repositoryState(repository) {
  const gitDirectory = git(
    repository,
    "rev-parse",
    "--path-format=absolute",
    "--git-dir",
  );
  let indexDigest = null;
  try {
    indexDigest = createHash("sha256")
      .update(await readFile(join(gitDirectory, "index")))
      .digest("hex");
  } catch (error) {
    assert.equal(error.code, "ENOENT");
  }
  return {
    head: git(repository, "rev-parse", "HEAD"),
    refs: git(repository, "for-each-ref", "--format=%(refname):%(objectname)"),
    status: git(repository, "status", "--porcelain=v2", "--untracked-files=all"),
    indexDigest,
  };
}

test("HGE-001 through HGE-003 freeze endpoints and inclusive lower bounds", async (t) => {
  const { root } = await temporaryRepository(t);
  const target = join(root, "plans", "demo.pert");
  const source1 = plan("DEMO", "one");
  const source2 = plan("DEMO", "two");
  await write(target, source1);
  const commit1 = commit(root, "add plan");
  await write(join(root, "unrelated-1.txt"), "one\n");
  const commit2 = commit(root, "unrelated before change");
  await write(target, source2);
  const commit3 = commit(root, "change plan");
  await write(join(root, "unrelated-2.txt"), "two\n");
  const commit4 = commit(root, "unrelated endpoint");
  git(root, "tag", "endpoint-tag", commit4);

  const complete = await probeHistoricalGitEvidence({ targetPath: target });
  assert.equal(complete.ok, true);
  assert.equal(complete.modelVersion, HISTORICAL_GIT_EVIDENCE_MODEL_VERSION);
  assert.equal(complete.status, "complete");
  assert.equal(complete.ancestryProfile, "first_parent");
  assert.equal(complete.requestedEndpoint, "HEAD");
  assert.equal(complete.resolvedEndpoint, commit4);
  assert.deepEqual(complete.inspectedCommitIds, [commit1, commit3, commit4]);
  assert.equal(complete.snapshots.at(-1).isEndpoint, true);
  assert.equal(complete.snapshots.at(-1).blobId, complete.snapshots.at(-2).blobId);
  assert.equal(complete.snapshots.at(-1).sourceDigest, digestDocumentBytes(Buffer.from(source2)));

  const bounded = await probeHistoricalGitEvidence({
    targetPath: target,
    requestedEndpoint: "endpoint-tag",
    lowerBoundary: commit2,
  });
  assert.equal(bounded.ok, true);
  assert.equal(bounded.status, "complete");
  assert.equal(bounded.resolvedLowerBoundary, commit2);
  assert.deepEqual(bounded.inspectedCommitIds, [commit2, commit3, commit4]);
  assert.equal(bounded.snapshots[0].isLowerBoundary, true);
  assert.equal(Buffer.from(bounded.snapshots[0].source).toString("utf8"), source1);

  const one = await probeHistoricalGitEvidence({
    targetPath: target,
    requestedEndpoint: commit4,
    lowerBoundary: commit4,
  });
  assert.equal(one.ok, true);
  assert.equal(one.status, "complete");
  assert.deepEqual(one.inspectedCommitIds, [commit4]);
  assert.equal(one.snapshots[0].isEndpoint, true);
  assert.equal(one.snapshots[0].isLowerBoundary, true);
});

test("HGE-004 records a first-parent merge without inspecting the side lane", async (t) => {
  const { root } = await temporaryRepository(t);
  const target = join(root, "plan.pert");
  await write(target, plan("MERGE", "base"));
  const base = commit(root, "base");
  git(root, "switch", "-c", "side");
  await write(target, plan("MERGE", "side"));
  const side = commit(root, "side change");
  git(root, "switch", "main");
  await write(join(root, "main.txt"), "main\n");
  const mainParent = commit(root, "main change");
  git(root, "merge", "--no-ff", "side", "-m", "merge side");
  const endpoint = git(root, "rev-parse", "HEAD");

  const result = await probeHistoricalGitEvidence({ targetPath: target });
  assert.equal(result.ok, true);
  assert.equal(result.status, "complete");
  assert.deepEqual(result.inspectedCommitIds, [base, endpoint]);
  assert.equal(result.inspectedCommitIds.includes(side), false);
  assert.deepEqual(result.snapshots.at(-1).parentCommitIds, [mainParent, side]);
  assert.equal(result.snapshots.at(-1).isMergeCommit, true);
});

test("HGE-005 refuses missing paths, non-commit revisions, and off-lane lower bounds", async (t) => {
  const { root } = await temporaryRepository(t);
  const target = join(root, "plan.pert");
  await write(target, plan("REFUSE", "one"));
  const added = commit(root, "add");
  await rm(target);
  const removed = commit(root, "remove");
  await write(target, plan("REFUSE", "restored"));
  const restored = commit(root, "restore");

  const missingEndpoint = await probeHistoricalGitEvidence({
    targetPath: target,
    requestedEndpoint: removed,
  });
  assert.equal(missingEndpoint.status, "unavailable");
  assert.deepEqual(causes(missingEndpoint), ["endpoint_path_missing"]);

  const missingLower = await probeHistoricalGitEvidence({
    targetPath: target,
    requestedEndpoint: restored,
    lowerBoundary: removed,
  });
  assert.equal(missingLower.status, "unavailable");
  assert.deepEqual(causes(missingLower), ["lower_path_missing"]);

  git(root, "switch", "-c", "side", added);
  await write(target, plan("REFUSE", "side"));
  const side = commit(root, "side");
  git(root, "switch", "main");
  const offLane = await probeHistoricalGitEvidence({
    targetPath: target,
    requestedEndpoint: restored,
    lowerBoundary: side,
  });
  assert.equal(offLane.status, "unavailable");
  assert.deepEqual(causes(offLane), ["lower_not_first_parent_ancestor"]);

  const blob = git(root, "rev-parse", `${restored}:plan.pert`);
  const nonCommit = await probeHistoricalGitEvidence({
    targetPath: target,
    requestedEndpoint: blob,
  });
  assert.equal(nonCommit.status, "unavailable");
  assert.deepEqual(causes(nonCommit), ["non_commit_revision"]);
  const unknown = await probeHistoricalGitEvidence({
    targetPath: target,
    requestedEndpoint: "missing-revision",
  });
  assert.equal(unknown.status, "unavailable");
  assert.deepEqual(causes(unknown), ["unknown_revision"]);
});

test("HGE-006 binds SHA-1, SHA-256, and linked worktrees without absolute paths", async (t) => {
  for (const objectFormat of ["sha1", "sha256"]) {
    const repository = await temporaryRepository(t, objectFormat);
    if (!repository.supported) {
      assert.equal(objectFormat, "sha256");
      continue;
    }
    const target = join(repository.root, "plan.pert");
    await write(target, plan("FORMAT", objectFormat));
    commit(repository.root, objectFormat);
    const result = await probeHistoricalGitEvidence({ targetPath: target });
    assert.equal(result.ok, true);
    assert.equal(result.status, "complete");
    assert.equal(result.objectFormat, objectFormat);
    assert.match(result.repositoryId, /^git-repository:sha256:[0-9a-f]{64}$/u);
    assert.match(result.repositoryReadSnapshotId, /^git-read:sha256:[0-9a-f]{64}$/u);
    assert.equal(JSON.stringify(result).includes(repository.root), false);
  }

  const { root } = await temporaryRepository(t);
  const mainTarget = join(root, "plan.pert");
  await write(mainTarget, plan("LINKED", "main"));
  commit(root, "main");
  const linked = join(dirname(root), `${root.split("/").at(-1)}.linked`);
  t.after(() => rm(linked, { recursive: true, force: true }));
  git(root, "worktree", "add", "-b", "linked-branch", linked);
  const linkedTarget = join(linked, "plan.pert");
  const [mainResult, linkedResult] = await Promise.all([
    probeHistoricalGitEvidence({ targetPath: mainTarget }),
    probeHistoricalGitEvidence({ targetPath: linkedTarget }),
  ]);
  assert.equal(mainResult.ok, true);
  assert.equal(linkedResult.ok, true);
  assert.equal(linkedResult.status, "complete");
  assert.equal(linkedResult.repositoryId, mainResult.repositoryId);
  assert.equal(linkedResult.repositoryRelativePath, "plan.pert");
});

test("HGE-007 distinguishes shallow origin from an explicit available boundary", async (t) => {
  const sourceRepository = await temporaryRepository(t);
  const target = join(sourceRepository.root, "plan.pert");
  await write(target, plan("SHALLOW", "one"));
  commit(sourceRepository.root, "one");
  await write(target, plan("SHALLOW", "two"));
  commit(sourceRepository.root, "two");
  await write(target, plan("SHALLOW", "three"));
  commit(sourceRepository.root, "three");

  const shallow = await mkdtemp(join(tmpdir(), "perttool-historical-shallow."));
  await rm(shallow, { recursive: true, force: true });
  t.after(() => rm(shallow, { recursive: true, force: true }));
  const clone = spawnSync(
    "git",
    ["clone", "--depth", "2", `file://${sourceRepository.root}`, shallow],
    { encoding: "utf8" },
  );
  assert.equal(clone.status, 0, clone.stderr);
  const shallowTarget = join(shallow, "plan.pert");
  const available = git(shallow, "rev-list", "--first-parent", "--reverse", "HEAD")
    .split("\n");

  const incomplete = await probeHistoricalGitEvidence({ targetPath: shallowTarget });
  assert.equal(incomplete.ok, true);
  assert.equal(incomplete.status, "incomplete");
  assert.deepEqual(causes(incomplete), ["shallow_origin"]);

  const bounded = await probeHistoricalGitEvidence({
    targetPath: shallowTarget,
    lowerBoundary: available[0],
  });
  assert.equal(bounded.ok, true);
  assert.equal(bounded.status, "complete");
  assert.equal(bounded.resolvedLowerBoundary, available[0]);
});

test("HGE-008 applies commit, per-snapshot, and aggregate limits before returning graphs", async (t) => {
  const { root } = await temporaryRepository(t);
  const target = join(root, "plan.pert");
  await write(target, plan("LIMIT", "one"));
  commit(root, "one");
  await write(target, plan("LIMIT", "two"));
  commit(root, "two");
  await write(target, plan("LIMIT", "three"));
  commit(root, "three");

  const commits = await probeHistoricalGitEvidence(
    { targetPath: target },
    { limits: { inspectedCommits: 2 } },
  );
  assert.equal(commits.status, "unavailable");
  assert.deepEqual(causes(commits), ["hard_limit"]);
  assert.equal(commits.causes[0].limit, "inspectedCommits");
  assert.deepEqual(commits.snapshots, []);

  const snapshot = await probeHistoricalGitEvidence(
    { targetPath: target },
    { limits: { rawBytesPerSnapshot: 8 } },
  );
  assert.equal(snapshot.status, "unavailable");
  assert.equal(snapshot.causes[0].limit, "rawBytesPerSnapshot");
  assert.deepEqual(snapshot.snapshots, []);

  const aggregate = await probeHistoricalGitEvidence(
    { targetPath: target },
    { limits: { aggregateRawSnapshotBytes: 50 } },
  );
  assert.equal(aggregate.status, "unavailable");
  assert.equal(aggregate.causes[0].limit, "aggregateRawSnapshotBytes");
  assert.deepEqual(aggregate.snapshots, []);
  assert.deepEqual(HISTORICAL_GIT_EVIDENCE_LIMITS, {
    inspectedCommits: 2048,
    rawBytesPerSnapshot: 8388608,
    aggregateRawSnapshotBytes: 134217728,
  });
});

test("HGE-009 fails closed on target and endpoint-ref races", async (t) => {
  const { root } = await temporaryRepository(t);
  const target = join(root, "plan.pert");
  await write(target, plan("RACE", "one"));
  commit(root, "one");

  const targetRace = await probeHistoricalGitEvidence(
    { targetPath: target },
    {
      afterEvidence: async () => {
        await write(target, plan("RACE", "dirty"));
      },
    },
  );
  assert.equal(targetRace.status, "unavailable");
  assert.deepEqual(causes(targetRace), ["repository_race"]);
  assert.deepEqual(targetRace.snapshots, []);

  await write(target, plan("RACE", "one"));
  const refRace = await probeHistoricalGitEvidence(
    { targetPath: target },
    {
      afterEvidence: async () => {
        await write(target, plan("RACE", "two"));
        commit(root, "two");
      },
    },
  );
  assert.equal(refRace.status, "unavailable");
  assert.deepEqual(causes(refRace), ["repository_race"]);
  assert.deepEqual(refRace.snapshots, []);
});

test("HGE-010 through HGE-012 preserve Git state and the active public surface", async (t) => {
  const cases = JSON.parse(
    await readFile(new URL("fixtures/historical-git-evidence-v1.json", import.meta.url), "utf8"),
  );
  const accepted = new Set();
  for (const evidenceCase of cases.cases) {
    assert.equal(evidenceCase.depends_on.every((id) => accepted.has(id)), true, evidenceCase.id);
    accepted.add(evidenceCase.id);
  }
  assert.deepEqual(
    [...accepted],
    Array.from({ length: 12 }, (_, index) => `HGE-${String(index + 1).padStart(3, "0")}`),
  );

  const { root } = await temporaryRepository(t);
  const target = join(root, "plan.pert");
  await write(target, plan("NOWRITE", "one"));
  commit(root, "one");
  const before = await repositoryState(root);
  const first = await probeHistoricalGitEvidence({ targetPath: target });
  const second = await probeHistoricalGitEvidence({ targetPath: target });
  const after = await repositoryState(root);
  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
  assert.deepEqual(after, before);
  assert.deepEqual(
    Object.keys(publicApi.createNodeHost().gitEvidence).sort(),
    ["captureAdvanceBaseline", "probeHistory", "recheckAdvanceBaseline"],
  );
  assert.equal(Object.keys(publicApi).length, 122);
  assert.equal(publicApi.COMMAND_REGISTRY.length, 44);
  assert.equal(publicApi.getJsonSchemaCatalog().length, 20);
  assert.equal("probeHistoricalGitEvidence" in publicApi, false);
  assert.equal("HISTORICAL_GIT_EVIDENCE_MODEL_VERSION" in publicApi, false);
});
