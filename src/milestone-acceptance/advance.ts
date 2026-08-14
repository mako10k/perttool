import type { Diagnostic } from "../model/diagnostics.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import { planValidatedAdvance, type AdvanceDocumentValidation, type AdvanceResult } from "../mutation/advance.js";
import { applyTextEdits, normalizeTextEdits } from "../mutation/text-edits.js";
import type { MutationOptions } from "../mutation/types.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";
import { evaluateMilestoneAcceptance, type MilestoneAcceptanceEvaluationV1 } from "./evaluate.js";
import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  milestoneAcceptanceBaseText,
  parseMilestoneAcceptanceSource,
  type MilestoneAcceptanceReceiptSourceV1,
  type MilestoneCriterionSetSourceV1,
} from "./source.js";

export interface MilestoneAcceptanceAdvanceGuardV1 {
  readonly modelVersion: 1;
  readonly status: "passed" | "blocked";
  readonly affectedMilestoneIds: readonly string[];
  readonly grandfatheredMilestoneIds: readonly string[];
  readonly acceptedMilestoneIds: readonly string[];
  readonly blockedMilestones: readonly {
    readonly milestoneId: string;
    readonly acceptance: MilestoneAcceptanceEvaluationV1["acceptance"];
    readonly blockingRequiredCriterionIds: readonly string[];
  }[];
}

export interface MilestoneAcceptanceProvisionalAdvanceV1 {
  readonly updatedDigest: string;
  readonly updatedText: string;
  readonly diff: string;
  readonly edits: AdvanceResult["edits"];
  readonly advance: NonNullable<AdvanceResult["advance"]>;
}

export interface MilestoneAcceptanceAdvanceResultV1 {
  readonly modelVersion: 1;
  readonly ok: boolean;
  readonly persistable: boolean;
  readonly originalDigest: string;
  readonly provisional: MilestoneAcceptanceProvisionalAdvanceV1 | null;
  readonly acceptanceGuard: MilestoneAcceptanceAdvanceGuardV1 | null;
  readonly canonical: AdvanceResult | null;
  readonly diagnostics: readonly Diagnostic[];
}

export interface MilestoneAcceptanceAdvanceOptionsV1 extends MutationOptions {
  readonly provisionalPlanner?: (baseText: string) => AdvanceResult;
  readonly canonicalPlanner?: (text: string) => AdvanceResult;
}

function diagnostic(message: string, blocked: MilestoneAcceptanceAdvanceGuardV1["blockedMilestones"]): Diagnostic {
  return Object.freeze({
    code: "PTMAC-108",
    severity: "error",
    message,
    helpTopic: "editing",
    data: Object.freeze({ blocked_milestones: blocked }),
  });
}

function validator(text: string, maxDiagnostics: number): AdvanceDocumentValidation {
  const acceptance = parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  const base = validateTargetGrammar6Document(milestoneAcceptanceBaseText(text), TARGET_GRAMMAR_6_CAPABILITY, { maxDiagnostics });
  const acceptanceDiagnostics = acceptance.diagnostics.map(({ code, message, span }): Diagnostic =>
    Object.freeze({
      code,
      severity: "error",
      message,
      span,
      helpTopic: "editing",
      data: Object.freeze({}),
    })
  );
  const diagnostics = [...base.diagnostics, ...acceptanceDiagnostics];
  return {
    ok: acceptance.ok && base.ok,
    document: { ...base.document, text },
    documentId: base.documentId,
    diagnostics: Object.freeze(diagnostics.slice(0, maxDiagnostics)),
    diagnosticsTruncated:
      base.diagnosticsTruncated || diagnostics.length > maxDiagnostics,
  };
}

function acceptanceRemovalExtension(text: string) {
  const source = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  return (_unusedText: string, _document: unknown, context: {
    readonly removedMilestones: readonly { readonly id: string }[];
  }) => {
    const affectedMilestones = new Set(
      context.removedMilestones.map(({ id }) => id),
    );
    const sets = source.records.filter(
      (record): record is MilestoneCriterionSetSourceV1 =>
        record.kind === "milestone_criterion_set" &&
        affectedMilestones.has(record.milestoneId),
    );
    const setIds = new Set(sets.map(({ id }) => id));
    const receipts = source.records.filter(
      (record): record is MilestoneAcceptanceReceiptSourceV1 =>
        record.kind === "milestone_acceptance_receipt" &&
        setIds.has(record.setId),
    );
    return {
      edits: Object.freeze([...sets, ...receipts].map(({ span }) => ({
        startOffset: span.start.offset,
        endOffset: span.end.offset,
        replacement: "",
      }))),
    };
  };
}

