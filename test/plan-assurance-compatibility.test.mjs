import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  captureAssuranceOwnedSource,
  getPlanAssuranceProjectMetadata,
  inspectPlanAssuranceProjectHistory,
  PLAN_ASSURANCE_DIRECT_EDIT_GUIDANCE,
  planAssuranceSemanticDigest,
} from "../dist/assurance/compatibility.js";
import {
  hashFrontierAssuranceReceipt,
} from "../dist/assurance/canonical.js";
import {
  exportPlanAssuranceMermaid,
  importPlanAssuranceMermaid,
} from "../dist/assurance/mermaid.js";
import {
  planTargetPlanAssuranceMutation,
} from "../dist/assurance/mutation.js";
import {
  planTargetGrammar6UnitMigrationCandidate,
} from "../dist/application/target-unit-migration-candidate.js";
import {
  selectExactDurationGrammarBoundary,
} from "../dist/migration/grammar-boundary.js";
import {
  formatTargetGrammar6Document,
} from "../dist/formatter/target-source-formatter.js";
import {
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar6Document,
} from "../dist/semantic/target-validator.js";

const digest = (character) => `sha256:${character.repeat(64)}`;

const receiptContract = {
  model: "Perttool.FrontierAssuranceReceipt.v1",
  producerTaskId: "OLD",
  producerTaskContractHash: digest("b"),
  producerAssuranceHash: digest("c"),
  outcome: "conformant",
  consumers: [{ consumerTaskId: "B", relationMode: "both" }],
  sourceMilestoneId: "M0",
};

function unsealedSource() {
  return [
    "project COMPAT:",
    "  version 6",
    '  title "compatibility"',
    '  description "preserve assurance"',
    "  as_of 2026-08-04",
    "  duration_unit point",
    "  velocity 4p/1d",
    "  finish M2",
    "  goal_owner user",
    "  dag_owner user",
    "  plan_assurance_model 1",
    "  plan_assurance_hash_model 1",
    "",
    "milestone M0:",
    '  title "start"',
    "  state reached",
    "",
    "milestone M1:",
    '  title "middle"',
    "",
    "milestone M2:",
    '  title "finish"',
    "",
    "task A M0 -> M1:",
    '  title "A"',
    "  duration 4p",
    "  status planned",
    "",
    "task B M1 -> M2:",
    '  title "B"',
    "  duration 8p",
    "  status planned",
    "",
    "task_relation REL_A_B A -> B:",
    "  mode both",
    '  reason "pin the default"',
    "",
    "assurance_receipt AR_OLD:",
    "  model 1",
    `  receipt_hash ${hashFrontierAssuranceReceipt(receiptContract)}`,
    "  producer OLD",
    `  producer_contract_hash ${digest("b")}`,
    `  producer_assurance_hash ${digest("c")}`,
    "  outcome conformant",
    "  source_milestone M0",
    "  consumers:",
    "    B both",
    "",
    "work_event WE_A_START:",
    "  model 1",
    "  task A",
    "  kind start",
    "  occurred_at 2026-08-04T09:00:00+09:00",
    "  planned_value 4p",
    "",
    "work_event WE_A_FINISH:",
    "  model 1",
    "  task A",
    "  kind finish",
    "  occurred_at 2026-08-04T10:00:00+09:00",
    "  active_time 1h",
    "  effort 1ph",
    "",
  ].join("\n");
}

