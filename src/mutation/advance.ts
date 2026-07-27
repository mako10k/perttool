import { createHash } from "node:crypto";
import { buildResidualGraph, computeEffectiveReached } from "../analysis/graph.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import type { Diagnostic } from "../model/diagnostics.js";
import {
  compareStableStrings,
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
} from "../model/diagnostics.js";
import type { DeclarationNode, DocumentNode, RequirementValue } from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import { checkDocument } from "../application/check.js";
import { EntityEditor } from "./entity-editor.js";
import {
  deleteDeclarationEdit,
  lineIndexAt,
  splitPhysicalLines,
  type PhysicalLine,
} from "./source.js";
import { applyTextEdits, normalizeTextEdits } from "./text-edits.js";
import type { TextEdit } from "./text-edits.js";
import type { MutationOptions, MutationResult } from "./types.js";

const milestoneFieldOrder = ["title", "description", "state", "tags"] as const;

export type AdvanceRetentionReason = "partial_satisfaction";

export interface AdvanceRetainedEdge {
  readonly id: string;
  readonly kind: "task" | "gate";
  readonly reason: AdvanceRetentionReason;
}

export interface AdvanceDetails {
  readonly keptTaskIds: readonly string[];
  readonly keptGateIds: readonly string[];
  readonly keptMilestoneIds: readonly string[];
  readonly removedTaskIds: readonly string[];
  readonly removedGateIds: readonly string[];
  readonly removedMilestoneIds: readonly string[];
  readonly stateChangedMilestoneIds: readonly string[];
  readonly retainedSatisfiedEdges: readonly AdvanceRetainedEdge[];
  readonly frontierBefore: readonly string[];
  readonly frontierAfter: readonly string[];
  readonly readyBefore: readonly string[];
  readonly readyAfter: readonly string[];
}

export interface AdvanceResult extends MutationResult {
  readonly advance: AdvanceDetails | null;
}

