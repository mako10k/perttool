import { createHash } from "node:crypto";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import { governanceMetadataFromDocument } from "../governance/source.js";
import { classifyGovernanceScopes } from "../governance/authority.js";
import type { GovernanceRequestInput } from "../governance/types.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import {
  TARGET_GRAMMAR_6_DECLARATION_FIELD_ORDER,
} from "../model/declaration-fields.js";
import type {
  DeclarationNode,
  DocumentNode,
  TargetDeclarationKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import { EntityEditor } from "../mutation/entity-editor.js";
import {
  appendDeclarationEdit,
  contentTextEndOffset,
  deleteDeclarationEdit,
  leadingCommentStart,
  majorLineEnding,
  serializeTextField,
  splitPhysicalLines,
} from "../mutation/source.js";
import {
  applyTextEdits,
  normalizeTextEdits,
  type TextEdit,
} from "../mutation/text-edits.js";
import type { TargetGrammar6Capability } from "../parser/document-parser.js";
import type { TargetGovernanceAtomicMutation } from "../mutation/target-types.js";
import {
  validateTargetGrammar6Document,
  type TargetGrammar6ValidatedDocument,
} from "../semantic/target-validator.js";
import {
  evaluatePlanAssurance,
  sealTaskResult,
} from "./evaluate.js";
import {
  composePlanAssuranceMutationImpact,
  type PlanAssuranceMutationImpactCompositionV1,
} from "./authority.js";
import {
  evaluatePlanAssuranceGovernance,
  normalizePlanAssuranceGovernanceRequest,
  planAssuranceGovernanceDiagnostics,
  type PlanAssuranceGovernanceDecisionV2,
} from "./governance.js";
import {
  mergeBatchInsertions,
} from "../mutation/planner.js";
import {
  planTargetGrammar6AtomicMutationEdits,
  planTargetGrammar6BatchMutation,
} from "../mutation/target-planner.js";
import { projectPlanAssuranceInput } from "./source.js";
import type {
  AcceptedPlanningInputV1,
  PlanAssuranceEvaluationV1,
  PlanAssuranceTaskResultV1,
  PlanDependencyMode,
  TaskPlanSealV1,
} from "./types.js";

export interface AddPlanDependencyMutation {
  readonly kind: "plan_dependency.add";
  readonly id: string;
  readonly predecessorTaskId: string;
  readonly successorTaskId: string;
  readonly mode: PlanDependencyMode;
  readonly reason?: string;
}

export interface SetPlanDependencyMutation {
  readonly kind: "plan_dependency.set";
  readonly id: string;
  readonly predecessorTaskId?: string;
  readonly successorTaskId?: string;
  readonly mode?: PlanDependencyMode;
  readonly reason?: string;
  readonly clearReason?: boolean;
}

export interface RemovePlanDependencyMutation {
  readonly kind: "plan_dependency.remove";
  readonly id: string;
}

export interface SealPlanAssuranceMutation {
  readonly kind: "plan_assurance.seal";
  readonly reason: string;
}

export interface ResealPlanAssuranceMutation {
  readonly kind: "plan_assurance.reseal";
  readonly taskIds: readonly string[];
  readonly reason: string;
}

export interface AddTaskOutcomeMutation {
  readonly kind: "task_outcome.add";
  readonly id: string;
  readonly taskId: string;
  readonly status: "conformant" | "changed";
  readonly summary?: string;
  readonly reason: string;
}

export interface SetTaskOutcomeMutation {
  readonly kind: "task_outcome.set";
  readonly id: string;
  readonly status?: "conformant" | "changed";
  readonly summary?: string;
  readonly clearSummary?: boolean;
  readonly reason?: string;
  readonly rebindCurrentBasis?: boolean;
}

export interface RemoveTaskOutcomeMutation {
  readonly kind: "task_outcome.remove";
  readonly id: string;
}

export type PlanAssuranceAtomicMutation =
  | AddPlanDependencyMutation
  | SetPlanDependencyMutation
  | RemovePlanDependencyMutation
  | SealPlanAssuranceMutation
  | ResealPlanAssuranceMutation
  | AddTaskOutcomeMutation
  | SetTaskOutcomeMutation
  | RemoveTaskOutcomeMutation;

export interface PlanAssuranceBatchMutation {
  readonly kind: "batch";
  readonly mutations: readonly (
    | PlanAssuranceAtomicMutation
    | TargetGovernanceAtomicMutation
  )[];
}

export type PlanAssuranceMutation =
  | PlanAssuranceAtomicMutation
  | PlanAssuranceBatchMutation;

function mutationAffectsAssuranceSource(
  mutation: PlanAssuranceMutation,
): boolean {
  if (mutation.kind !== "batch") return true;
  return mutation.mutations.some((item) =>
    item.kind.startsWith("plan_assurance.") ||
    item.kind.startsWith("plan_dependency.") ||
    item.kind.startsWith("task_outcome.")
  );
}

export interface PlanAssuranceMutationOptions {
  readonly maxDiagnostics?: number;
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
  readonly warningsAsErrors?: boolean;
  readonly governance?: GovernanceRequestInput;
}

export interface PlanAssuranceImpactV1 {
  readonly modelVersion: 1;
  readonly affectedTaskIds: readonly string[];
  readonly before: PlanAssuranceEvaluationV1;
  readonly after: PlanAssuranceEvaluationV1;
  readonly projection: PlanAssuranceMutationImpactCompositionV1;
}

export interface TargetPlanAssuranceMutationResultV4 {
  readonly schemaVersion: "Perttool.MutationResult.v4";
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly TextEdit[];
  readonly governance: PlanAssuranceGovernanceDecisionV2 | null;
  readonly assuranceImpact: PlanAssuranceImpactV1 | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

interface EditPlan {
  readonly edits: readonly TextEdit[];
  readonly diagnostic?: Diagnostic;
}

const requestFieldsByKind: Readonly<Record<string, ReadonlySet<string>>> =
  Object.freeze({
    "plan_dependency.add": new Set([
      "kind", "id", "predecessorTaskId", "successorTaskId", "mode", "reason",
    ]),
    "plan_dependency.set": new Set([
      "kind", "id", "predecessorTaskId", "successorTaskId", "mode", "reason",
      "clearReason",
    ]),
    "plan_dependency.remove": new Set(["kind", "id"]),
    "plan_assurance.seal": new Set(["kind", "reason"]),
    "plan_assurance.reseal": new Set(["kind", "taskIds", "reason"]),
    "task_outcome.add": new Set([
      "kind", "id", "taskId", "status", "summary", "reason",
    ]),
    "task_outcome.set": new Set([
      "kind", "id", "status", "summary", "clearSummary", "reason",
      "rebindCurrentBasis",
    ]),
    "task_outcome.remove": new Set(["kind", "id"]),
    batch: new Set(["kind", "mutations"]),
  });

function mutationRequestShapeError(value: unknown, nested = false): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "assurance mutation request must be an object";
  }
  const request = value as Record<string, unknown>;
  const kind = request["kind"];
  const ordinaryKind = typeof kind === "string" && (
    kind === "project.set" ||
    kind.startsWith("task.") ||
    kind.startsWith("gate.") ||
    kind.startsWith("milestone.") ||
    kind.startsWith("resource.")
  );
  if (
    typeof kind !== "string" ||
    (requestFieldsByKind[kind] === undefined && !(nested && ordinaryKind))
  ) {
    return "assurance mutation kind is unsupported";
  }
  if (nested && ordinaryKind && requestFieldsByKind[kind] === undefined) {
    return null;
  }
  if (nested && kind === "batch") return "assurance batch cannot be nested";
  if (Object.keys(request).some((field) =>
    !requestFieldsByKind[kind]!.has(field)
  )) {
    return `${kind} request contains unsupported fields`;
  }
  if (kind === "batch") {
    if (!Array.isArray(request["mutations"]) || request["mutations"].length === 0) {
      return "assurance batch requires at least one mutation";
    }
    for (const item of request["mutations"]) {
      const error = mutationRequestShapeError(item, true);
      if (error !== null) return error;
    }
  }
  return null;
}

