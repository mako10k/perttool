import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import * as coreApi from "../dist/core/index.js";
import * as nodeApi from "../dist/node/index.js";
import * as rootApi from "../dist/index.js";
import { planTargetPlanAssuranceAdvance } from "../dist/assurance/advance.js";
import { digestDocumentBytes } from "../dist/io/document-file.js";
import { probeHistoricalGitEvidence } from "../dist/history/git-probe.js";
import { milestoneAcceptanceBaseText } from "../dist/milestone-acceptance/source.js";
import { applyTextEdits } from "../dist/mutation/text-edits.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../dist/parser/document-parser.js";
import {
  PLANNING_HISTORY_CORE_CAPABILITY,
  PLANNING_HISTORY_CORE_LIMITS,
  reconstructPlanningPoolHistory,
} from "../dist/planning-pool/history.js";
import {
  planningPoolBaseText,
  scanPlanningDeclarationBlocks,
} from "../dist/planning-pool/source-lexical.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "../dist/planning-pool/source.js";
import {
  scanTemporalDeclarationBlocks,
  temporalScheduleBaseText,
} from "../dist/temporal-schedule/source-lexical.js";

const encoder = new TextEncoder();
const q = (id) => `POOL::${id}`;
const commits = Array.from({ length: 8 }, (_, index) => (index + 1).toString(16).repeat(40));

function git(repository, ...args) {
  const result = spawnSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function source({
  description = null,
  includeW1 = true,
  taskLinked = true,
  taskStatus = "planned",
  includeSprint = false,
  releaseWorks = ["W2"],
} = {}) {
  const lines = [
    "project POOL:",
    "  version 9",
    '  title "Pool"',
    "  as_of 2026-08-25",
    "  duration_unit point",
    "  finish END",
    "",
  ];
  if (includeW1) {
    lines.push(
      "work W1:",
      '  title "Primary"',
      ...(description === null ? [] : [`  description ${JSON.stringify(description)}`]),
      ...(taskLinked ? ["  task_links:", "    T"] : []),
      "",
    );
  }
  lines.push(
    "work W2:",
    '  title "Backlog"',
    "",
    "window RELEASE:",
    '  title "Release"',
    '  objective "Coordinate delivery"',
    "  works:",
    ...releaseWorks.map((id) => `    ${id}`),
    "",
  );
  if (includeSprint) {
    lines.push(
      "window SPRINT:",
      '  title "Sprint"',
      '  objective "Finish primary"',
      "  works:",
      "    W1",
      "",
    );
  }
  lines.push(
    "work_order:",
    ...(includeW1 ? ["  W1"] : []),
    "  W2",
    "",
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone END:",
    '  title "End"',
    "",
    "task T START -> END:",
    '  title "Deliver"',
    "  duration 1p",
    ...(taskStatus === "planned" ? [] : [`  status ${taskStatus}`]),
    "",
  );
  return `${lines.join("\n")}\n`;
}

function strictBase(text) {
  const grammar8 = planningPoolBaseText(text, scanPlanningDeclarationBlocks(text));
  const grammar7 = temporalScheduleBaseText(grammar8, scanTemporalDeclarationBlocks(grammar8));
  return milestoneAcceptanceBaseText(grammar7);
}

function canonicalAdvance(text) {
  const planned = planTargetPlanAssuranceAdvance(
    strictBase(text),
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  assert.equal(planned.ok, true);
  assert.equal(planned.changed, true);
  assert.notEqual(planned.updatedText, null);
  let candidate = applyTextEdits(text, planned.edits);
  for (const taskId of planned.advance.removedTaskIds) {
    candidate = candidate.replace(`  task_links:\n    ${taskId}\n`, "");
  }
  for (const milestoneId of planned.advance.removedMilestoneIds) {
    candidate = candidate.replace(`  milestone_links:\n    ${milestoneId}\n`, "");
  }
  const parsed = parsePlanningPoolSource(candidate, PLANNING_POOL_SOURCE_CAPABILITY);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.diagnostics));
  return { candidate, advance: planned.advance };
}

function readSnapshotId(fields) {
  return `git-read:${digestDocumentBytes(Buffer.from(JSON.stringify({
    model: "Perttool.HistoricalGitEvidence.v1",
    objectFormat: "sha1",
    repositoryId: fields.repositoryId,
    repositoryRelativePath: fields.repositoryRelativePath,
    resolvedEndpoint: fields.resolvedEndpoint,
    resolvedLowerBoundary: fields.resolvedLowerBoundary,
    snapshots: fields.snapshots.map((snapshot) => ({
      commitId: snapshot.commitId,
      parentCommitIds: snapshot.parentCommitIds,
      blobId: snapshot.blobId,
      sourceDigest: snapshot.sourceDigest,
    })),
  }), "utf8"))}`;
}

