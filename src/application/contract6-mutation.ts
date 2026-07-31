import { createHash } from "node:crypto";
import {
  actualsDiagnostic,
  validateStoredLifecycleState,
  type FinishActualsMutation,
  type LifecycleMutation,
} from "../actuals/lifecycle.js";
import {
  projectActualsSourceModel,
} from "../actuals/source.js";
import {
  classifyGovernanceScopes,
  evaluateGovernanceAuthority,
  governanceDecisionDiagnostics,
  normalizeGovernanceRequest,
} from "../governance/authority.js";
import {
  governanceMetadataFromDocument,
} from "../governance/source.js";
import type {
  GovernanceDecisionV1,
} from "../governance/types.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import type {
  TargetGovernanceBatchMutation,
  TargetGovernanceMutation,
} from "../mutation/target-types.js";
import type {
  BatchMutation,
  Mutation,
  MutationOptions,
  MutationResult,
} from "../mutation/types.js";
import {
  TARGET_GRAMMAR_5_CAPABILITY,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar5Document,
  type TargetGrammar5ValidatedDocument,
} from "../semantic/target-validator.js";
import {
  planTargetActualsAdvance,
} from "./target-actuals-advance.js";
import {
  withPreviewAdvanceHistory,
  type AdvanceResultV1,
} from "./advance-history.js";
import {
  planTargetFinishActualsMutation,
  planTargetLifecycleMutation,
  type TargetActualsMutationOptions,
  type TargetActualsMutationResultV3,
} from "./target-actuals-mutation.js";
import {
  planTargetGrammar5BatchMutation,
  planTargetGrammar5Mutation,
} from "./target-mutate.js";

export interface MutationResultV3 extends MutationResult {
  readonly schemaVersion: "Perttool.MutationResult.v3";
  readonly governance: GovernanceDecisionV1 | null;
  readonly lifecycle: null;
}

export type AdvanceResultV3 = AdvanceResultV1;
export type LifecycleResultV3 = TargetActualsMutationResultV3;

interface ValidOriginal {
  readonly validated: TargetGrammar5ValidatedDocument;
  readonly documentId: string | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

function digest(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function mutationOptions(
  options: TargetActualsMutationOptions,
): MutationOptions {
  return {
    ...(options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics }),
    ...(options.originalLabel === undefined
      ? {}
      : { originalLabel: options.originalLabel }),
    ...(options.updatedLabel === undefined
      ? {}
      : { updatedLabel: options.updatedLabel }),
  };
}

function validOriginal(
  text: string,
  maximum: number,
): ValidOriginal | null {
  const checked = validateTargetGrammar5Document(
    text,
    TARGET_GRAMMAR_5_CAPABILITY,
    { maxDiagnostics: maximum },
  );
  if (!checked.ok || checked.validatedDocument === null) return null;
  const lifecycleDiagnostics = validateStoredLifecycleState(
    checked.validatedDocument,
  );
  if (lifecycleDiagnostics.length > 0) return null;
  return {
    validated: checked.validatedDocument,
    documentId: checked.documentId,
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  };
}

function requestFailure(
  text: string,
  original: ValidOriginal,
  diagnostic: Diagnostic,
  maximum: number,
): MutationResultV3 {
  const limited = limitDiagnostics(
    sortDiagnostics([...original.diagnostics, diagnostic]),
    maximum,
  );
  return Object.freeze({
    schemaVersion: "Perttool.MutationResult.v3",
    ok: false,
    documentId: original.documentId,
    changed: false,
    originalDigest: digest(text),
    updatedDigest: null,
    updatedText: null,
    diff: null,
    edits: Object.freeze([]),
    governance: null,
    lifecycle: null,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated:
      original.diagnosticsTruncated || limited.truncated,
  });
}

function statusMutationDiagnostic(
  original: TargetGrammar5ValidatedDocument,
  mutation: TargetGovernanceMutation,
): Diagnostic | null {
  if (original.grammarVersion !== 5) return null;
  const mutations =
    mutation.kind === "batch" ? mutation.mutations : [mutation];
  const events = projectActualsSourceModel(original).events;
  for (const item of mutations) {
    if (item.kind === "task.finish") {
      const task = original.document.declarations.find(
        ({ kind, id }) => kind === "task" && id === item.id,
      );
      return actualsDiagnostic(
        "PTACT-105",
        "invalid lifecycle mutation request",
        "status_only_finish_not_allowed",
        item.id,
        task?.idSpan,
      );
    }
    if (
      item.kind === "task.set" &&
      (
        item.set?.status !== undefined ||
        item.clear?.includes("status") === true
      ) &&
      events.some(({ taskId }) => taskId === item.id)
    ) {
      const task = original.document.declarations.find(
        ({ kind, id }) => kind === "task" && id === item.id,
      );
      return actualsDiagnostic(
        "PTACT-105",
        "invalid lifecycle mutation request",
        "eventful_task_requires_lifecycle",
        item.id,
        task?.idSpan,
      );
    }
  }
  return null;
}

function governedResult(
  original: ValidOriginal,
  base: MutationResult,
  options: TargetActualsMutationOptions,
): MutationResultV3 {
  if (
    !base.ok ||
    base.updatedText === null ||
    base.updatedDigest === null
  ) {
    return Object.freeze({
      ...base,
      schemaVersion: "Perttool.MutationResult.v3",
      governance: null,
      lifecycle: null,
    });
  }
  const normalized = normalizeGovernanceRequest(options.governance);
  if (!normalized.ok) {
    throw new Error(
      "governance request must be normalized before candidate planning",
    );
  }
  const candidate = validateTargetGrammar5Document(
    base.updatedText,
    TARGET_GRAMMAR_5_CAPABILITY,
    options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics },
  );
  if (!candidate.ok || candidate.validatedDocument === null) {
    throw new Error("Contract 6 mutation candidate lost Grammar 5 validation");
  }
  const metadata = governanceMetadataFromDocument(
    original.validated.document,
  );
  const governance = evaluateGovernanceAuthority(
    {
      originalDigest: base.originalDigest,
      effective: metadata.effective,
    },
    classifyGovernanceScopes(
      original.validated.document,
      candidate.validatedDocument.document,
    ),
    normalized.request,
  );
  const decisionDiagnostics = governanceDecisionDiagnostics(governance);
  if (decisionDiagnostics.length === 0) {
    return Object.freeze({
      ...base,
      schemaVersion: "Perttool.MutationResult.v3",
      governance,
      lifecycle: null,
    });
  }
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const limited = limitDiagnostics(
    sortDiagnostics([...base.diagnostics, ...decisionDiagnostics]),
    maximum,
  );
  return Object.freeze({
    ...base,
    schemaVersion: "Perttool.MutationResult.v3",
    ok: !decisionDiagnostics.some(({ severity }) => severity === "error"),
    governance,
    lifecycle: null,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated:
      base.diagnosticsTruncated || limited.truncated,
  });
}

