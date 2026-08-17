import { TOOL_VERSION } from "../version.js";
import { getAssuranceGuide, type AssuranceGuideResult } from "./assurance-guide.js";
import { guideResultToJson, renderGuideResult, type GuideProjectionResult } from "./guide.js";
import type { HelpLevel } from "./registry.js";

export interface Contract9GuideResult extends Omit<AssuranceGuideResult, "cliContractVersion"> {
  readonly cliContractVersion: 9;
}

const topic = Object.freeze({ id: "temporal-schedule", title: "Temporal schedule",
  summary: "Grammar 8 calendars, generic resource availability, event bounds, backward-required schedules, and POSTDUE evidence." });

export function getContract9Guide(topicId: string | null, level: HelpLevel): Contract9GuideResult {
  if (topicId !== "temporal-schedule") {
    const base = getAssuranceGuide(topicId, level);
    return Object.freeze({ ...base, cliContractVersion: 9,
      topics: topicId === null ? Object.freeze([...base.topics, topic]) : base.topics });
  }
  return Object.freeze({ schemaVersion: "Perttool.GuideResult.v1", cliContractVersion: 9, toolVersion: TOOL_VERSION,
    operation: "guide", ok: true, topicId, level, title: topic.title, summary: topic.summary,
    sections: level === "index" ? Object.freeze([]) : Object.freeze([
      Object.freeze({ id: "model", title: "Model", body: "Declare one project time profile, reusable calendars, resource availability intervals and overrides, and task or milestone event bounds. Calendars constrain capacity; event bounds constrain event time." }),
      Object.freeze({ id: "postdue", title: "POSTDUE", body: "Check and Next emit compact POSTDUE evidence. Analysis emits full applicable driver paths. When a compact result lacks a full path, run the exact analysis_argv array without reconstructing or shell-joining its operand." }),
      Object.freeze({ id: "authority", title: "Authority", body: "Deadline and POSTDUE facts are diagnostic and do not alter Recommendation version 1. not_before compatibility is represented by start-earliest authority. Resource scheduling remains a qualified heuristic with optimal=false." }),
    ]),
    syntax: level === "index" ? Object.freeze([]) : Object.freeze(["calendar ID:", "  mon 09:00..12:00, 13:00..17:00", "resource ID:", "  availability START..END CAPACITY", "task ID FROM -> TO:", "  when finish latest DATE-TIME", "milestone ID:", "  when reach latest DATE-TIME"]),
    examples: level === "detail" ? Object.freeze([Object.freeze({ id: "postdue-analysis", title: "Inspect complete POSTDUE drivers", text: "perttool dag analyze plan.pert --schedule both --format json" })]) : Object.freeze([]),
    related: level === "index" ? Object.freeze([]) : Object.freeze(["analysis", "workflows", "plan-assurance"]), topics: Object.freeze([]), diagnostics: Object.freeze([]) });
}

export function contract9GuideResultToJson(value: Contract9GuideResult): Readonly<Record<string, unknown>> {
  return guideResultToJson(value as GuideProjectionResult);
}
export function serializeContract9GuideResult(value: Contract9GuideResult): string {
  return `${JSON.stringify(contract9GuideResultToJson(value))}\n`;
}
export function renderContract9GuideResult(value: Contract9GuideResult): string {
  return renderGuideResult(value as GuideProjectionResult);
}
