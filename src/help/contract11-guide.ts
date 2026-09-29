// R: Explain the active Contract 11 Plan Review workflow and its authority boundaries.
import { TOOL_VERSION } from "../version.js";
import { getContract10Guide, type Contract10GuideResult } from "./contract10-guide.js";
import { guideResultToJson, renderGuideResult, type GuideProjectionResult } from "./guide.js";
import type { HelpLevel } from "./registry.js";

export interface Contract11GuideResult extends Omit<Contract10GuideResult, "cliContractVersion"> {
  readonly cliContractVersion: 11;
}
const topic = Object.freeze({
  id: "plan-review", title: "Plan Review Requests",
  summary: "Record a bounded task-linked review, advise review before new downstream work, and resolve by retaining or changing the plan.",
});
const sections = Object.freeze([
  Object.freeze({ id: "continuation", title: "Active work and local safety", body: "An open Plan Review Request strongly advises review before new downstream work. It does not change readiness, recommendation, or start authority. Already active work may continue, and a bounded local safety action may protect current work without claiming that the review is resolved." }),
  Object.freeze({ id: "review", title: "Review before a decision", body: "Create a task-bound request with an explicit reason, actor, and time. Inspect open requests and their Plan Review basis. A request records the need for review; it does not itself change the task plan, certify the plan, or accept an outcome." }),
  Object.freeze({ id: "resolution", title: "Retain or change the plan", body: "Resolve with plan_retained when the reviewed plan stands. Resolve with plan_changed only with one closed Contract 11 batch request containing the actual plan change. The tool composes and validates one final candidate; the resolution and change are one atomic write. The recorded request digest identifies the normalized request, not its correctness." }),
  Object.freeze({ id: "other-authority", title: "Independent authorities", body: "Plan Review, conditional Plan Assurance, Milestone Outcome Acceptance, and mutation authority answer different questions. Resolving a request does not reseal a plan, accept a milestone outcome, or supply governance delegates. A plan change must pass its own assurance, acceptance, governance, history, and persistence gates." }),
]);
const syntax = Object.freeze([
  "perttool plan review-request DOCUMENT REQUEST_ID TASK_ID --reason TEXT --created-at DATE_TIME --actor PRINCIPAL [--locator TEXT]",
  "perttool plan review-list DOCUMENT [--state open|resolved|all]",
  "perttool plan review-show DOCUMENT REQUEST_ID",
  "perttool plan review-resolve DOCUMENT REQUEST_ID --outcome plan_retained|plan_changed --resolved-at DATE_TIME --actor PRINCIPAL --resolution-reason TEXT [--accepted-owner PRINCIPAL]... [--request JSON_PATH_OR_STDIN]",
  "Create and resolve: [--preview] [--diff] [--output PATH | --in-place] [--expected-digest SHA256] [--format text|json]",
]);
const examples = Object.freeze([
  Object.freeze({ id: "open", title: "Record a review request", text: "perttool plan review-request plan.pert REVIEW_1 TASK_1 --reason 'Recheck task scope' --created-at 2026-09-29T09:00:00+09:00 --actor alice --diff" }),
  Object.freeze({ id: "inspect", title: "Inspect open requests", text: "perttool plan review-list plan.pert --state open --format json" }),
  Object.freeze({ id: "retain", title: "Resolve with the plan retained", text: "perttool plan review-resolve plan.pert REVIEW_1 --outcome plan_retained --resolved-at 2026-09-29T10:00:00+09:00 --actor alice --resolution-reason 'Current plan retained' --diff" }),
]);
function planReviewGuide(level: HelpLevel): Contract11GuideResult {
  return Object.freeze({ schemaVersion: "Perttool.GuideResult.v1", cliContractVersion: 11,
    toolVersion: TOOL_VERSION, operation: "guide", ok: true, topicId: topic.id, level,
    title: topic.title, summary: topic.summary,
    sections: level === "index" ? Object.freeze([]) : sections,
    syntax: level === "index" ? Object.freeze([]) : syntax,
    examples: level === "detail" ? examples : Object.freeze([]),
    related: level === "index" ? Object.freeze([]) : Object.freeze(["plan-assurance", "milestone-acceptance", "editing", "next"]),
    topics: Object.freeze([]), diagnostics: Object.freeze([]),
  });
}
export function getContract11Guide(topicId: string | null, level: HelpLevel): Contract11GuideResult {
  if (topicId === topic.id) return planReviewGuide(level);
  const base = getContract10Guide(topicId, level);
  const nextIdentity = topicId === "next" || topicId === "analysis.temporal";
  const current = nextIdentity ? Object.freeze({
    ...base,
    summary: base.summary.replaceAll("NextResult.v8", "NextResult.v9"),
    sections: Object.freeze(base.sections.map((section) => Object.freeze({
      ...section,
      body: section.body.replaceAll("NextResult.v8", "NextResult.v9").replaceAll("NextResult v8", "NextResult v9"),
    }))),
  }) : topicId === "editing" ? Object.freeze({
    ...base,
    sections: Object.freeze(base.sections.map((section) => Object.freeze({
      ...section, body: section.body.replaceAll("current Contract 10 candidate", "current Contract 11 candidate"),
    }))),
  }) : base;
  return Object.freeze({ ...current, cliContractVersion: 11,
    topics: topicId === null ? Object.freeze([
      ...current.topics.map((entry) => entry.id === "next"
        ? Object.freeze({ ...entry, summary: entry.summary.replaceAll("NextResult.v8", "NextResult.v9") })
        : entry),
      topic,
    ]) : current.topics });
}
export function contract11GuideResultToJson(value: Contract11GuideResult): Readonly<Record<string, unknown>> {
  return guideResultToJson(value as unknown as GuideProjectionResult);
}
export function serializeContract11GuideResult(value: Contract11GuideResult): string {
  return `${JSON.stringify(contract11GuideResultToJson(value))}\n`;
}
export function renderContract11GuideResult(value: Contract11GuideResult): string {
  return renderGuideResult(value as unknown as GuideProjectionResult);
}
