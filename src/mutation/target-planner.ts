import {
  planAtomicMutationEdits,
  planValidatedMutationRequest,
  type MutationDocumentValidation,
  type MutationPlanningProfile,
} from "./planner.js";
import type { DocumentNode, TargetDeclarationKind } from "../model/syntax.js";
import type { MutationEditPlan } from "../mutation/diagnostics.js";
import {
  TARGET_MILESTONE_MUTATION_PROFILE,
} from "../mutation/milestone.js";
import {
  TARGET_GRAMMAR_2_PROJECT_MUTATION_PROFILE,
  TARGET_GRAMMAR_3_PROJECT_MUTATION_PROFILE,
  TARGET_GRAMMAR_4_PROJECT_MUTATION_PROFILE,
  TARGET_GRAMMAR_5_PROJECT_MUTATION_PROFILE,
  TARGET_GRAMMAR_6_PROJECT_MUTATION_PROFILE,
} from "../mutation/project.js";
import {
  TARGET_GRAMMAR_3_TASK_MUTATION_PROFILE,
  TARGET_GRAMMAR_2_TASK_MUTATION_PROFILE,
} from "../mutation/task.js";
import type {
  TargetBatchMutation,
  TargetGovernanceBatchMutation,
  TargetGovernanceMutation,
  TargetMutation,
} from "../mutation/target-types.js";
import type {
  MutationOptions,
  MutationResult,
} from "../mutation/types.js";
import type {
  TargetGrammar3Capability,
  TargetGrammar4Capability,
  TargetGrammar5Capability,
  TargetGrammar6Capability,
  TargetGrammar2Capability,
} from "../parser/document-parser.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import {
  validateTargetGrammar3Document,
  validateTargetGrammar4Document,
  validateTargetGrammar5Document,
  validateTargetGrammar6Document,
  validateTargetDocument,
} from "../semantic/target-validator.js";
import {
  validateStoredLifecycleState,
} from "../actuals/lifecycle.js";

const targetGrammar2MutationPlanningProfile: MutationPlanningProfile =
  Object.freeze({
    project: TARGET_GRAMMAR_2_PROJECT_MUTATION_PROFILE,
    task: TARGET_GRAMMAR_2_TASK_MUTATION_PROFILE,
    milestone: TARGET_MILESTONE_MUTATION_PROFILE,
  });

const targetGrammar3MutationPlanningProfile: MutationPlanningProfile =
  Object.freeze({
    project: TARGET_GRAMMAR_3_PROJECT_MUTATION_PROFILE,
    task: TARGET_GRAMMAR_3_TASK_MUTATION_PROFILE,
    milestone: TARGET_MILESTONE_MUTATION_PROFILE,
  });

const targetGrammar4MutationPlanningProfile: MutationPlanningProfile =
  Object.freeze({
    project: TARGET_GRAMMAR_4_PROJECT_MUTATION_PROFILE,
    task: TARGET_GRAMMAR_3_TASK_MUTATION_PROFILE,
    milestone: TARGET_MILESTONE_MUTATION_PROFILE,
  });

const targetGrammar5MutationPlanningProfile: MutationPlanningProfile =
  Object.freeze({
    project: TARGET_GRAMMAR_5_PROJECT_MUTATION_PROFILE,
    task: TARGET_GRAMMAR_3_TASK_MUTATION_PROFILE,
    milestone: TARGET_MILESTONE_MUTATION_PROFILE,
  });

const targetGrammar6MutationPlanningProfile: MutationPlanningProfile =
  Object.freeze({
    project: TARGET_GRAMMAR_6_PROJECT_MUTATION_PROFILE,
    task: TARGET_GRAMMAR_3_TASK_MUTATION_PROFILE,
    milestone: TARGET_MILESTONE_MUTATION_PROFILE,
  });

export function planTargetGrammar5AtomicMutationEdits(
  text: string,
  document: DocumentNode<TargetDeclarationKind>,
  mutation: TargetGovernanceMutation,
): MutationEditPlan {
  if (mutation.kind === "batch") {
    throw new Error("target Grammar 5 atomic edit planning does not accept a batch");
  }
  return planAtomicMutationEdits(
    text,
    document as unknown as Parameters<typeof planAtomicMutationEdits>[1],
    mutation,
    targetGrammar5MutationPlanningProfile,
  );
}

export function planTargetGrammar6AtomicMutationEdits(
  text: string,
  document: DocumentNode<TargetDeclarationKind>,
  mutation: TargetGovernanceMutation,
  capability: TargetGrammar6Capability,
): MutationEditPlan {
  if (capability !== TARGET_GRAMMAR_6_CAPABILITY) {
    throw new TypeError("target Grammar 6 assurance source capability is required");
  }
  if (mutation.kind === "batch") {
    throw new Error("target Grammar 6 atomic edit planning does not accept a batch");
  }
  return planAtomicMutationEdits(
    text,
    document as unknown as Parameters<typeof planAtomicMutationEdits>[1],
    mutation,
    targetGrammar6MutationPlanningProfile,
  );
}

