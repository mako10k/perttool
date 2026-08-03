import type { DeclaredCalendarValue } from "../model/calendar.js";
import type { SourceSpan } from "../model/diagnostics.js";
import { compareStableStrings } from "../model/diagnostics.js";
import { rationalFromDuration } from "../model/rational.js";
import type {
  AcceptedPlanningInputValue,
  AssuranceConsumerValue,
  DeclarationNode,
  ExactDurationValue,
  FieldNode,
  RequirementValue,
  TargetDeclarationKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type {
  TargetGrammar6ValidatedDocument,
} from "../semantic/target-validator.js";
import {
  hashFrontierAssuranceReceipt,
  isSha256Digest,
} from "./canonical.js";
import type {
  CanonicalCalendarValueV1,
  CanonicalDurationOrEstimateV1,
  CanonicalExactValueV1,
  ExecutionTaskRelationV1,
  FrontierAssuranceReceiptContractV1,
  FrontierPlanningInputV1,
  PlanAssuranceInputV1,
  PlanDependencyRelationV1,
  Sha256Digest,
  TaskAssuranceInputV1,
  TaskOutcomeEvidenceV1,
  TaskPlanContractV1,
  TaskPlanSealV1,
} from "./types.js";

export const PLAN_ASSURANCE_SOURCE_MODEL_VERSION = 1 as const;

export interface PlanAssuranceSourceRecordV1 {
  readonly kind: TargetDeclarationKind;
  readonly id: string;
  readonly declarationSpan: SourceSpan;
  readonly idSpan: SourceSpan;
}

export interface PlanAssuranceSourceModelV1 {
  readonly modelVersion: typeof PLAN_ASSURANCE_SOURCE_MODEL_VERSION;
  readonly grammarVersion: 1 | 2 | 3 | 4 | 5 | 6;
  readonly input: PlanAssuranceInputV1;
  readonly records: readonly PlanAssuranceSourceRecordV1[];
}

function requiredField(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): FieldNode {
  const field = fieldNamed(declaration, name);
  if (field === undefined) {
    throw new Error(
      `validated ${declaration.kind} ${declaration.id} is missing ${name}`,
    );
  }
  return field;
}

function stringField(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): string | null {
  const value = fieldNamed(declaration, name)?.value;
  if (value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`validated ${declaration.kind}.${name} is not a string`);
  }
  return value;
}

function exactDuration(field: FieldNode): ExactDurationValue {
  if (
    field.value === null ||
    typeof field.value !== "object" ||
    !("suffix" in field.value) ||
    (!("digits" in field.value) && !("numerator" in field.value))
  ) {
    throw new Error(`validated ${field.name} is not an exact duration`);
  }
  return field.value as ExactDurationValue;
}

function exactValue(field: FieldNode): CanonicalExactValueV1 {
  const value = exactDuration(field);
  const reduced = rationalFromDuration(value);
  return {
    numerator: reduced.numerator.toString(),
    denominator: reduced.denominator.toString(),
    unit: value.suffix === "d"
      ? "day"
      : value.suffix === "h"
        ? "hour"
        : "point",
  };
}

function durationOrEstimate(
  task: DeclarationNode<TargetDeclarationKind>,
): CanonicalDurationOrEstimateV1 {
  const duration = fieldNamed(task, "duration");
  if (duration !== undefined) {
    return { kind: "duration", value: exactValue(duration) };
  }
  const estimate = requiredField(task, "estimate");
  const child = (name: string): FieldNode => {
    const value = estimate.children?.find((candidate) => candidate.name === name);
    if (value === undefined) {
      throw new Error(`validated task ${task.id} estimate is missing ${name}`);
    }
    return value;
  };
  return {
    kind: "estimate",
    optimistic: exactValue(child("optimistic")),
    mostLikely: exactValue(child("most_likely")),
    pessimistic: exactValue(child("pessimistic")),
  };
}

function calendarValue(
  field: FieldNode | undefined,
): CanonicalCalendarValueV1 | null {
  if (field === undefined) return null;
  const value = field.value as DeclaredCalendarValue;
  if (value.kind === "date") {
    return {
      kind: "date",
      year: value.year,
      month: value.month,
      day: value.day,
    };
  }
  return {
    kind: "date_time",
    year: value.year,
    month: value.month,
    day: value.day,
    hour: value.hour,
    minute: value.minute,
    second: {
      numerator: value.second.numerator.toString(),
      denominator: value.second.denominator.toString(),
    },
    offsetMinutes: value.offsetMinutes,
  };
}

