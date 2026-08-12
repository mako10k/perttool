import { hashFrontierAssuranceReceipt } from "../../dist/assurance/canonical.js";
import { planTargetPlanAssuranceMutation } from "../../dist/assurance/mutation.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../../dist/parser/document-parser.js";

function digest(character) {
  return `sha256:${character.repeat(64)}`;
}

function mutate(text, request) {
  const result = planTargetPlanAssuranceMutation(
    text,
    request,
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  if (!result.ok || result.updatedText === null) {
    throw new Error(result.diagnostics
      .map(({ code, message }) => `${code} ${message}`)
      .join("; "));
  }
  return result.updatedText;
}

function appendDeclaration(text, lines, lineEnding, separatorBlankLines) {
  return `${text.trimEnd()}${lineEnding.repeat(separatorBlankLines + 1)}${
    lines.join(lineEnding)
  }${lineEnding}`;
}

export function buildIssue11AdvanceSource({
  lineEnding = "\n",
  separatorBlankLines = 1,
  finalNewline = true,
} = {}) {
  let source = [
    "project ISSUE11:",
    "  version 5",
    '  title "consecutive terminal deletion"',
    "  duration_unit point",
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
    "task A M0 -> M1:",
    '  title "producer"',
    "  duration 1p",
    "  status done",
    "",
    "task B M1 -> M2:",
    '  title "consumer"',
    "  duration 1p",
    "  status planned",
    "",
  ].join(lineEnding);
  source = mutate(source, {
    kind: "plan_assurance.seal",
    reason: "Accepted Issue 11 baseline",
  });
  for (let index = 1; index <= 3; index += 1) {
    const contract = {
      model: "Perttool.FrontierAssuranceReceipt.v1",
      producerTaskId: `OLD_${index}`,
      producerTaskContractHash: digest(String(index)),
      producerAssuranceHash: digest(String(index + 3)),
      outcome: "conformant",
      consumers: [{ consumerTaskId: "A", relationMode: "both" }],
      sourceMilestoneId: "M0",
    };
    source = appendDeclaration(source, [
      `assurance_receipt AR_OLD_${index}:`,
      "  model 1",
      `  receipt_hash ${hashFrontierAssuranceReceipt(contract)}`,
      `  producer OLD_${index}`,
      `  producer_contract_hash ${contract.producerTaskContractHash}`,
      `  producer_assurance_hash ${contract.producerAssuranceHash}`,
      "  outcome conformant",
      "  source_milestone M0",
      "  consumers:",
      "    A both",
    ], lineEnding, separatorBlankLines);
  }
  source = mutate(source, {
    kind: "plan_assurance.reseal",
    taskIds: ["A"],
    reason: "Accepted historical producer inputs",
  });
  source = mutate(source, {
    kind: "task_outcome.add",
    id: "OUT_A",
    taskId: "A",
    status: "conformant",
    reason: "Accepted producer result",
  });
  source = appendDeclaration(source, [
    "work_event WE_A_START:",
    "  model 1",
    "  task A",
    "  kind start",
    "  occurred_at 2026-08-12T09:00:00+09:00",
    "  planned_value 1p",
  ], lineEnding, separatorBlankLines);
  source = appendDeclaration(source, [
    "work_event WE_A_FINISH:",
    "  model 1",
    "  task A",
    "  kind finish",
    "  occurred_at 2026-08-12T10:00:00+09:00",
    "  active_time 1h",
    "  effort 1ph",
  ], lineEnding, separatorBlankLines);
  return finalNewline ? source : source.slice(0, -lineEnding.length);
}
