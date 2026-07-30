import { GOVERNANCE_DIRECT_EDIT_WARNING } from "../governance/guidance.js";
import { TOOL_VERSION } from "../version.js";
import {
  guideResultToJson,
  renderGuideResult,
  type GuideProjectionResult,
} from "./guide.js";
import {
  getHelp,
  type HelpLevel,
  type HelpSection,
} from "./registry.js";

export interface TargetGovernanceGuideResult extends GuideProjectionResult {
  readonly cliContractVersion: 5;
}

const governanceQuick: HelpSection = Object.freeze({
  id: "owner-aware-governance",
  title: "Owner-aware governance",
  body: "Start each Contract 5 candidate with an assertion-free preview. Persistent governed changes require an actor: an effective owner or delegate has direct authority, while another actor may provide repeatable --accepted-by-owner caller assertions only for the explicitly confirmed affected scopes of this candidate. Omit them when governance is not applicable and never reuse them across commands.",
});

const governanceDetail: readonly HelpSection[] = Object.freeze([
  Object.freeze({
    id: "pre-change-authority",
    title: "Pre-change authority",
    body: "The digest-bound pre-change document determines the effective goal and DAG owners and delegates. One atomic batch must satisfy every affected scope; candidate owner or delegate changes cannot authorize that same operation.",
  }),
  Object.freeze({
    id: "assertion-boundary",
    title: "Caller assertion boundary",
    body: "--actor and repeatable --accepted-by-owner values are caller-provided assertions. Before a non-direct governed write, present the operation, target, affected scopes, required owners, source and candidate digests, and candidate summary. A loose owner confirmation belongs to that candidate only; do not carry it to later maintenance, a changed candidate, or the next dag advance, and do not chain preview and confirmation-dependent write without a user-response boundary. These values are not authentication, verified identity, signatures, or a durable approval audit.",
  }),
  Object.freeze({
    id: "direct-edit-boundary",
    title: "Direct editing boundary",
    body: `${GOVERNANCE_DIRECT_EDIT_WARNING} This warning is guidance, not technical prevention. A text editor, shell command, or other program can bypass the tool-mediated authority check; Git review and human review remain external controls.`,
  }),
]);

function targetSections(
  topicId: string | null,
  level: HelpLevel,
  sections: readonly HelpSection[],
): readonly HelpSection[] {
  if (topicId !== "editing" || level === "index") {
    return sections;
  }
  return Object.freeze([
    ...sections,
    governanceQuick,
    ...(level === "detail" ? governanceDetail : []),
  ]);
}

export function getTargetGovernanceGuide(
  topicId: string | null,
  level: HelpLevel,
): TargetGovernanceGuideResult {
  const help = getHelp(topicId, level);
  return Object.freeze({
    schemaVersion: "Perttool.GuideResult.v1",
    cliContractVersion: 5,
    toolVersion: TOOL_VERSION,
    operation: "guide",
    ...help,
    sections: targetSections(topicId, level, help.sections),
  });
}

export function targetGovernanceGuideResultToJson(
  result: TargetGovernanceGuideResult,
): Readonly<Record<string, unknown>> {
  return guideResultToJson(result);
}

export function serializeTargetGovernanceGuideResult(
  result: TargetGovernanceGuideResult,
): string {
  return `${JSON.stringify(targetGovernanceGuideResultToJson(result))}\n`;
}

export function renderTargetGovernanceGuideResult(
  result: TargetGovernanceGuideResult,
): string {
  return renderGuideResult(result);
}