const relationFieldOrder = ["mode", "reason"] as const;
const sealFieldOrder = [
  "accepted_contract",
  "accepted_basis",
  "accepted_inputs",
  "reason",
] as const;
const outcomeFieldOrder = [
  "model",
  "task",
  "against_basis",
  "status",
  "summary",
  "reason",
] as const;

function digest(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function assuranceDiagnostic(
  code:
    | "PTASSURE-101"
    | "PTASSURE-102"
    | "PTASSURE-201"
    | "PTASSURE-202"
    | "PTASSURE-203"
    | "PTASSURE-301"
    | "PTASSURE-302"
    | "PTASSURE-303"
    | "PTASSURE-304"
    | "PTASSURE-305",
  severity: "error" | "warning",
  message: string,
  entityId: string | null = null,
  data: Readonly<Record<string, unknown>> = {},
): Diagnostic {
  return Object.freeze({
    code,
    severity,
    message,
    ...(entityId === null ? {} : { entityId }),
    helpTopic: "plan-assurance",
    data: Object.freeze(data),
  });
}

function failure(
  text: string,
  documentId: string | null,
  diagnostics: readonly Diagnostic[],
  maximum: number,
  alreadyTruncated = false,
): TargetPlanAssuranceMutationResultV4 {
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maximum);
  return Object.freeze({
    schemaVersion: "Perttool.MutationResult.v4",
    ok: false,
    documentId,
    changed: false,
    originalDigest: digest(text),
    updatedDigest: null,
    updatedText: null,
    diff: null,
    edits: Object.freeze([]),
    governance: null,
    assuranceImpact: null,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated: alreadyTruncated || limited.truncated,
  });
}

function entity(
  document: DocumentNode<TargetDeclarationKind>,
  id: string,
): DeclarationNode<TargetDeclarationKind> | undefined {
  return document.declarations.find((declaration) => declaration.id === id);
}

function declarationOfKind(
  document: DocumentNode<TargetDeclarationKind>,
  kind: TargetDeclarationKind,
  id: string,
): DeclarationNode<TargetDeclarationKind> | undefined {
  return document.declarations.find(
    (declaration) => declaration.kind === kind && declaration.id === id,
  );
}

function nonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function validMode(value: unknown): value is PlanDependencyMode {
  return value === "both" || value === "execution_only" || value === "planning_only";
}

