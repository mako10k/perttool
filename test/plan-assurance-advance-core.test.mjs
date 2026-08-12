import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  planTargetPlanAssuranceAdvance,
} from "../dist/assurance/advance.js";
import {
  planTargetPlanAssuranceMutation,
} from "../dist/assurance/mutation.js";
import {
  planTargetActualsAdvance,
} from "../dist/application/target-actuals-advance.js";
import {
  prepareTargetPlanAssuranceAdvanceHistory,
} from "../dist/application/target-assurance-advance-history.js";
import {
  persistTargetPlanAssuranceResult,
} from "../dist/application/target-assurance-write.js";
import {
  TARGET_GRAMMAR_5_CAPABILITY,
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  deriveAdvanceDestructiveRecords,
} from "../dist/history/advance-history.js";
import {
  validateTargetGrammar6Document,
} from "../dist/semantic/target-validator.js";

function source(lineEnding = "\n") {
  return [
    "project ASSURE_ADVANCE:",
    "  version 5",
    '  title "assurance advance"',
    "  as_of 2026-08-04",
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
    "# producer comment is advance-owned with A",
    "task A M0 -> M1:",
    '  title "A"',
    "  duration 1p",
    "  status done",
    "",
    "# retained consumer comment stays byte-identical",
    "task B M1 -> M2:",
    '  title "B"',
    "  duration 1p",
    "  status planned",
    "",
  ].join(lineEnding);
}

function multiConsumerSource() {
  return [
    "project ASSURE_RECEIPT_PRUNE:",
    "  version 5",
    '  title "receipt pruning"',
    "  as_of 2026-08-04",
    "  duration_unit point",
    "  velocity 2p/1d",
    "  finish M4",
    "  dag_owner user",
    "",
    "milestone M0:",
    '  title "start"',
    "  state reached",
    "",
    "milestone M1:",
    '  title "after A"',
    "",
    "milestone M2:",
    '  title "after B"',
    "",
    "milestone M3:",
    '  title "after C"',
    "",
    "milestone M4:",
    '  title "finish"',
    "",
    "task A M0 -> M1:",
    '  title "A"',
    "  duration 1p",
    "  status done",
    "",
    "task B M1 -> M2:",
    '  title "B"',
    "  duration 1p",
    "  status planned",
    "",
    "task D M2 -> M4:",
    '  title "D"',
    "  duration 1p",
    "  status planned",
    "",
    "task C M0 -> M3:",
    '  title "C"',
    "  duration 1p",
    "  status planned",
    "",
    "gate G M3 -> M4:",
    '  reason "C must also complete"',
    "",
  ].join("\n");
}

