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

const activeSyntaxSummary = "Grammar versions 1 through 9 for declaring projects, governance metadata, calendars, resources, planning Work, project-owned Events and Activities, Windows, strict milestones, tasks, gates, explicit task work events, conditional plan-assurance records, and milestone acceptance evidence.";

function replaceSectionBody(
  sections: Contract9GuideResult["sections"],
  id: string,
  body: string,
): Contract9GuideResult["sections"] {
  return Object.freeze(sections.map((section) => section.id === id
    ? Object.freeze({ ...section, body })
    : section));
}

type GuideTopics = Contract9GuideResult["topics"];
type Contract10TopicOverride = (
  base: Contract9GuideResult,
  topics: GuideTopics,
) => Contract9GuideResult;

function applySyntaxTopic(
  base: Contract9GuideResult,
  topics: GuideTopics,
): Contract9GuideResult {
  return Object.freeze({
    ...base,
    summary: activeSyntaxSummary,
    sections: replaceSectionBody(
      base.sections,
      "declarations",
      "Place exactly one project first. Grammar 1 declares resources, milestones, tasks, and gates; Grammar 5 adds task-owned work_event declarations; Grammar 6 adds task_relation, plan_seal, task_outcome, and assurance_receipt; Grammar 7 adds milestone criterion sets, acceptance receipts, and one migration baseline; Grammar 8 adds calendar declarations and schedule fields; Grammar 9 adds Work, project-owned Event and Activity, Window, and one work_order declaration. See temporal-schedule and planning-pool for the additive Grammar 8 and 9 meanings.",
    ),
    syntax: Object.freeze([
      "project ID:",
      "calendar ID:",
      "resource ID:",
      "work ID:",
      "event ID:",
      "activity ID FROM -> TO:",
      "window ID:",
      "work_order:",
      "milestone ID:",
      "task ID FROM -> TO:",
      "gate ID FROM -> TO:",
      "work_event ID:",
    ]),
    related: Object.freeze([
      ...base.related,
      "temporal-schedule",
      "planning-pool",
    ]),
    topics,
  });
}

function applyProjectSyntaxTopic(
  base: Contract9GuideResult,
  topics: GuideTopics,
): Contract9GuideResult {
  return Object.freeze({
    ...base,
    sections: replaceSectionBody(
      base.sections,
      "version",
      "An omitted version is treated as 1. Version 2 adds temporal fields; version 3 adds exact Fraction Duration; version 4 adds declared goal and DAG owners and delegates; version 5 adds task work events; version 6 adds conditional plan assurance; version 7 adds milestone acceptance; version 8 adds calendar schedules, resource availability, and event bounds; and version 9 adds Planning Pool declarations while retaining the Grammar 8 strict DAG and temporal meanings.",
    ),
    topics,
  });
}

function applyWorkEventSyntaxTopic(
  base: Contract9GuideResult,
  topics: GuideTopics,
): Contract9GuideResult {
  return Object.freeze({
    ...base,
    summary: "Grammar 5 introduces explicit task-owned lifecycle evidence in the same PERT document; Grammars 6 through 9 retain it unchanged.",
    topics,
  });
}

function applyDurationSyntaxTopic(
  base: Contract9GuideResult,
  topics: GuideTopics,
): Contract9GuideResult {
  return Object.freeze({
    ...base,
    summary: "An exact Decimal or, in Grammar 3 through 9, reduced Fraction followed by d, h, or p.",
    topics,
  });
}