function insertDeclarations(
  text: string,
  document: DocumentNode<TargetDeclarationKind>,
  serialized: readonly string[],
  beforeKinds: ReadonlySet<TargetDeclarationKind>,
): TextEdit {
  const lineEnding = majorLineEnding(text);
  const later = document.declarations.find((declaration) =>
    beforeKinds.has(declaration.kind)
  );
  if (later === undefined) {
    return appendDeclarationEdit(
      text,
      serialized.join(`${lineEnding}${lineEnding}`),
      lineEnding,
    );
  }
  const lines = splitPhysicalLines(text);
  const offset = leadingCommentStart(lines, later.headerSpan.start.offset, 0);
  return {
    startOffset: offset,
    endOffset: offset,
    replacement: `${serialized.join(`${lineEnding}${lineEnding}`)}${lineEnding}${lineEnding}`,
  };
}

function serializeAcceptedInputs(
  inputs: readonly AcceptedPlanningInputV1[],
  lineEnding: string,
): string {
  return [
    "  accepted_inputs:",
    ...inputs.map((input) =>
      `    ${input.predecessorTaskId} ${input.relationMode} ${input.assuranceHash}`
    ),
  ].join(lineEnding);
}

function serializeSeal(
  taskId: string,
  seal: TaskPlanSealV1,
  reason: string,
  lineEnding: string,
): string {
  return [
    `plan_seal ${taskId}:`,
    `  accepted_contract ${seal.acceptedContractHash}`,
    `  accepted_basis ${seal.acceptedBasisHash}`,
    ...(seal.acceptedInputs.length === 0
      ? []
      : [serializeAcceptedInputs(seal.acceptedInputs, lineEnding)]),
    serializeTextField("reason", reason, lineEnding),
  ].join(lineEnding);
}

function planSealRecordEdits(
  text: string,
  declaration: DeclarationNode<TargetDeclarationKind>,
  seal: TaskPlanSealV1,
  reason: string,
): readonly TextEdit[] {
  const acceptedInputs = fieldNamed(declaration, "accepted_inputs");
  const editor = new EntityEditor(
    text,
    declaration,
    sealFieldOrder,
    seal.acceptedInputs.length === 0 ? ["accepted_inputs"] : [],
  );
  editor.setScalar("accepted_contract", seal.acceptedContractHash);
  editor.setScalar("accepted_basis", seal.acceptedBasisHash);
  editor.setText("reason", reason);
  const edits = [...editor.finish()];
  if (seal.acceptedInputs.length > 0) {
    const serialized = serializeAcceptedInputs(
      seal.acceptedInputs,
      editor.lineEnding,
    );
    if (acceptedInputs === undefined) {
      const inputEditor = new EntityEditor(text, declaration, sealFieldOrder);
      inputEditor.queue("accepted_inputs", serialized);
      edits.push(...inputEditor.finish());
    } else {
      edits.push({
        startOffset: acceptedInputs.span.start.offset,
        endOffset: contentTextEndOffset(
          acceptedInputs,
          splitPhysicalLines(text),
        ),
        replacement: serialized,
      });
    }
  }
  return edits;
}

function serializeRelation(
  mutation: AddPlanDependencyMutation,
  lineEnding: string,
): string {
  return [
    `task_relation ${mutation.id} ${mutation.predecessorTaskId} -> ${mutation.successorTaskId}:`,
    `  mode ${mutation.mode}`,
    ...(mutation.reason === undefined
      ? []
      : [serializeTextField("reason", mutation.reason, lineEnding)]),
  ].join(lineEnding);
}

function relationRequestError(
  mutation: AddPlanDependencyMutation | SetPlanDependencyMutation,
): string | null {
  if (!nonemptyString(mutation.id)) return "relation ID must be nonempty";
  if (mutation.kind === "plan_dependency.add") {
    if (
      !nonemptyString(mutation.predecessorTaskId) ||
      !nonemptyString(mutation.successorTaskId) ||
      !validMode(mutation.mode)
    ) {
      return "relation add requires task IDs and a known mode";
    }
    if (
      mutation.reason !== undefined &&
      !nonemptyString(mutation.reason)
    ) {
      return "relation reason must be nonempty when present";
    }
    return null;
  }
  if (
    mutation.predecessorTaskId === undefined &&
    mutation.successorTaskId === undefined &&
    mutation.mode === undefined &&
    mutation.reason === undefined &&
    mutation.clearReason !== true
  ) {
    return "relation set requires at least one change";
  }
  if (
    mutation.predecessorTaskId !== undefined &&
    !nonemptyString(mutation.predecessorTaskId)
  ) return "predecessor task ID must be nonempty";
  if (
    mutation.successorTaskId !== undefined &&
    !nonemptyString(mutation.successorTaskId)
  ) return "successor task ID must be nonempty";
  if (mutation.mode !== undefined && !validMode(mutation.mode)) {
    return "relation mode is unknown";
  }
  if (mutation.reason !== undefined && !nonemptyString(mutation.reason)) {
    return "relation reason must be nonempty when present";
  }
  if (mutation.reason !== undefined && mutation.clearReason === true) {
    return "relation reason cannot be set and cleared together";
  }
  return null;
}

