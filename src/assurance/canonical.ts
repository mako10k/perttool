import { sha256DigestUtf8 } from "../model/sha256.js";
import { compareStableStrings } from "../model/diagnostics.js";
import type {
  AcceptedPlanningInputV1,
  CanonicalCalendarValueV1,
  CanonicalDurationOrEstimateV1,
  CanonicalExactValueV1,
  FrontierAssuranceReceiptContractV1,
  Sha256Digest,
  TaskPlanContract,
} from "./types.js";

const canonicalUnsignedInteger = /^(?:0|[1-9][0-9]*)$/;
const sha256DigestPattern = /^sha256:[0-9a-f]{64}$/;

function compareUnicodeScalars(left: string, right: string): number {
  const leftScalars = Array.from(left, (value) => value.codePointAt(0)!);
  const rightScalars = Array.from(right, (value) => value.codePointAt(0)!);
  const common = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < common; index += 1) {
    const difference = leftScalars[index]! - rightScalars[index]!;
    if (difference !== 0) return difference;
  }
  return leftScalars.length - rightScalars.length;
}

function assertUnicodeScalars(value: string): void {
  if (typeof value !== "string") {
    throw new Error("canonical JSON string value is not a string");
  }
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new Error("canonical JSON string contains a lone high surrogate");
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error("canonical JSON string contains a lone low surrogate");
    }
  }
}

function encodeCanonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    assertUnicodeScalars(value);
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error("canonical JSON numbers must be safe integers");
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => encodeCanonicalJson(item)).join(",")}]`;
  }
  if (typeof value !== "object") {
    throw new Error("canonical JSON value is unsupported");
  }
  const entries = Object.entries(value as Readonly<Record<string, unknown>>);
  return `{${entries.map(([key, item]) => {
    if (item === undefined) {
      throw new Error(`canonical JSON field ${key} is undefined`);
    }
    return `${encodeCanonicalJson(key)}:${encodeCanonicalJson(item)}`;
  }).join(",")}}`;
}

export function canonicalJson(value: unknown): string {
  return encodeCanonicalJson(value);
}

export function sha256Canonical(value: unknown): Sha256Digest {
  return sha256DigestUtf8(canonicalJson(value)) as Sha256Digest;
}

export function isSha256Digest(value: string): value is Sha256Digest {
  return sha256DigestPattern.test(value);
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

function assertExactValue(
  value: CanonicalExactValueV1,
  context: string,
): void {
  if (
    typeof value.numerator !== "string" ||
    typeof value.denominator !== "string" ||
    !canonicalUnsignedInteger.test(value.numerator) ||
    !canonicalUnsignedInteger.test(value.denominator) ||
    value.denominator === "0"
  ) {
    throw new Error(`${context} has a non-canonical exact value`);
  }
  if (
    greatestCommonDivisor(BigInt(value.numerator), BigInt(value.denominator)) !==
    1n
  ) {
    throw new Error(`${context} exact value is not reduced`);
  }
  if (!(["day", "hour", "point"] as const).includes(value.unit)) {
    throw new Error(`${context} has an unknown unit`);
  }
}

function exactValueRecord(value: CanonicalExactValueV1): unknown {
  return {
    numerator: value.numerator,
    denominator: value.denominator,
    unit: value.unit,
  };
}

function timingRecord(value: CanonicalDurationOrEstimateV1): unknown {
  if (value.kind === "duration") {
    assertExactValue(value.value, "duration");
    return { kind: "duration", value: exactValueRecord(value.value) };
  }
  assertExactValue(value.optimistic, "optimistic estimate");
  assertExactValue(value.mostLikely, "most-likely estimate");
  assertExactValue(value.pessimistic, "pessimistic estimate");
  if (
    value.optimistic.unit !== value.mostLikely.unit ||
    value.optimistic.unit !== value.pessimistic.unit
  ) {
    throw new Error("estimate components use different units");
  }
  return {
    kind: "estimate",
    optimistic: exactValueRecord(value.optimistic),
    most_likely: exactValueRecord(value.mostLikely),
    pessimistic: exactValueRecord(value.pessimistic),
  };
}

function calendarRecord(value: CanonicalCalendarValueV1): unknown {
  if (value.kind !== "date" && value.kind !== "date_time") {
    throw new Error("calendar value has an unknown kind");
  }
  const integers = [value.year, value.month, value.day];
  if (!integers.every(Number.isSafeInteger)) {
    throw new Error("calendar value contains a non-integer field");
  }
  if (value.kind === "date") {
    return {
      kind: "date",
      year: value.year,
      month: value.month,
      day: value.day,
    };
  }
  if (
    !Number.isSafeInteger(value.hour) ||
    !Number.isSafeInteger(value.minute) ||
    !Number.isSafeInteger(value.offsetMinutes) ||
    typeof value.second.numerator !== "string" ||
    typeof value.second.denominator !== "string" ||
    !canonicalUnsignedInteger.test(value.second.numerator) ||
    !canonicalUnsignedInteger.test(value.second.denominator) ||
    value.second.denominator === "0" ||
    greatestCommonDivisor(
      BigInt(value.second.numerator),
      BigInt(value.second.denominator),
    ) !== 1n
  ) {
    throw new Error("date-time contains a non-canonical field");
  }
  return {
    kind: "date_time",
    year: value.year,
    month: value.month,
    day: value.day,
    hour: value.hour,
    minute: value.minute,
    second: {
      numerator: value.second.numerator,
      denominator: value.second.denominator,
    },
    offset_minutes: value.offsetMinutes,
  };
}

export function taskPlanContractRecord(contract: TaskPlanContract): unknown {
  if (contract.model !== "Perttool.TaskPlanContract.v1" && contract.model !== "Perttool.TaskPlanContract.v2") {
    throw new Error("unknown task plan contract model");
  }
  for (const value of [
    contract.taskId,
    contract.fromMilestoneId,
    contract.toMilestoneId,
    contract.title,
    contract.description,
    contract.owner,
    contract.source,
    ...contract.tags,
    ...contract.requirements.map(({ resourceId }) => resourceId),
  ]) {
    if (value !== null) assertUnicodeScalars(value);
  }
  if (
    contract.taskId.length === 0 ||
    contract.fromMilestoneId.length === 0 ||
    contract.toMilestoneId.length === 0
  ) {
    throw new Error("task and milestone IDs must not be empty");
  }
  if (!Number.isSafeInteger(contract.priority)) {
    throw new Error("task priority must be a safe integer");
  }
  const requirements = [...contract.requirements].sort((left, right) =>
    compareStableStrings(left.resourceId, right.resourceId)
  );
  if (
    requirements.some(
      ({ units }, index) =>
        !Number.isSafeInteger(units) ||
        units <= 0 ||
        (index > 0 &&
          requirements[index - 1]!.resourceId === requirements[index]!.resourceId),
    )
  ) {
    throw new Error("task requirements must be unique positive integers");
  }
  const tags = [...contract.tags].sort(compareUnicodeScalars);
  if (tags.some((tag, index) => index > 0 && tags[index - 1] === tag)) {
    throw new Error("task tags must be unique");
  }
  const prefix = {
    model: contract.model,
    task_id: contract.taskId,
    from_milestone_id: contract.fromMilestoneId,
    to_milestone_id: contract.toMilestoneId,
    title: contract.title,
    description: contract.description,
    duration_or_estimate: timingRecord(contract.durationOrEstimate),
  };
  const suffix = {
    deadline: contract.deadline === null
      ? null
      : calendarRecord(contract.deadline),
    priority: contract.priority,
    requirements: requirements.map(({ resourceId, units }) => ({
      resource_id: resourceId,
      units,
    })),
    owner: contract.owner,
    tags,
    source: contract.source,
  };
  return contract.model === "Perttool.TaskPlanContract.v1" ? {
    ...prefix,
    not_before: contract.notBefore === null ? null : calendarRecord(contract.notBefore),
    ...suffix,
  } : {
    ...prefix,
    when: {
      start_earliest: contract.when.startEarliest === null ? null : calendarRecord(contract.when.startEarliest),
      start_latest: contract.when.startLatest === null ? null : calendarRecord(contract.when.startLatest),
      finish_earliest: contract.when.finishEarliest === null ? null : calendarRecord(contract.when.finishEarliest),
      finish_latest: contract.when.finishLatest === null ? null : calendarRecord(contract.when.finishLatest),
    },
    ...suffix,
  };
}

export function hashTaskPlanContract(
  contract: TaskPlanContract,
): Sha256Digest {
  return sha256Canonical(taskPlanContractRecord(contract));
}

export function taskPlanBasisRecord(
  contractHash: Sha256Digest,
  planningInputs: readonly AcceptedPlanningInputV1[],
): unknown {
  if (!isSha256Digest(contractHash)) {
    throw new Error("task contract hash is not canonical SHA-256");
  }
  const inputs = [...planningInputs].sort((left, right) =>
    compareStableStrings(left.predecessorTaskId, right.predecessorTaskId)
  );
  if (
    inputs.some(
      (input, index) =>
        typeof input.predecessorTaskId !== "string" ||
        input.predecessorTaskId.length === 0 ||
        (input.relationMode !== "both" &&
          input.relationMode !== "planning_only") ||
        !isSha256Digest(input.assuranceHash) ||
        (index > 0 &&
          inputs[index - 1]!.predecessorTaskId === input.predecessorTaskId),
    )
  ) {
    throw new Error(
      "planning inputs must have nonempty IDs, planning modes, and unique canonical commitments",
    );
  }
  return {
    model: "Perttool.TaskPlanBasis.v1",
    task_contract_hash: contractHash,
    planning_inputs: inputs.map((input) => ({
      predecessor_task_id: input.predecessorTaskId,
      relation_mode: input.relationMode,
      assurance_hash: input.assuranceHash,
    })),
  };
}

export function hashTaskPlanBasis(
  contractHash: Sha256Digest,
  planningInputs: readonly AcceptedPlanningInputV1[],
): Sha256Digest {
  return sha256Canonical(taskPlanBasisRecord(contractHash, planningInputs));
}

export function hashChangedOutcomeContract(summary: string): Sha256Digest {
  if (typeof summary !== "string" || summary.length === 0) {
    throw new Error("changed outcome summary must not be empty");
  }
  assertUnicodeScalars(summary);
  return sha256Canonical({
    model: "Perttool.ChangedTaskOutcomeContract.v1",
    summary,
  });
}

export function hashTaskOutcomeCommitment(
  taskId: string,
  againstBasisHash: Sha256Digest,
  summary: string,
): Sha256Digest {
  if (typeof taskId !== "string" || taskId.length === 0) {
    throw new Error("outcome task ID must not be empty");
  }
  if (!isSha256Digest(againstBasisHash)) {
    throw new Error("outcome basis hash is not canonical SHA-256");
  }
  return sha256Canonical({
    model: "Perttool.TaskOutcomeCommitment.v1",
    task_id: taskId,
    against_basis_hash: againstBasisHash,
    changed_outcome_contract_hash: hashChangedOutcomeContract(summary),
  });
}

export function frontierAssuranceReceiptRecord(
  receipt: FrontierAssuranceReceiptContractV1,
): unknown {
  if (receipt.model !== "Perttool.FrontierAssuranceReceipt.v1") {
    throw new Error("unknown frontier assurance receipt model");
  }
  if (
    receipt.producerTaskId.length === 0 ||
    !isSha256Digest(receipt.producerTaskContractHash) ||
    !isSha256Digest(receipt.producerAssuranceHash) ||
    (receipt.outcome !== "conformant" && receipt.outcome !== "changed")
  ) {
    throw new Error("frontier assurance receipt contains an invalid producer");
  }
  const consumers = [...receipt.consumers].sort((left, right) =>
    compareStableStrings(left.consumerTaskId, right.consumerTaskId)
  );
  if (
    consumers.some(
      (consumer, index) =>
        consumer.consumerTaskId.length === 0 ||
        (consumer.relationMode !== "both" &&
          consumer.relationMode !== "planning_only") ||
        (index > 0 &&
          consumers[index - 1]!.consumerTaskId === consumer.consumerTaskId),
    )
  ) {
    throw new Error("frontier assurance receipt consumers are invalid");
  }
  for (const value of [
    receipt.producerTaskId,
    receipt.sourceMilestoneId,
    ...consumers.map(({ consumerTaskId }) => consumerTaskId),
  ]) {
    if (value !== null) assertUnicodeScalars(value);
  }
  return {
    model: "Perttool.FrontierAssuranceReceipt.v1",
    producer_task_id: receipt.producerTaskId,
    producer_task_contract_hash: receipt.producerTaskContractHash,
    producer_assurance_hash: receipt.producerAssuranceHash,
    outcome: receipt.outcome,
    consumers: consumers.map(({ consumerTaskId, relationMode }) => ({
      consumer_task_id: consumerTaskId,
      relation_mode: relationMode,
    })),
    source_milestone_id: receipt.sourceMilestoneId,
  };
}

export function hashFrontierAssuranceReceipt(
  receipt: FrontierAssuranceReceiptContractV1,
): Sha256Digest {
  return sha256Canonical(frontierAssuranceReceiptRecord(receipt));
}
