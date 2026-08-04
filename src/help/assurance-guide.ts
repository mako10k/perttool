import { TOOL_VERSION } from "../version.js";
import {
  guideResultToJson,
  renderGuideResult,
  type GuideProjectionResult,
} from "./guide.js";
import type { HelpLevel, HelpSection } from "./registry.js";
import { getActualsGuide } from "./actuals-guide.js";

export interface AssuranceGuideResult extends GuideProjectionResult {
  readonly cliContractVersion: 7;
}

const topic = Object.freeze({
  id: "plan-assurance",
  title: "Conditional plan assurance",
  summary: "Verifies whether accepted task plans still match their recursive planning basis.",
});

const quick: readonly HelpSection[] = Object.freeze([
  Object.freeze({
    id: "verify-and-seal",
    title: "Verify and seal",
    body: "Use plan-assurance show or hash to inspect current commitments. Use seal once to enable model 1 and establish a complete baseline. Hash output is inspection evidence only; it is not acceptance or write authority.",
  }),
  Object.freeze({
    id: "replan-and-reseal",
    title: "Replan and reseal",
    body: "A review_required task has an accepted basis that no longer matches recomputation. Revise the plan, then use reseal with an explicit repeatable task set and one nonempty reason. Descendants are not accepted automatically.",
  }),
]);

const detail: readonly HelpSection[] = Object.freeze([
  Object.freeze({
    id: "dependency-modes",
    title: "Dependency modes",
    body: "both participates in execution and planning, execution-only preserves execution order without assurance propagation, and planning-only propagates assurance without adding an execution edge. The DSL stores both as both, execution_only, or planning_only task_relation modes.",
  }),
  Object.freeze({
    id: "outcomes",
    title: "Basis-bound outcomes",
    body: "A completed producer needs a conformant or changed task_outcome bound to its current accepted basis before its commitment can remain trustworthy. A changed outcome requires a summary and is a different exported commitment.",
  }),
  Object.freeze({
    id: "advance-receipts",
    title: "Advance receipts",
    body: "dag advance contracts removed producers into self-hashed assurance receipts only when every retained consumer basis remains equal. --force-history-loss cannot bypass a blocked assurance guard.",
  }),
  Object.freeze({
    id: "trust-boundary",
    title: "Trust boundary",
    body: "SHA-256 commitments detect changed planning inputs under the declared model. They are not signatures, authentication, correctness proofs, or evidence that work was performed as planned.",
  }),
]);

function custom(level: HelpLevel): AssuranceGuideResult {
  return Object.freeze({
    schemaVersion: "Perttool.GuideResult.v1",
    cliContractVersion: 7,
    toolVersion: TOOL_VERSION,
    operation: "guide",
    ok: true,
    topicId: topic.id,
    level,
    title: topic.title,
    summary: topic.summary,
    sections: level === "index"
      ? Object.freeze([])
      : level === "quick"
        ? quick
        : Object.freeze([...quick, ...detail]),
    syntax: level === "index" ? Object.freeze([]) : Object.freeze([
      "task_relation ID PREDECESSOR -> SUCCESSOR:",
      "  mode both|execution_only|planning_only",
      "plan_seal TASK_ID:",
      "task_outcome ID:",
      "assurance_receipt ID:",
    ]),
    examples: Object.freeze([]),
    related: level === "index"
      ? Object.freeze([])
      : Object.freeze(["syntax", "editing", "analysis"]),
    topics: Object.freeze([]),
    diagnostics: Object.freeze([]),
  });
}

export function getAssuranceGuide(
  topicId: string | null,
  level: HelpLevel,
): AssuranceGuideResult {
  if (topicId === "plan-assurance") return custom(level);
  const base = getActualsGuide(topicId, level);
  const contract7Text = (value: string): string => value
    .replaceAll("Grammar versions 1 through 5", "Grammar versions 1 through 6")
    .replaceAll("Grammar 5", "Grammar 6")
    .replaceAll("NextResult.v5", "NextResult.v6")
    .replaceAll("Contract 6", "Contract 7");
  return Object.freeze({
    ...base,
    cliContractVersion: 7,
    summary: contract7Text(base.summary),
    sections: Object.freeze(base.sections.map((section) => Object.freeze({
      ...section,
      body: contract7Text(section.body),
    }))),
    syntax: Object.freeze(base.syntax.map(contract7Text)),
    examples: Object.freeze(base.examples.map((example) => Object.freeze({
      ...example,
      title: contract7Text(example.title),
      text: contract7Text(example.text),
    }))),
    topics: topicId === null
      ? Object.freeze([
          ...base.topics.map((item) => Object.freeze({
            ...item,
            summary: contract7Text(item.summary),
          })),
          topic,
        ])
      : base.topics,
  });
}

export function serializeAssuranceGuideResult(
  result: AssuranceGuideResult,
): string {
  return `${JSON.stringify(guideResultToJson(result))}\n`;
}

export { guideResultToJson as assuranceGuideResultToJson };

export function renderAssuranceGuideResult(
  result: AssuranceGuideResult,
): string {
  return renderGuideResult(result);
}