function planRelation(
  text: string,
  validated: TargetGrammar6ValidatedDocument,
  mutation:
    | AddPlanDependencyMutation
    | SetPlanDependencyMutation
    | RemovePlanDependencyMutation,
): EditPlan {
  const document = validated.document;
  if (!nonemptyString(mutation.id)) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-301",
      "error",
      "plan-dependency mutation requires a nonempty relation ID",
    ) };
  }
  const current = entity(document, mutation.id);
  if (mutation.kind === "plan_dependency.add") {
    const error = relationRequestError(mutation);
    if (error !== null) {
      return { edits: [], diagnostic: assuranceDiagnostic(
        "PTASSURE-301", "error", error, mutation.id,
      ) };
    }
    if (current !== undefined) {
      return { edits: [], diagnostic: assuranceDiagnostic(
        "PTASSURE-302", "error", `entity ID ${mutation.id} is already in use`, mutation.id,
      ) };
    }
    return { edits: [insertDeclarations(
      text,
      document,
      [serializeRelation(mutation, majorLineEnding(text))],
      new Set(["plan_seal", "task_outcome", "assurance_receipt", "work_event"]),
    )] };
  }
  if (current === undefined || current.kind !== "task_relation") {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-302",
      "error",
      `plan dependency ${mutation.id} does not exist`,
      mutation.id,
    ) };
  }
  if (mutation.kind === "plan_dependency.remove") {
    return { edits: [deleteDeclarationEdit(current, splitPhysicalLines(text))] };
  }
  const error = relationRequestError(mutation);
  if (error !== null) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-301", "error", error, mutation.id,
    ) };
  }
  if (current.fromSpan === undefined || current.toSpan === undefined) {
    throw new Error("validated task relation lost endpoint spans");
  }
  const editor = new EntityEditor(
    text,
    current,
    relationFieldOrder,
    mutation.clearReason === true ? ["reason"] : [],
  );
  if (mutation.mode !== undefined) editor.setScalar("mode", mutation.mode);
  if (mutation.reason !== undefined) editor.setText("reason", mutation.reason);
  const edits = [...editor.finish()];
  if (mutation.predecessorTaskId !== undefined) {
    edits.push({
      startOffset: current.fromSpan.start.offset,
      endOffset: current.fromSpan.end.offset,
      replacement: mutation.predecessorTaskId,
    });
  }
  if (mutation.successorTaskId !== undefined) {
    edits.push({
      startOffset: current.toSpan.start.offset,
      endOffset: current.toSpan.end.offset,
      replacement: mutation.successorTaskId,
    });
  }
  return { edits };
}

function evaluationOf(
  validated: TargetGrammar6ValidatedDocument,
): PlanAssuranceEvaluationV1 {
  return evaluatePlanAssurance(projectPlanAssuranceInput(validated));
}

function currentEqualBasis(
  evaluation: PlanAssuranceEvaluationV1,
  taskId: string,
): PlanAssuranceTaskResultV1 | null {
  const result = evaluation.taskResults.find((task) => task.taskId === taskId);
  return result !== undefined &&
      result.contractHash !== null &&
      result.computedBasisHash !== null &&
      result.acceptedBasisHash === result.computedBasisHash
    ? result
    : null;
}

function planInitialSeal(
  text: string,
  validated: TargetGrammar6ValidatedDocument,
  mutation: SealPlanAssuranceMutation,
  capability: TargetGrammar6Capability,
): EditPlan {
  if (!nonemptyString(mutation.reason)) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-301", "error", "initial seal requires a nonempty reason",
    ) };
  }
  const originalInput = projectPlanAssuranceInput(validated);
  const enabled = originalInput.modelVersion !== null ||
    originalInput.hashModelVersion !== null;
  if (
    enabled &&
    (originalInput.modelVersion !== 1 || originalInput.hashModelVersion !== 1)
  ) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-303", "error", "initial seal requires known assurance models",
    ) };
  }
  const originalEvaluation = evaluationOf(validated);
  const existingSealed = new Set(
    originalInput.tasks.filter((task) => task.seal !== null)
      .map((task) => task.contract.taskId),
  );
  if (
    enabled &&
    originalInput.tasks.every((task) => task.seal !== null)
  ) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-303", "error", "initial seal would replace an existing complete baseline",
    ) };
  }
  if (
    enabled &&
    originalEvaluation.taskResults.some((result) =>
      existingSealed.has(result.taskId) &&
      result.status !== "verified" &&
      result.status !== "conditional"
    )
  ) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-303",
      "error",
      "partial initial seal cannot replace or silently accept an inconsistent existing seal",
    ) };
  }

  const project = validated.document.declarations.find(
    (declaration) => declaration.kind === "project",
  );
  if (project === undefined) throw new Error("validated document has no project");
  const projectEditor = new EntityEditor(
    text,
    project,
    TARGET_GRAMMAR_6_DECLARATION_FIELD_ORDER.project,
  );
  if (!enabled) {
    projectEditor.setScalar("version", "6");
    projectEditor.setScalar("plan_assurance_model", "1");
    projectEditor.setScalar("plan_assurance_hash_model", "1");
  }
  const projectEdits = [...projectEditor.finish()];
  const enabledText = applyTextEdits(
    text,
    normalizeTextEdits(text, projectEdits, "plan assurance enablement"),
  );
  const enabledValidation = validateTargetGrammar6Document(
    enabledText,
    capability,
  );
  if (!enabledValidation.ok || enabledValidation.validatedDocument === null) {
    throw new Error("initial assurance enablement did not validate");
  }
  const enabledInput = projectPlanAssuranceInput(
    enabledValidation.validatedDocument,
  );
  const enabledEvaluation = !enabled
    ? evaluatePlanAssurance({
        ...enabledInput,
        tasks: enabledInput.tasks.map((task) => ({
          ...task,
          lifecycle: "unfinished" as const,
          outcome: null,
        })),
      })
    : evaluatePlanAssurance(enabledInput);
  if (!enabledEvaluation.ok) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-303", "error", "initial seal basis is unavailable",
    ) };
  }
  const missing = enabledEvaluation.taskResults
    .filter((result) => !existingSealed.has(result.taskId));
  let seals: readonly string[];
  try {
    seals = missing.map((result) => serializeSeal(
      result.taskId,
      sealTaskResult(result),
      mutation.reason,
      majorLineEnding(text),
    ));
  } catch {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-303", "error", "initial seal requires every missing task basis to be available",
    ) };
  }
  const sealEdit = insertDeclarations(
    text,
    validated.document,
    seals,
    new Set(["task_outcome", "assurance_receipt", "work_event"]),
  );
  return { edits: [...projectEdits, sealEdit] };
}