function evidence(currentText, values, { status = "complete", limits = {} } = {}) {
  if (status === "unavailable") {
    return {
      ok: true,
      modelVersion: 1,
      status,
      ancestryProfile: "first_parent",
      objectFormat: null,
      repositoryId: null,
      repositoryReadSnapshotId: null,
      repositoryRelativePath: null,
      requestedEndpoint: "HEAD",
      resolvedEndpoint: null,
      requestedLowerBoundary: null,
      resolvedLowerBoundary: null,
      oldestInspectedCommitId: null,
      currentSourceDigest: digestDocumentBytes(encoder.encode(currentText)),
      aggregateRawSnapshotBytes: 0,
      limits: { inspectedCommits: 2048, rawBytesPerSnapshot: 8388608, aggregateRawSnapshotBytes: 134217728, ...limits },
      inspectedCommitIds: [],
      snapshots: [],
      causes: [{ cause: "no_repository", subject: "repository", commitId: null, limit: null, actual: null }],
    };
  }
  const repositoryId = `git-repository:sha256:${"a".repeat(64)}`;
  const repositoryRelativePath = "plans/pool.pert";
  const raw = values.map((value) => value instanceof Uint8Array ? value : encoder.encode(value));
  const snapshots = raw.map((bytes, index) => ({
    modelVersion: 1,
    objectFormat: "sha1",
    repositoryId,
    repositoryReadSnapshotId: "pending",
    repositoryRelativePath,
    commitId: commits[index],
    parentCommitIds: index === 0 ? [] : [commits[index - 1]],
    blobId: (index + 9).toString(16).repeat(40),
    sourceDigest: digestDocumentBytes(bytes),
    source: bytes,
    recordedAt: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
    isMergeCommit: false,
    isEndpoint: index === raw.length - 1,
    isLowerBoundary: index === 0,
  }));
  const base = {
    repositoryId,
    repositoryRelativePath,
    resolvedEndpoint: snapshots.at(-1).commitId,
    resolvedLowerBoundary: snapshots[0].commitId,
    snapshots,
  };
  const repositoryReadSnapshotId = readSnapshotId(base);
  const bound = snapshots.map((snapshot) => ({ ...snapshot, repositoryReadSnapshotId }));
  return {
    ok: true,
    modelVersion: 1,
    status,
    ancestryProfile: "first_parent",
    objectFormat: "sha1",
    repositoryId,
    repositoryReadSnapshotId,
    repositoryRelativePath,
    requestedEndpoint: "HEAD",
    resolvedEndpoint: bound.at(-1).commitId,
    requestedLowerBoundary: bound[0].commitId,
    resolvedLowerBoundary: bound[0].commitId,
    oldestInspectedCommitId: bound[0].commitId,
    currentSourceDigest: digestDocumentBytes(encoder.encode(currentText)),
    aggregateRawSnapshotBytes: raw.reduce((sum, bytes) => sum + bytes.byteLength, 0),
    limits: { inspectedCommits: 2048, rawBytesPerSnapshot: 8388608, aggregateRawSnapshotBytes: 134217728, ...limits },
    inspectedCommitIds: bound.map(({ commitId }) => commitId),
    snapshots: bound,
    causes: status === "incomplete"
      ? [{ cause: "shallow_origin", subject: "repository", commitId: commits[0], limit: null, actual: null }]
      : [],
  };
}

function execution(sourceText, evidenceState = "complete") {
  return {
    source_digest: digestDocumentBytes(encoder.encode(sourceText)),
    evidence_state: evidenceState,
    recommended_task_ids: [],
    startable_task_ids: [],
  };
}

function contexts(currentText, values, omitted = new Set()) {
  return {
    current: execution(currentText),
    historical: values.flatMap((value, index) => omitted.has(index) || value instanceof Uint8Array
      ? []
      : [{ commit_id: commits[index], execution: execution(value) }]),
  };
}

function request(currentText, selection = { kind: "pool" }) {
  return {
    request_schema_version: "Perttool.PlanningObservationRequest.v1",
    source_digest: digestDocumentBytes(encoder.encode(currentText)),
    selection,
    observation_at: null,
    close_dispositions: [],
  };
}

function reconstruct(currentText, values, options = {}) {
  const git = options.evidence ?? evidence(currentText, values, options.evidenceOptions);
  return reconstructPlanningPoolHistory(
    currentText,
    request(currentText, options.selection),
    options.contexts ?? contexts(currentText, values, options.omittedContexts),
    git,
    PLANNING_HISTORY_CORE_CAPABILITY,
  );
}

