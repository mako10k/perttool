import { TARGET_GRAMMAR_4_CAPABILITY } from "../parser/document-parser.js";
import type {
  TargetGovernanceBatchMutation,
  TargetGovernanceMutation,
} from "../mutation/target-types.js";
import type {
  BatchMutation,
  Mutation,
  MutationOptions,
} from "../mutation/types.js";
import {
  planTargetGovernanceAdvance,
  planTargetGovernanceBatchMutation,
  planTargetGovernanceMutation,
  type TargetGovernanceAdvanceResultV2,
  type TargetGovernanceMutationResultV2,
} from "./target-governance-mutation.js";

export type MutationResultV2 = TargetGovernanceMutationResultV2;
export type AdvanceResultV2 = TargetGovernanceAdvanceResultV2;

export function planMutation(
  text: string,
  mutation: Mutation,
  options: MutationOptions = {},
): MutationResultV2 {
  return planTargetGovernanceMutation(
    text,
    mutation as TargetGovernanceMutation,
    TARGET_GRAMMAR_4_CAPABILITY,
    options,
  );
}

export function planBatchMutation(
  text: string,
  mutation: BatchMutation,
  options: MutationOptions = {},
): MutationResultV2 {
  return planTargetGovernanceBatchMutation(
    text,
    mutation as TargetGovernanceBatchMutation,
    TARGET_GRAMMAR_4_CAPABILITY,
    options,
  );
}

export function planAdvance(
  text: string,
  options: MutationOptions = {},
): AdvanceResultV2 {
  return planTargetGovernanceAdvance(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
    options,
  );
}