function planReseal(
  text: string,
  validated: TargetGrammar6ValidatedDocument,
  mutation: ResealPlanAssuranceMutation,
): EditPlan {
  if (
    !Array.isArray(mutation.taskIds) ||
    mutation.taskIds.length === 0 ||
    mutation.taskIds.some((taskId) => !nonemptyString(taskId)) ||
    new Set(mutation.taskIds).size !== mutation.taskIds.length ||
    !nonemptyString(mutation.reason)
  ) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-301",
      "error",
      "reseal requires unique task IDs and one nonempty reason",
    ) };
  }
  const input = projectPlanAssuranceInput(validated);
  if (input.modelVersion !== 1 || input.hashModelVersion !== 1) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-304", "error", "reseal requires known enabled assurance models",
    ) };
  }
  const evaluation = evaluatePlanAssurance(input);
  if (!evaluation.ok) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-304", "error", "reseal cannot evaluate the planning DAG",
    ) };
  }
  const selected = new Set(mutation.taskIds);
  const resultById = new Map(
    evaluation.taskResults.map((result) => [result.taskId, result] as const),
  );
  for (const taskId of selected) {
    const result = resultById.get(taskId);
    const seal = declarationOfKind(validated.document, "plan_seal", taskId);
    if (
      result === undefined ||
      seal === undefined ||
      result.contractHash === null ||
      result.computedBasisHash === null
    ) {
      return { edits: [], diagnostic: assuranceDiagnostic(
        "PTASSURE-304",
        "error",
        `task ${taskId} has no resealable current basis`,
        taskId,
      ) };
    }
    const unresolved = evaluation.effectiveDependencies
      .filter((relation) =>
        relation.successorTaskId === taskId &&
        relation.mode !== "execution_only"
      )
      .map((relation) => relation.predecessorTaskId)
      .find((predecessorId) => {
        const predecessor = resultById.get(predecessorId);
        return predecessor !== undefined &&
          predecessor.status !== "verified" &&
          predecessor.status !== "conditional" &&
          !selected.has(predecessorId);
      });
    if (unresolved !== undefined) {
      return { edits: [], diagnostic: assuranceDiagnostic(
        "PTASSURE-304",
        "error",
        `task ${taskId} has unresolved unselected predecessor ${unresolved}`,
        taskId,
        { predecessor_task_id: unresolved },
      ) };
    }
  }
  const edits: TextEdit[] = [];
  for (const taskId of [...selected].sort()) {
    edits.push(...planSealRecordEdits(
      text,
      declarationOfKind(validated.document, "plan_seal", taskId)!,
      sealTaskResult(resultById.get(taskId)!),
      mutation.reason,
    ));
  }
  return { edits };
}

function outcomeRequestError(
  mutation: AddTaskOutcomeMutation | SetTaskOutcomeMutation,
): string | null {
  if (!nonemptyString(mutation.id)) return "outcome ID must be nonempty";
  if (mutation.kind === "task_outcome.add") {
    if (!nonemptyString(mutation.taskId) || !nonemptyString(mutation.reason)) {
      return "outcome add requires a task ID and nonempty reason";
    }
    if (mutation.status !== "conformant" && mutation.status !== "changed") {
      return "outcome status is unknown";
    }
    if (
      (mutation.status === "changed" && !nonemptyString(mutation.summary)) ||
      (mutation.status === "conformant" && mutation.summary !== undefined)
    ) {
      return "changed outcome requires summary and conformant outcome forbids it";
    }
    return null;
  }
  if (
    mutation.status === undefined &&
    mutation.summary === undefined &&
    mutation.clearSummary !== true &&
    mutation.reason === undefined &&
    mutation.rebindCurrentBasis !== true
  ) return "outcome set requires at least one change";
  if (
    mutation.status !== undefined &&
    mutation.status !== "conformant" &&
    mutation.status !== "changed"
  ) return "outcome status is unknown";
  if (mutation.summary !== undefined && !nonemptyString(mutation.summary)) {
    return "outcome summary must be nonempty when present";
  }
  if (mutation.reason !== undefined && !nonemptyString(mutation.reason)) {
    return "outcome reason must be nonempty when present";
  }
  if (mutation.summary !== undefined && mutation.clearSummary === true) {
    return "outcome summary cannot be set and cleared together";
  }
  if (mutation.rebindCurrentBasis === true && !nonemptyString(mutation.reason)) {
    return "outcome rebind requires a nonempty reason";
  }
  return null;
}

function serializeOutcome(
  mutation: AddTaskOutcomeMutation,
  basis: string,
  lineEnding: string,
): string {
  return [
    `task_outcome ${mutation.id}:`,
    "  model 1",
    `  task ${mutation.taskId}`,
    `  against_basis ${basis}`,
    `  status ${mutation.status}`,
    ...(mutation.summary === undefined
      ? []
      : [serializeTextField("summary", mutation.summary, lineEnding)]),
    serializeTextField("reason", mutation.reason, lineEnding),
  ].join(lineEnding);
}