test("PPHC-001 and PPHC-002 fix the private identity and immutable evidence binding", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/planning-pool-history-core-v1.json", "utf8"));
  assert.deepEqual(fixture.cases.map(({ id }) => id), Array.from({ length: 16 }, (_, index) => `PPHC-${String(index + 1).padStart(3, "0")}`));
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.deepEqual(PLANNING_HISTORY_CORE_LIMITS, {
    inspectedCommits: 2048,
    rawBytesPerSnapshot: 8388608,
    aggregateRawSnapshotBytes: 134217728,
    derivedEntityRecords: 100000,
  });
  const text = source();
  assert.throws(
    () => reconstructPlanningPoolHistory(text, request(text), contexts(text, [text]), evidence(text, [text]), { ...PLANNING_HISTORY_CORE_CAPABILITY }),
    /private planning history Core capability/u,
  );
  const stale = evidence(text, [text]);
  stale.repositoryReadSnapshotId = `git-read:sha256:${"f".repeat(64)}`;
  const result = reconstruct(text, [text], { evidence: stale });
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some(({ code }) => code === "PTPOOL-111"), true);
});

test("PPHC-002 composes the accepted real first-parent Git evidence without another Git owner", async (t) => {
  const repository = await mkdtemp(join(tmpdir(), "perttool-planning-history."));
  t.after(() => rm(repository, { recursive: true, force: true }));
  git(repository, "init", "-b", "main");
  git(repository, "config", "user.name", "Planning History Test");
  git(repository, "config", "user.email", "planning-history@example.invalid");
  const target = join(repository, "plans", "pool.pert");
  await mkdir(join(repository, "plans"), { recursive: true });
  const before = source({ description: "Before" });
  const current = source({ description: "Current" });
  await writeFile(target, before, "utf8");
  git(repository, "add", "plans/pool.pert");
  git(repository, "commit", "-m", "before");
  await writeFile(target, current, "utf8");
  git(repository, "add", "plans/pool.pert");
  git(repository, "commit", "-m", "current");
  const probed = await probeHistoricalGitEvidence({
    targetPath: target,
    expectedSourceDigest: digestDocumentBytes(encoder.encode(current)),
  });
  assert.equal(probed.ok, true);
  const historical = probed.snapshots.map((snapshot) => ({
    commit_id: snapshot.commitId,
    execution: execution(new TextDecoder().decode(snapshot.source)),
  }));
  const result = reconstructPlanningPoolHistory(
    current,
    request(current),
    { current: execution(current), historical },
    probed,
    PLANNING_HISTORY_CORE_CAPABILITY,
  );
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.evidence.state, "complete");
  assert.equal(result.evidence.repositoryRelativePath, "plans/pool.pert");
  assert.match(result.evidence.repositoryId, /^git-repository:sha256:[0-9a-f]{64}$/u);
  assert.equal(result.snapshots.length, 2);
});

test("PPHC-003 through PPHC-006 preserve current authority and continuous Work and relation epochs", () => {
  const first = source({ description: "Initial", taskStatus: "planned" });
  const second = source({ description: "Refined", taskStatus: "done" });
  const current = source({ includeW1: false, taskStatus: "done" });
  const result = reconstruct(current, [first, second, current], {
    selection: { kind: "work", work_ids: [q("W1")] },
  });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.current.state, "selection_absent");
  assert.equal(result.current.overridesHistoricalFacts, true);
  assert.equal(result.snapshots[0].selectionState, "observed");
  assert.equal(result.snapshots[2].selectionState, "absent");
  const work = result.lineage.workOccurrences.find(({ workId }) => workId === q("W1"));
  assert.equal(work.semanticEpochs.length, 2);
  assert.equal(work.retiredAtCommitId, commits[2]);
  assert.equal(work.endedBy, "removed");
  const task = result.lineage.relationOccurrences.find(({ kind }) => kind === "work_task_projection");
  assert.equal(task.factEpochs.length, 2);
  assert.equal(task.retiredAtCommitId, commits[2]);
  assert.equal(result.evidence.continuityQualified, true);
});

test("PPHC-007 reconstructs Window contraction without inventing a durable close request", () => {
  const before = source({ includeSprint: true, releaseWorks: ["W2"] });
  const after = source({ includeSprint: false, releaseWorks: ["W1", "W2"] });
  const result = reconstruct(after, [before, after]);
  const transition = result.lineage.transitions.at(-1);
  assert.equal(transition.kind, "window_close");
  assert.deepEqual(transition.removedWindowIds, [q("SPRINT")]);
  assert.deepEqual(result.lineage.windowCloses, [{
    windowId: q("SPRINT"),
    fromCommitId: commits[0],
    toCommitId: commits[1],
    memberWorkIds: [q("W1")],
    carriedOver: [{ workId: q("W1"), targetWindowId: q("RELEASE") }],
    unrecordedDispositionWorkIds: [],
    exactMutationRequestAvailable: false,
  }]);
  assert.equal(result.lineage.windowOccurrences.find(({ windowId }) => windowId === q("SPRINT")).retiredAtCommitId, commits[1]);
});