function acceptanceRemovalEdits(
  text: string,
  removedMilestoneIds: readonly string[],
) {
  const source = parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  const removedMilestones = new Set(removedMilestoneIds);
  const sets = source.records.filter((record): record is MilestoneCriterionSetSourceV1 =>
    record.kind === "milestone_criterion_set" && removedMilestones.has(record.milestoneId)
  );
  const setIds = new Set(sets.map(({ id }) => id));
  const receipts = source.records.filter((record): record is MilestoneAcceptanceReceiptSourceV1 =>
    record.kind === "milestone_acceptance_receipt" && setIds.has(record.setId)
  );
  return [...sets, ...receipts].map(({ span }) => ({
    startOffset: span.start.offset,
    endOffset: span.end.offset,
    replacement: "",
  }));
}

export function coalesceMilestoneAcceptanceDeletionOverlaps<T extends {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly replacement: string;
}>(edits: readonly T[]) {
  const retained = edits
    .filter(({ replacement }) => replacement !== "")
    .filter((edit, index, values) => values.findIndex((candidate) =>
      candidate.startOffset === edit.startOffset &&
      candidate.endOffset === edit.endOffset &&
      candidate.replacement === edit.replacement
    ) === index);
  const deletions = edits
    .filter(({ replacement }) => replacement === "")
    .sort((left, right) =>
      left.startOffset - right.startOffset || left.endOffset - right.endOffset
    );
  const merged: { startOffset: number; endOffset: number; replacement: "" }[] = [];
  for (const deletion of deletions) {
    const previous = merged.at(-1);
    if (previous !== undefined && deletion.startOffset < previous.endOffset) {
      previous.endOffset = Math.max(previous.endOffset, deletion.endOffset);
    } else {
      merged.push({
        startOffset: deletion.startOffset,
        endOffset: deletion.endOffset,
        replacement: "",
      });
    }
  }
  return [...retained, ...merged];
}

function acceptanceRecordSpans(
  text: string,
  milestoneIds: readonly string[],
) {
  const source = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  const milestones = new Set(milestoneIds);
  const sets = source.records.filter(
    (record): record is MilestoneCriterionSetSourceV1 =>
      record.kind === "milestone_criterion_set" &&
      milestones.has(record.milestoneId),
  );
  const setIds = new Set(sets.map(({ id }) => id));
  return [...sets, ...source.records.filter(
    (record): record is MilestoneAcceptanceReceiptSourceV1 =>
      record.kind === "milestone_acceptance_receipt" &&
      setIds.has(record.setId),
  )].map(({ span }) => ({
    startOffset: span.start.offset,
    endOffset: span.end.offset,
  }));
}

export function preserveMilestoneAcceptanceRecords<T extends {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly replacement: string;
}>(
  text: string,
  edits: readonly T[],
  milestoneIds: readonly string[],
) {
  const protectedSpans = acceptanceRecordSpans(text, milestoneIds);
  return edits.flatMap((edit) => {
    if (edit.replacement !== "") return [edit];
    let segments = [{
      startOffset: edit.startOffset,
      endOffset: edit.endOffset,
      replacement: "",
    }];
    for (const protectedSpan of protectedSpans) {
      segments = segments.flatMap((segment) => {
        if (
          protectedSpan.endOffset <= segment.startOffset ||
          protectedSpan.startOffset >= segment.endOffset
        ) return [segment];
        return [
          ...(segment.startOffset < protectedSpan.startOffset
            ? [{
                startOffset: segment.startOffset,
                endOffset: protectedSpan.startOffset,
                replacement: "" as const,
              }]
            : []),
          ...(protectedSpan.endOffset < segment.endOffset
            ? [{
                startOffset: protectedSpan.endOffset,
                endOffset: segment.endOffset,
                replacement: "" as const,
              }]
            : []),
        ];
      });
    }
    return segments;
  });
}

function composeProvisionalBase(
  text: string,
  plannedBase: AdvanceResult,
  options: MilestoneAcceptanceAdvanceOptionsV1,
): AdvanceResult {
  if (
    !plannedBase.ok ||
    plannedBase.updatedText === null ||
    plannedBase.advance === null
  ) return plannedBase;
  const protectedBaseEdits = preserveMilestoneAcceptanceRecords(
    text,
    plannedBase.edits,
    plannedBase.advance.stateChangedMilestoneIds,
  );
  const edits = normalizeTextEdits(
    text,
    coalesceMilestoneAcceptanceDeletionOverlaps([
      ...protectedBaseEdits,
      ...acceptanceRemovalEdits(
        text,
        plannedBase.advance.removedMilestoneIds,
      ),
    ]),
    "milestone acceptance provisional advance",
  );
  const updatedText = applyTextEdits(text, edits);
  const checked = validator(updatedText, options.maxDiagnostics ?? 100);
  if (!checked.ok) {
    return Object.freeze({
      ...plannedBase,
      ok: false,
      changed: false,
      originalDigest: sha256DigestUtf8(text),
      updatedText: null,
      updatedDigest: null,
      diff: null,
      edits: Object.freeze([]),
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
      advance: null,
    });
  }
  return Object.freeze({
    ...plannedBase,
    originalDigest: sha256DigestUtf8(text),
    updatedText,
    updatedDigest: sha256DigestUtf8(updatedText),
    diff: createUnifiedDiff(text, updatedText, {
      originalLabel: options.originalLabel ?? "original",
      updatedLabel: options.updatedLabel ?? "updated",
    }),
    edits,
  });
}