function mutate(text, request) {
  const result = planTargetPlanAssuranceMutation(
    text,
    request,
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  assert.equal(
    result.ok,
    true,
    result.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  return result.updatedText;
}

function sealed(outcome = "conformant", lineEnding = "\n") {
  const enabled = mutate(source(lineEnding), {
    kind: "plan_assurance.seal",
    reason: "Accepted initial planning basis",
  });
  return mutate(enabled, {
    kind: "task_outcome.add",
    id: "OUT_A",
    taskId: "A",
    status: outcome,
    ...(outcome === "changed" ? { summary: "A delivered a reviewed alternative" } : {}),
    reason: "Reviewed completion evidence",
  });
}

function withTerminalWorkEvents(text, { retainConsumerEvent = false } = {}) {
  const sourceText = retainConsumerEvent
    ? text.replace("  status planned", "  status active")
    : text;
  return [
    sourceText.trimEnd(),
    "",
    "work_event WE_A_START:",
    "  model 1",
    "  task A",
    "  kind start",
    "  occurred_at 2026-08-04T09:00:00+09:00",
    "  planned_value 1p",
    "",
    "work_event WE_A_FINISH:",
    "  model 1",
    "  task A",
    "  kind finish",
    "  occurred_at 2026-08-04T10:00:00+09:00",
    "  active_time 1h",
    "  effort 1ph",
    ...(retainConsumerEvent
      ? [
          "",
          "work_event WE_B_START:",
          "  model 1",
          "  task B",
          "  kind start",
          "  occurred_at 2026-08-04T10:00:00+09:00",
          "  planned_value 1p",
        ]
      : []),
    "",
  ].join("\n");
}

function advance(text, governance = { intent: "preview" }) {
  return planTargetPlanAssuranceAdvance(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance },
  );
}

function assertValid(text) {
  const checked = validateTargetGrammar6Document(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(
    checked.ok,
    true,
    checked.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
}

test("assurance advance remains internal while disabled documents retain the ordinary candidate", () => {
  assert.equal("planTargetPlanAssuranceAdvance" in publicApi, false);
  const ordinary = planTargetActualsAdvance(
    source(),
    TARGET_GRAMMAR_5_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  const assurance = advance(source());
  assert.equal(assurance.ok, true);
  assert.equal(assurance.schemaVersion, "Perttool.AdvanceResult.v2");
  assert.equal(assurance.updatedText, ordinary.updatedText);
  assert.equal(assurance.assuranceGuard.status, "not_applicable");
  assert.equal(assurance.assuranceGuard.cause, "not_enabled");
  assert.deepEqual(assurance.governance.affectedScopes, ["dag"]);
});

test("advance contracts one conformant producer into a deterministic receipt and preserves every retained basis", () => {
  const original = sealed();
  const result = advance(original);
  assert.equal(
    result.ok,
    true,
    result.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.deepEqual(result.advance.removedTaskIds, ["A"]);
  assert.deepEqual(result.assuranceGuard.crossingProducerTaskIds, ["A"]);
  assert.deepEqual(result.assuranceGuard.createdReceiptIds, ["AR_A"]);
  assert.equal(result.assuranceGuard.status, "passed");
  assert.ok(result.assuranceGuard.retainedBasisChecks.every(({ equal }) => equal));
  assert.match(result.updatedText, /assurance_receipt AR_A:/);
  assert.match(result.updatedText, /  producer A\n/);
  assert.match(result.updatedText, /  outcome conformant\n/);
  assert.match(result.updatedText, /  source_milestone M1\n/);
  assert.match(result.updatedText, /  consumers:\n    B both\n/);
  assert.doesNotMatch(result.updatedText, /task A /);
  assert.doesNotMatch(result.updatedText, /plan_seal A:/);
  assert.doesNotMatch(result.updatedText, /task_outcome OUT_A:/);
  assert.match(result.updatedText, /# retained consumer comment stays byte-identical/);
  assert.deepEqual(result.governance.affectedScopes, ["dag", "plan_assurance"]);
  assertValid(result.updatedText);

  const repeated = advance(result.updatedText);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.updatedText, result.updatedText);
});

test("receipt creation precedes a terminal removed work-event suffix", () => {
  const original = withTerminalWorkEvents(sealed());
  assertValid(original);
  const result = advance(original);
  assert.equal(
    result.ok,
    true,
    result.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.match(result.updatedText, /assurance_receipt AR_A:/);
  assert.doesNotMatch(result.updatedText, /work_event WE_A_/);
  assert.equal(result.edits.some((edit) =>
    edit.startOffset === edit.endOffset &&
    edit.replacement.startsWith("assurance_receipt AR_A:")
  ), true);
  assertValid(result.updatedText);
});

test("receipt creation retains its existing work-event anchor when a consumer event remains", () => {
  const original = withTerminalWorkEvents(sealed(), { retainConsumerEvent: true });
  assertValid(original);
  const result = advance(original);
  assert.equal(
    result.ok,
    true,
    result.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.match(result.updatedText, /assurance_receipt AR_A:[\s\S]*work_event WE_B_START:/);
  assert.doesNotMatch(result.updatedText, /work_event WE_A_/);
  assertValid(result.updatedText);
});

test("changed outcome crossing blocks until the retained consumer accepts the exact commitment", () => {
  const changed = sealed("changed");
  const blocked = advance(changed);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.updatedText, null);
  assert.equal(blocked.assuranceGuard.status, "blocked");
  assert.equal(blocked.assuranceGuard.cause, "changed_outcome_not_accepted");
  assert.ok(blocked.diagnostics.some(({ code }) => code === "PTASSURE-306"));

  const resealed = mutate(changed, {
    kind: "plan_assurance.reseal",
    taskIds: ["B"],
    reason: "Accepted A changed outcome for B",
  });
  const accepted = advance(resealed);
  assert.equal(accepted.ok, true);
  assert.match(accepted.updatedText, /  outcome changed\n/);
  assert.ok(accepted.assuranceGuard.retainedBasisChecks.every(({ equal }) => equal));
});

test("an unavailable crossing producer and a damaged retained receipt fail closed", () => {
  const enabled = mutate(source(), {
    kind: "plan_assurance.seal",
    reason: "Accepted initial planning basis",
  });
  const missingOutcome = advance(enabled);
  assert.equal(missingOutcome.ok, false);
  assert.equal(
    missingOutcome.assuranceGuard.cause,
    "crossing_commitment_unavailable",
  );

  const contracted = advance(sealed());
  const damaged = contracted.updatedText.replace(
    /(receipt_hash sha256:)([a-f0-9])/,
    (_match, prefix, digit) => `${prefix}${digit === "0" ? "1" : "0"}`,
  );
  const blocked = advance(damaged);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.assuranceGuard.cause, "retained_receipt_unavailable");
  assert.ok(blocked.diagnostics.some(({ code }) => code === "PTASSURE-306"));
});

test("execution-only crossing removes the explicit relation without creating a receipt", () => {
  let text = sealed();
  text = mutate(text, {
    kind: "plan_dependency.add",
    id: "REL_A_B",
    predecessorTaskId: "A",
    successorTaskId: "B",
    mode: "execution_only",
    reason: "B planning is independent of A",
  });
  text = mutate(text, {
    kind: "plan_assurance.reseal",
    taskIds: ["B"],
    reason: "Accepted planning independence",
  });
  const result = advance(text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.assuranceGuard.createdReceiptIds, []);
  assert.doesNotMatch(result.updatedText, /task_relation REL_A_B/);
  assert.doesNotMatch(result.updatedText, /assurance_receipt/);
});

test("receipt IDs use the smallest deterministic collision suffix and BOM/CRLF are preserved", () => {
  const collision = `\uFEFF${sealed("conformant", "\r\n")}`.replace(
    "\r\nplan_seal A:",
    [
      "\r\nresource AR_A:",
      '  title "receipt ID collision"',
      "  capacity 1",
      "",
      "plan_seal A:",
    ].join("\r\n"),
  );
  assertValid(collision);
  const result = advance(collision);
  assert.equal(result.ok, true);
  assert.deepEqual(result.assuranceGuard.createdReceiptIds, ["AR_A_2"]);
  assert.equal(result.updatedText.startsWith("\uFEFF"), true);
  assert.match(result.updatedText, /assurance_receipt AR_A_2:\r\n/);
  assert.equal(/(^|[^\r])\n/.test(result.updatedText), false);
});

test("Grammar 6 history composition covers assurance-owned destructive records", async () => {
  const original = sealed();
  const result = advance(original);
  const prepared = await prepareTargetPlanAssuranceAdvanceHistory(
    original,
    result,
    TARGET_GRAMMAR_6_CAPABILITY,
    {
      mode: "preview",
      sourceBytes: Buffer.from(original, "utf8"),
      sourceModifiedAt: null,
    },
  );
  assert.equal(prepared.result.schemaVersion, "Perttool.AdvanceResult.v2");
  assert.equal(prepared.result.assuranceGuard.status, "passed");
  assert.equal(prepared.result.historyGuard.status, "not_applicable");
  assert.equal(prepared.result.historyGuard.cause, "preview");
  assert.ok(prepared.result.historyGuard.destructiveEntityIds.includes("OUT_A"));
  assert.deepEqual(result.advance.removedAssuranceRecordIds, ["A", "OUT_A"]);
});

test("force-history-loss never bypasses a blocked assurance guard", async () => {
  const original = sealed("changed");
  const blocked = advance(original);
  const prepared = await prepareTargetPlanAssuranceAdvanceHistory(
    original,
    blocked,
    TARGET_GRAMMAR_6_CAPABILITY,
    {
      mode: "in_place",
      sourceBytes: Buffer.from(original, "utf8"),
      sourceModifiedAt: null,
      targetPath: "/tmp/assurance-force-must-not-run.pert",
      forceRequested: true,
    },
  );
  assert.equal(prepared.result.ok, false);
  assert.equal(prepared.result.assuranceGuard.status, "blocked");
  assert.equal(prepared.result.historyGuard, null);
  assert.equal(prepared.baseline, null);
  assert.equal(prepared.result.diagnostics.some(({ code }) => code === "PTADV-103"), false);
});

test("planning-only consumers share one producer receipt which is rehashed and removed with its last consumer", () => {
  let text = mutate(multiConsumerSource(), {
    kind: "plan_assurance.seal",
    reason: "Accepted initial multi-branch basis",
  });
  text = mutate(text, {
    kind: "task_outcome.add",
    id: "OUT_A_MULTI",
    taskId: "A",
    status: "conformant",
    reason: "A completed to plan",
  });
  text = mutate(text, {
    kind: "plan_dependency.add",
    id: "REL_A_C",
    predecessorTaskId: "A",
    successorTaskId: "C",
    mode: "planning_only",
    reason: "C planning consumes A without execution order",
  });
  text = mutate(text, {
    kind: "plan_assurance.reseal",
    taskIds: ["C"],
    reason: "Accepted A as C planning input",
  });
  const first = advance(text);
  assert.equal(first.ok, true);
  assert.deepEqual(first.assuranceGuard.createdReceiptIds, ["AR_A"]);
  assert.match(first.updatedText, /  consumers:\n    B both\n    C planning_only\n/);
  const firstHash = /assurance_receipt AR_A:[\s\S]*?receipt_hash (sha256:[a-f0-9]{64})/
    .exec(first.updatedText)[1];

  text = first.updatedText.replace(
    /(task B M1 -> M2:[\s\S]*?  status )planned/,
    "$1done",
  );
  text = mutate(text, {
    kind: "task_outcome.add",
    id: "OUT_B_MULTI",
    taskId: "B",
    status: "conformant",
    reason: "B completed to plan",
  });
  const second = advance(text);
  assert.equal(second.ok, true);
  assert.deepEqual(second.assuranceGuard.updatedReceiptIds, ["AR_A"]);
  assert.deepEqual(second.advance.updatedAssuranceReceiptIds, ["AR_A"]);
  const secondSource = validateTargetGrammar6Document(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(secondSource.ok, true);
  const destructive = deriveAdvanceDestructiveRecords(
    text,
    secondSource.validatedDocument.document,
    second.advance,
  );
  assert.deepEqual(
    destructive
      .filter(({ entityId }) => entityId === "AR_A")
      .map(({ field }) => field)
      .sort(),
    ["consumers", "receipt_hash"],
  );
  assert.match(second.updatedText, /assurance_receipt AR_A:[\s\S]*?  consumers:\n    C planning_only\n/);
  const secondHash = /assurance_receipt AR_A:[\s\S]*?receipt_hash (sha256:[a-f0-9]{64})/
    .exec(second.updatedText)[1];
  assert.notEqual(secondHash, firstHash);
  assert.ok(second.assuranceGuard.retainedBasisChecks.every(({ equal }) => equal));

  text = second.updatedText.replace(
    /(task C M0 -> M3:[\s\S]*?  status )planned/,
    "$1done",
  );
  text = mutate(text, {
    kind: "task_outcome.add",
    id: "OUT_C_MULTI",
    taskId: "C",
    status: "conformant",
    reason: "C completed to plan",
  });
  const third = advance(text);
  assert.equal(third.ok, true);
  assert.deepEqual(third.assuranceGuard.removedReceiptIds, ["AR_A"]);
  assert.doesNotMatch(third.updatedText, /assurance_receipt AR_A:/);
  assertValid(third.updatedText);
});

test("an authorized separate-output candidate uses the existing digest-bound Grammar 6 safe writer", async () => {
  const original = sealed();
  const planned = advance(original, {
    intent: "persist",
    actor: "user",
  });
  assert.equal(planned.ok, true);
  assert.equal(planned.governance.writeAuthorized, true);
  const prepared = await prepareTargetPlanAssuranceAdvanceHistory(
    original,
    planned,
    TARGET_GRAMMAR_6_CAPABILITY,
    {
      mode: "out",
      sourceBytes: Buffer.from(original, "utf8"),
      sourceModifiedAt: null,
    },
  );
  assert.equal(prepared.result.historyGuard.cause, "separate_output");
  const directory = await mkdtemp(path.join(tmpdir(), "perttool-assure-advance-"));
  try {
    const target = path.join(directory, "candidate.pert");
    const written = await persistTargetPlanAssuranceResult(
      prepared.result,
      TARGET_GRAMMAR_6_CAPABILITY,
      {
        mode: "out",
        source: "-",
        target,
      },
    );
    assert.equal(written.written, true);
    assert.equal(await readFile(target, "utf8"), planned.updatedText);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