test("PPHC-008 recognizes the strict canonical-advance semantic candidate", () => {
  const before = source({ taskStatus: "done" });
  const { candidate, advance } = canonicalAdvance(before);
  const result = reconstruct(candidate, [before, candidate]);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  const transition = result.lineage.transitions.at(-1);
  assert.equal(transition.kind, "canonical_advance");
  assert.equal(transition.strictCanonicalAdvance, true);
  assert.deepEqual(transition.removedTaskIds, advance.removedTaskIds.map((id) => q(id)));
  assert.deepEqual(transition.removedMilestoneIds, advance.removedMilestoneIds.map((id) => q(id)));
});

test("PPHC-009 through PPHC-012 stop at gaps and keep incomplete evidence explicit", () => {
  const text = source();
  const invalid = encoder.encode("\xff");
  const gap = reconstruct(text, [text, invalid, text]);
  assert.equal(gap.ok, true);
  assert.equal(gap.evidence.state, "incomplete");
  assert.equal(gap.lineage.gaps.some(({ cause }) => cause === "source_invalid" || cause === "source_binding_invalid"), true);
  assert.equal(gap.lineage.workOccurrences.filter(({ workId }) => workId === q("W1")).length, 2);
  assert.equal(gap.lineage.ambiguousIdentityIds.includes(q("W1")), true);
  assert.equal(gap.axisStates.execution, "unknown");

  const shallowEvidence = evidence(text, [text], { status: "incomplete" });
  const shallow = reconstruct(text, [text], { evidence: shallowEvidence });
  assert.equal(shallow.ok, true);
  assert.equal(shallow.evidence.state, "incomplete");
  assert.equal(shallow.evidence.continuityQualified, false);

  const missingContext = reconstruct(text, [text], { omittedContexts: new Set([0]) });
  assert.equal(missingContext.ok, true);
  assert.equal(missingContext.snapshots[0].globalExecutionEvidence, "unavailable");
  assert.equal(missingContext.evidence.state, "incomplete");
});

test("PPHC-013 and PPHC-014 fail closed for unavailable, raced, stale, and over-limit evidence", () => {
  const text = source();
  const unavailable = reconstruct(text, [], { evidence: evidence(text, [], { status: "unavailable" }), contexts: contexts(text, []) });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.lineage, null);
  assert.equal(unavailable.diagnostics.some(({ code }) => code === "PTPOOL-114"), true);

  const probeFailure = reconstruct(text, [], {
    evidence: { ok: false, modelVersion: 1, kind: "git_command_failed", operation: "historical_path_changes" },
    contexts: contexts(text, []),
  });
  assert.equal(probeFailure.ok, false);

  const stale = evidence(text, [text]);
  stale.currentSourceDigest = `sha256:${"0".repeat(64)}`;
  assert.equal(reconstruct(text, [text], { evidence: stale }).diagnostics.some(({ code }) => code === "PTPOOL-111"), true);

  const overLimit = evidence(text, [text], { limits: { inspectedCommits: 2049 } });
  const limited = reconstruct(text, [text], { evidence: overLimit });
  assert.equal(limited.ok, false);
  assert.equal(limited.diagnostics.some(({ code }) => code === "PTPOOL-115"), true);
});

test("PPHC-015 and PPHC-016 are deterministic, no-write, and publicly inactive", () => {
  const before = source({ description: "Before" });
  const current = source({ description: "Current" });
  const git = evidence(current, [before, current]);
  const inputBytes = git.snapshots.map(({ source: bytes }) => Buffer.from(bytes));
  const first = reconstruct(current, [before, current], { evidence: git });
  const second = reconstruct(current, [before, current], { evidence: git });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(git.snapshots.map(({ source: bytes }) => Buffer.from(bytes)), inputBytes);
  assert.equal(Object.isFrozen(first), true);
  assert.equal("reconstructPlanningPoolHistory" in rootApi, false);
  assert.equal(rootApi.COMMAND_REGISTRY.length, 56);
  assert.equal(rootApi.getJsonSchemaCatalog().length, 23);
  assert.equal(Object.keys(rootApi).length, 129);
  assert.equal(Object.keys(nodeApi).length, 129);
  assert.equal(Object.keys(coreApi).length, 45);
});