function taskContract(
  task: DeclarationNode<TargetDeclarationKind>,
): TaskPlanContractV1 {
  const title = requiredField(task, "title").value;
  if (typeof title !== "string") {
    throw new Error(`validated task ${task.id} title is not a string`);
  }
  const priority = fieldNamed(task, "priority")?.value ?? 0;
  if (typeof priority !== "number") {
    throw new Error(`validated task ${task.id} priority is not an integer`);
  }
  const requirements = fieldNamed(task, "requires")?.value ?? [];
  if (!Array.isArray(requirements)) {
    throw new Error(`validated task ${task.id} requirements are invalid`);
  }
  const tags = fieldNamed(task, "tags")?.value ?? [];
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) {
    throw new Error(`validated task ${task.id} tags are invalid`);
  }
  return {
    model: "Perttool.TaskPlanContract.v1",
    taskId: task.id,
    fromMilestoneId: task.from!,
    toMilestoneId: task.to!,
    title,
    description: stringField(task, "description"),
    durationOrEstimate: durationOrEstimate(task),
    notBefore: calendarValue(fieldNamed(task, "not_before")),
    deadline: calendarValue(fieldNamed(task, "deadline")),
    priority,
    requirements: (requirements as readonly RequirementValue[]).map(
      ({ resourceId, units }) => ({ resourceId, units }),
    ),
    owner: stringField(task, "owner"),
    tags: tags as readonly string[],
    source: stringField(task, "source"),
  };
}

function gateOnlyExecutionRelations(
  declarations: readonly DeclarationNode<TargetDeclarationKind>[],
): readonly ExecutionTaskRelationV1[] {
  const tasks = declarations.filter((declaration) => declaration.kind === "task");
  const gates = declarations.filter((declaration) => declaration.kind === "gate");
  const targets = new Map<string, string[]>();
  for (const gate of gates) {
    const values = targets.get(gate.from!) ?? [];
    values.push(gate.to!);
    targets.set(gate.from!, values);
  }
  for (const values of targets.values()) values.sort(compareStableStrings);
  const reachable = (source: string, target: string): boolean => {
    if (source === target) return true;
    const pending = [source];
    const seen = new Set(pending);
    while (pending.length > 0) {
      for (const next of targets.get(pending.shift()!) ?? []) {
        if (next === target) return true;
        if (!seen.has(next)) {
          seen.add(next);
          pending.push(next);
        }
      }
    }
    return false;
  };
  const relations: ExecutionTaskRelationV1[] = [];
  for (const predecessor of tasks) {
    for (const successor of tasks) {
      if (
        predecessor !== successor &&
        reachable(predecessor.to!, successor.from!)
      ) {
        relations.push({
          predecessorTaskId: predecessor.id,
          successorTaskId: successor.id,
        });
      }
    }
  }
  return relations.sort((left, right) =>
    compareStableStrings(left.successorTaskId, right.successorTaskId) ||
    compareStableStrings(left.predecessorTaskId, right.predecessorTaskId)
  );
}

function sealFrom(
  declaration: DeclarationNode<TargetDeclarationKind> | undefined,
): TaskPlanSealV1 | null {
  if (declaration === undefined) return null;
  const acceptedContractHash = requiredField(
    declaration,
    "accepted_contract",
  ).value;
  const acceptedBasisHash = requiredField(declaration, "accepted_basis").value;
  if (
    typeof acceptedContractHash !== "string" ||
    typeof acceptedBasisHash !== "string"
  ) {
    throw new Error(`validated plan_seal ${declaration.id} has invalid hashes`);
  }
  const inputs = fieldNamed(declaration, "accepted_inputs")?.value ?? [];
  return {
    acceptedContractHash: acceptedContractHash as Sha256Digest,
    acceptedBasisHash: acceptedBasisHash as Sha256Digest,
    acceptedInputs: (inputs as readonly AcceptedPlanningInputValue[]).map(
      (input) => ({
        predecessorTaskId: input.predecessorTaskId,
        relationMode: input.relationMode,
        assuranceHash: input.assuranceHash as Sha256Digest,
      }),
    ),
  };
}

function outcomeFrom(
  declaration: DeclarationNode<TargetDeclarationKind> | undefined,
): TaskOutcomeEvidenceV1 | null {
  if (declaration === undefined) return null;
  const modelVersion = requiredField(declaration, "model").value;
  const againstBasisHash = requiredField(declaration, "against_basis").value;
  const status = requiredField(declaration, "status").value;
  if (
    typeof modelVersion !== "number" ||
    typeof againstBasisHash !== "string" ||
    (status !== "conformant" && status !== "changed")
  ) {
    throw new Error(`validated task_outcome ${declaration.id} is invalid`);
  }
  return {
    modelVersion,
    againstBasisHash: againstBasisHash as Sha256Digest,
    status,
    summary: stringField(declaration, "summary"),
  };
}

