import {
  getTargetGovernanceProjectMetadata,
  type TargetGovernanceProjectMetadata,
  type TargetGovernanceProjectMetadataResult,
} from "./target-governance-project.js";
import { TARGET_GRAMMAR_4_CAPABILITY } from "../parser/document-parser.js";
import type { CheckOptions } from "./check.js";

export type ProjectMetadataDurationUnit = "day" | "hour" | "point";
export type ProjectMetadata = TargetGovernanceProjectMetadata;
export type ProjectMetadataResult = TargetGovernanceProjectMetadataResult;

export function getProjectMetadata(
  text: string,
  options: CheckOptions = {},
): ProjectMetadataResult {
  return getTargetGovernanceProjectMetadata(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
    options,
  );
}
