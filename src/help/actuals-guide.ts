import type { HelpLevel } from "./registry.js";
import {
  getTargetGovernanceGuide,
  renderTargetGovernanceGuideResult,
  serializeTargetGovernanceGuideResult,
  type TargetGovernanceGuideResult,
} from "./target-governance-guide.js";
import { guideResultToJson } from "./guide.js";

export interface ActualsGuideResult
  extends Omit<TargetGovernanceGuideResult, "cliContractVersion"> {
  readonly cliContractVersion: 6;
}

export function getActualsGuide(
  topicId: string | null,
  level: HelpLevel,
): ActualsGuideResult {
  const target = getTargetGovernanceGuide(topicId, level);
  return Object.freeze({
    ...target,
    cliContractVersion: 6,
    sections: Object.freeze(
      target.sections.map((section) =>
        Object.freeze({
          ...section,
          body: section.body.replaceAll("Contract 5", "Contract 6"),
        }),
      ),
    ),
  });
}

export function serializeActualsGuideResult(
  result: ActualsGuideResult,
): string {
  return serializeTargetGovernanceGuideResult(
    result as unknown as TargetGovernanceGuideResult,
  );
}

export function actualsGuideResultToJson(
  result: ActualsGuideResult,
): Readonly<Record<string, unknown>> {
  return guideResultToJson(result);
}

export function renderActualsGuideResult(
  result: ActualsGuideResult,
): string {
  return renderTargetGovernanceGuideResult(
    result as unknown as TargetGovernanceGuideResult,
  );
}