function frontierInputs(
  declarations: readonly DeclarationNode<TargetDeclarationKind>[],
): readonly FrontierPlanningInputV1[] {
  const values: FrontierPlanningInputV1[] = [];
  for (const receipt of declarations.filter(
    (declaration) => declaration.kind === "assurance_receipt",
  )) {
    const model = requiredField(receipt, "model").value;
    const storedHash = requiredField(receipt, "receipt_hash").value;
    const producerTaskId = requiredField(receipt, "producer").value;
    const producerTaskContractHash = requiredField(
      receipt,
      "producer_contract_hash",
    ).value;
    const producerAssuranceHash = requiredField(
      receipt,
      "producer_assurance_hash",
    ).value;
    const outcome = requiredField(receipt, "outcome").value;
    const consumers = requiredField(receipt, "consumers").value as
      readonly AssuranceConsumerValue[];
    const sourceMilestoneId = fieldNamed(receipt, "source_milestone")?.value ?? null;
    let usableHash: Sha256Digest | null = null;
    if (
      model === 1 &&
      typeof storedHash === "string" &&
      typeof producerTaskId === "string" &&
      typeof producerTaskContractHash === "string" &&
      typeof producerAssuranceHash === "string" &&
      (outcome === "conformant" || outcome === "changed") &&
      (sourceMilestoneId === null || typeof sourceMilestoneId === "string") &&
      isSha256Digest(storedHash) &&
      isSha256Digest(producerTaskContractHash) &&
      isSha256Digest(producerAssuranceHash)
    ) {
      const contract: FrontierAssuranceReceiptContractV1 = {
        model: "Perttool.FrontierAssuranceReceipt.v1",
        producerTaskId,
        producerTaskContractHash,
        producerAssuranceHash,
        outcome,
        consumers: consumers.map((consumer) => ({
          consumerTaskId: consumer.consumerTaskId,
          relationMode: consumer.relationMode,
        })),
        sourceMilestoneId,
      };
      if (hashFrontierAssuranceReceipt(contract) === storedHash) {
        usableHash = producerAssuranceHash;
      }
    }
    for (const consumer of consumers) {
      values.push({
        producerTaskId: String(producerTaskId),
        consumerTaskId: consumer.consumerTaskId,
        relationMode: consumer.relationMode,
        assuranceHash: usableHash,
      });
    }
  }
  return values.sort((left, right) =>
    compareStableStrings(left.consumerTaskId, right.consumerTaskId) ||
    compareStableStrings(left.producerTaskId, right.producerTaskId)
  );
}

export function projectPlanAssuranceSourceModel(
  validated: TargetGrammar6ValidatedDocument,
): PlanAssuranceSourceModelV1 {
  const declarations = validated.document.declarations;
  const project = declarations.find((declaration) => declaration.kind === "project");
  if (project === undefined) throw new Error("validated document has no project");
  const seals = new Map(
    declarations
      .filter((declaration) => declaration.kind === "plan_seal")
      .map((declaration) => [declaration.id, declaration] as const),
  );
  const outcomes = new Map(
    declarations
      .filter((declaration) => declaration.kind === "task_outcome")
      .map((declaration) => [
        requiredField(declaration, "task").value as string,
        declaration,
      ] as const),
  );
  const tasks: TaskAssuranceInputV1[] = declarations
    .filter((declaration) => declaration.kind === "task")
    .map((task) => ({
      contract: taskContract(task),
      lifecycle: fieldNamed(task, "status")?.value === "done"
        ? "completed"
        : "unfinished",
      seal: sealFrom(seals.get(task.id)),
      outcome: outcomeFrom(outcomes.get(task.id)),
    }));
  const explicitRelations: PlanDependencyRelationV1[] = declarations
    .filter((declaration) => declaration.kind === "task_relation")
    .map((relation) => ({
      id: relation.id,
      predecessorTaskId: relation.from!,
      successorTaskId: relation.to!,
      mode: requiredField(relation, "mode").value as
        PlanDependencyRelationV1["mode"],
      reason: stringField(relation, "reason"),
    }));
  const modelVersion = fieldNamed(project, "plan_assurance_model")?.value;
  const hashModelVersion = fieldNamed(
    project,
    "plan_assurance_hash_model",
  )?.value;
  const input: PlanAssuranceInputV1 = {
    modelVersion: typeof modelVersion === "number" ? modelVersion : null,
    hashModelVersion:
      typeof hashModelVersion === "number" ? hashModelVersion : null,
    tasks,
    executionRelations: gateOnlyExecutionRelations(declarations),
    explicitRelations,
    frontierInputs: frontierInputs(declarations),
  };
  return Object.freeze({
    modelVersion: PLAN_ASSURANCE_SOURCE_MODEL_VERSION,
    grammarVersion: validated.grammarVersion,
    input: Object.freeze(input),
    records: Object.freeze(declarations.map((declaration) => Object.freeze({
      kind: declaration.kind,
      id: declaration.id,
      declarationSpan: declaration.span,
      idSpan: declaration.idSpan,
    }))),
  });
}

export function projectPlanAssuranceInput(
  validated: TargetGrammar6ValidatedDocument,
): PlanAssuranceInputV1 {
  return projectPlanAssuranceSourceModel(validated).input;
}