function planOutcome(
  text: string,
  validated: TargetGrammar6ValidatedDocument,
  mutation:
    | AddTaskOutcomeMutation
    | SetTaskOutcomeMutation
    | RemoveTaskOutcomeMutation,
): EditPlan {
  if (!nonemptyString(mutation.id)) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-301", "error", "task-outcome mutation requires a nonempty ID",
    ) };
  }
  const current = entity(validated.document, mutation.id);
  const evaluation = evaluationOf(validated);
  if (mutation.kind === "task_outcome.add") {
    const error = outcomeRequestError(mutation);
    if (error !== null) {
      return { edits: [], diagnostic: assuranceDiagnostic(
        "PTASSURE-301", "error", error, mutation.id,
      ) };
    }
    if (current !== undefined) {
      return { edits: [], diagnostic: assuranceDiagnostic(
        "PTASSURE-302", "error", `entity ID ${mutation.id} is already in use`, mutation.id,
      ) };
    }
    const task = declarationOfKind(validated.document, "task", mutation.taskId);
    const result = currentEqualBasis(evaluation, mutation.taskId);
    if (
      task === undefined ||
      fieldNamed(task, "status")?.value !== "done" ||
      result === null
    ) {
      return { edits: [], diagnostic: assuranceDiagnostic(
        "PTASSURE-305",
        "error",
        `task ${mutation.taskId} is not a completed task with an equal accepted current basis`,
        mutation.taskId,
      ) };
    }
    if (evaluation.taskResults.some((candidate) =>
      candidate.taskId === mutation.taskId &&
      validated.document.declarations.some((declaration) =>
        declaration.kind === "task_outcome" &&
        fieldNamed(declaration, "task")?.value === mutation.taskId
      )
    )) {
      return { edits: [], diagnostic: assuranceDiagnostic(
        "PTASSURE-302", "error", `task ${mutation.taskId} already has an outcome`, mutation.taskId,
      ) };
    }
    return { edits: [insertDeclarations(
      text,
      validated.document,
      [serializeOutcome(
        mutation,
        result.computedBasisHash!,
        majorLineEnding(text),
      )],
      new Set(["assurance_receipt", "work_event"]),
    )] };
  }
  if (current === undefined || current.kind !== "task_outcome") {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-302", "error", `task outcome ${mutation.id} does not exist`, mutation.id,
    ) };
  }
  if (mutation.kind === "task_outcome.remove") {
    return { edits: [deleteDeclarationEdit(current, splitPhysicalLines(text))] };
  }
  const error = outcomeRequestError(mutation);
  if (error !== null) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-301", "error", error, mutation.id,
    ) };
  }
  const taskId = fieldNamed(current, "task")?.value;
  if (typeof taskId !== "string") throw new Error("validated outcome lost task ID");
  const editor = new EntityEditor(
    text,
    current,
    outcomeFieldOrder,
    mutation.clearSummary === true ? ["summary"] : [],
  );
  if (mutation.status !== undefined) editor.setScalar("status", mutation.status);
  if (mutation.summary !== undefined) editor.setText("summary", mutation.summary);
  if (mutation.reason !== undefined) editor.setText("reason", mutation.reason);
  if (mutation.rebindCurrentBasis === true) {
    const result = currentEqualBasis(evaluation, taskId);
    if (result === null) {
      return { edits: [], diagnostic: assuranceDiagnostic(
        "PTASSURE-305",
        "error",
        `task ${taskId} has no equal accepted current basis for outcome rebind`,
        taskId,
      ) };
    }
    editor.setScalar("against_basis", result.computedBasisHash!);
  }
  return { edits: editor.finish() };
}

function planEdits(
  text: string,
  validated: TargetGrammar6ValidatedDocument,
  mutation: PlanAssuranceAtomicMutation,
  capability: TargetGrammar6Capability,
): EditPlan {
  if (
    mutation.kind === "plan_dependency.add" ||
    mutation.kind === "plan_dependency.set" ||
    mutation.kind === "plan_dependency.remove"
  ) return planRelation(text, validated, mutation);
  if (mutation.kind === "plan_assurance.seal") {
    return planInitialSeal(text, validated, mutation, capability);
  }
  if (mutation.kind === "plan_assurance.reseal") {
    return planReseal(text, validated, mutation);
  }
  return planOutcome(text, validated, mutation);
}

