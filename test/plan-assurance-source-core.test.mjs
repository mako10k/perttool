import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  hashFrontierAssuranceReceipt,
  hashTaskPlanContract,
} from "../dist/assurance/canonical.js";
import {
  evaluatePlanAssurance,
} from "../dist/assurance/evaluate.js";
import {
  PLAN_ASSURANCE_SOURCE_MODEL_VERSION,
  projectPlanAssuranceInput,
  projectPlanAssuranceSourceModel,
} from "../dist/assurance/source.js";
import {
  formatTargetGrammar6Document,
} from "../dist/formatter/target-source-formatter.js";
import {
  TARGET_GRAMMAR_6_DECLARATION_FIELD_ORDER,
} from "../dist/model/declaration-fields.js";
import {
  parseDocument,
  parseTargetGrammar6Document,
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar6Document,
} from "../dist/semantic/target-validator.js";

const digest = (hex) => `sha256:${hex.repeat(64)}`;

const receiptContract = {
  model: "Perttool.FrontierAssuranceReceipt.v1",
  producerTaskId: "OLD",
  producerTaskContractHash: digest("b"),
  producerAssuranceHash: digest("c"),
  outcome: "conformant",
  consumers: [{ consumerTaskId: "C", relationMode: "both" }],
  sourceMilestoneId: "M1",
};

function source({
  projectModel = 1,
  hashModel = 1,
  receiptHash = hashFrontierAssuranceReceipt(receiptContract),
  extraRelations = [],
  seals = true,
  outcomes = true,
  receipt = true,
} = {}) {
  return [
    "project ASSURANCE:",
    "  version 6",
    '  title "assurance"',
    "  as_of 2026-08-03",
    "  duration_unit point",
    "  velocity 4p/1d",
    "  finish M3",
    `  plan_assurance_model ${projectModel}`,
    `  plan_assurance_hash_model ${hashModel}`,
    "",
    "milestone M0:",
    '  title "start"',
    "  state reached",
    "",
    "milestone M1:",
    '  title "one"',
    "",
    "milestone M2:",
    '  title "two"',
    "",
    "milestone M3:",
    '  title "finish"',
    "",
    "task A M0 -> M1:",
    '  title "A"',
    "  duration 2/2p",
    `  status ${outcomes ? "done" : "planned"}`,
    "  priority 3",
    "  tags [zeta, alpha]",
    "",
    "task B M1 -> M2:",
    '  title "B"',
    "  estimate:",
    "    optimistic 1p",
    "    most_likely 2p",
    "    pessimistic 3p",
    "  status planned",
    "",
    "task C M2 -> M3:",
    '  title "C"',
    "  duration 1p",
    "  status planned",
    "",
    "task_relation REL_B_C B -> C:",
    "  mode execution_only",
    '  reason "execution order only"',
    "",
    "task_relation REL_A_C A -> C:",
    "  mode planning_only",
    '  reason "A informs C directly"',
    ...extraRelations,
    ...(seals
      ? [
          "",
          "plan_seal A:",
          `  accepted_contract ${digest("1")}`,
          `  accepted_basis ${digest("2")}`,
          '  reason "initial"',
          "",
          "plan_seal C:",
          `  accepted_contract ${digest("3")}`,
          `  accepted_basis ${digest("4")}`,
          "  accepted_inputs:",
          `    A planning_only ${digest("5")}`,
          '  reason "reviewed"',
        ]
      : []),
    ...(outcomes
      ? [
          "",
          "task_outcome OUT_A:",
          "  model 1",
          "  task A",
          `  against_basis ${digest("2")}`,
          "  status conformant",
          '  reason "accepted"',
        ]
      : []),
    ...(receipt
      ? [
          "",
          "assurance_receipt AR_OLD:",
          "  model 1",
          `  receipt_hash ${receiptHash}`,
          "  producer OLD",
          `  producer_contract_hash ${digest("b")}`,
          `  producer_assurance_hash ${digest("c")}`,
          "  outcome conformant",
          "  source_milestone M1",
          "  consumers:",
          "    C both",
        ]
      : []),
    ...(outcomes
      ? [
          "",
          "work_event WE_A_START:",
          "  model 1",
          "  task A",
          "  kind start",
          "  occurred_at 2026-08-03T09:00:00+09:00",
          "  planned_value 1p",
          "",
          "work_event WE_A_FINISH:",
          "  model 1",
          "  task A",
          "  kind finish",
          "  occurred_at 2026-08-03T10:00:00+09:00",
          "  active_time 1h",
          "  effort 1ph",
        ]
      : []),
    "",
  ].join("\n");
}

