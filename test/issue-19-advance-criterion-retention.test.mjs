import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkDocument,
  planAcceptanceReceiptMutation,
  planAdvance,
  planCriterionSetReplacement,
  planMilestoneAcceptanceAdvance,
  planMilestoneAcceptanceMigration,
} from "../dist/index.js";
import {
  planTargetPlanAssuranceAdvance,
} from "../dist/assurance/advance.js";
import {
  planTargetPlanAssuranceMutation,
} from "../dist/assurance/mutation.js";
import { sha256DigestUtf8 } from "../dist/model/sha256.js";
import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  parseMilestoneAcceptanceSource,
} from "../dist/milestone-acceptance/source.js";
import {
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../dist/parser/document-parser.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

function runJson(args, options = {}) {
  const result = run([...args, "--format", "json"], options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function git(directory, ...args) {
  const result = spawnSync("git", args, {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function baseSource() {
  return [
    "project ISSUE_19:",
    "  version 6",
    '  title "Retained criterion regression"',
    "  duration_unit point",
    "  finish M3",
    "  dag_owner user",
    "",
    "milestone M0:",
    '  title "start"',
    "  state reached",
    "",
    "milestone M1:",
    '  title "first frontier"',
    "",
    "milestone M2:",
    '  title "second frontier"',
    "",
    "milestone M3:",
    '  title "finish"',
    "",
    "task A M0 -> M1:",
    '  title "first producer"',
    "  duration 1p",
    "  status done",
    "",
    "task B M1 -> M2:",
    '  title "second producer"',
    "  duration 1p",
    "  status planned",
    "",
    "task C M2 -> M3:",
    '  title "retained consumer"',
    "  duration 1p",
    "  status planned",
    "",
  ].join("\n");
}

function assuranceMutation(text, request) {
  const result = planTargetPlanAssuranceMutation(
    text,
    request,
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.updatedText;
}

function declarationBlock(text, header) {
  const start = text.indexOf(header);
  assert.notEqual(start, -1, header);
  const next = text.indexOf("\n\n", start);
  return text.slice(start, next === -1 ? text.length : next).trimEnd();
}

function acceptanceRecordText(text, id) {
  const parsed = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  assert.equal(parsed.ok, true, JSON.stringify(parsed.diagnostics));
  const record = parsed.records.find((candidate) => candidate.id === id);
  assert.ok(record, id);
  return text.slice(record.span.start.offset, record.span.end.offset);
}

function issue19Source() {
  let text = assuranceMutation(baseSource(), {
    kind: "plan_assurance.seal",
    reason: "Accepted Issue #19 regression basis",
  });
  text = assuranceMutation(text, {
    kind: "task_outcome.add",
    id: "OUT_A",
    taskId: "A",
    status: "conformant",
    reason: "Accepted first producer",
  });
  const first = planTargetPlanAssuranceAdvance(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  assert.equal(first.ok, true, JSON.stringify(first.diagnostics));
  assert.match(first.updatedText, /assurance_receipt AR_A:/u);

  text = first.updatedText.replace(
    /(task B M1 -> M2:[\s\S]*?  status )planned/u,
    "$1done",
  );
  text = text.replace(
    /(task C M2 -> M3:[\s\S]*?  status )planned/u,
    "$1active",
  );
  text = assuranceMutation(text, {
    kind: "task_outcome.add",
    id: "OUT_B",
    taskId: "B",
    status: "conformant",
    reason: "Accepted second producer",
  });
  text = [
    text.trimEnd(),
    "",
    "work_event WE_C_START:",
    "  model 1",
    "  task C",
    "  kind start",
    "  occurred_at 2026-08-14T07:46:00+00:00",
    "  planned_value 1p",
    "",
  ].join("\n");
  const migrated = planMilestoneAcceptanceMigration(text, {
    repositoryId: "issue-19-regression",
    repositoryRelativePath: "plan.pert",
    objectFormat: "sha1",
    headCommit: "a".repeat(40),
    headBlob: "b".repeat(40),
    stage0Blob: "b".repeat(40),
    sourceDigest: sha256DigestUtf8(text),
  });
  assert.equal(migrated.ok, true, JSON.stringify(migrated.diagnostics));
  text = migrated.candidateText;

  const secondFrontier = planCriterionSetReplacement(text, {
    milestoneId: "M2",
    setId: "M2_R1",
    revisionId: "R1",
    criteria: [{
      criterionId: "SECOND_ACCEPTED",
      required: true,
      evidenceKind: "test",
      description: "The second frontier is accepted",
    }],
  });
  assert.equal(secondFrontier.ok, true, JSON.stringify(secondFrontier.diagnostics));
  text = secondFrontier.updatedText;
  const secondReceipt = planAcceptanceReceiptMutation(text, {
    receiptId: "RCPT_M2_ACCEPTED",
    setId: "M2_R1",
    criterionId: "SECOND_ACCEPTED",
    action: "verify",
    evidenceKind: "test",
    evidenceReference: "node --test issue-19",
    evidenceRevision: "abc123",
    verifier: "codex",
    occurredAt: "2026-08-14T07:45:00Z",
  });
  assert.equal(secondReceipt.ok, true, JSON.stringify(secondReceipt.diagnostics));
  text = secondReceipt.updatedText;
  const finish = planCriterionSetReplacement(text, {
    milestoneId: "M3",
    setId: "M3_R1",
    revisionId: "R1",
    criteria: [{
      criterionId: "FINISH_DECLARED",
      required: true,
      evidenceKind: "artifact",
      description: "The retained finish contract remains declared",
    }],
  });
  assert.equal(finish.ok, true, JSON.stringify(finish.diagnostics));
  text = finish.updatedText;

  const headers = [
    "milestone_criterion_set M3_R1:",
    "milestone_criterion_set M2_R1:",
    "milestone_acceptance_receipt RCPT_M2_ACCEPTED:",
  ];
  const blocks = headers.map((header) => declarationBlock(text, header));
  for (const block of blocks) text = text.replace(block, "");
  text = text.replace(
    "work_event WE_C_START:",
    `${blocks.join("\n\n")}\n\nwork_event WE_C_START:`,
  );
  return text;
}

test("Issue #19 retains criterion sets for every milestone kept by advance", () => {
  const source = issue19Source();
  assert.equal(
    checkDocument(source).diagnostics.some(({ code }) => code === "PTMAC-102"),
    false,
  );
  const finishBefore = acceptanceRecordText(source, "M3_R1");
  const frontierBefore = acceptanceRecordText(source, "M2_R1");
  const receiptBefore = acceptanceRecordText(source, "RCPT_M2_ACCEPTED");

  const result = planMilestoneAcceptanceAdvance(source, {
    provisionalPlanner: (baseText) => planAdvance(baseText),
  });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.provisional.advance.keptMilestoneIds, ["M2", "M3"]);
  assert.deepEqual(result.provisional.advance.stateChangedMilestoneIds, ["M2"]);
  assert.equal(
    acceptanceRecordText(result.provisional.updatedText, "M3_R1"),
    finishBefore,
  );
  assert.equal(
    acceptanceRecordText(result.provisional.updatedText, "M2_R1"),
    frontierBefore,
  );
  assert.equal(
    acceptanceRecordText(result.provisional.updatedText, "RCPT_M2_ACCEPTED"),
    receiptBefore,
  );
  assert.equal(
    checkDocument(result.provisional.updatedText).diagnostics.some(
      ({ code }) => code === "PTMAC-102",
    ),
    false,
  );
});

test("Issue #19 CLI preview, output, and write share the checked candidate", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-issue-19."));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  git(directory, "init", "-q");
  git(directory, "config", "user.name", "Perttool Test");
  git(directory, "config", "user.email", "perttool@example.invalid");
  const pathname = path.join(directory, "plan.pert");
  writeFileSync(pathname, issue19Source(), "utf8");
  git(directory, "add", "plan.pert");
  git(directory, "commit", "-qm", "record pre-advance acceptance");

  const preview = runJson(["dag", "advance", pathname]);
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.diagnostics, []);
  assert.match(preview.updated_text, /milestone_criterion_set M3_R1:/u);
  assert.match(preview.updated_text, /milestone_criterion_set M2_R1:/u);
  assert.match(
    preview.updated_text,
    /milestone_acceptance_receipt RCPT_M2_ACCEPTED:/u,
  );

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
  assert.equal(separate.updated_digest, preview.updated_digest);
  assert.equal(separate.updated_text, preview.updated_text);
  assert.equal(readFileSync(output, "utf8"), preview.updated_text);

  const written = runJson([
    "dag",
    "advance",
    pathname,
    "--write",
    "--actor",
    "user",
  ]);
  assert.equal(written.updated_digest, preview.updated_digest);
  assert.equal(written.updated_text, preview.updated_text);
  assert.equal(written.history_guard.status, "passed");
  assert.equal(readFileSync(pathname, "utf8"), preview.updated_text);
  const checked = runJson([
    "document",
    "check",
    pathname,
    "--warnings-as-errors",
  ]);
  assert.equal(checked.ok, true);
  assert.deepEqual(checked.diagnostics, []);
});

test("dag advance reports diagnostics from the final Contract 8 candidate", () => {
  const source = issue19Source();
  const missingFinish = source.replace(
    declarationBlock(source, "milestone_criterion_set M3_R1:"),
    "",
  );
  const preview = runJson(["dag", "advance", "-"], {
    input: missingFinish,
  });
  assert.equal(preview.ok, true);
  assert.equal(
    preview.diagnostics.some(
      ({ code, entity_id: entityId }) =>
        code === "PTMAC-102" && entityId === "M3",
    ),
    true,
  );
});

test("Issue #19 correction boundary is documented across normative surfaces", () => {
  const requirements = readFileSync(
    path.join(root, "docs", "requirements.md"),
    "utf8",
  );
  const design = readFileSync(
    path.join(root, "docs", "basic-design.md"),
    "utf8",
  );
  const contract = readFileSync(
    path.join(root, "docs", "specs", "contract8-emergency-corrections.md"),
    "utf8",
  );
  const acceptance = readFileSync(
    path.join(
      root,
      "docs",
      "process",
      "issue-19-advance-criterion-acceptance.md",
    ),
    "utf8",
  );
  const backlog = readFileSync(path.join(root, "docs", "backlog.md"), "utf8");

  assert.match(requirements, /21\.20 Retained milestone acceptance/u);
  assert.match(design, /Slice 4X: Retained milestone acceptance/u);
  assert.match(contract, /final `keptMilestoneIds` set/u);
  assert.match(acceptance, /docs-process-issue-19-advance-criterion-rca/u);
  assert.match(acceptance, /sha256:26d3a6dc49da2da3c73e3384573cd33/u);
  assert.match(backlog, /Status: Local correction accepted \(2026-08-14\)/u);
});