function planBatchEdits(
  text: string,
  validated: TargetGrammar6ValidatedDocument,
  mutation: PlanAssuranceBatchMutation,
  capability: TargetGrammar6Capability,
): EditPlan {
  if (
    !Array.isArray(mutation.mutations) ||
    mutation.mutations.length === 0 ||
    mutation.mutations.some((item) =>
      item === null ||
      typeof item !== "object" ||
      (item as { readonly kind?: unknown }).kind === "batch"
    )
  ) {
    return { edits: [], diagnostic: assuranceDiagnostic(
      "PTASSURE-301",
      "error",
      "assurance batch requires at least one non-batch mutation",
    ) };
  }
  const isAssuranceMutation = (
    item: PlanAssuranceBatchMutation["mutations"][number],
  ): item is PlanAssuranceAtomicMutation =>
    requestFieldsByKind[item.kind] !== undefined;
  const hasOrdinaryMutation = mutation.mutations.some((item) =>
    !isAssuranceMutation(item)
  );
  const hasAssuranceMutation = mutation.mutations.some(isAssuranceMutation);
  if (hasOrdinaryMutation && !hasAssuranceMutation) {
    const result = planTargetGrammar6BatchMutation(
      text,
      mutation as unknown as Parameters<
        typeof planTargetGrammar6BatchMutation
      >[1],
      capability,
    );
    return result.ok
      ? { edits: result.edits }
      : {
          edits: [],
          diagnostic: result.diagnostics.find(({ severity }) =>
            severity === "error"
          ) ?? assuranceDiagnostic(
            "PTASSURE-301",
            "error",
            "ordinary batch mutation could not produce a valid candidate",
          ),
        };
  }
  if (hasOrdinaryMutation) {
    if (mutation.mutations.some((item) =>
      isAssuranceMutation(item) &&
      item.kind !== "plan_dependency.add" &&
      item.kind !== "plan_dependency.set" &&
      item.kind !== "plan_dependency.remove"
    )) {
      return { edits: [], diagnostic: assuranceDiagnostic(
        "PTASSURE-301",
        "error",
        "mixed current-graph batches support relation maintenance; seal and outcome staging remains assurance-only",
      ) };
    }
    const edits: TextEdit[] = [];
    for (const item of mutation.mutations) {
      const planned = isAssuranceMutation(item)
        ? planEdits(text, validated, item, capability)
        : planTargetGrammar6AtomicMutationEdits(
            text,
            validated.document,
            item,
            capability,
          );
      if (planned.diagnostic !== undefined) return planned;
      if (
        !isAssuranceMutation(item) &&
        (item.kind === "task.add" || item.kind === "gate.add") &&
        planned.edits.length === 1 &&
        planned.edits[0]!.startOffset === text.length &&
        planned.edits[0]!.endOffset === text.length
      ) {
        const serialized = planned.edits[0]!.replacement
          .replace(/^(?:\r?\n)+/, "")
          .replace(/(?:\r?\n)+$/, "");
        edits.push(insertDeclarations(
          text,
          validated.document,
          [serialized],
          new Set([
            "task_relation",
            "plan_seal",
            "task_outcome",
            "assurance_receipt",
            "work_event",
          ]),
        ));
      } else {
        edits.push(...planned.edits);
      }
    }
    let candidateText: string;
    try {
      candidateText = applyTextEdits(
        text,
        normalizeTextEdits(
          text,
          mergeBatchInsertions(edits),
          "mixed plan-assurance batch",
        ),
      );
    } catch (error) {
      return { edits: [], diagnostic: assuranceDiagnostic(
        "PTASSURE-301",
        "error",
        error instanceof Error ? error.message : "mixed batch edits overlap",
      ) };
    }
    const checked = validateTargetGrammar6Document(candidateText, capability);
    if (!checked.ok || checked.validatedDocument === null) {
      return {
        edits: [],
        diagnostic: checked.diagnostics.find(({ severity }) => severity === "error") ??
          assuranceDiagnostic(
            "PTASSURE-301",
            "error",
            "mixed plan-assurance batch produced an invalid final candidate",
          ),
      };
    }
    return candidateText === text
      ? { edits: [] }
      : { edits: [{ startOffset: 0, endOffset: text.length, replacement: candidateText }] };
  }
  let currentText = text;
  let currentValidated = validated;
  for (const atomic of mutation.mutations) {
    if (!isAssuranceMutation(atomic)) {
      throw new Error("assurance-only batch retained an ordinary mutation");
    }
    const planned = planEdits(
      currentText,
      currentValidated,
      atomic,
      capability,
    );
    if (planned.diagnostic !== undefined) return planned;
    let normalized: readonly TextEdit[];
    try {
      normalized = normalizeTextEdits(
        currentText,
        planned.edits,
        `assurance batch ${atomic.kind}`,
      );
      currentText = applyTextEdits(currentText, normalized);
    } catch (error) {
      return { edits: [], diagnostic: assuranceDiagnostic(
        "PTASSURE-301",
        "error",
        error instanceof Error ? error.message : "assurance batch edits overlap",
      ) };
    }
    const checked = validateTargetGrammar6Document(currentText, capability);
    if (!checked.ok || checked.validatedDocument === null) {
      const first = checked.diagnostics.find(({ severity }) => severity === "error");
      return { edits: [], diagnostic: first ?? assuranceDiagnostic(
        "PTASSURE-301",
        "error",
        `assurance batch ${atomic.kind} produced an invalid candidate`,
      ) };
    }
    currentValidated = checked.validatedDocument;
  }
  return currentText === text
    ? { edits: [] }
    : { edits: [{
        startOffset: 0,
        endOffset: text.length,
        replacement: currentText,
      }] };
}