function applyTemporalSyntaxTopic(
  base: Contract9GuideResult,
  topics: GuideTopics,
): Contract9GuideResult {
  return Object.freeze({
    ...base,
    summary: "Grammar 2 introduces milestone deadline plus task not_before and deadline fields. Grammars 3 through 7 retain those spellings. Grammar 8 replaces not_before with when start earliest and adds calendar schedules, availability, and event bounds; Grammar 9 retains the Grammar 8 temporal syntax and meaning.",
    syntax: Object.freeze([
      "project ID:",
      "  version 2|3|4|5|6|7",
      "  as_of DATE|OFFSET_DATE_TIME",
      "milestone ID:",
      "  deadline DATE|OFFSET_DATE_TIME",
      "task ID FROM -> TO:",
      "  not_before DATE|OFFSET_DATE_TIME",
      "  deadline DATE|OFFSET_DATE_TIME",
      "project ID:",
      "  version 8|9",
      "  time_zone STRING",
      "  tzdb STRING",
      "  calendar ID",
      "  workday DURATION",
      "calendar ID:",
      "  mon 09:00..12:00, 13:00..17:00",
      "milestone ID:",
      "  when reach earliest|latest OFFSET_DATE_TIME",
      "task ID FROM -> TO:",
      "  when start|finish earliest|latest OFFSET_DATE_TIME",
    ]),
    related: Object.freeze([...base.related, "temporal-schedule"]),
    topics,
  });
}

function applyActualsTopic(
  base: Contract9GuideResult,
  topics: GuideTopics,
): Contract9GuideResult {
  return Object.freeze({
    ...base,
    sections: replaceSectionBody(
      replaceSectionBody(
        base.sections,
        "explicit-events",
        "Grammar 5 introduces task-owned work events; Grammars 6 through 9 retain them unchanged. task start, suspend, resume, and eventful finish require an explicit --at value; no command reads the wall clock. Preview, governance, digest, and safe-write controls apply before persistence.",
      ),
      "legacy-status",
      "Grammar 1 through 4 retain status-only task finish. In Grammar 5 through 9, eventless legacy tasks may use direct planned, active, blocked, or done status changes; once a work event exists, lifecycle commands are required and suspended remains distinct from blocked.",
    ),
    topics,
  });
}

function applyEditingTopic(
  base: Contract9GuideResult,
  topics: GuideTopics,
): Contract9GuideResult {
  return Object.freeze({
    ...base,
    sections: replaceSectionBody(
      base.sections,
      "owner-aware-governance",
      "Start each current Contract 10 candidate with an assertion-free preview. Persistent governed changes require an actor: an effective owner or delegate has direct authority, while another actor may provide repeatable --accepted-by-owner caller assertions only for the explicitly confirmed affected scopes of this candidate. Omit them when governance is not applicable and never reuse them across commands. PTGOV-103 warns about an assertion on a not-applicable candidate; PTGOV-104 warns about one on a governed preview.",
    ),
    topics,
  });
}

const contract10TopicOverrides: Readonly<Record<string, Contract10TopicOverride>> =
  Object.freeze({
    syntax: applySyntaxTopic,
    "syntax.project": applyProjectSyntaxTopic,
    "syntax.work-event": applyWorkEventSyntaxTopic,
    "syntax.duration": applyDurationSyntaxTopic,
    "syntax.temporal": applyTemporalSyntaxTopic,
    actuals: applyActualsTopic,
    editing: applyEditingTopic,
  });

function applyContract10Syntax(
  base: Contract9GuideResult,
  topicId: string | null,
): Contract9GuideResult {
  const topics = topicId === null
    ? Object.freeze(base.topics.map((entry) => entry.id === "syntax"
      ? Object.freeze({ ...entry, summary: activeSyntaxSummary })
      : entry))
    : base.topics;
  const override = topicId === null
    ? undefined
    : contract10TopicOverrides[topicId];
  return override === undefined
    ? Object.freeze({ ...base, topics })
    : override(base, topics);
}

