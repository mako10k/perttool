import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import type { CheckOptions } from "./check.js";
import {
  getTargetGovernanceProjectMetadata,
  type TargetGovernanceProjectMetadata,
  type TargetGovernanceProjectMetadataResult,
} from "./target-governance-project.js";
import {
  renderTargetGovernanceProjectText,
  targetGovernanceProjectResultToJson,
} from "./target-governance-projection.js";

export const PROJECT_RESULT_V4 = "Perttool.ProjectResult.v4" as const;

export type ProjectMetadataDurationUnit = "day" | "hour" | "point";
export type ProjectMetadata = TargetGovernanceProjectMetadata;
export type ProjectMetadataResult = TargetGovernanceProjectMetadataResult;

export function getProjectMetadata(
  text: string,
  options: CheckOptions = {},
): ProjectMetadataResult {
  return getTargetGovernanceProjectMetadata(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
}

export function contract7ProjectResultToJson(
  result: TargetGovernanceProjectMetadataResult,
  source: string,
  sourceDigest: string,
  ok = result.ok,
): Readonly<Record<string, unknown>> {
  const base = targetGovernanceProjectResultToJson(
    result,
    source,
    sourceDigest,
    ok,
  );
  const project = base["project"] as Readonly<Record<string, unknown>> | null;
  return Object.freeze({
    ...base,
    schema_version: PROJECT_RESULT_V4,
    cli_contract_version: 7,
    project: project === null || result.project === null
      ? null
      : Object.freeze({
          ...project,
          plan_assurance_model: result.project.planAssuranceModel,
          plan_assurance_hash_model: result.project.planAssuranceHashModel,
        }),
  });
}

export function renderContract7ProjectText(
  project: TargetGovernanceProjectMetadata,
): string {
  const lines = renderTargetGovernanceProjectText(project).trimEnd().split("\n");
  lines.push(
    `PLAN_ASSURANCE_MODEL ${project.planAssuranceModel ?? "-"}`,
    `PLAN_ASSURANCE_HASH_MODEL ${project.planAssuranceHashModel ?? "-"}`,
    "",
  );
  return lines.join("\n");
}