function impact(
  before: PlanAssuranceEvaluationV1,
  after: PlanAssuranceEvaluationV1,
  beforeDocument: DocumentNode<TargetDeclarationKind>,
  afterDocument: DocumentNode<TargetDeclarationKind>,
): PlanAssuranceImpactV1 {
  const beforeById = new Map(before.taskResults.map((result) => [result.taskId, result]));
  const affectedTaskIds = after.taskResults
    .filter((result) => {
      const previous = beforeById.get(result.taskId);
      return previous === undefined ||
        previous.status !== result.status ||
        previous.contractHash !== result.contractHash ||
        previous.computedBasisHash !== result.computedBasisHash ||
        previous.acceptedBasisHash !== result.acceptedBasisHash ||
        previous.exportedAssuranceHash !== result.exportedAssuranceHash;
    })
    .map((result) => result.taskId);
  const activeTaskIds = (
    document: DocumentNode<TargetDeclarationKind>,
  ): readonly string[] => document.declarations
    .filter((declaration) =>
      declaration.kind === "task" &&
      fieldNamed(declaration, "status")?.value === "active"
    )
    .map(({ id }) => id);
  return Object.freeze({
    modelVersion: 1,
    affectedTaskIds: Object.freeze(affectedTaskIds),
    before,
    after,
    projection: composePlanAssuranceMutationImpact(
      affectedTaskIds,
      before,
      after,
      activeTaskIds(beforeDocument),
      activeTaskIds(afterDocument),
    ),
  });
}

export function planTargetPlanAssuranceMutation(
  text: string,
  mutation: PlanAssuranceMutation,
  capability: TargetGrammar6Capability,
  options: PlanAssuranceMutationOptions = {},
): TargetPlanAssuranceMutationResultV4 {
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
  const requestError = mutationRequestShapeError(mutation);
  if (requestError !== null) {
    return failure(
      text,
      original.documentId,
      [...original.diagnostics, assuranceDiagnostic(
        "PTASSURE-301",
        "error",
        requestError,
      )],
      maximum,
      original.diagnosticsTruncated,
    );
  }
  const normalizedGovernance = normalizePlanAssuranceGovernanceRequest(
    options.governance,
  );
  if (!normalizedGovernance.ok) {
    return failure(
      text,
      original.documentId,
      [...original.diagnostics, ...normalizedGovernance.diagnostics],
      maximum,
      original.diagnosticsTruncated,
    );
  }
  const planned = mutation.kind === "batch"
    ? planBatchEdits(
        text,
        original.validatedDocument,
        mutation,
        capability,
      )
    : planEdits(
        text,
        original.validatedDocument,
        mutation,
        capability,
      );
  if (planned.diagnostic !== undefined) {
    return failure(
      text,
      original.documentId,
      [...original.diagnostics, planned.diagnostic],
      maximum,
      original.diagnosticsTruncated,
    );
  }
  let edits: readonly TextEdit[];
  let updatedText: string;
  try {
    edits = Object.freeze(normalizeTextEdits(
      text,
      planned.edits,
      "plan assurance mutation",
    ));
    updatedText = applyTextEdits(text, edits);
  } catch (error) {
    return failure(
      text,
      original.documentId,
      [...original.diagnostics, assuranceDiagnostic(
        "PTASSURE-301",
        "error",
        error instanceof Error ? error.message : "assurance edits overlap",
      )],
      maximum,
      original.diagnosticsTruncated,
    );
  }
  const changed = updatedText !== text;
  const candidate = validateTargetGrammar6Document(
    updatedText,
    capability,
    { maxDiagnostics: maximum },
  );
  if (!candidate.ok || candidate.validatedDocument === null) {
    return failure(
      text,
      candidate.documentId ?? original.documentId,
      candidate.diagnostics,
      maximum,
      candidate.diagnosticsTruncated,
    );
  }
  const before = evaluationOf(original.validatedDocument);
  const after = evaluationOf(candidate.validatedDocument);
  if (!after.ok) {
    return failure(
      text,
      candidate.documentId,
      after.diagnostics.map((item) => assuranceDiagnostic(
        item.code,
        "error",
        item.message,
        item.entityId,
        item.data,
      )),
      maximum,
    );
  }
  const originalDigest = digest(text);
  const metadata = governanceMetadataFromDocument(
    original.validatedDocument.document,
  );
  const governance = evaluatePlanAssuranceGovernance(
    {
      sourceDigest: originalDigest,
      goalOwner: metadata.effective.goalOwner,
      goalDelegates: metadata.effective.goalDelegates,
      dagOwner: metadata.effective.dagOwner,
      dagDelegates: metadata.effective.dagDelegates,
    },
    changed
      ? Object.freeze([
          ...classifyGovernanceScopes(
            original.validatedDocument.document,
            candidate.validatedDocument.document,
          ),
          ...(mutationAffectsAssuranceSource(mutation)
            ? ["plan_assurance" as const]
            : []),
        ])
      : Object.freeze([]),
    normalizedGovernance.request,
  );
  const assuranceImpact = impact(
    before,
    after,
    original.validatedDocument.document,
    candidate.validatedDocument.document,
  );
  const diagnostics = [
    ...candidate.diagnostics,
    ...assuranceImpact.projection.diagnostics,
    ...planAssuranceGovernanceDiagnostics(governance),
  ];
  const hasError = diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const warningFailure = options.warningsAsErrors === true &&
    diagnostics.some((diagnostic) => diagnostic.severity === "warning");
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maximum);
  return Object.freeze({
    schemaVersion: "Perttool.MutationResult.v4",
    ok: !hasError && !warningFailure,
    documentId: candidate.documentId,
    changed,
    originalDigest,
    updatedDigest: digest(updatedText),
    updatedText,
    diff: createUnifiedDiff(text, updatedText, {
      originalLabel: options.originalLabel ?? "original",
      updatedLabel: options.updatedLabel ?? "updated",
    }),
    edits,
    governance,
    assuranceImpact,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated:
      original.diagnosticsTruncated ||
      candidate.diagnosticsTruncated ||
      limited.truncated,
  });
}
