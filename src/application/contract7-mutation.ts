import type {
  FinishActualsMutation,
  LifecycleMutation,
} from "../actuals/lifecycle.js";
import { composePlanAssuranceMutationImpact } from "../assurance/authority.js";
import { evaluatePlanAssurance } from "../assurance/evaluate.js";
import {
  evaluatePlanAssuranceGovernance,
  normalizePlanAssuranceGovernanceRequest,
  planAssuranceGovernanceDiagnostics,
} from "../assurance/governance.js";
import {
  planTargetPlanAssuranceMutation,
  type PlanAssuranceBatchMutation,
  type PlanAssuranceImpactV1,
  type PlanAssuranceMutation,
  type PlanAssuranceMutationOptions,
  type TargetPlanAssuranceMutationResultV4,
} from "../assurance/mutation.js";
import { projectPlanAssuranceInput } from "../assurance/source.js";
import {
  planTargetPlanAssuranceAdvance,
  type PlanAssuranceAdvanceOptions,
  type TargetPlanAssuranceAdvanceResultV2,
} from "../assurance/advance.js";
import { classifyGovernanceScopes } from "../governance/authority.js";
import { governanceMetadataFromDocument } from "../governance/source.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
} from "../model/diagnostics.js";
import type { TargetGovernanceAtomicMutation } from "../mutation/target-types.js";
import type { BatchMutation, Mutation } from "../mutation/types.js";
import { fieldNamed } from "../model/syntax.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";
import {
  planTargetFinishActualsMutation,
  planTargetLifecycleMutation,
  type ActualsLifecycleResult,
  type TargetActualsMutationOptions,
} from "./target-actuals-mutation.js";
import {
  planTargetGrammar6BatchMutation,
  planTargetGrammar6Mutation,
} from "./target-mutate.js";
import {
  planBatchMutation as planContract6BatchMutation,
  planMutation as planContract6Mutation,
} from "./contract6-mutation.js";

export type MutationResultV4 = TargetPlanAssuranceMutationResultV4;
export type AdvanceResultV2 = TargetPlanAssuranceAdvanceResultV2;

export interface LifecycleResultV4
  extends Omit<TargetPlanAssuranceMutationResultV4, "assuranceImpact"> {
  readonly lifecycle: ActualsLifecycleResult | null;
  readonly assuranceImpact: PlanAssuranceImpactV1 | null;
}

export interface Contract7LifecycleOptions
  extends TargetActualsMutationOptions {
  readonly warningsAsErrors?: boolean;
}

