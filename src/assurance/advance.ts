import { sha256DigestUtf8 } from "../model/sha256.js";
import { validateStoredLifecycleState } from "../actuals/lifecycle.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import { classifyGovernanceScopes } from "../governance/authority.js";
import { governanceMetadataFromDocument } from "../governance/source.js";
import type { GovernanceRequestInput } from "../governance/types.js";
import {
  compareStableStrings,
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import type {
  AssuranceConsumerValue,
  DeclarationNode,
  DocumentNode,
  TargetDeclarationKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  planValidatedAdvance,
  type ActualsAdvanceDetails,
  type AdvanceDocumentValidation,
  type AdvancePlanningContext,
  type AdvancePlanningExtension,
  type AdvanceResult,
} from "../mutation/advance.js";
import { EntityEditor } from "../mutation/entity-editor.js";
import {
  appendDeclarationEdit,
  contentTextEndOffset,
  leadingCommentStart,
  majorLineEnding,
  splitPhysicalLines,
} from "../mutation/source.js";
import type { TextEdit } from "../mutation/text-edits.js";
import type { TargetGrammar6Capability } from "../parser/document-parser.js";
import {
  validateTargetGrammar6Document,
  type TargetGrammar5ValidatedDocument,
  type TargetGrammar6ValidatedDocument,
} from "../semantic/target-validator.js";
import {
  hashFrontierAssuranceReceipt,
  isSha256Digest,
} from "./canonical.js";
import { evaluatePlanAssurance } from "./evaluate.js";
import {
  evaluatePlanAssuranceGovernance,
  normalizePlanAssuranceGovernanceRequest,
  planAssuranceGovernanceDiagnostics,
  type PlanAssuranceGovernanceDecisionV2,
  type PlanAssuranceGovernanceScope,
} from "./governance.js";
import { projectPlanAssuranceInput } from "./source.js";
import type {
  FrontierAssuranceReceiptContractV1,
  PlanAssuranceEvaluationV1,
  PlanningInputMode,
  Sha256Digest,
} from "./types.js";

export const PLAN_ASSURANCE_ADVANCE_RESULT_SCHEMA_VERSION =
  "Perttool.AdvanceResult.v2" as const;

export type PlanAssuranceAdvanceGuardStatus =
  | "not_applicable"
  | "passed"
  | "blocked";

export type PlanAssuranceAdvanceGuardCause =
  | "not_enabled"
  | "no_change"
  | "basis_preserved"
  | "crossing_commitment_unavailable"
  | "changed_outcome_not_accepted"
  | "retained_receipt_unavailable"
  | "retained_basis_changed";

export interface PlanAssuranceAdvanceBasisCheckV1 {
  readonly taskId: string;
  readonly beforeBasisHash: Sha256Digest | null;
  readonly afterBasisHash: Sha256Digest | null;
  readonly equal: boolean;
}

export interface PlanAssuranceAdvanceGuardV1 {
  readonly modelVersion: 1;
  readonly status: PlanAssuranceAdvanceGuardStatus;
  readonly cause: PlanAssuranceAdvanceGuardCause;
  readonly crossingProducerTaskIds: readonly string[];
  readonly createdReceiptIds: readonly string[];
  readonly updatedReceiptIds: readonly string[];
  readonly removedReceiptIds: readonly string[];
  readonly retainedBasisChecks: readonly PlanAssuranceAdvanceBasisCheckV1[];
}

export interface TargetPlanAssuranceAdvanceResultV2
  extends Omit<AdvanceResult, "advance"> {
  readonly schemaVersion: typeof PLAN_ASSURANCE_ADVANCE_RESULT_SCHEMA_VERSION;
  readonly governance: PlanAssuranceGovernanceDecisionV2 | null;
  readonly lifecycle: null;
  readonly assuranceGuard: PlanAssuranceAdvanceGuardV1 | null;
  readonly historyGuard: null;
  readonly advance: PlanAssuranceAdvanceDetailsV1 | null;
}

export interface PlanAssuranceAdvanceDetailsV1 extends ActualsAdvanceDetails {
  readonly removedAssuranceRecordIds: readonly string[];
  readonly updatedAssuranceReceiptIds: readonly string[];
}

export interface PlanAssuranceAdvanceOptions {
  readonly maxDiagnostics?: number;
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
  readonly warningsAsErrors?: boolean;
  readonly governance?: GovernanceRequestInput;
}

interface ReceiptMutationSummary {
  readonly crossingProducerTaskIds: readonly string[];
  readonly createdReceiptIds: readonly string[];
  readonly updatedReceiptIds: readonly string[];
  readonly removedReceiptIds: readonly string[];
  readonly removedAssuranceRecordIds: readonly string[];
  readonly updatedAssuranceReceiptIds: readonly string[];
}

interface PlannedReceipt {
  readonly id: string;
  readonly contract: FrontierAssuranceReceiptContractV1;
  readonly hash: Sha256Digest;
}

const receiptFieldOrder = [
  "model",
  "receipt_hash",
  "producer",
  "producer_contract_hash",
  "producer_assurance_hash",
  "outcome",
  "source_milestone",
  "consumers",
] as const;

function digest(text: string): string {
  return sha256DigestUtf8(text);
}

function assuranceAdvanceDiagnostic(
  message: string,
  entityId: string | null,
  cause: PlanAssuranceAdvanceGuardCause,
  data: Readonly<Record<string, unknown>> = {},
): Diagnostic {
  return Object.freeze({
    code: "PTASSURE-306",
    severity: "error",
    message,
    ...(entityId === null ? {} : { entityId }),
    helpTopic: "plan-assurance",
    data: Object.freeze({ cause, ...data }),
  });
}

function grammar6AdvanceValidator(
  capability: TargetGrammar6Capability,
): (text: string, maxDiagnostics: number) => AdvanceDocumentValidation {
  return (text, maxDiagnostics) => {
    const checked = validateTargetGrammar6Document(
      text,
      capability,
      { maxDiagnostics },
    );
    const lifecycleDiagnostics = checked.validatedDocument === null
      ? []
      : validateStoredLifecycleState(
          checked.validatedDocument as unknown as TargetGrammar5ValidatedDocument,
        );
    const diagnostics = sortDiagnostics([
      ...checked.diagnostics,
      ...lifecycleDiagnostics,
    ]);
    return {
      ok: checked.ok && lifecycleDiagnostics.length === 0,
      document: checked.document,
      documentId: checked.documentId,
      diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  };
}

function requiredString(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): string {
  const value = fieldNamed(declaration, name)?.value;
  if (typeof value !== "string") {
    throw new Error(`validated ${declaration.kind} ${declaration.id} lost ${name}`);
  }
  return value;
}

function receiptContract(
  declaration: DeclarationNode<TargetDeclarationKind>,
  consumers?: readonly AssuranceConsumerValue[],
): FrontierAssuranceReceiptContractV1 {
  const values = consumers ?? (
    fieldNamed(declaration, "consumers")?.value as readonly AssuranceConsumerValue[]
  );
  return {
    model: "Perttool.FrontierAssuranceReceipt.v1",
    producerTaskId: requiredString(declaration, "producer"),
    producerTaskContractHash: requiredString(
      declaration,
      "producer_contract_hash",
    ) as Sha256Digest,
    producerAssuranceHash: requiredString(
      declaration,
      "producer_assurance_hash",
    ) as Sha256Digest,
    outcome: requiredString(declaration, "outcome") as "conformant" | "changed",
    consumers: values.map((consumer) => ({
      consumerTaskId: consumer.consumerTaskId,
      relationMode: consumer.relationMode,
    })),
    sourceMilestoneId:
      (fieldNamed(declaration, "source_milestone")?.value as string | undefined) ??
      null,
  };
}

function serializeConsumers(
  consumers: FrontierAssuranceReceiptContractV1["consumers"],
  lineEnding: string,
): string {
  return [
    "  consumers:",
    ...consumers.map(({ consumerTaskId, relationMode }) =>
      `    ${consumerTaskId} ${relationMode}`
    ),
  ].join(lineEnding);
}

function serializeReceipt(
  receipt: PlannedReceipt,
  lineEnding: string,
): string {
  const { contract } = receipt;
  return [
    `assurance_receipt ${receipt.id}:`,
    "  model 1",
    `  receipt_hash ${receipt.hash}`,
    `  producer ${contract.producerTaskId}`,
    `  producer_contract_hash ${contract.producerTaskContractHash}`,
    `  producer_assurance_hash ${contract.producerAssuranceHash}`,
    `  outcome ${contract.outcome}`,
    ...(contract.sourceMilestoneId === null
      ? []
      : [`  source_milestone ${contract.sourceMilestoneId}`]),
    serializeConsumers(contract.consumers, lineEnding),
  ].join(lineEnding);
}

function allocateReceiptId(
  producerTaskId: string,
  reserved: Set<string>,
): string {
  const base = `AR_${producerTaskId}`;
  if (!reserved.has(base)) {
    reserved.add(base);
    return base;
  }
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}_${suffix}`;
    if (!reserved.has(candidate)) {
      reserved.add(candidate);
      return candidate;
    }
  }
}

function receiptInsertions(
  text: string,
  document: DocumentNode<TargetDeclarationKind>,
  removed: ReadonlySet<DeclarationNode<TargetDeclarationKind>>,
  receipts: readonly PlannedReceipt[],
): readonly TextEdit[] {
  if (receipts.length === 0) return [];
  const lineEnding = majorLineEnding(text);
  const lines = splitPhysicalLines(text);
  const retainedReceipts = document.declarations
    .filter((declaration) =>
      declaration.kind === "assurance_receipt" && !removed.has(declaration)
    )
    .sort((left, right) => compareStableStrings(left.id, right.id));
  const firstRetainedEvent = document.declarations.find((declaration) =>
    declaration.kind === "work_event" && !removed.has(declaration)
  );
  const groups = new Map<number, PlannedReceipt[]>();
  for (const receipt of [...receipts].sort((left, right) =>
    compareStableStrings(left.id, right.id)
  )) {
    const later = retainedReceipts.find((candidate) =>
      compareStableStrings(candidate.id, receipt.id) > 0
    );
    const target = later ?? firstRetainedEvent;
    const offset = target === undefined
      ? text.length
      : leadingCommentStart(lines, target.headerSpan.start.offset, 0);
    groups.set(offset, [...(groups.get(offset) ?? []), receipt]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([offset, values]) => {
      const serialized = values
        .sort((left, right) => compareStableStrings(left.id, right.id))
        .map((receipt) => serializeReceipt(receipt, lineEnding))
        .join(`${lineEnding}${lineEnding}`);
      if (offset === text.length) {
        return appendDeclarationEdit(text, serialized, lineEnding);
      }
      return {
        startOffset: offset,
        endOffset: offset,
        replacement: `${serialized}${lineEnding}${lineEnding}`,
      };
    });
}

function receiptUpdateEdits(
  text: string,
  declaration: DeclarationNode<TargetDeclarationKind>,
  contract: FrontierAssuranceReceiptContractV1,
): readonly TextEdit[] {
  const editor = new EntityEditor(text, declaration, receiptFieldOrder);
  editor.setScalar("receipt_hash", hashFrontierAssuranceReceipt(contract));
  const consumers = fieldNamed(declaration, "consumers");
  if (consumers === undefined) {
    throw new Error("validated assurance receipt lost consumers");
  }
  return [
    ...editor.finish(),
    {
      startOffset: consumers.span.start.offset,
      endOffset: contentTextEndOffset(consumers, splitPhysicalLines(text)),
      replacement: serializeConsumers(contract.consumers, editor.lineEnding),
    },
  ];
}

function extensionFor(
  capability: TargetGrammar6Capability,
  summary: ReceiptMutationSummary,
): (
  text: string,
  document: DocumentNode<TargetDeclarationKind>,
  context: AdvancePlanningContext,
) => AdvancePlanningExtension {
  let captured = false;
  return (text, document, context) => {
    const checked = validateTargetGrammar6Document(text, capability);
    if (!checked.ok || checked.validatedDocument === null) {
      throw new Error("validated assurance advance source lost Grammar 6 validation");
    }
    const input = projectPlanAssuranceInput(checked.validatedDocument);
    if (input.modelVersion === null && input.hashModelVersion === null) return {};
    const evaluation = evaluatePlanAssurance(input);
    if (!evaluation.ok) {
      return {
        diagnostics: evaluation.diagnostics.map((item) =>
          assuranceAdvanceDiagnostic(
            item.message,
            item.entityId,
            "crossing_commitment_unavailable",
            item.data,
          )
        ),
      };
    }

    const removedTaskIds = new Set(context.removedTasks.map(({ id }) => id));
    const keptTaskIds = new Set(context.keptTasks.map(({ id }) => id));
    const removedDeclarations: DeclarationNode<TargetDeclarationKind>[] = [];
    for (const declaration of document.declarations) {
      if (
        declaration.kind === "task_relation" &&
        (removedTaskIds.has(declaration.from!) || removedTaskIds.has(declaration.to!))
      ) removedDeclarations.push(declaration);
      if (declaration.kind === "plan_seal" && removedTaskIds.has(declaration.id)) {
        removedDeclarations.push(declaration);
      }
      if (
        declaration.kind === "task_outcome" &&
        removedTaskIds.has(fieldNamed(declaration, "task")?.value as string)
      ) removedDeclarations.push(declaration);
    }

    const edits: TextEdit[] = [];
    const retainedReceiptIds = new Set<string>();
    for (const receipt of document.declarations.filter(
      (declaration) => declaration.kind === "assurance_receipt",
    )) {
      const originalConsumers = fieldNamed(receipt, "consumers")!
        .value as readonly AssuranceConsumerValue[];
      const consumers = originalConsumers.filter(({ consumerTaskId }) =>
        keptTaskIds.has(consumerTaskId)
      );
      if (consumers.length === 0) {
        removedDeclarations.push(receipt);
        continue;
      }
      retainedReceiptIds.add(receipt.id);
      const contract = receiptContract(receipt, consumers);
      const storedHash = requiredString(receipt, "receipt_hash");
      if (
        fieldNamed(receipt, "model")?.value !== 1 ||
        !isSha256Digest(storedHash) ||
        hashFrontierAssuranceReceipt(receiptContract(receipt)) !== storedHash
      ) {
        return {
          diagnostics: [assuranceAdvanceDiagnostic(
            `retained assurance receipt ${receipt.id} is unavailable`,
            receipt.id,
            "retained_receipt_unavailable",
          )],
        };
      }
      if (consumers.length !== originalConsumers.length) {
        edits.push(...receiptUpdateEdits(text, receipt, contract));
      }
    }

    const crossings = evaluation.effectiveDependencies.filter((relation) =>
      removedTaskIds.has(relation.predecessorTaskId) &&
      keptTaskIds.has(relation.successorTaskId) &&
      relation.mode !== "execution_only"
    );
    const byProducer = new Map<string, typeof crossings>();
    for (const crossing of crossings) {
      byProducer.set(crossing.predecessorTaskId, [
        ...(byProducer.get(crossing.predecessorTaskId) ?? []),
        crossing,
      ]);
    }
    const resultById = new Map(
      evaluation.taskResults.map((result) => [result.taskId, result] as const),
    );
    const inputById = new Map(
      input.tasks.map((task) => [task.contract.taskId, task] as const),
    );
    const taskById = new Map(
      document.declarations
        .filter((declaration) => declaration.kind === "task")
        .map((task) => [task.id, task] as const),
    );
    const baseRemoved = new Set<DeclarationNode<TargetDeclarationKind>>([
      ...context.removedTasks,
      ...context.removedGates,
      ...context.removedMilestones,
      ...context.removedWorkEvents,
      ...removedDeclarations,
    ]);
    const reserved = new Set(
      document.declarations
        .filter((declaration) => declaration.kind !== "plan_seal")
        .filter((declaration) => !baseRemoved.has(declaration))
        .map(({ id }) => id),
    );
    const plannedReceipts: PlannedReceipt[] = [];
    const capture = (
      plannedReceipts: readonly PlannedReceipt[] = [],
      updatedReceiptIds: readonly string[] = [],
    ): void => {
      if (captured) return;
      captured = true;
      Object.assign(summary, {
        crossingProducerTaskIds: Object.freeze(
          [...byProducer.keys()].sort(compareStableStrings),
        ),
        createdReceiptIds: Object.freeze(
          plannedReceipts.map(({ id }) => id).sort(compareStableStrings),
        ),
        updatedReceiptIds: Object.freeze(
          [...updatedReceiptIds].sort(compareStableStrings),
        ),
        removedReceiptIds: Object.freeze(
          removedDeclarations
            .filter(({ kind }) => kind === "assurance_receipt")
            .map(({ id }) => id)
            .sort(compareStableStrings),
        ),
        removedAssuranceRecordIds: Object.freeze(
          removedDeclarations.map(({ id }) => id).sort(compareStableStrings),
        ),
        updatedAssuranceReceiptIds: Object.freeze(
          [...updatedReceiptIds].sort(compareStableStrings),
        ),
      });
    };
    for (const producerTaskId of [...byProducer.keys()].sort(compareStableStrings)) {
      const producer = resultById.get(producerTaskId);
      const producerTask = taskById.get(producerTaskId);
      if (
        producer === undefined ||
        producerTask === undefined ||
        producer.status !== "verified" ||
        producer.contractHash === null ||
        producer.exportedAssuranceHash === null ||
        (producer.outcomeStatus !== "conformant" &&
          producer.outcomeStatus !== "changed")
      ) {
        capture();
        return {
          diagnostics: [assuranceAdvanceDiagnostic(
            `cross-frontier producer ${producerTaskId} has no usable accepted commitment`,
            producerTaskId,
            "crossing_commitment_unavailable",
          )],
        };
      }
      const consumers = byProducer.get(producerTaskId)!
        .map((relation) => ({
          consumerTaskId: relation.successorTaskId,
          relationMode: relation.mode as PlanningInputMode,
        }))
        .sort((left, right) =>
          compareStableStrings(left.consumerTaskId, right.consumerTaskId)
        );
      if (producer.outcomeStatus === "changed") {
        for (const consumer of consumers) {
          const accepted = inputById.get(consumer.consumerTaskId)?.seal
            ?.acceptedInputs.find((candidate) =>
              candidate.predecessorTaskId === producerTaskId &&
              candidate.relationMode === consumer.relationMode
            );
          if (accepted?.assuranceHash !== producer.exportedAssuranceHash) {
            capture();
            return {
              diagnostics: [assuranceAdvanceDiagnostic(
                `consumer ${consumer.consumerTaskId} has not accepted changed outcome commitment from ${producerTaskId}`,
                consumer.consumerTaskId,
                "changed_outcome_not_accepted",
                { producer_task_id: producerTaskId },
              )],
            };
          }
        }
      }
      const contract: FrontierAssuranceReceiptContractV1 = {
        model: "Perttool.FrontierAssuranceReceipt.v1",
        producerTaskId,
        producerTaskContractHash: producer.contractHash,
        producerAssuranceHash: producer.exportedAssuranceHash,
        outcome: producer.outcomeStatus,
        consumers,
        sourceMilestoneId: producerTask.to ?? null,
      };
      const id = allocateReceiptId(producerTaskId, reserved);
      plannedReceipts.push({
        id,
        contract,
        hash: hashFrontierAssuranceReceipt(contract),
      });
    }
    edits.push(...receiptInsertions(
      text,
      document,
      baseRemoved,
      plannedReceipts,
    ));

    const updatedReceiptIds = [...retainedReceiptIds].filter((id) => {
      const declaration = document.declarations.find((item) => item.id === id)!;
      const consumers = fieldNamed(declaration, "consumers")!
        .value as readonly AssuranceConsumerValue[];
      return consumers.some(({ consumerTaskId }) => removedTaskIds.has(consumerTaskId));
    });
    capture(plannedReceipts, updatedReceiptIds);
    return {
      removedDeclarations: Object.freeze(removedDeclarations),
      edits: Object.freeze(edits),
    };
  };
}

function failure(
  text: string,
  documentId: string | null,
  diagnostics: readonly Diagnostic[],
  maximum: number,
  alreadyTruncated = false,
): TargetPlanAssuranceAdvanceResultV2 {
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maximum);
  return Object.freeze({
    schemaVersion: PLAN_ASSURANCE_ADVANCE_RESULT_SCHEMA_VERSION,
    ok: false,
    documentId,
    changed: false,
    originalDigest: digest(text),
    updatedDigest: null,
    updatedText: null,
    diff: null,
    edits: Object.freeze([]),
    governance: null,
    lifecycle: null,
    assuranceGuard: null,
    historyGuard: null,
    advance: null,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated: alreadyTruncated || limited.truncated,
  });
}

function blockedCause(diagnostics: readonly Diagnostic[]): PlanAssuranceAdvanceGuardCause {
  const value = diagnostics.find(({ code }) => code === "PTASSURE-306")
    ?.data?.["cause"];
  return typeof value === "string"
    ? value as PlanAssuranceAdvanceGuardCause
    : "crossing_commitment_unavailable";
}

function receiptGuardSummary(
  summary: ReceiptMutationSummary,
): Pick<
  PlanAssuranceAdvanceGuardV1,
  | "crossingProducerTaskIds"
  | "createdReceiptIds"
  | "updatedReceiptIds"
  | "removedReceiptIds"
> {
  return {
    crossingProducerTaskIds: summary.crossingProducerTaskIds,
    createdReceiptIds: summary.createdReceiptIds,
    updatedReceiptIds: summary.updatedReceiptIds,
    removedReceiptIds: summary.removedReceiptIds,
  };
}

function baseResult(
  base: AdvanceResult,
  assuranceGuard: PlanAssuranceAdvanceGuardV1 | null,
  summary: ReceiptMutationSummary,
): TargetPlanAssuranceAdvanceResultV2 {
  return Object.freeze({
    ...base,
    schemaVersion: PLAN_ASSURANCE_ADVANCE_RESULT_SCHEMA_VERSION,
    governance: null,
    lifecycle: null,
    assuranceGuard,
    historyGuard: null,
    advance: base.advance === null
      ? null
      : {
          ...base.advance as ActualsAdvanceDetails,
          removedAssuranceRecordIds: Object.freeze([
            ...summary.removedAssuranceRecordIds,
          ]),
          updatedAssuranceReceiptIds: Object.freeze([
            ...summary.updatedAssuranceReceiptIds,
          ]),
        },
  });
}

export function planTargetPlanAssuranceAdvance(
  text: string,
  capability: TargetGrammar6Capability,
  options: PlanAssuranceAdvanceOptions = {},
): TargetPlanAssuranceAdvanceResultV2 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const original = validateTargetGrammar6Document(
    text,
    capability,
    { maxDiagnostics: maximum },
  );
  if (!original.ok || original.validatedDocument === null) {
    return failure(
      text,
      original.documentId,
      original.diagnostics,
      maximum,
      original.diagnosticsTruncated,
    );
  }
  const normalized = normalizePlanAssuranceGovernanceRequest(options.governance);
  if (!normalized.ok) {
    return failure(
      text,
      original.documentId,
      [...original.diagnostics, ...normalized.diagnostics],
      maximum,
      original.diagnosticsTruncated,
    );
  }
  const before = evaluatePlanAssurance(
    projectPlanAssuranceInput(original.validatedDocument),
  );
  const enabled = before.modelVersion !== null || before.hashModelVersion !== null;
  const summary: ReceiptMutationSummary = {
    crossingProducerTaskIds: Object.freeze([]),
    createdReceiptIds: Object.freeze([]),
    updatedReceiptIds: Object.freeze([]),
    removedReceiptIds: Object.freeze([]),
    removedAssuranceRecordIds: Object.freeze([]),
    updatedAssuranceReceiptIds: Object.freeze([]),
  };
  const base = planValidatedAdvance(
    text,
    grammar6AdvanceValidator(capability),
    options,
    {
      removeTaskOwnedWorkEvents: true,
      extendPlan: extensionFor(capability, summary),
    },
  );
  if (!base.ok || base.updatedText === null || base.advance === null) {
    const guard = base.diagnostics.some(({ code }) => code === "PTASSURE-306")
      ? Object.freeze({
          modelVersion: 1 as const,
          status: "blocked" as const,
          cause: blockedCause(base.diagnostics),
          ...receiptGuardSummary(summary),
          retainedBasisChecks: Object.freeze([]),
        })
      : null;
    return baseResult(base, guard, summary);
  }
  const candidate = validateTargetGrammar6Document(
    base.updatedText,
    capability,
    { maxDiagnostics: maximum },
  );
  if (!candidate.ok || candidate.validatedDocument === null) {
    throw new Error("assurance advance candidate lost Grammar 6 validation");
  }
  const after = evaluatePlanAssurance(
    projectPlanAssuranceInput(candidate.validatedDocument),
  );
  const beforeById = new Map(before.taskResults.map((item) => [item.taskId, item]));
  const retainedBasisChecks = after.taskResults.map((item) => {
    const beforeBasisHash = beforeById.get(item.taskId)?.computedBasisHash ?? null;
    return Object.freeze({
      taskId: item.taskId,
      beforeBasisHash,
      afterBasisHash: item.computedBasisHash,
      equal: beforeBasisHash === item.computedBasisHash,
    });
  });
  const mismatch = retainedBasisChecks.find(({ equal }) => !equal);
  if (enabled && mismatch !== undefined) {
    const diagnostic = assuranceAdvanceDiagnostic(
      `advance changed retained planning basis for ${mismatch.taskId}`,
      mismatch.taskId,
      "retained_basis_changed",
      {
        before_basis_hash: mismatch.beforeBasisHash,
        after_basis_hash: mismatch.afterBasisHash,
      },
    );
    const limited = limitDiagnostics(
      sortDiagnostics([...base.diagnostics, diagnostic]),
      maximum,
    );
    return Object.freeze({
      ...baseResult(base, Object.freeze({
        modelVersion: 1,
        status: "blocked",
        cause: "retained_basis_changed",
        ...receiptGuardSummary(summary),
        retainedBasisChecks: Object.freeze(retainedBasisChecks),
      }), summary),
      ok: false,
      diagnostics: limited.diagnostics,
      diagnosticsTruncated: base.diagnosticsTruncated || limited.truncated,
    });
  }

  const metadata = governanceMetadataFromDocument(
    original.validatedDocument.document,
  );
  const ordinaryScopes = classifyGovernanceScopes(
    original.validatedDocument.document,
    candidate.validatedDocument.document,
  );
  const scopes: readonly PlanAssuranceGovernanceScope[] = base.changed
    ? Object.freeze(([
        ...ordinaryScopes,
        ...(enabled ? ["plan_assurance" as const] : []),
      ] as PlanAssuranceGovernanceScope[]).filter(
        (scope, index, values) => values.indexOf(scope) === index,
      ))
    : Object.freeze([]);
  const governance = evaluatePlanAssuranceGovernance(
    {
      sourceDigest: base.originalDigest,
      goalOwner: metadata.effective.goalOwner,
      goalDelegates: metadata.effective.goalDelegates,
      dagOwner: metadata.effective.dagOwner,
      dagDelegates: metadata.effective.dagDelegates,
    },
    scopes,
    normalized.request,
  );
  const assuranceGuard: PlanAssuranceAdvanceGuardV1 = Object.freeze({
    modelVersion: 1,
    status: enabled ? "passed" : "not_applicable",
    cause: enabled
      ? base.changed ? "basis_preserved" : "no_change"
      : "not_enabled",
    ...receiptGuardSummary(summary),
    retainedBasisChecks: Object.freeze(retainedBasisChecks),
  });
  const diagnostics = [
    ...base.diagnostics,
    ...planAssuranceGovernanceDiagnostics(governance),
  ];
  const hasError = diagnostics.some(({ severity }) => severity === "error");
  const warningFailure = options.warningsAsErrors === true &&
    diagnostics.some(({ severity }) => severity === "warning");
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maximum);
  return Object.freeze({
    ...base,
    schemaVersion: PLAN_ASSURANCE_ADVANCE_RESULT_SCHEMA_VERSION,
    ok: !hasError && !warningFailure,
    governance,
    lifecycle: null,
    assuranceGuard,
    historyGuard: null,
    advance: baseResult(base, assuranceGuard, summary).advance,
    diff: createUnifiedDiff(text, base.updatedText, {
      originalLabel: options.originalLabel ?? "original",
      updatedLabel: options.updatedLabel ?? "updated",
    }),
    diagnostics: limited.diagnostics,
    diagnosticsTruncated:
      base.diagnosticsTruncated || candidate.diagnosticsTruncated || limited.truncated,
  });
}
