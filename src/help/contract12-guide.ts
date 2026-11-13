// R: Explain the count-first Next contract, boundary budgets and version-specific override use.
import * as previous from "./contract11-guide.js";
import type { HelpLevel } from "./registry.js";
export interface Contract12GuideResult extends Omit<previous.Contract11GuideResult, "cliContractVersion"> {
  readonly cliContractVersion: 12;
}
const summary = "Select the maximum simultaneous task count using complete Perttool.NextResult.v10 evidence and remaining resource capacity.";
const previousNextSections = previous.getContract11Guide("next", "detail").sections;
const sections = Object.freeze([
  previousNextSections.find((section) => section.id === "classification")!,
  Object.freeze({ id: "recommendation", title: "Recommendation authority", body: "Recommended and deferred classify every ready task. The recommended set has the exact maximum simultaneous task count within the applied resource capacities after active allocation. Runnable and startable IDs identify that same selected set. optimal is true with optimality_scope task_count." }),
  Object.freeze({ id: "consumer-safety", title: "Machine-readable result", body: "--format json returns the complete NextResult v10 selection and explanation, temporal and plan-assurance eligibility, milestone acceptance and Plan Review projection. Consumers verify the recognized identities, source binding and complete authority before using the selected IDs." }),
  Object.freeze({ id: "authority-adoption", title: "Start authority", body: "Use a successful, complete Perttool.NextResult.v10 with recommendation interface 2, taxonomy 2.0, explanation model 2, expression model 1, description registry 2 and locale en. The authority policy is max_count_dispatch_v1_plus_release_gate_plus_plan_assurance_v1. recommended_task_ids, result_decision.recommended_task_ids, selection.selected_task_ids, groups.runnable_now and startable_recommended_task_ids carry the same ordered set. Existing source, temporal and assurance evidence determines eligibility before optimization. Inspect exclusions and safe_stop_reasons and reanalyze after source, capacity or eligibility changes." }),
  Object.freeze({ id: "selection", title: "Count-first selection", body: "The exact perttool.dispatch.maximum-count algorithm version 1 maximizes eligible ready task count within resource capacity after active allocation. Equal-count sets maximize selected counts by semantic rank group, then use stable task IDs. Every ready candidate is considered. --capacity RESOURCE=N supplies units of that resource. Zero-resource tasks consume no resource units. Zero applied capacity retains resource-free tasks. When the complete resource forecast is unavailable, schedule_critical and schedule_alerts are null." }),
  Object.freeze({ id: "boundary", title: "Equal-ranked boundary", body: "Each overflowing same-ranked group lists every eligible candidate with requirements, selected and unselected IDs, and selected IDs outside the group. Each resource reports capacity, active_usage, outside_group_usage, allocatable_units, selected_usage and remaining_units. Allocatable units equal capacity minus active usage minus outside-group selected usage. Remaining units subtract selected usage inside the group." }),
  Object.freeze({ id: "override-validation", title: "Human override", body: "validateOverride accepts a v10 source through Perttool.OverrideDecision.v2 and override contract 2. A feasible deferred selection uses an explicit human reason and the exact result decision ID, including its selection input digest. Existing v8/v9 sources retain OverrideDecision.v1. Override validation evaluates one source-bound selection and returns evidence for that selection." }),
  Object.freeze({ id: "selection-evidence", title: "Complete selection evidence", body: "selection.input commits the source, grammar, units, exact ranking keys, complete frontier, eligibility, active tasks and applied capacities. Its RFC 8785 SHA-256 digest also identifies the result decision. Typed facts, expressions, adjacent candidate comparisons, decision steps and registered descriptions explain the exact optimum and exclusions. optimality_scope is task_count. Precedence and resource schedule forecasts retain their existing meanings." }),
  previousNextSections.find((section) => section.id === "explanation")!,
]);
export function getContract12Guide(topicId: string | null, level: HelpLevel): Contract12GuideResult {
  const base = previous.getContract11Guide(topicId, level);
  const next = topicId === "next";
  const identity = (text: string) => text.replaceAll("Perttool.NextResult.v9", "Perttool.NextResult.v10")
    .replaceAll("NextResult v9", "NextResult v10")
    .replaceAll("current Contract 11 candidate", "current Contract 12 candidate");
  return Object.freeze({ ...base, cliContractVersion: 12,
    summary: next ? summary : identity(base.summary),
    sections: next && level !== "index" ? sections : Object.freeze(base.sections.map((section) => Object.freeze({
      ...section, body: topicId === "analysis.temporal" && section.id === "ranking"
        ? "Deadline facts remain informational for the inherited ranking keys. NextResult v10 computes temporal and plan-assurance eligibility before exact count-first selection. Its recommended, runnable and startable task IDs share the same selected set."
        : section.id === "authority-adoption"
        ? sections.find((entry) => entry.id === "authority-adoption")!.body
        : identity(section.body),
    }))),
    topics: Object.freeze(base.topics.map((topic) => topic.id === "next" ? Object.freeze({ ...topic, summary }) : topic)),
  });
}
export function contract12GuideResultToJson(value: Contract12GuideResult): Readonly<Record<string, unknown>> {
  return previous.contract11GuideResultToJson(value as unknown as previous.Contract11GuideResult);
}
export function serializeContract12GuideResult(value: Contract12GuideResult): string {
  return `${JSON.stringify(contract12GuideResultToJson(value))}\n`;
}
export function renderContract12GuideResult(value: Contract12GuideResult): string {
  return previous.renderContract11GuideResult(value as unknown as previous.Contract11GuideResult);
}
