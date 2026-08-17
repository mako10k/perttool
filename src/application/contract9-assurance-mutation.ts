import type { PlanAssuranceEvaluationV1, PlanAssuranceTaskResultV1 } from "../assurance/types.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import type { Diagnostic } from "../model/diagnostics.js";
import { applyTextEdits, normalizeTextEdits, type TextEdit } from "../mutation/text-edits.js";
import { scanTemporalDeclarationBlocks, temporalScheduleBaseText, type TemporalDeclarationBlock } from "../temporal-schedule/source-lexical.js";
import { parseTemporalScheduleSource, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../temporal-schedule/source.js";
import { evaluateContract9PlanAssurance } from "./contract9-assurance.js";
import { milestoneAcceptanceBaseText } from "../milestone-acceptance/source.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import { governanceMetadataFromDocument } from "../governance/source.js";
import { evaluatePlanAssuranceGovernance, normalizePlanAssuranceGovernanceRequest,
  planAssuranceGovernanceDiagnostics, type PlanAssuranceGovernanceDecisionV2 } from "../assurance/governance.js";
import type { GovernanceRequestInput } from "../governance/types.js";

export type Contract9SealMutation =
  | { readonly kind: "plan_assurance.seal"; readonly reason: string }
  | { readonly kind: "plan_assurance.reseal"; readonly taskIds: readonly string[]; readonly reason: string };

export interface Contract9AssuranceMutationResultV6 {
  readonly schemaVersion: "Perttool.MutationResult.v6";
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: false;
  readonly assuranceImpact: Readonly<{ before: PlanAssuranceEvaluationV1; after: PlanAssuranceEvaluationV1 }> | null;
  readonly governance: PlanAssuranceGovernanceDecisionV2 | null;
}

function ending(text: string): "\n" | "\r\n" { return text.includes("\r\n") ? "\r\n" : "\n"; }
function failure(text: string, documentId: string | null, code: string, message: string, entityId?: string): Contract9AssuranceMutationResultV6 {
  return Object.freeze({ schemaVersion: "Perttool.MutationResult.v6", ok: false, documentId, changed: false,
    originalDigest: sha256DigestUtf8(text), updatedDigest: null, updatedText: null, diff: null, edits: Object.freeze([]),
    diagnostics: Object.freeze([Object.freeze({ code, severity: "error" as const, message, ...(entityId === undefined ? {} : { entityId }) })]),
    diagnosticsTruncated: false, assuranceImpact: null, governance: null });
}

function sealText(result: PlanAssuranceTaskResultV1, reason: string, lineEnding: string): string {
  if (result.contractHash === null || result.computedBasisHash === null || result.exportedAssuranceHash === null)
    throw new Error(`task ${result.taskId} has no sealable model-2 basis`);
  return [`plan_seal ${result.taskId}:`, `  accepted_contract ${result.contractHash}`, `  accepted_basis ${result.computedBasisHash}`,
    ...(result.computedInputs.length === 0 ? [] : ["  accepted_inputs:", ...result.computedInputs.map((input) =>
      `    ${input.predecessorTaskId} ${input.relationMode} ${input.assuranceHash}`)]),
    `  reason ${JSON.stringify(reason)}`].join(lineEnding);
}

function enablementEdit(text: string, project: TemporalDeclarationBlock): TextEdit {
  const before = project.lines.find(({ text: line }) => /^  (?:critical_epsilon|target_duration|time_zone|tzdb|calendar|workday) /u.test(line));
  const offset = before?.start ?? project.lines.at(-1)?.end ?? project.header.end;
  const eol = ending(text);
  return Object.freeze({ startOffset: offset, endOffset: offset,
    replacement: `  plan_assurance_model 1${eol}  plan_assurance_hash_model 2${eol}` });
}

function declarationInsertion(text: string, blocks: readonly TemporalDeclarationBlock[], records: readonly string[]): TextEdit {
  const later = blocks.find(({ header }) => /^(?:task_outcome|assurance_receipt|work_event) /u.test(header.text));
  const offset = later?.header.start ?? text.length;
  const eol = ending(text);
  const prefix = offset > 0 && !text.slice(0, offset).endsWith(`${eol}${eol}`) ? eol : "";
  return Object.freeze({ startOffset: offset, endOffset: offset, replacement: `${prefix}${records.join(`${eol}${eol}`)}${eol}${eol}` });
}

function sealRecordEdits(block: TemporalDeclarationBlock, result: PlanAssuranceTaskResultV1,
  reason: string, text: string): readonly TextEdit[] {
  if (result.contractHash === null || result.computedBasisHash === null)
    throw new Error(`task ${result.taskId} has no resealable model-2 basis`);
  const field = (name: string) => block.lines.find(({ text: line }) => line.startsWith(`  ${name} `));
  const scalar = (line: NonNullable<ReturnType<typeof field>>, replacement: string): TextEdit =>
    Object.freeze({ startOffset: line.start, endOffset: line.contentEnd, replacement });
  const contract = field("accepted_contract")!;
  const basis = field("accepted_basis")!;
  const reasonLine = field("reason")!;
  const edits: TextEdit[] = [scalar(contract, `  accepted_contract ${result.contractHash}`),
    scalar(basis, `  accepted_basis ${result.computedBasisHash}`), scalar(reasonLine, `  reason ${JSON.stringify(reason)}`)];
  const inputHeader = block.lines.find(({ text: line }) => line === "  accepted_inputs:");
  const nested = inputHeader === undefined ? [] : block.lines.filter((line) => line.start > inputHeader.start && line.start < reasonLine.start && line.text.startsWith("    "));
  const inputText = result.computedInputs.length === 0 ? "" : ["  accepted_inputs:", ...result.computedInputs.map((input) =>
    `    ${input.predecessorTaskId} ${input.relationMode} ${input.assuranceHash}`)].join(ending(text)) + ending(text);
  if (inputHeader === undefined && inputText !== "") edits.push(Object.freeze({ startOffset: reasonLine.start, endOffset: reasonLine.start, replacement: inputText }));
  if (inputHeader !== undefined) edits.push(Object.freeze({ startOffset: inputHeader.start,
    endOffset: nested.at(-1)?.end ?? inputHeader.end, replacement: inputText }));
  return Object.freeze(edits);
}

export function planContract9AssuranceSealMutation(text: string, mutation: Contract9SealMutation,
  options: Readonly<{ governance?: GovernanceRequestInput }> = {}): Contract9AssuranceMutationResultV6 {
  const source = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  if (!source.ok || source.model === null || source.grammarVersion !== 8)
    return failure(text, source.documentId, "PTASSURE-301", "model-2 assurance mutation requires valid Grammar 8 source");
  if (mutation.reason.length === 0) return failure(text, source.documentId, "PTASSURE-301", "seal mutation requires a nonempty reason");
  if (mutation.kind === "plan_assurance.reseal" &&
    (mutation.taskIds.length === 0 || new Set(mutation.taskIds).size !== mutation.taskIds.length))
    return failure(text, source.documentId, "PTASSURE-301", "reseal requires unique task IDs");
  const blocks = scanTemporalDeclarationBlocks(text);
  let preparedText = text;
  const preEdits: TextEdit[] = [];
  const before = evaluateContract9PlanAssurance(text);
  if (before === null) return failure(text, source.documentId, "PTASSURE-303", "model-2 assurance basis is unavailable");
  if (before.modelVersion === null && before.hashModelVersion === null) {
    const project = blocks.find(({ kind }) => kind === "project")!;
    preEdits.push(enablementEdit(text, project));
    preparedText = applyTextEdits(text, preEdits);
  } else if (before.modelVersion !== 1 || before.hashModelVersion !== 2) {
    return failure(text, source.documentId, "PTASSURE-303", "Grammar 8 assurance mutation requires model 1 and hash model 2");
  }
  const evaluated = evaluateContract9PlanAssurance(preparedText);
  if (evaluated === null || !evaluated.ok) return failure(text, source.documentId, "PTASSURE-303", "model-2 assurance basis is unavailable");
  const selectedIds = mutation.kind === "plan_assurance.seal"
    ? evaluated.taskResults.filter(({ acceptedBasisHash }) => acceptedBasisHash === null).map(({ taskId }) => taskId)
    : [...mutation.taskIds];
  if (selectedIds.length === 0) return failure(text, source.documentId, "PTASSURE-304", "seal mutation selects no task");
  const byId = new Map(evaluated.taskResults.map((result) => [result.taskId, result]));
  const preparedBlocks = scanTemporalDeclarationBlocks(preparedText);
  const recordEdits: TextEdit[] = [];
  const additions: string[] = [];
  try {
    for (const taskId of selectedIds) {
      const result = byId.get(taskId);
      if (result === undefined) return failure(text, source.documentId, "PTASSURE-304", `task ${taskId} has no sealable current basis`, taskId);
      const serialized = sealText(result, mutation.reason, ending(text));
      const current = preparedBlocks.find(({ header, id }) => id === taskId && header.text.startsWith("plan_seal "));
      if (mutation.kind === "plan_assurance.reseal" && current === undefined)
        return failure(text, source.documentId, "PTASSURE-304", `task ${taskId} has no existing seal`, taskId);
      if (current === undefined) additions.push(serialized);
      else recordEdits.push(...sealRecordEdits(current, result, mutation.reason, preparedText));
    }
  } catch (error) {
    return failure(text, source.documentId, "PTASSURE-304", error instanceof Error ? error.message : "model-2 seal is unavailable");
  }
  if (additions.length > 0) recordEdits.push(declarationInsertion(preparedText, preparedBlocks, additions));
  const second = normalizeTextEdits(preparedText, recordEdits, "Contract 9 assurance seal mutation");
  const candidate = applyTextEdits(preparedText, second);
  const checked = parseTemporalScheduleSource(candidate, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  const after = evaluateContract9PlanAssurance(candidate);
  if (!checked.ok || checked.model === null || after === null || !after.ok)
    return failure(text, source.documentId, "PTASSURE-304", "model-2 seal candidate failed complete Grammar 8 validation");
  const edits = normalizeTextEdits(text, [...preEdits, ...second.map((edit) => preEdits.length === 0 ? edit : Object.freeze({
    ...edit, startOffset: edit.startOffset - preEdits[0]!.replacement.length * Number(edit.startOffset > preEdits[0]!.startOffset),
    endOffset: edit.endOffset - preEdits[0]!.replacement.length * Number(edit.endOffset > preEdits[0]!.startOffset),
  }))], "Contract 9 complete assurance seal mutation");
  const updatedText = applyTextEdits(text, edits);
  if (updatedText !== candidate) throw new Error("Contract 9 seal edit composition changed candidate bytes");
  const base = milestoneAcceptanceBaseText(temporalScheduleBaseText(text, blocks));
  const validated = validateTargetGrammar6Document(base, TARGET_GRAMMAR_6_CAPABILITY).validatedDocument;
  if (validated === null) throw new Error("validated Grammar 8 base lost governance metadata");
  const metadata = governanceMetadataFromDocument(validated.document);
  const normalized = normalizePlanAssuranceGovernanceRequest(options.governance);
  if (!normalized.ok) return failure(text, source.documentId, "PTGOV-101", "invalid governance request");
  const governance = evaluatePlanAssuranceGovernance({ sourceDigest: sha256DigestUtf8(text),
    goalOwner: metadata.effective.goalOwner, goalDelegates: metadata.effective.goalDelegates,
    dagOwner: metadata.effective.dagOwner, dagDelegates: metadata.effective.dagDelegates }, ["plan_assurance"], normalized.request);
  const governanceDiagnostics = planAssuranceGovernanceDiagnostics(governance);
  return Object.freeze({ schemaVersion: "Perttool.MutationResult.v6", ok: !governanceDiagnostics.some(({ severity }) => severity === "error"), documentId: source.documentId, changed: true,
    originalDigest: sha256DigestUtf8(text), updatedDigest: sha256DigestUtf8(candidate), updatedText: candidate,
    diff: createUnifiedDiff(text, candidate, { originalLabel: "original", updatedLabel: "candidate" }), edits,
    diagnostics: governanceDiagnostics, diagnosticsTruncated: false,
    assuranceImpact: Object.freeze({ before, after }), governance });
}