function planOrdinary(
  text: string,
  mutation: TargetGovernanceMutation,
  batch: boolean,
  options: TargetActualsMutationOptions,
): MutationResultV3 {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const original = validOriginal(text, maximum);
  const baseOptions = mutationOptions(options);
  if (original === null) {
    const base = batch
      ? planTargetGrammar5BatchMutation(
          text,
          mutation as TargetGovernanceBatchMutation,
          TARGET_GRAMMAR_5_CAPABILITY,
          baseOptions,
        )
      : planTargetGrammar5Mutation(
          text,
          mutation,
          TARGET_GRAMMAR_5_CAPABILITY,
          baseOptions,
        );
    return Object.freeze({
      ...base,
      schemaVersion: "Perttool.MutationResult.v3",
      governance: null,
      lifecycle: null,
    });
  }
  const normalized = normalizeGovernanceRequest(options.governance);
  if (!normalized.ok) {
    return requestFailure(
      text,
      original,
      normalized.diagnostics[0]!,
      maximum,
    );
  }
  const statusDiagnostic = statusMutationDiagnostic(
    original.validated,
    mutation,
  );
  if (statusDiagnostic !== null) {
    return requestFailure(text, original, statusDiagnostic, maximum);
  }
  const base = batch
    ? planTargetGrammar5BatchMutation(
        text,
        mutation as TargetGovernanceBatchMutation,
        TARGET_GRAMMAR_5_CAPABILITY,
        baseOptions,
      )
    : planTargetGrammar5Mutation(
        text,
        mutation,
        TARGET_GRAMMAR_5_CAPABILITY,
        baseOptions,
      );
  return governedResult(original, base, {
    ...options,
    governance: normalized.request,
  });
}

export function planMutation(
  text: string,
  mutation: Mutation,
  options: TargetActualsMutationOptions = {},
): MutationResultV3 {
  return planOrdinary(
    text,
    mutation as TargetGovernanceMutation,
    false,
    options,
  );
}

export function planBatchMutation(
  text: string,
  mutation: BatchMutation,
  options: TargetActualsMutationOptions = {},
): MutationResultV3 {
  return planOrdinary(
    text,
    mutation as TargetGovernanceBatchMutation,
    true,
    options,
  );
}

export function planAdvance(
  text: string,
  options: TargetActualsMutationOptions = {},
): AdvanceResultV3 {
  return withPreviewAdvanceHistory(
    text,
    planTargetActualsAdvance(
      text,
      TARGET_GRAMMAR_5_CAPABILITY,
      options,
    ),
  );
}

export function planLifecycle(
  text: string,
  mutation: LifecycleMutation,
  options: TargetActualsMutationOptions = {},
): LifecycleResultV3 {
  return planTargetLifecycleMutation(
    text,
    mutation,
    TARGET_GRAMMAR_5_CAPABILITY,
    options,
  );
}

export function planFinishActuals(
  text: string,
  mutation: FinishActualsMutation,
  options: TargetActualsMutationOptions = {},
): LifecycleResultV3 {
  return planTargetFinishActualsMutation(
    text,
    mutation,
    TARGET_GRAMMAR_5_CAPABILITY,
    options,
  );
}
