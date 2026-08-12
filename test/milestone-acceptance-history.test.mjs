import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planTargetPlanAssuranceAdvance } from "../dist/assurance/advance.js";
import {
  HISTORICAL_MILESTONE_ACCEPTANCE_MODEL,
  reconstructHistoricalMilestoneAcceptance,
} from "../dist/history/milestone-acceptance-history.js";
import { digestDocumentBytes } from "../dist/io/document-file.js";
import { planMilestoneAcceptanceAdvance } from "../dist/milestone-acceptance/advance.js";
import { planMilestoneAcceptanceMigration } from "../dist/milestone-acceptance/migration.js";
import {
  planAcceptanceReceiptMutation,
  planCriterionSetReplacement,
} from "../dist/milestone-acceptance/mutation.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../dist/parser/document-parser.js";
import {
  inspectTargetHistoricalGraphFile,
  renderTargetHistoricalGraphText,
  targetHistoricalGraphResultToJson,
} from "../dist/application/target-historical-graph.js";

const encoder = new TextEncoder();
const repositoryId = `git-repository:sha256:${"a".repeat(64)}`;
const path = "plans/history.pert";
const commits = Array.from({ length: 8 }, (_, index) =>
  (index + 1).toString(16).repeat(40)
);
const blobs = Array.from({ length: 8 }, (_, index) =>
  (index + 9).toString(16).repeat(40)
);

const base = `project P:\n  version 6\n  title "P"\n  duration_unit point\n  finish DONE\n  dag_owner user\n\nmilestone START:\n  title "Start"\n  state reached\n\nmilestone MID:\n  title "Mid"\n\nmilestone DONE:\n  title "Done"\n\ntask BUILD START -> MID:\n  title "Build"\n  duration 1p\n  status done\n\ntask SHIP MID -> DONE:\n  title "Ship"\n  duration 1p\n`;

function migration(text = base, objectFormat = "sha1") {
  const length = objectFormat === "sha1" ? 40 : 64;
  const head = commits[0].slice(0, length).padEnd(length, "1");
  const blob = blobs[0].slice(0, length).padEnd(length, "9");
  return planMilestoneAcceptanceMigration(text, {
    repositoryId,
    repositoryRelativePath: path,
    objectFormat,
    headCommit: head,
    headBlob: blob,
    stage0Blob: blob,
    sourceDigest: digestDocumentBytes(encoder.encode(text)),
  }).candidateText;
}

function set(text, id = "MID_R1", revisionId = "R1") {
  return planCriterionSetReplacement(text, {
    setId: id,
    milestoneId: "MID",
    revisionId,
    criteria: [{
      criterionId: "BUILD_OK",
      required: true,
      evidenceKind: "command",
      description: "Build is accepted",
    }],
  }).updatedText;
}

function verify(text, setId = "MID_R1", receiptId = "MID_OK") {
  return planAcceptanceReceiptMutation(text, {
    receiptId,
    setId,
    criterionId: "BUILD_OK",
    action: "verify",
    evidenceKind: "command",
    evidenceReference: "npm run check",
    evidenceRevision: "abc123",
    verifier: "codex",
    occurredAt: "2026-08-12T12:00:00Z",
  }).updatedText;
}

function advance(text) {
  const result = planMilestoneAcceptanceAdvance(text, {
    provisionalPlanner: (source) => planTargetPlanAssuranceAdvance(
      source,
      TARGET_GRAMMAR_6_CAPABILITY,
      { governance: { intent: "preview" } },
    ),
  });
  assert.equal(result.ok, true);
  return result.canonical.updatedText;
}

function evidence(values, { objectFormat = "sha1", lower = 0 } = {}) {
  const length = objectFormat === "sha1" ? 40 : 64;
  const snapshots = values.map((text, index) => {
    const bytes = text === null ? null : encoder.encode(text);
    const commitId = commits[index].slice(0, length).padEnd(length, String(index + 1));
    const blobId = blobs[index].slice(0, length).padEnd(length, (index + 9).toString(16));
    return {
      modelVersion: 1,
      objectFormat,
      repositoryId,
      repositoryReadSnapshotId: `git-read:sha256:${"b".repeat(64)}`,
      repositoryRelativePath: path,
      commitId,
      parentCommitIds: index === 0 ? [] : [commits[index - 1].slice(0, length).padEnd(length, String(index))],
      blobId: bytes === null ? null : blobId,
      sourceDigest: bytes === null ? null : digestDocumentBytes(bytes),
      source: bytes,
      recordedAt: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      isMergeCommit: false,
      isEndpoint: index === values.length - 1,
      isLowerBoundary: index === lower,
    };
  }).slice(lower);
  return {
    ok: true,
    modelVersion: 1,
    status: "complete",
    ancestryProfile: "first_parent",
    objectFormat,
    repositoryId,
    repositoryReadSnapshotId: `git-read:sha256:${"b".repeat(64)}`,
    repositoryRelativePath: path,
    requestedEndpoint: "HEAD",
    resolvedEndpoint: snapshots.at(-1).commitId,
    requestedLowerBoundary: snapshots[0].commitId,
    resolvedLowerBoundary: snapshots[0].commitId,
    oldestInspectedCommitId: snapshots[0].commitId,
    currentSourceDigest: snapshots.at(-1).sourceDigest,
    aggregateRawSnapshotBytes: snapshots.reduce((sum, item) => sum + (item.source?.byteLength ?? 0), 0),
    limits: { inspectedCommits: 2048, rawBytesPerSnapshot: 8388608, aggregateRawSnapshotBytes: 134217728 },
    inspectedCommitIds: snapshots.map(({ commitId }) => commitId),
    snapshots,
    causes: [],
  };
}