export interface AdvanceDocumentValidation {
  readonly ok: boolean;
  readonly document: DocumentNode;
  readonly documentId: string | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export type AdvanceDocumentValidator = (
  text: string,
  maxDiagnostics: number,
) => AdvanceDocumentValidation;

interface AdvancePlan {
  readonly edits: readonly TextEdit[];
  readonly keptTaskIds: readonly string[];
  readonly keptGateIds: readonly string[];
  readonly keptMilestoneIds: readonly string[];
  readonly removedTaskIds: readonly string[];
  readonly removedGateIds: readonly string[];
  readonly removedMilestoneIds: readonly string[];
  readonly stateChangedMilestoneIds: readonly string[];
  readonly retainedSatisfiedEdges: readonly AdvanceRetainedEdge[];
}

function digest(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function failure(
  originalDigest: string,
  documentId: string | null,
  diagnostics: readonly Diagnostic[],
  maximum: number,
  alreadyTruncated: boolean,
): AdvanceResult {
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maximum);
  return {
    ok: false,
    documentId,
    changed: false,
    originalDigest,
    updatedDigest: null,
    updatedText: null,
    diff: null,
    edits: [],
    diagnostics: limited.diagnostics,
    diagnosticsTruncated: alreadyTruncated || limited.truncated,
    advance: null,
  };
}

function sortedIds(declarations: readonly DeclarationNode[]): readonly string[] {
  return declarations.map(({ id }) => id).sort(compareStableStrings);
}

function taskStatus(declaration: DeclarationNode): string {
  return (fieldNamed(declaration, "status")?.value ?? "planned") as string;
}

function readyTaskIds(
  document: DocumentNode,
  reached: ReadonlySet<string>,
): readonly string[] {
  return document.declarations
    .filter(
      (declaration) =>
        declaration.kind === "task" &&
        taskStatus(declaration) === "planned" &&
        reached.has(declaration.from!),
    )
    .map(({ id }) => id)
    .sort(compareStableStrings);
}

function classifiedTaskIds(
  document: DocumentNode,
  reached: ReadonlySet<string>,
): Readonly<Record<"active" | "ready" | "blockedNow" | "upcoming", readonly string[]>> {
  const groups = {
    active: [] as string[],
    ready: [] as string[],
    blockedNow: [] as string[],
    upcoming: [] as string[],
  };
  for (const declaration of document.declarations) {
    if (declaration.kind !== "task") continue;
    const status = taskStatus(declaration);
    if (status === "done") continue;
    if (status === "active") groups.active.push(declaration.id);
    else if (status === "planned" && reached.has(declaration.from!)) {
      groups.ready.push(declaration.id);
    } else if (status === "blocked" && reached.has(declaration.from!)) {
      groups.blockedNow.push(declaration.id);
    } else {
      groups.upcoming.push(declaration.id);
    }
  }
  for (const ids of Object.values(groups)) ids.sort(compareStableStrings);
  return groups;
}

function advanceDeletionEdit(
  text: string,
  declaration: DeclarationNode,
  lines: readonly PhysicalLine[],
  isLastDeclaration: boolean,
): TextEdit {
  const edit = deleteDeclarationEdit(declaration, lines);
  if (!isLastDeclaration) return edit;

  let startOffset = edit.startOffset;
  let lineIndex = lineIndexAt(lines, startOffset);
  while (lineIndex > 0 && lines[lineIndex - 1]!.text.trim() === "") {
    lineIndex -= 1;
    startOffset = lines[lineIndex]!.start;
  }
  return {
    startOffset,
    endOffset: text.length,
    replacement: "",
  };
}

function buildAdvancePlan(text: string, document: DocumentNode): AdvancePlan {
  const project = document.declarations.find(({ kind }) => kind === "project");
  if (project === undefined) throw new Error("validated advance document has no project");
  const finish = fieldNamed(project, "finish")?.value;
  if (typeof finish !== "string") throw new Error("validated advance project has no finish");

  const reached = computeEffectiveReached(document);
  const edges = document.declarations.filter(
    (declaration) => declaration.kind === "task" || declaration.kind === "gate",
  );
  const keptEdges = edges.filter((edge) => !reached.has(edge.to!));
  const keptMilestones = new Set<string>([finish]);
  for (const edge of keptEdges) {
    keptMilestones.add(edge.from!);
    keptMilestones.add(edge.to!);
  }

  const keptTasks = keptEdges.filter(({ kind }) => kind === "task");
  const keptGates = keptEdges.filter(({ kind }) => kind === "gate");
  const removedTasks = edges.filter(
    (edge) => edge.kind === "task" && !keptEdges.includes(edge),
  );
  const removedGates = edges.filter(
    (edge) => edge.kind === "gate" && !keptEdges.includes(edge),
  );
  const milestones = document.declarations.filter(({ kind }) => kind === "milestone");
  const removedMilestones = milestones.filter(({ id }) => !keptMilestones.has(id));
  const stateChangedMilestones = milestones.filter(
    (milestone) =>
      keptMilestones.has(milestone.id) &&
      reached.has(milestone.id) &&
      fieldNamed(milestone, "state")?.value !== "reached",
  );

  const lines = splitPhysicalLines(text);
  const lastDeclaration = document.declarations.at(-1);
  const edits: TextEdit[] = [
    ...removedTasks.map((declaration) =>
      advanceDeletionEdit(text, declaration, lines, declaration === lastDeclaration)),
    ...removedGates.map((declaration) =>
      advanceDeletionEdit(text, declaration, lines, declaration === lastDeclaration)),
    ...removedMilestones.map((declaration) =>
      advanceDeletionEdit(text, declaration, lines, declaration === lastDeclaration)),
  ];
  for (const milestone of stateChangedMilestones) {
    const editor = new EntityEditor(text, milestone, milestoneFieldOrder);
    editor.setScalar("state", "reached");
    edits.push(...editor.finish());
  }

  const retainedSatisfiedEdges = keptEdges
    .filter(
      (edge) =>
        reached.has(edge.from!) &&
        (edge.kind === "gate" || taskStatus(edge) === "done"),
    )
    .map((edge): AdvanceRetainedEdge => ({
      id: edge.id,
      kind: edge.kind as "task" | "gate",
      reason: "partial_satisfaction",
    }))
    .sort((left, right) => compareStableStrings(left.id, right.id));

  return {
    edits,
    keptTaskIds: sortedIds(keptTasks),
    keptGateIds: sortedIds(keptGates),
    keptMilestoneIds: [...keptMilestones].sort(compareStableStrings),
    removedTaskIds: sortedIds(removedTasks),
    removedGateIds: sortedIds(removedGates),
    removedMilestoneIds: sortedIds(removedMilestones),
    stateChangedMilestoneIds: sortedIds(stateChangedMilestones),
    retainedSatisfiedEdges,
  };
}

function exactRational(value: { readonly numerator: bigint; readonly denominator: bigint }): string {
  return `${value.numerator}/${value.denominator}`;
}

function residualProjection(document: DocumentNode): unknown {
  const graph = buildResidualGraph(document);
  return {
    finish: graph.finish,
    durationUnit: graph.durationUnit,
    velocity:
      graph.velocity === null
        ? null
        : {
            points: exactRational(graph.velocity.points),
            period: exactRational(graph.velocity.period),
            periodUnit: graph.velocity.periodUnit,
          },
    criticalEpsilon: exactRational(graph.criticalEpsilon),
    vertices: [...graph.vertices.keys()],
    resources: [...graph.resources.values()].map(({ id, capacity }) => ({ id, capacity })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      kind: edge.kind,
      source: edge.source,
      target: edge.target,
      status: edge.status,
      expected: exactRational(edge.expected),
      variance: exactRational(edge.variance),
      priority: edge.priority,
      requirements: edge.requirements.map((requirement: RequirementValue) => ({
        resourceId: requirement.resourceId,
        units: requirement.units,
      })),
    })),
    reached: [...graph.effectiveReached]
      .filter((id) => graph.vertices.has(id))
      .sort(compareStableStrings),
    frontier: graph.frontier,
    blockedTaskIds: graph.blockedTaskIds,
  };
}