const planningPoolSections = Object.freeze([
  Object.freeze({
    id: "model",
    title: "Meaning owners",
    body: "Work owns residual intent. Event and Activity form a Temporary Draft AoA. Milestone and Task remain the strict execution and outcome owners. Projection transfers meaning by same identity; it never creates a second authoritative copy.",
  }),
  Object.freeze({
    id: "reshape",
    title: "Guided reshape",
    body: "For routine operations, write one closed Perttool.PlanningIntentRequest.v1 and pass it as --intent-request. perttool deterministically builds the complete audited v2 reshape or Window request without semantic inference. Complex split and merge operations retain --request. Run work reshape preflight, review the compiled normalized request and candidate, then apply the same input with the returned hash and opaque token.",
  }),
  Object.freeze({
    id: "human-output",
    title: "Human review views",
    body: "Default text keeps lists compact; expands Work, project-owned Event and Activity, and Window show into semantic sections; separates observation axes; and makes reshape binding, affected meaning, authority, token, diagnostics, and the next action explicit. Event and Activity detail includes reverse Work associations, Activity endpoints, and all declared planning fields without creating per-Work copies. Human detail omits source-span and raw-candidate noise; use --format json for the complete stable machine result and source spans.",
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
  Object.freeze({
    id: "final-goal-boundary",
    title: "Final Goal boundary",
    body: "Remaining Work is advisory planning retention and does not block project.finish. Work and Window observations do not prove Final Milestone Goal obligation coverage, goal completion, or objective achievement. Projection changes execution scope only through an explicit governed strict-DAG candidate that is separately reviewed and persisted. GitHub Issue #24 (https://github.com/mako10k/perttool/issues/24) separately owns future Goal Obligation, Goal Coverage, and Goal Seal semantics; the current Planning Pool infers and seals none of them.",
  }),
  Object.freeze({
    id: "retained-work-example",
    title: "Final Milestone acceptance with retained Work",
    body: "A team may accept the Final Milestone for its strict MVP DAG while retaining Work named Add offline export. Those two facts can coexist. They do not say that export is unnecessary, that a Window objective was achieved, or that the Final Goal is covered or complete. To add export to execution scope, explicitly project it and review the governed strict-DAG candidate.",
  }),
]);

const planningPoolSyntax = Object.freeze([
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
]);

const planningPoolExamples = Object.freeze([
  Object.freeze({
    id: "intent-preflight",
    title: "Audit one routine intent",
    text: "perttool work reshape preflight plan.pert --intent-request intent.json --format json",
  }),
  Object.freeze({
    id: "window-observation",
    title: "Observe a Window",
    text: "perttool window observe plan.pert --request observation.json",
  }),
  Object.freeze({
    id: "entity-inspection",
    title: "Inspect project-owned planning entities",
    text: "perttool event show plan.pert EVENT && perttool activity show plan.pert ACTIVITY",
  }),
]);

const planningPoolRelated = Object.freeze([
  "syntax",
  "editing",
  "plan-assurance",
  "historical-dag",
  "milestone-acceptance",
]);

function getPlanningPoolGuide(level: HelpLevel): Contract10GuideResult {
  return Object.freeze({
    schemaVersion: "Perttool.GuideResult.v1",
    cliContractVersion: 10,
    toolVersion: TOOL_VERSION,
    operation: "guide",
    ok: true,
    topicId: topic.id,
    level,
    title: topic.title,
    summary: topic.summary,
    sections: level === "index" ? Object.freeze([]) : planningPoolSections,
    syntax: level === "index" ? Object.freeze([]) : planningPoolSyntax,
    examples: level === "detail" ? planningPoolExamples : Object.freeze([]),
    related: level === "index" ? Object.freeze([]) : planningPoolRelated,
    topics: Object.freeze([]),
    diagnostics: Object.freeze([]),
  });
}

export function getContract10Guide(
  topicId: string | null,
  level: HelpLevel,
): Contract10GuideResult {
  if (topicId === topic.id) return getPlanningPoolGuide(level);
  const base = applyContract10Syntax(
    getContract9Guide(topicId, level),
    topicId,
  );
  return Object.freeze({
    ...base,
    cliContractVersion: 10,
    topics: topicId === null
      ? Object.freeze([...base.topics, topic])
      : base.topics,
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