test("Contract 7 checkpoints remain explicitly not applicable", () => {
  const result = reconstructHistoricalMilestoneAcceptance(evidence([base]));
  assert.equal(result.model, HISTORICAL_MILESTONE_ACCEPTANCE_MODEL);
  assert.equal(result.status, "complete");
  assert.equal(result.checkpoints[0].status, "not_applicable");
  assert.equal(result.checkpoints[0].evaluation, null);
});

test("Grammar 7 binds migration and evaluates each exact checkpoint", () => {
  const migrated = migration();
  const pending = set(migrated);
  const accepted = verify(pending);
  const result = reconstructHistoricalMilestoneAcceptance(evidence([
    base,
    migrated,
    pending,
    accepted,
  ]));
  assert.equal(result.status, "complete");
  assert.deepEqual(result.checkpoints.map(({ status }) => status), [
    "not_applicable",
    "available",
    "available",
    "available",
  ]);
  assert.equal(result.checkpoints[1].evaluation.milestones.find(({ milestoneId }) => milestoneId === "MID").acceptance, "not_declared");
  assert.equal(result.checkpoints[2].evaluation.milestones.find(({ milestoneId }) => milestoneId === "MID").acceptance, "pending");
  assert.equal(result.checkpoints[3].evaluation.milestones.find(({ milestoneId }) => milestoneId === "MID").acceptance, "accepted");
});

test("criterion replacement preserves deleted revision only in prior checkpoints", () => {
  const migrated = migration();
  const r1 = verify(set(migrated));
  const r2 = verify(set(r1, "MID_R2", "R2"), "MID_R2", "MID_OK_R2");
  const result = reconstructHistoricalMilestoneAcceptance(evidence([base, migrated, r1, r2]));
  assert.deepEqual(result.checkpoints[2].records.map(({ id }) => id), [
    "GRAMMAR_7_BASELINE",
    "MID_R1",
    "MID_OK",
  ]);
  assert.deepEqual(result.checkpoints[3].records.map(({ id }) => id), [
    "GRAMMAR_7_BASELINE",
    "MID_R2",
    "MID_OK_R2",
  ]);
});

test("historical canonical advance requires exact acceptance-aware bytes", () => {
  const migrated = migration();
  const accepted = verify(set(migrated));
  const advanced = advance(accepted);
  const result = reconstructHistoricalMilestoneAcceptance(evidence([
    base,
    migrated,
    accepted,
    advanced,
  ]));
  assert.equal(result.status, "complete");
  assert.equal(result.canonical_advance_proofs.length, 1);
  assert.deepEqual(result.canonical_advance_proofs[0].affected_milestone_ids, ["START", "MID"]);
  assert.deepEqual(result.canonical_advance_proofs[0].accepted_milestone_ids, ["MID"]);
  const edited = `${advanced}\n`;
  const mismatch = reconstructHistoricalMilestoneAcceptance(evidence([
    base,
    migrated,
    accepted,
    edited,
  ]));
  assert.equal(mismatch.status, "incomplete");
  assert.equal(mismatch.causes.some(({ cause }) => cause === "migration_missing"), true);
  assert.equal(mismatch.canonical_advance_proofs.length, 0);
});

test("missing migration baseline and Contract regression fail closed", () => {
  const migrated = migration();
  const missing = reconstructHistoricalMilestoneAcceptance(evidence([base, migrated], { lower: 1 }));
  assert.equal(missing.status, "incomplete");
  assert.equal(missing.causes.some(({ cause }) => cause === "migration_baseline_unavailable"), true);
  const regression = reconstructHistoricalMilestoneAcceptance(evidence([base, migrated, base]));
  assert.equal(regression.causes.some(({ cause }) => cause === "contract_regression"), true);
});

test("SHA-256 evidence keeps the same opaque migration boundary", () => {
  const shaBase = base;
  const migrated = migration(shaBase, "sha256");
  const result = reconstructHistoricalMilestoneAcceptance(evidence([shaBase, migrated], { objectFormat: "sha256" }));
  assert.equal(result.status, "complete");
  assert.equal(result.checkpoints[1].status, "available");
});

test("public historical projection exposes the shared checkpoint model", async () => {
  const migrated = migration();
  const accepted = verify(set(migrated));
  const captured = evidence([base, migrated, accepted]);
  const result = await inspectTargetHistoricalGraphFile({
    targetPath: path,
    view: "timeline",
  }, {
    probe: async () => captured,
  });
  assert.equal(result.ok, true);
  assert.equal(result.milestoneAcceptanceHistory.status, "complete");
  const json = targetHistoricalGraphResultToJson(result);
  assert.equal(json.cli_contract_version, 8);
  assert.equal(json.milestone_acceptance_history.model, HISTORICAL_MILESTONE_ACCEPTANCE_MODEL);
  assert.equal(json.milestone_acceptance_history.checkpoints.at(-1).evaluation.milestones.find(
    ({ milestone_id }) => milestone_id === "MID",
  ).acceptance, "accepted");
  assert.match(renderTargetHistoricalGraphText(result), /ACCEPTANCE_CHECKPOINT/u);
});

test("all twelve history cases are dependency ordered", async () => {
  const fixture = JSON.parse(await readFile(new URL("fixtures/milestone-acceptance-history-v1.json", import.meta.url), "utf8"));
  const accepted = new Set();
  for (const value of fixture.cases) {
    for (const dependency of value.depends_on) assert.equal(accepted.has(dependency), true, `${value.id} before ${dependency}`);
    accepted.add(value.id);
  }
  assert.equal(accepted.size, 12);
});