function assertSame(label: string, before: unknown, after: unknown): void {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`advance postcondition failed: ${label} changed`);
  }
}

function explicitReachedRootIds(document: DocumentNode): readonly string[] {
  const milestones = document.declarations.filter(({ kind }) => kind === "milestone");
  const incomingTargets = new Set(
    document.declarations
      .filter(({ kind }) => kind === "task" || kind === "gate")
      .map(({ to }) => to!),
  );
  return milestones
    .filter((milestone) => !incomingTargets.has(milestone.id))
    .filter((milestone) => fieldNamed(milestone, "state")?.value === "reached")
    .map(({ id }) => id)
    .sort(compareStableStrings);
}

function allRootIds(document: DocumentNode): readonly string[] {
  const incomingTargets = new Set(
    document.declarations
      .filter(({ kind }) => kind === "task" || kind === "gate")
      .map(({ to }) => to!),
  );
  return document.declarations
    .filter(({ kind }) => kind === "milestone")
    .filter(({ id }) => !incomingTargets.has(id))
    .map(({ id }) => id)
    .sort(compareStableStrings);
}

function verifyPostconditions(
  original: DocumentNode,
  candidateText: string,
  candidate: DocumentNode,
  plan: AdvancePlan,
): void {
  const beforeReached = computeEffectiveReached(original);
  const afterReached = computeEffectiveReached(candidate);
  assertSame(
    "effective reached set",
    plan.keptMilestoneIds.filter((id) => beforeReached.has(id)),
    plan.keptMilestoneIds.filter((id) => afterReached.has(id)),
  );
  assertSame("explicit residual roots", allRootIds(candidate), explicitReachedRootIds(candidate));
  assertSame(
    "task classification",
    classifiedTaskIds(original, beforeReached),
    classifiedTaskIds(candidate, afterReached),
  );
  assertSame("residual analysis input", residualProjection(original), residualProjection(candidate));

  const originalProject = original.declarations.find(({ kind }) => kind === "project")!;
  const candidateProject = candidate.declarations.find(({ kind }) => kind === "project")!;
  const originalFinish = fieldNamed(originalProject, "finish")!.value as string;
  const candidateFinish = fieldNamed(candidateProject, "finish")!.value as string;
  assertSame(
    "project completion",
    beforeReached.has(originalFinish),
    afterReached.has(candidateFinish),
  );

  const repeated = buildAdvancePlan(candidateText, candidate);
  const repeatedEdits = normalizeTextEdits(candidateText, repeated.edits, "advance idempotence");
  if (repeatedEdits.length !== 0) {
    throw new Error("advance postcondition failed: repeated advance is not empty");
  }
}