function assuredSource() {
  const sealed = planTargetPlanAssuranceMutation(
    unsealedSource(),
    {
      kind: "plan_assurance.seal",
      reason: "accepted compatibility baseline",
    },
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(sealed.ok, true, JSON.stringify(sealed.diagnostics));
  const completed = planTargetPlanAssuranceMutation(
    sealed.updatedText,
    {
      kind: "batch",
      mutations: [
        {
          kind: "task.set",
          id: "A",
          set: { status: "done" },
        },
        {
          kind: "plan_dependency.set",
          id: "REL_A_B",
          mode: "both",
          reason: "pin the default",
        },
      ],
    },
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(completed.ok, true, JSON.stringify(completed.diagnostics));
  const outcome = planTargetPlanAssuranceMutation(
    completed.updatedText,
    {
      kind: "task_outcome.add",
      id: "OUT_A",
      taskId: "A",
      status: "conformant",
      reason: "delivered as reviewed",
    },
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(outcome.ok, true, JSON.stringify(outcome.diagnostics));
  return outcome.updatedText;
}

function validated(text) {
  const checked = validateTargetGrammar6Document(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(
    checked.ok,
    true,
    checked.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.ok(checked.validatedDocument);
  return checked.validatedDocument;
}

function protectedBytes(text) {
  return captureAssuranceOwnedSource(text, validated(text)).records.map(
    ({ kind, id, sourceText }) => [kind, id, sourceText],
  );
}

test("Grammar 6 formatting preserves the complete assurance semantic projection", () => {
  const source = `\uFEFF${assuredSource()}`
    .replace("  version 6", "  version 0006")
    .replace("task_relation REL_A_B A -> B:", "task_relation  REL_A_B  A  ->  B:")
    .replaceAll("\n", "\r\n");
  const before = planAssuranceSemanticDigest(validated(source));
  const formatted = formatTargetGrammar6Document(
    source,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(formatted.ok, true);
  assert.equal(formatted.formattedText.startsWith("\uFEFFproject"), true);
  assert.equal(/(?<!\r)\n/.test(formatted.formattedText), false);
  assert.equal(
    planAssuranceSemanticDigest(validated(formatted.formattedText)),
    before,
  );
});

test("Grammar 6 unit migration retains version and assurance-owned bytes", () => {
  assert.deepEqual(
    selectExactDurationGrammarBoundary(
      6,
      [{ classification: "fraction", token: "1/3d" }],
      { migrationChanged: true, velocityDisposition: "retained" },
    ),
    {
      sourceGrammarVersion: 6,
      targetGrammarVersion: 6,
      grammarDisposition: "retained",
      requiresVersionUpgrade: false,
      reversibility: "exact",
      qualifications: [],
    },
  );
  const source = assuredSource();
  const before = protectedBytes(source);
  const result = planTargetGrammar6UnitMigrationCandidate(
    source,
    { targetUnit: "day" },
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.changed, true);
  assert.equal(result.sourceGrammarVersion, 6);
  assert.equal(result.targetGrammarVersion, 6);
  assert.match(result.updatedText, /  version 6\n/);
  assert.match(result.updatedText, /  duration_unit day\n/);
  assert.match(result.updatedText, /  duration 1d\n/);
  assert.match(result.updatedText, /  duration 2d\n/);
  assert.match(result.updatedText, /  planned_value 1d\n/);
  assert.deepEqual(protectedBytes(result.updatedText), before);
});

test("Grammar 6 project metadata and mixed batch retain explicit assurance", () => {
  const source = assuredSource();
  const metadata = getPlanAssuranceProjectMetadata(
    source,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(metadata.ok, true);
  assert.deepEqual(metadata.project.assurance, {
    enabled: true,
    modelVersion: 1,
    hashModelVersion: 1,
  });
  const before = protectedBytes(source);
  const batch = planTargetPlanAssuranceMutation(
    source,
    {
      kind: "batch",
      mutations: [
        {
          kind: "project.set",
          set: { targetDuration: "16p" },
        },
        {
          kind: "plan_dependency.set",
          id: "REL_A_B",
          mode: "both",
          reason: "pin the default",
        },
      ],
    },
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(batch.ok, true, JSON.stringify(batch.diagnostics));
  assert.match(
    batch.updatedText,
    /  plan_assurance_hash_model 1\n  target_duration 16p\n/,
  );
  assert.deepEqual(protectedBytes(batch.updatedText), before);
});

test("Grammar 6 history reduces actuals without deriving assurance from Git", () => {
  const source = assuredSource();
  const commitId = "a".repeat(40);
  const sourceDigest = digest("d");
  const probe = {
    ok: true,
    modelVersion: 1,
    status: "complete",
    traversal: "first_parent",
    objectFormat: "sha1",
    repositorySnapshotId: `git:sha1:${commitId}`,
    repositoryRelativePath: "plan.pert",
    requestedRevision: "HEAD",
    resolvedRevision: commitId,
    headCommitId: commitId,
    currentSourceDigest: sourceDigest,
    selectedSourceDigest: sourceDigest,
    inspectedCommitIds: [commitId],
    snapshots: [{
      repositorySnapshotId: `git:sha1:${commitId}`,
      relativePath: "plan.pert",
      commitId,
      parentCommitIds: [],
      recordedAt: "2026-08-04T10:01:00+09:00",
      sourceDigest,
      source: Buffer.from(source, "utf8"),
    }],
    availability: [],
  };
  const result = inspectPlanAssuranceProjectHistory(
    probe,
    { taskIds: ["A"] },
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.equal(result.grammarVersion, 6);
  assert.deepEqual(
    result.events.map(({ event }) => event.id),
    ["WE_A_FINISH", "WE_A_START"],
  );
  assert.equal(result.tasks[0].coverage, "complete");
  assert.equal("assurance" in result, false);
  assert.equal("planSeals" in result, false);
});

test("Mermaid profile 2 round-trips Grammar 6 and older profiles report exact loss", () => {
  const source = assuredSource();
  const exported = exportPlanAssuranceMermaid(
    source,
    TARGET_GRAMMAR_6_CAPABILITY,
    { profile: 2 },
  );
  assert.equal(exported.ok, true, JSON.stringify(exported.diagnostics));
  assert.equal(exported.lossReport.lossless, true);
  assert.match(exported.artifact, /Perttool\.MermaidProfile\.v2/);
  const imported = importPlanAssuranceMermaid(
    exported.artifact,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(imported.ok, true, JSON.stringify(imported.diagnostics));
  assert.equal(imported.sourceText, exported.canonicalSource);
  assert.equal(
    imported.assuranceSemanticDigest,
    exported.assuranceSemanticDigest,
  );
  const damagedProjection = importPlanAssuranceMermaid(
    exported.artifact.replace("ptm_M0", "ptm_BROKEN"),
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(damagedProjection.ok, false);
  assert.equal(damagedProjection.sourceText, null);

  for (const profile of [1, "plain"]) {
    const strict = exportPlanAssuranceMermaid(
      source,
      TARGET_GRAMMAR_6_CAPABILITY,
      { profile },
    );
    assert.equal(strict.ok, false);
    assert.equal(strict.artifact, null);
    const lossy = exportPlanAssuranceMermaid(
      source,
      TARGET_GRAMMAR_6_CAPABILITY,
      { profile, allowLoss: true },
    );
    assert.equal(lossy.ok, true);
    assert.equal(lossy.lossReport.lossless, false);
    assert.deepEqual(
      lossy.lossReport.records.map(({ elementId }) => elementId),
      protectedBytes(source).map(([, id]) => id),
    );
  }
});

test("compatibility modules ship internally while Contract 6 remains unchanged", async () => {
  for (const name of [
    "captureAssuranceOwnedSource",
    "getPlanAssuranceProjectMetadata",
    "inspectPlanAssuranceProjectHistory",
    "exportPlanAssuranceMermaid",
    "planTargetGrammar6UnitMigrationCandidate",
    "PLAN_ASSURANCE_DIRECT_EDIT_GUIDANCE",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
  assert.match(
    PLAN_ASSURANCE_DIRECT_EDIT_GUIDANCE.boundaries.join(" "),
    /does not add, replace, or repair a plan_seal/,
  );
  assert.match(
    PLAN_ASSURANCE_DIRECT_EDIT_GUIDANCE.boundaries.join(" "),
    /does not accept a plan or authorize reseal or persistence/,
  );
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(packageJson.files, ["dist", "schemas", "CHANGELOG.md"]);
  const rootTypes = await readFile(
    new URL("../dist/index.d.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(rootTypes, /PlanAssuranceMermaid|Grammar6UnitMigration/);
});
