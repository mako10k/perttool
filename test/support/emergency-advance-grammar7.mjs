import assert from "node:assert/strict";
import {
  checkDocument,
  planAcceptanceReceiptMutation,
  planAdvance,
  planCriterionSetReplacement,
  planMilestoneAcceptanceAdvance,
  planMilestoneAcceptanceMigration,
} from "../../dist/index.js";
import { planTargetPlanAssuranceMutation } from "../../dist/assurance/mutation.js";
import { sha256DigestUtf8 } from "../../dist/model/sha256.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../../dist/parser/document-parser.js";

function appendDeclaration(text, lines, lineEnding, separatorBlankLines) {
  return `${text.trimEnd()}${lineEnding.repeat(separatorBlankLines + 1)}${
    lines.join(lineEnding)
  }${lineEnding}`;
}

function grammar6Source({ lineEnding, separatorBlankLines, retainedEvent }) {
  let source = [
    "project EMERGENCY_ADVANCE:",
    "  version 6",
    '  title "Grammar 7 emergency advance regression"',
    "  duration_unit point",
    "  finish M2",
    "  dag_owner user",
    "",
    "milestone M0:",
    '  title "start"',
    "  state reached",
    "",
    "milestone M1:",
    '  title "accepted frontier"',
    "",
    "milestone M2:",
    '  title "finish"',
    "",
    "task A M0 -> M1:",
    '  title "completed producer"',
    "  duration 1p",
    "  status done",
    "",
    "task B M1 -> M2:",
    '  title "retained consumer"',
    "  duration 1p",
    `  status ${retainedEvent ? "active" : "planned"}`,
    "",
  ].join(lineEnding);
  const sealed = planTargetPlanAssuranceMutation(
    source,
    { kind: "plan_assurance.seal", reason: "Accepted emergency regression basis" },
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  assert.equal(sealed.ok, true, JSON.stringify(sealed.diagnostics));
  const outcome = planTargetPlanAssuranceMutation(
    sealed.updatedText,
    {
      kind: "task_outcome.add",
      id: "OUT_A",
      taskId: "A",
      status: "conformant",
      reason: "Accepted producer result",
    },
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  assert.equal(outcome.ok, true, JSON.stringify(outcome.diagnostics));
  source = appendDeclaration(outcome.updatedText, [
    "work_event WE_A_START:",
    "  model 1",
    "  task A",
    "  kind start",
    "  occurred_at 2026-08-14T00:00:00+00:00",
    "  planned_value 1p",
  ], lineEnding, separatorBlankLines);
  source = appendDeclaration(source, [
    "work_event WE_A_FINISH:",
    "  model 1",
    "  task A",
    "  kind finish",
    "  occurred_at 2026-08-14T01:00:00+00:00",
    "  active_time 1h",
    "  effort 1ph",
  ], lineEnding, separatorBlankLines);
  if (retainedEvent) {
    source = appendDeclaration(source, [
      "work_event WE_B_START:",
      "  model 1",
      "  task B",
      "  kind start",
      "  occurred_at 2026-08-14T01:01:00+00:00",
      "  planned_value 1p",
    ], lineEnding, separatorBlankLines);
  }
  return source;
}

function acceptedGrammar7Source(options) {
  const base = grammar6Source(options);
  const migrated = planMilestoneAcceptanceMigration(base, {
    repositoryId: "emergency-advance-regression",
    repositoryRelativePath: "plan.pert",
    objectFormat: "sha1",
    headCommit: "a".repeat(40),
    headBlob: "b".repeat(40),
    stage0Blob: "b".repeat(40),
    sourceDigest: sha256DigestUtf8(base),
  });
  assert.equal(
    migrated.ok,
    true,
    JSON.stringify({
      migration: migrated.diagnostics,
      source: checkDocument(base).diagnostics,
    }),
  );
  const provisional = planMilestoneAcceptanceAdvance(migrated.candidateText, {
    provisionalPlanner: (text) => planAdvance(text),
  });
  const blocked = provisional.acceptanceGuard?.blockedMilestones.find(
    ({ milestoneId }) => milestoneId === "M1",
  );
  assert.ok(blocked);
  const criterion = planCriterionSetReplacement(migrated.candidateText, {
    milestoneId: "M1",
    setId: "M1_R1",
    revisionId: "R1",
    criteria: [{
      criterionId: "M1_ACCEPTED",
      required: true,
      evidenceKind: "command",
      description: "The frontier is accepted",
    }],
  });
  assert.equal(criterion.ok, true, JSON.stringify(criterion.diagnostics));
  const receipt = planAcceptanceReceiptMutation(criterion.updatedText, {
    receiptId: "RCPT_M1_ACCEPTED",
    setId: "M1_R1",
    criterionId: "M1_ACCEPTED",
    action: "verify",
    evidenceKind: "command",
    evidenceReference: "npm test",
    evidenceRevision: "abc123",
    verifier: "codex",
    occurredAt: "2026-08-14T01:02:00Z",
  });
  assert.equal(receipt.ok, true, JSON.stringify(receipt.diagnostics));
  return receipt.updatedText;
}

function declarationBlock(text, header) {
  const lineEnding = text.includes("\r\n") ? "\r\n" : "\n";
  const start = text.indexOf(header);
  assert.notEqual(start, -1, header);
  const next = text.indexOf(`${lineEnding}${lineEnding}`, start);
  const end = next === -1 ? text.length : next;
  return text.slice(start, end).trimEnd();
}

export function buildEmergencyAdvanceSource({
  topology,
  lineEnding = "\n",
  separatorBlankLines = 1,
  finalNewline = true,
  retainedEvent = false,
}) {
  const source = acceptedGrammar7Source({
    lineEnding,
    separatorBlankLines,
    retainedEvent,
  });
  const headers = [
    "milestone_criterion_set M1_R1:",
    "milestone_acceptance_receipt RCPT_M1_ACCEPTED:",
    "work_event WE_A_START:",
    "work_event WE_A_FINISH:",
    ...(retainedEvent ? ["work_event WE_B_START:"] : []),
  ];
  const blocks = new Map(headers.map((header) => [
    header,
    declarationBlock(source, header),
  ]));
  let prefix = source;
  for (const block of blocks.values()) {
    prefix = prefix.replace(block, "");
  }
  const orderedHeaders = topology === "receipt-between-events"
    ? [
        "milestone_criterion_set M1_R1:",
        "work_event WE_A_START:",
        "milestone_acceptance_receipt RCPT_M1_ACCEPTED:",
        "work_event WE_A_FINISH:",
        ...(retainedEvent ? ["work_event WE_B_START:"] : []),
      ]
    : [
        "work_event WE_A_START:",
        "work_event WE_A_FINISH:",
        "milestone_criterion_set M1_R1:",
        "milestone_acceptance_receipt RCPT_M1_ACCEPTED:",
        ...(retainedEvent ? ["work_event WE_B_START:"] : []),
      ];
  const separator = lineEnding.repeat(separatorBlankLines + 1);
  const result = [
    prefix.trimEnd(),
    ...orderedHeaders.map((header) => blocks.get(header)),
  ].join(separator);
  return finalNewline ? `${result}${lineEnding}` : result;
}