function usesRetainedGrammar(text: string): boolean {
  const checked = validateTargetGrammar6Document(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  const project = checked.document.declarations.find(({ kind }) =>
    kind === "project"
  );
  const declared = project === undefined
    ? null
    : fieldNamed(project, "version")?.value;
  return declared !== 6;
}

function retainedPreflightOptions(
  options: PlanAssuranceMutationOptions,
): TargetActualsMutationOptions {
  const {
    governance: _governance,
    warningsAsErrors: _warningsAsErrors,
    ...retained
  } = options;
  return retained;
}

function retainedFailure(
  base: ReturnType<typeof planContract6Mutation>,
): MutationResultV4 {
  return Object.freeze({
    ...base,
    schemaVersion: "Perttool.MutationResult.v4" as const,
    governance: null,
    assuranceImpact: null,
  });
}

function activeTaskIds(
  document: NonNullable<
    ReturnType<typeof validateTargetGrammar6Document>["validatedDocument"]
  >["document"],
): readonly string[] {
  return Object.freeze(document.declarations
    .filter((declaration) =>
      declaration.kind === "task" &&
      fieldNamed(declaration, "status")?.value === "active"
    )
    .map(({ id }) => id));
}

function lifecycleResult(
  text: string,
  base: ReturnType<typeof planTargetLifecycleMutation>,
  options: Contract7LifecycleOptions,
): LifecycleResultV4 {
  if (!base.ok || base.updatedText === null || base.updatedDigest === null) {
    return Object.freeze({
      ...base,
      schemaVersion: "Perttool.MutationResult.v4" as const,
      governance: null,
      assuranceImpact: null,
    });
  }
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const original = validateTargetGrammar6Document(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    { maxDiagnostics: maximum },
  );
  const candidate = validateTargetGrammar6Document(
    base.updatedText,
    TARGET_GRAMMAR_6_CAPABILITY,
    { maxDiagnostics: maximum },
  );
  if (
    !original.ok || original.validatedDocument === null ||
    !candidate.ok || candidate.validatedDocument === null
  ) {
    throw new Error("Contract 7 lifecycle candidate lost Grammar 6 validation");
  }
  const normalized = normalizePlanAssuranceGovernanceRequest(
    options.governance,
  );
  if (!normalized.ok) {
    throw new Error("lifecycle governance request was not normalized");
  }
  const metadata = governanceMetadataFromDocument(
    original.validatedDocument.document,
  );
  const governance = evaluatePlanAssuranceGovernance(
    {
      sourceDigest: base.originalDigest,
      goalOwner: metadata.effective.goalOwner,
      goalDelegates: metadata.effective.goalDelegates,
      dagOwner: metadata.effective.dagOwner,
      dagDelegates: metadata.effective.dagDelegates,
    },
    classifyGovernanceScopes(
      original.validatedDocument.document,
      candidate.validatedDocument.document,
    ),
    normalized.request,
  );
  const before = evaluatePlanAssurance(
    projectPlanAssuranceInput(original.validatedDocument),
  );
  const after = evaluatePlanAssurance(
    projectPlanAssuranceInput(candidate.validatedDocument),
  );
  const affectedTaskIds = after.taskResults
    .filter((result) => {
      const previous = before.taskResults.find(({ taskId }) =>
        taskId === result.taskId
      );
      return previous === undefined ||
        previous.status !== result.status ||
        previous.contractHash !== result.contractHash ||
        previous.computedBasisHash !== result.computedBasisHash ||
        previous.acceptedBasisHash !== result.acceptedBasisHash ||
        previous.exportedAssuranceHash !== result.exportedAssuranceHash;
    })
    .map(({ taskId }) => taskId);
  const assuranceImpact: PlanAssuranceImpactV1 = Object.freeze({
    modelVersion: 1,
    affectedTaskIds: Object.freeze(affectedTaskIds),
    before,
    after,
    projection: composePlanAssuranceMutationImpact(
      affectedTaskIds,
      before,
      after,
      activeTaskIds(original.validatedDocument.document),
      activeTaskIds(candidate.validatedDocument.document),
    ),
  });
  const diagnostics = sortDiagnostics([
    ...candidate.diagnostics,
    ...assuranceImpact.projection.diagnostics,
    ...planAssuranceGovernanceDiagnostics(governance),
  ]);
  const warningFailure = options.warningsAsErrors === true &&
    diagnostics.some(({ severity }) => severity === "warning");
  const limited = limitDiagnostics(diagnostics, maximum);
  return Object.freeze({
    ...base,
    schemaVersion: "Perttool.MutationResult.v4" as const,
    ok: !diagnostics.some(({ severity }) => severity === "error") &&
      !warningFailure,
    governance,
    assuranceImpact,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated:
      base.diagnosticsTruncated || candidate.diagnosticsTruncated ||
      limited.truncated,
  });
}

export function planMutation(
  text: string,
  mutation: Mutation,
  options: PlanAssuranceMutationOptions = {},
): MutationResultV4 {
  if ((mutation as { readonly kind?: unknown } | null)?.kind === "batch") {
    return planBatchMutation(
      text,
      mutation as unknown as BatchMutation,
      options,
    );
  }
  if (usesRetainedGrammar(text)) {
    const retained = planContract6Mutation(
      text,
      mutation,
      retainedPreflightOptions(options),
    );
    if (!retained.ok) return retainedFailure(retained);
  }
  const base = planTargetGrammar6Mutation(
    text,
    mutation as unknown as Parameters<typeof planTargetGrammar6Mutation>[1],
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
  if (!base.ok) {
    return Object.freeze({
      ...base,
      schemaVersion: "Perttool.MutationResult.v4" as const,
      governance: null,
      assuranceImpact: null,
    });
  }
  return planTargetPlanAssuranceMutation(
    text,
    {
      kind: "batch",
      mutations: Object.freeze([
        mutation as unknown as TargetGovernanceAtomicMutation,
      ]),
    },
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
}

export function planBatchMutation(
  text: string,
  mutation: BatchMutation | PlanAssuranceBatchMutation,
  options: PlanAssuranceMutationOptions = {},
): MutationResultV4 {
  if (usesRetainedGrammar(text)) {
    const retained = planContract6BatchMutation(
      text,
      mutation as BatchMutation,
      retainedPreflightOptions(options),
    );
    if (!retained.ok) return retainedFailure(retained);
  }
  const mutationItems = (mutation as unknown as {
    readonly mutations?: unknown;
  }).mutations;
  if (!Array.isArray(mutationItems)) {
    const base = planTargetGrammar6BatchMutation(
      text,
      mutation as unknown as Parameters<
        typeof planTargetGrammar6BatchMutation
      >[1],
      TARGET_GRAMMAR_6_CAPABILITY,
      options,
    );
    return Object.freeze({
      ...base,
      schemaVersion: "Perttool.MutationResult.v4" as const,
      governance: null,
      assuranceImpact: null,
    });
  }
  const mutations = mutationItems as readonly {
    readonly kind?: unknown;
  }[];
  const assurance = mutations.some(({ kind }) =>
    typeof kind === "string" &&
    (
      kind.startsWith("plan_assurance.") ||
      kind.startsWith("plan_dependency.") ||
      kind.startsWith("task_outcome.")
    )
  );
  if (!assurance) {
    const base = planTargetGrammar6BatchMutation(
      text,
      mutation as unknown as Parameters<
        typeof planTargetGrammar6BatchMutation
      >[1],
      TARGET_GRAMMAR_6_CAPABILITY,
      options,
    );
    if (!base.ok) {
      return Object.freeze({
        ...base,
        schemaVersion: "Perttool.MutationResult.v4" as const,
        governance: null,
        assuranceImpact: null,
      });
    }
  }
  return planTargetPlanAssuranceMutation(
    text,
    mutation as PlanAssuranceBatchMutation,
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
}

export function planAssuranceMutation(
  text: string,
  mutation: PlanAssuranceMutation,
  options: PlanAssuranceMutationOptions = {},
): MutationResultV4 {
  return planTargetPlanAssuranceMutation(
    text,
    mutation,
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
}

export function planAdvance(
  text: string,
  options: PlanAssuranceAdvanceOptions = {},
): AdvanceResultV2 {
  return planTargetPlanAssuranceAdvance(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
}

export function planLifecycle(
  text: string,
  mutation: LifecycleMutation,
  options: Contract7LifecycleOptions = {},
): LifecycleResultV4 {
  return lifecycleResult(
    text,
    planTargetLifecycleMutation(
      text,
      mutation,
      TARGET_GRAMMAR_6_CAPABILITY,
      options,
    ),
    options,
  );
}

export function planFinishActuals(
  text: string,
  mutation: FinishActualsMutation,
  options: Contract7LifecycleOptions = {},
): LifecycleResultV4 {
  return lifecycleResult(
    text,
    planTargetFinishActualsMutation(
      text,
      mutation,
      TARGET_GRAMMAR_6_CAPABILITY,
      options,
    ),
    options,
  );
}
