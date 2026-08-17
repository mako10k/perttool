import type { CheckOptions } from "./check.js";
import { getProjectMetadata as getContract8ProjectMetadata } from "./contract8-milestone-acceptance.js";
import type { TargetGovernanceProjectMetadata, TargetGovernanceProjectMetadataResult } from "./target-governance-project.js";
import { scanTemporalDeclarationBlocks, temporalScheduleBaseText } from "../temporal-schedule/source-lexical.js";
import { parseTemporalScheduleSource, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../temporal-schedule/source.js";
import type { TemporalScheduleSourceModel } from "../temporal-schedule/source-types.js";

export const CONTRACT9_PROJECT_RESULT = "Perttool.ProjectResult.v5" as const;

export interface Contract9ProjectMetadata extends Omit<TargetGovernanceProjectMetadata, "version"> {
  readonly version: TargetGovernanceProjectMetadata["version"] | 8;
}

export interface Contract9ProjectResult extends Omit<TargetGovernanceProjectMetadataResult, "grammarVersion" | "project"> {
  readonly schemaVersion: typeof CONTRACT9_PROJECT_RESULT;
  readonly grammarVersion: TargetGovernanceProjectMetadataResult["grammarVersion"] | 8;
  readonly project: Contract9ProjectMetadata | null;
  readonly temporalSchedule: TemporalScheduleSourceModel | null;
}

export function getProjectMetadata(text: string, options: CheckOptions = {}): Contract9ProjectResult {
  const source = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY, options);
  const grammar8 = source.grammarVersion === 8;
  const base = getContract8ProjectMetadata(grammar8
    ? temporalScheduleBaseText(text, scanTemporalDeclarationBlocks(text)) : text, options);
  if (!grammar8) return Object.freeze({ ...base, schemaVersion: CONTRACT9_PROJECT_RESULT, temporalSchedule: null });
  const diagnostics = Object.freeze([...base.diagnostics,
    ...source.diagnostics.filter(({ code }) => code.startsWith("PTSCH-10"))]);
  if (!source.ok || source.model === null || !base.ok || base.project === null) {
    return Object.freeze({ ...base, schemaVersion: CONTRACT9_PROJECT_RESULT, ok: false, grammarVersion: 8,
      project: null, diagnostics, diagnosticsTruncated: base.diagnosticsTruncated || source.diagnosticsTruncated,
      temporalSchedule: null });
  }
  return Object.freeze({ ...base, schemaVersion: CONTRACT9_PROJECT_RESULT, grammarVersion: 8,
    project: Object.freeze({ ...base.project, version: 8 as const }), diagnostics,
    diagnosticsTruncated: base.diagnosticsTruncated || source.diagnosticsTruncated,
    temporalSchedule: source.model });
}