function targetGrammar2Validator(
  capability: TargetGrammar2Capability,
): (text: string, maxDiagnostics: number) => MutationDocumentValidation {
  return (text, maxDiagnostics) => {
    const checked = validateTargetDocument(text, capability, { maxDiagnostics });
    const document = checked.validatedDocument?.document;
    const project = document?.declarations.find(
      (declaration) => declaration.kind === "project",
    );
    return {
      ok: checked.ok,
      document: document ?? null,
      documentId: project?.id ?? null,
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  };
}

function targetGrammar3Validator(
  capability: TargetGrammar3Capability,
): (text: string, maxDiagnostics: number) => MutationDocumentValidation {
  return (text, maxDiagnostics) => {
    const checked = validateTargetGrammar3Document(
      text,
      capability,
      { maxDiagnostics },
    );
    const document = checked.validatedDocument?.document;
    const project = document?.declarations.find(
      (declaration) => declaration.kind === "project",
    );
    return {
      ok: checked.ok,
      document: document ?? null,
      documentId: project?.id ?? null,
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  };
}

function targetGrammar4Validator(
  capability: TargetGrammar4Capability,
): (text: string, maxDiagnostics: number) => MutationDocumentValidation {
  return (text, maxDiagnostics) => {
    const checked = validateTargetGrammar4Document(
      text,
      capability,
      { maxDiagnostics },
    );
    const document = checked.validatedDocument?.document;
    const project = document?.declarations.find(
      (declaration) => declaration.kind === "project",
    );
    return {
      ok: checked.ok,
      document: document ?? null,
      documentId: project?.id ?? null,
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  };
}

function targetGrammar5Validator(
  capability: TargetGrammar5Capability,
): (text: string, maxDiagnostics: number) => MutationDocumentValidation {
  return (text, maxDiagnostics) => {
    const checked = validateTargetGrammar5Document(
      text,
      capability,
      { maxDiagnostics },
    );
    const document = checked.validatedDocument?.document;
    const project = document?.declarations.find(
      (declaration) => declaration.kind === "project",
    );
    const lifecycleDiagnostics =
      checked.validatedDocument === null
        ? []
        : validateStoredLifecycleState(checked.validatedDocument);
    return {
      ok: checked.ok && lifecycleDiagnostics.length === 0,
      document: (document ?? null) as unknown as
        MutationDocumentValidation["document"],
      documentId: project?.id ?? null,
      diagnostics: Object.freeze([
        ...checked.diagnostics,
        ...lifecycleDiagnostics,
      ]),
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  };
}

function targetGrammar6Validator(
  capability: TargetGrammar6Capability,
): (text: string, maxDiagnostics: number) => MutationDocumentValidation {
  return (text, maxDiagnostics) => {
    const checked = validateTargetGrammar6Document(
      text,
      capability,
      { maxDiagnostics },
    );
    const document = checked.validatedDocument?.document;
    const project = document?.declarations.find(
      (declaration) => declaration.kind === "project",
    );
    const lifecycleDiagnostics = checked.validatedDocument === null
      ? []
      : validateStoredLifecycleState(
          checked.validatedDocument as unknown as Parameters<
            typeof validateStoredLifecycleState
          >[0],
        );
    return {
      ok: checked.ok && lifecycleDiagnostics.length === 0,
      document: (document ?? null) as unknown as
        MutationDocumentValidation["document"],
      documentId: project?.id ?? null,
      diagnostics: Object.freeze([
        ...checked.diagnostics,
        ...lifecycleDiagnostics,
      ]),
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  };
}

export function planTargetMutation(
  text: string,
  mutation: TargetMutation,
  capability: TargetGrammar2Capability,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    targetGrammar2Validator(capability),
    targetGrammar2MutationPlanningProfile,
    options,
  );
}

export function planTargetBatchMutation(
  text: string,
  mutation: TargetBatchMutation,
  capability: TargetGrammar2Capability,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    targetGrammar2Validator(capability),
    targetGrammar2MutationPlanningProfile,
    options,
    true,
  );
}

export function planTargetGrammar3Mutation(
  text: string,
  mutation: TargetMutation,
  capability: TargetGrammar3Capability,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    targetGrammar3Validator(capability),
    targetGrammar3MutationPlanningProfile,
    options,
  );
}

export function planTargetGrammar3BatchMutation(
  text: string,
  mutation: TargetBatchMutation,
  capability: TargetGrammar3Capability,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    targetGrammar3Validator(capability),
    targetGrammar3MutationPlanningProfile,
    options,
    true,
  );
}

export function planTargetGrammar4Mutation(
  text: string,
  mutation: TargetGovernanceMutation,
  capability: TargetGrammar4Capability,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    targetGrammar4Validator(capability),
    targetGrammar4MutationPlanningProfile,
    options,
  );
}

export function planTargetGrammar4BatchMutation(
  text: string,
  mutation: TargetGovernanceBatchMutation,
  capability: TargetGrammar4Capability,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    targetGrammar4Validator(capability),
    targetGrammar4MutationPlanningProfile,
    options,
    true,
  );
}

export function planTargetGrammar5Mutation(
  text: string,
  mutation: TargetGovernanceMutation,
  capability: TargetGrammar5Capability,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    targetGrammar5Validator(capability),
    targetGrammar5MutationPlanningProfile,
    options,
  );
}

export function planTargetGrammar5BatchMutation(
  text: string,
  mutation: TargetGovernanceBatchMutation,
  capability: TargetGrammar5Capability,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    targetGrammar5Validator(capability),
    targetGrammar5MutationPlanningProfile,
    options,
    true,
  );
}

export function planTargetGrammar6Mutation(
  text: string,
  mutation: TargetGovernanceMutation,
  capability: TargetGrammar6Capability,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    targetGrammar6Validator(capability),
    targetGrammar6MutationPlanningProfile,
    options,
  );
}

export function planTargetGrammar6BatchMutation(
  text: string,
  mutation: TargetGovernanceBatchMutation,
  capability: TargetGrammar6Capability,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    targetGrammar6Validator(capability),
    targetGrammar6MutationPlanningProfile,
    options,
    true,
  );
}