function checked(text = source()) {
  return validateTargetGrammar6Document(text, TARGET_GRAMMAR_6_CAPABILITY);
}

test("Grammar 6 assurance source capability remains internal and identity checked", async () => {
  for (const name of [
    "TARGET_GRAMMAR_6_CAPABILITY",
    "parseTargetGrammar6Document",
    "validateTargetGrammar6Document",
    "formatTargetGrammar6Document",
    "projectPlanAssuranceSourceModel",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
  assert.equal(Object.isFrozen(TARGET_GRAMMAR_6_CAPABILITY), true);
  assert.equal(Object.isFrozen(TARGET_GRAMMAR_6_DECLARATION_FIELD_ORDER), true);
  assert.deepEqual(
    TARGET_GRAMMAR_6_DECLARATION_FIELD_ORDER.task_relation,
    ["mode", "reason"],
  );
  assert.throws(
    () => parseTargetGrammar6Document("", { ...TARGET_GRAMMAR_6_CAPABILITY }),
    /target Grammar 6 assurance source capability is required/,
  );
  const root = await readFile(new URL("../dist/index.d.ts", import.meta.url), "utf8");
  assert.doesNotMatch(root, /TargetGrammar6|PlanAssuranceSourceModel/);
  assert.equal(
    parseDocument(source()).diagnostics.some(({ code }) => code === "PTDSL-005"),
    true,
    "the active Grammar 5 parser must not accept Grammar 6 project fields",
  );
});

test("validated Grammar 6 source projects contracts, relations, seals, outcomes, receipts, and spans", () => {
  const result = checked();
  assert.equal(
    result.ok,
    true,
    result.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.ok(result.validatedDocument);
  const model = projectPlanAssuranceSourceModel(result.validatedDocument);
  assert.equal(model.modelVersion, PLAN_ASSURANCE_SOURCE_MODEL_VERSION);
  assert.equal(model.grammarVersion, 6);
  assert.equal(model.input.modelVersion, 1);
  assert.equal(model.input.hashModelVersion, 1);
  assert.deepEqual(model.input.executionRelations, [
    { predecessorTaskId: "A", successorTaskId: "B" },
    { predecessorTaskId: "B", successorTaskId: "C" },
  ]);
  assert.deepEqual(
    model.input.explicitRelations.map(({ id, mode }) => ({ id, mode })),
    [
      { id: "REL_B_C", mode: "execution_only" },
      { id: "REL_A_C", mode: "planning_only" },
    ],
  );
  assert.equal(model.input.tasks[0].contract.durationOrEstimate.kind, "duration");
  assert.deepEqual(model.input.tasks[0].contract.durationOrEstimate.value, {
    numerator: "1",
    denominator: "1",
    unit: "point",
  });
  assert.deepEqual(model.input.tasks[0].contract.tags, ["zeta", "alpha"]);
  assert.equal(model.input.tasks[2].seal.acceptedInputs[0].predecessorTaskId, "A");
  assert.equal(model.input.tasks[0].outcome.status, "conformant");
  assert.deepEqual(model.input.frontierInputs, [{
    producerTaskId: "OLD",
    consumerTaskId: "C",
    relationMode: "both",
    assuranceHash: digest("c"),
  }]);
  assert.equal(model.records.some(({ kind }) => kind === "plan_seal"), true);
  assert.equal(model.records.every(({ declarationSpan }) =>
    declarationSpan.end.offset >= declarationSpan.start.offset), true);
  assert.deepEqual(projectPlanAssuranceInput(result.validatedDocument), model.input);
  assert.equal(
    hashTaskPlanContract(model.input.tasks[0].contract),
    "sha256:dd27b92774e9aad43c031bc364f70da64f4b93e9c35c89acd74b0ae504fd4661",
  );
});

test("Grammar 6 formatter preserves BOM, CRLF, comments, declaration order, and nested records", () => {
  const text = `\uFEFF${source()}`
    .replace("  version 6", "  version 0006")
    .replace("  plan_assurance_model 1", "  plan_assurance_model 01")
    .replace("task_relation REL_B_C B -> C:", "task_relation  REL_B_C  B  ->  C:")
    .replace("  reason \"execution order only\"", "  # relation comment\n  reason \"execution order only\"")
    .replaceAll("\n", "\r\n");
  const result = checked(text);
  assert.equal(result.ok, true);
  const formatted = formatTargetGrammar6Document(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(formatted.ok, true);
  assert.equal(formatted.changed, true);
  assert.equal(formatted.formattedText.startsWith("\uFEFFproject ASSURANCE:"), true);
  assert.equal(/(?<!\r)\n/.test(formatted.formattedText), false);
  assert.match(formatted.formattedText, /  version 6\r\n/);
  assert.match(formatted.formattedText, /  plan_assurance_model 1\r\n/);
  assert.match(formatted.formattedText, /task_relation REL_B_C B -> C:/);
  assert.match(formatted.formattedText, /  # relation comment/);
  assert.match(formatted.formattedText, /    A planning_only sha256:/);
  assert.ok(
    formatted.formattedText.indexOf("task_relation REL_B_C") <
      formatted.formattedText.indexOf("task_relation REL_A_C"),
  );
  const repeated = formatTargetGrammar6Document(
    formatted.formattedText,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(repeated.changed, false);
});

test("Grammar 6 rejects invalid assurance references, ownership, conditional fields, order, and cycles", () => {
  const cases = [
    source().replace("task_relation REL_A_C A -> C:", "task_relation REL_A_C UNKNOWN -> C:"),
    source().replace(
      "plan_seal C:",
      `plan_seal A:\n  accepted_contract ${digest("6")}\n  accepted_basis ${digest("7")}\n  reason \"duplicate\"\n\nplan_seal C:`,
    ),
    source().replace(
      "  status conformant\n  reason \"accepted\"",
      "  status conformant\n  summary \"forbidden\"\n  reason \"accepted\"",
    ),
    source().replace(
      "  consumers:\n    C both",
      "  consumers:\n    C both\n    B both",
    ),
    source().replace(digest("1"), digest("A")),
  ];
  for (const text of cases) {
    const result = checked(text);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics.some(({ code }) => code === "PTASSURE-101"), true);
  }
  const cycle = source({
    extraRelations: [
      "",
      "task_relation REL_C_A C -> A:",
      "  mode planning_only",
      '  reason "cycle"',
    ],
  });
  const cycleResult = checked(cycle);
  assert.equal(cycleResult.ok, false);
  assert.equal(cycleResult.diagnostics.some(({ code }) => code === "PTASSURE-102"), true);
});

test("unknown models, inconsistent seals, and damaged receipt self-hashes remain valid unavailable input", () => {
  const unknown = checked(source({
    projectModel: 2,
    hashModel: 2,
    receiptHash: digest("a"),
    outcomes: false,
  }));
  assert.equal(unknown.ok, true);
  const input = projectPlanAssuranceInput(unknown.validatedDocument);
  assert.equal(input.frontierInputs[0].assuranceHash, null);
  const evaluation = evaluatePlanAssurance(input);
  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.coverage, "partial");
  assert.equal(evaluation.taskResults.every(({ status }) => status === "unavailable"), true);
});
