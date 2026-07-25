import {
  planValidatedMutationRequest,
  type MutationDocumentValidation,
  type MutationPlanningProfile,
} from "./mutate.js";
import {
  TARGET_MILESTONE_MUTATION_PROFILE,
} from "../mutation/milestone.js";
import {
  TARGET_GRAMMAR_2_PROJECT_MUTATION_PROFILE,
  TARGET_GRAMMAR_3_PROJECT_MUTATION_PROFILE,
} from "../mutation/project.js";
import {
  TARGET_GRAMMAR_3_TASK_MUTATION_PROFILE,
  TARGET_GRAMMAR_2_TASK_MUTATION_PROFILE,
} from "../mutation/task.js";
import type {
  TargetBatchMutation,
  TargetMutation,
} from "../mutation/target-types.js";
import type {
  MutationOptions,
  MutationResult,
} from "../mutation/types.js";
import type {
  TargetGrammar3Capability,
  TargetGrammar2Capability,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar3Document,
  validateTargetDocument,
} from "../semantic/target-validator.js";

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