export function planValidatedAdvance(
  text: string,
  validator: AdvanceDocumentValidator,
  options: MutationOptions = {},
): AdvanceResult {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const originalDigest = digest(text);
  const original = validator(text, maximum);
  if (!original.ok) {
    return failure(
      originalDigest,
      original.documentId,
      original.diagnostics,
      maximum,
      original.diagnosticsTruncated,
    );
  }

  const plan = buildAdvancePlan(text, original.document);
  const edits = normalizeTextEdits(text, plan.edits, "advance");
  const updatedText = applyTextEdits(text, edits);
  const candidate = validator(updatedText, maximum);
  if (!candidate.ok) {
    return failure(
      originalDigest,
      original.documentId,
      candidate.diagnostics,
      maximum,
      candidate.diagnosticsTruncated,
    );
  }

  verifyPostconditions(original.document, updatedText, candidate.document, plan);
  const beforeGraph = buildResidualGraph(original.document);
  const afterGraph = buildResidualGraph(candidate.document);
  const readyBefore = readyTaskIds(original.document, beforeGraph.effectiveReached);
  const readyAfter = readyTaskIds(candidate.document, afterGraph.effectiveReached);

  return {
    ok: true,
    documentId: original.documentId,
    changed: updatedText !== text,
    originalDigest,
    updatedDigest: digest(updatedText),
    updatedText,
    diff: createUnifiedDiff(text, updatedText, {
      ...(options.originalLabel === undefined ? {} : { originalLabel: options.originalLabel }),
      ...(options.updatedLabel === undefined ? {} : { updatedLabel: options.updatedLabel }),
    }),
    edits,
    diagnostics: candidate.diagnostics,
    diagnosticsTruncated: candidate.diagnosticsTruncated,
    advance: {
      keptTaskIds: plan.keptTaskIds,
      keptGateIds: plan.keptGateIds,
      keptMilestoneIds: plan.keptMilestoneIds,
      removedTaskIds: plan.removedTaskIds,
      removedGateIds: plan.removedGateIds,
      removedMilestoneIds: plan.removedMilestoneIds,
      stateChangedMilestoneIds: plan.stateChangedMilestoneIds,
      retainedSatisfiedEdges: plan.retainedSatisfiedEdges,
      frontierBefore: beforeGraph.frontier,
      frontierAfter: afterGraph.frontier,
      readyBefore,
      readyAfter,
    },
  };
}

function validateActiveAdvanceDocument(
  text: string,
  maxDiagnostics: number,
): AdvanceDocumentValidation {
  const checked = checkDocument(text, { maxDiagnostics });
  return {
    ok: checked.ok,
    document: checked.document,
    documentId: checked.documentId,
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  };
}

export function planAdvance(
  text: string,
  options: MutationOptions = {},
): AdvanceResult {
  return planValidatedAdvance(text, validateActiveAdvanceDocument, options);
}
