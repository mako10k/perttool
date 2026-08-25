import { TOOL_VERSION } from "../version.js";
import {
  getContract9Guide,
  type Contract9GuideResult,
} from "./contract9-guide.js";
import {
  guideResultToJson,
  renderGuideResult,
  type GuideProjectionResult,
} from "./guide.js";
import type { HelpLevel } from "./registry.js";

export interface Contract10GuideResult
  extends Omit<Contract9GuideResult, "cliContractVersion"> {
  readonly cliContractVersion: 10;
}

const topic = Object.freeze({
  id: "planning-pool",
  title: "Planning pool",
  summary: "Grammar 9 Work, project-owned Event and Activity AoA, guided reshape, Windows, observations, and Git-owned history.",
});

export function getContract10Guide(
  topicId: string | null,
  level: HelpLevel,
): Contract10GuideResult {
  if (topicId !== topic.id) {
    const base = getContract9Guide(topicId, level);
    return Object.freeze({
      ...base,
      cliContractVersion: 10,
      topics: topicId === null
        ? Object.freeze([...base.topics, topic])
        : base.topics,
    });
  }
  return Object.freeze({
    schemaVersion: "Perttool.GuideResult.v1",
    cliContractVersion: 10,
    toolVersion: TOOL_VERSION,
    operation: "guide",
    ok: true,
    topicId,
    level,
    title: topic.title,
    summary: topic.summary,
    sections: level === "index" ? Object.freeze([]) : Object.freeze([
      Object.freeze({
        id: "model",
        title: "Meaning owners",
        body: "Work owns residual intent. Event and Activity form a Temporary Draft AoA. Milestone and Task remain the strict execution and outcome owners. Projection transfers meaning by same identity; it never creates a second authoritative copy.",
      }),
      Object.freeze({
        id: "reshape",
        title: "Guided reshape",
        body: "Write a complete source-bound semantic inventory, run work reshape preflight, review its decomposition and candidate, then apply the same normalized request with the returned hash and opaque token. Use Add residual description when projected meaning needs a remaining Work expression.",
      }),
      Object.freeze({
        id: "authority",
        title: "Authority and history",
        body: "The token is a navigation receipt, not approval. A strict-DAG change still requires candidate-bound governance authority. Canonical Work and Window deletion requires Git recoverability; Temporary Draft Event and Activity deletion does not. Current source keeps only latest facts and Git owns removed history.",
      }),
      Object.freeze({
        id: "windows",
        title: "Windows",
        body: "A Window is an active planning selection with a temporary outcome-oriented objective and optional bounds. It has no completion or objective-achieved state. Close explicitly disposes the objective and carries only enumerated Work.",
      }),
    ]),
    syntax: level === "index" ? Object.freeze([]) : Object.freeze([
      "work ID:",
      "  title STRING",
      "  description STRING_OR_BLOCK",
      "event ID:",
      "  title STRING",
      "activity ID FROM -> TO:",
      "  title STRING",
      "window ID:",
      "  title STRING",
      "  objective STRING",
      "work_order:",
      "  ID",
    ]),
    examples: level === "detail" ? Object.freeze([
      Object.freeze({
        id: "reshape-preflight",
        title: "Audit a semantic reshape",
        text: "perttool work reshape preflight plan.pert --request reshape.json --format json",
      }),
      Object.freeze({
        id: "window-observation",
        title: "Observe a Window",
        text: "perttool window observe plan.pert --request observation.json --format json",
      }),
    ]) : Object.freeze([]),
    related: level === "index" ? Object.freeze([]) : Object.freeze([
      "editing",
      "plan-assurance",
      "historical-dag",
    ]),
    topics: Object.freeze([]),
    diagnostics: Object.freeze([]),
  });
}

export function contract10GuideResultToJson(value: Contract10GuideResult): Readonly<Record<string, unknown>> {
  return guideResultToJson(value as unknown as GuideProjectionResult);
}
export function serializeContract10GuideResult(value: Contract10GuideResult): string {
  return `${JSON.stringify(contract10GuideResultToJson(value))}\n`;
}
export function renderContract10GuideResult(value: Contract10GuideResult): string {
  return renderGuideResult(value as unknown as GuideProjectionResult);
}