export function planMilestoneAcceptanceAdvance(text: string, options: MilestoneAcceptanceAdvanceOptionsV1 = {}): MilestoneAcceptanceAdvanceResultV1 {
  const source = parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  if (!source.ok || source.grammarVersion !== 7) {
    const migrationRequired: Diagnostic = Object.freeze({ code: "PTMAC-101", severity: "error", message: "Grammar 7 migration is required for milestone acceptance advance", helpTopic: "editing", data: Object.freeze({}) });
    return Object.freeze({ modelVersion: 1, ok: false, persistable: false, originalDigest: sha256DigestUtf8(text), provisional: null, acceptanceGuard: null, canonical: null, diagnostics: Object.freeze([migrationRequired]) });
  }
  const plannedBase = options.provisionalPlanner === undefined
    ? planValidatedAdvance(text, validator, options, {
        extendPlan: acceptanceRemovalExtension(text) as never,
        prepareEdits: coalesceMilestoneAcceptanceDeletionOverlaps,
      })
    : options.provisionalPlanner(milestoneAcceptanceBaseText(text));
  const provisionalBase = composeProvisionalBase(text, plannedBase, options);
  if (!provisionalBase.ok || provisionalBase.updatedText === null || provisionalBase.updatedDigest === null || provisionalBase.diff === null || provisionalBase.advance === null) {
    return Object.freeze({ modelVersion: 1, ok: false, persistable: false, originalDigest: provisionalBase.originalDigest, provisional: null, acceptanceGuard: null, canonical: null, diagnostics: provisionalBase.diagnostics });
  }
  const provisional = Object.freeze({ updatedDigest: provisionalBase.updatedDigest, updatedText: provisionalBase.updatedText, diff: provisionalBase.diff, edits: provisionalBase.edits, advance: provisionalBase.advance });
  const milestoneIds = [...text.matchAll(/^milestone ([A-Za-z][A-Za-z0-9_-]*):$/gmu)].map((match) => match[1]!);
  const closureReachedMilestoneIds = new Set([...provisional.advance.removedMilestoneIds, ...provisional.advance.stateChangedMilestoneIds]);
  const evaluation = evaluateMilestoneAcceptance({ source, milestoneIds, closureReachedMilestoneIds });
  if (!evaluation.ok) {
    return Object.freeze({ modelVersion: 1, ok: false, persistable: false, originalDigest: provisionalBase.originalDigest, provisional, acceptanceGuard: null, canonical: null, diagnostics: Object.freeze(evaluation.diagnostics.map(({ message }) => diagnostic(message, []))) });
  }
  const affected = evaluation.milestones.filter(({ milestoneId }) => closureReachedMilestoneIds.has(milestoneId));
  const blockedMilestones = Object.freeze(affected.filter(({ grandfathered, acceptance }) => !grandfathered && acceptance !== "accepted").map(({ milestoneId, acceptance, blockingRequiredCriterionIds }) => Object.freeze({ milestoneId, acceptance, blockingRequiredCriterionIds })));
  const guard: MilestoneAcceptanceAdvanceGuardV1 = Object.freeze({
    modelVersion: 1,
    status: blockedMilestones.length === 0 ? "passed" : "blocked",
    affectedMilestoneIds: Object.freeze(affected.map(({ milestoneId }) => milestoneId)),
    grandfatheredMilestoneIds: Object.freeze(affected.filter(({ grandfathered }) => grandfathered).map(({ milestoneId }) => milestoneId)),
    acceptedMilestoneIds: Object.freeze(affected.filter(({ acceptance }) => acceptance === "accepted").map(({ milestoneId }) => milestoneId)),
    blockedMilestones,
  });
  if (blockedMilestones.length > 0) {
    return Object.freeze({ modelVersion: 1, ok: false, persistable: false, originalDigest: provisionalBase.originalDigest, provisional, acceptanceGuard: guard, canonical: null, diagnostics: Object.freeze([diagnostic("Canonical advance is blocked by milestone acceptance", blockedMilestones)]) });
  }
  const canonical = options.canonicalPlanner?.(text) ?? provisionalBase;
  if (!canonical.ok || canonical.updatedText !== provisional.updatedText || canonical.updatedDigest !== provisional.updatedDigest) throw new Error("canonical advance did not preserve the accepted provisional candidate");
  return Object.freeze({ modelVersion: 1, ok: true, persistable: true, originalDigest: provisionalBase.originalDigest, provisional, acceptanceGuard: guard, canonical, diagnostics: canonical.diagnostics });
}
