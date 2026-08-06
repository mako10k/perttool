import { TOOL_VERSION } from "../version.js";
import {
  guideResultToJson,
  renderGuideResult,
  type GuideProjectionResult,
} from "./guide.js";
import type {
  HelpExample,
  HelpLevel,
  HelpSection,
} from "./registry.js";
import { getActualsGuide } from "./actuals-guide.js";

export interface AssuranceGuideResult extends GuideProjectionResult {
  readonly cliContractVersion: 7;
}

const topic = Object.freeze({
  id: "plan-assurance",
  title: "Conditional plan assurance",
  summary: "Verifies whether accepted task plans still match their recursive planning basis.",
});

const historicalTopic = Object.freeze({
  id: "historical-dag",
  title: "Historical DAG reconstruction",
  summary: "Reconstructs exact snapshots, proved lineage, or an ordered first-parent timeline from immutable Git evidence.",
});

const historicalQuick: readonly HelpSection[] = Object.freeze([
  Object.freeze({
    id: "bounds-and-view",
    title: "Bounds and view",
    body: "dag history binds one on-disk file, an inclusive --rev endpoint, and an optional inclusive --base first-parent boundary. snapshot selects one exact checkpoint, lineage includes retired topology only after proved canonical advance, and timeline preserves ordered epochs and gaps.",
  }),
  Object.freeze({
    id: "safe-reading",
    title: "Safe reading",
    body: "The command reads committed Git objects only. It does not use current worktree bytes as historical evidence, mutate a source, index or ref, or grant task, governance, assurance, or write authority.",
  }),
]);

const historicalDetail: readonly HelpSection[] = Object.freeze([
  Object.freeze({
    id: "analysis",
    title: "Checkpoint-bound analysis",
    body: "--analysis none, precedence, resource, or both is independent of the selected view. Analysis runs against one valid selected or endpoint checkpoint, never against cumulative lineage or a union of timeline epochs.",
  }),
  Object.freeze({
    id: "navigation",
    title: "Immutable source bindings",
    body: "Every historical source range is bound to repository, relative path, commit, blob, source digest, and UTF-16 range evidence. Consumers must verify all bindings before opening historical bytes.",
  }),
  Object.freeze({
    id: "three-way",
    title: "Three-way deferral",
    body: "--history three-way fails closed with PTHDG-106 in model 1 and performs no side-lane inspection. Semantic merge remains a separate SCM-001 decision.",
  }),
]);

const historicalExamples: readonly HelpExample[] = Object.freeze([
  Object.freeze({
    id: "lineage",
    title: "Inspect proved lineage",
    text: "perttool dag history plan.pert --rev HEAD --history first-parent --view lineage --analysis none --format json",
  }),
  Object.freeze({
    id: "snapshot",
    title: "Inspect one listed checkpoint",
    text: "perttool dag history plan.pert --view snapshot --snapshot 0123456789012345678901234567890123456789 --analysis both --format json",
  }),
]);

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

const examples: readonly HelpExample[] = Object.freeze([
  Object.freeze({
    id: "inspect",
    title: "Inspect current assurance",
    text: "perttool plan-assurance show plan.pert --format json",
  }),
  Object.freeze({
    id: "seal",
    title: "Preview an initial seal",
    text: "perttool plan-assurance seal plan.pert --reason \"Initial reviewed baseline\" --diff",
  }),
  Object.freeze({
    id: "reseal",
    title: "Preview a selected reseal",
    text: "perttool plan-assurance reseal plan.pert --task BUILD --reason \"Plan revised\" --diff",
  }),
]);

interface ActiveTopicOverride {
  readonly summary?: string;
  readonly sections?: Readonly<Record<string, string>>;
  readonly syntax?: readonly string[];
  readonly related?: readonly string[];
}

const activeTopicOverrides: Readonly<Record<string, ActiveTopicOverride>> =
  Object.freeze({
    syntax: Object.freeze({
      summary: "Grammar versions 1 through 6 for declaring projects, governance metadata, resources, milestones, tasks, gates, explicit task work events, and conditional plan-assurance records.",
      sections: Object.freeze({
        declarations: "Place exactly one project first, followed by resource, milestone, task, gate, and Grammar 5 work-event declarations. Grammar 6 additionally accepts task_relation, plan_seal, task_outcome, and assurance_receipt declarations.",
      }),
      related: Object.freeze([
        "syntax.project",
        "syntax.resource",
        "syntax.milestone",
        "syntax.task",
        "syntax.work-event",
        "syntax.gate",
        "syntax.estimate",
        "syntax.velocity",
        "syntax.temporal",
        "analysis",
        "errors",
        "plan-assurance",
      ]),
    }),
    "syntax.project": Object.freeze({
      sections: Object.freeze({
        version: "An omitted version is treated as 1. Version 2 adds temporal fields; version 3 additionally accepts exact Fraction Duration; version 4 adds declared goal and DAG owners and delegates; version 5 adds explicit task work events; and version 6 adds conditional plan-assurance records.",
      }),
    }),
    "syntax.work-event": Object.freeze({
      summary: "Grammar 5 introduces explicit task-owned lifecycle evidence in the same PERT document, and Grammar 6 retains it unchanged.",
    }),
    "syntax.duration": Object.freeze({
      summary: "An exact Decimal or, in Grammar 3 through 6, reduced Fraction followed by d, h, or p.",
    }),
    "syntax.temporal": Object.freeze({
      summary: "Grammar 2 introduces milestone deadline plus task not_before and deadline fields, retained through Grammar 6.",
      syntax: Object.freeze([
        "project ID:",
        "  version 2|3|4|5|6",
        "  as_of DATE|OFFSET_DATE_TIME",
        "milestone ID:",
        "  deadline DATE|OFFSET_DATE_TIME",
        "task ID FROM -> TO:",
        "  not_before DATE|OFFSET_DATE_TIME",
        "  deadline DATE|OFFSET_DATE_TIME",
      ]),
    }),
    analysis: Object.freeze({
      related: Object.freeze([
        "analysis.resources",
        "analysis.temporal",
        "next",
        "plan-assurance",
      ]),
    }),
    "analysis.temporal": Object.freeze({
      sections: Object.freeze({
        views: "AnalysisResult v5 retains base analysis and adds temporal precedence, temporal resource, deadline, lifecycle, and plan-assurance projections. The resource view remains heuristic and optimal=false.",
        ranking: "Deadline facts remain informational for Recommendation version 1. NextResult v6 applies not_before through a separate release gate and then composes conditional plan-assurance eligibility into the final start authority.",
      }),
    }),
    next: Object.freeze({
      summary: "Returns NextResult.v6 recommendations, temporal and plan-assurance start authority, and active, ready, runnable_now, blocked_now, and upcoming tasks.",
      sections: Object.freeze({
        "consumer-safety": "--format json returns a complete Perttool.NextResult.v6 with the unchanged Recommendation version 1 explanation graph, a separate temporal release gate, and conditional plan-assurance authority. Consumers validate every identity and do not start when recommendation, temporal, or assurance authority is unknown.",
        "authority-adoption": "AI uses only a known Perttool.NextResult.v6 from --format json, Recommendation interface 1, ranking algorithm 1, reason taxonomy 1.0, explanation/expression/description model 1, locale en, a complete non-truncated trace, and authority policy recommendation_v1_plus_release_gate_plus_plan_assurance_v1. Start only IDs in startable_recommended_task_ids. Stop for unknown, incomplete, malformed, future, unavailable, or assurance-withheld authority, safe-stop reasons, PTREC diagnostics, and deferred or discouraged selections. Reanalyze after task-state, capacity, temporal, relation, outcome, or assurance changes.",
        "override-validation": "The public Core validateOverride deterministically produces Perttool.OverrideDecision.v1 from a complete NextResult.v6 and an explicit request, and cannot bypass a future or unavailable temporal release gate or withheld plan-assurance authority. This is read-only validation and does not change task state, files, Git, or the network.",
      }),
      related: Object.freeze([
        "analysis",
        "analysis.resources",
        "analysis.temporal",
        "plan-assurance",
      ]),
    }),
    editing: Object.freeze({
      sections: Object.freeze({
        "owner-aware-governance": "Start each Contract 7 candidate with an assertion-free preview. Persistent governed changes require an actor: an effective owner or delegate has direct authority, while another actor may provide repeatable --accepted-by-owner caller assertions only for the explicitly confirmed affected scopes of this candidate. Omit them when governance is not applicable and never reuse them across commands. PTGOV-103 warns about an assertion on a not-applicable candidate; PTGOV-104 warns about one on a governed preview.",
      }),
      related: Object.freeze([
        "editing.unit-migration",
        "syntax.temporal",
        "workflows",
        "plan-assurance",
      ]),
    }),
    actuals: Object.freeze({
      sections: Object.freeze({
        "explicit-events": "Grammar 5 introduces task-owned work events, and Grammar 6 retains them unchanged. task start, suspend, resume, and eventful finish require an explicit --at value; no command reads the wall clock. Preview, governance, digest, and safe-write controls apply before persistence.",
        "legacy-status": "Grammar 1 through 4 retain status-only task finish. In Grammar 5 and 6, eventless legacy tasks may use direct planned, active, blocked, or done status changes; once a work event exists, lifecycle commands are required and suspended remains distinct from blocked.",
      }),
    }),
  });

function activeSections(
  topicId: string | null,
  sections: readonly HelpSection[],
): readonly HelpSection[] {
  if (topicId === null) return sections;
  const replacements = activeTopicOverrides[topicId]?.sections;
  if (replacements === undefined) return sections;
  return Object.freeze(sections.map((section) => Object.freeze({
    ...section,
    body: replacements[section.id] ?? section.body,
  })));
}

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
    examples: level === "detail" ? examples : Object.freeze([]),
    related: level === "index"
      ? Object.freeze([])
      : Object.freeze(["syntax", "editing", "analysis", "next"]),
    topics: Object.freeze([]),
    diagnostics: Object.freeze([]),
  });
}

function historical(level: HelpLevel): AssuranceGuideResult {
  return Object.freeze({
    schemaVersion: "Perttool.GuideResult.v1",
    cliContractVersion: 7,
    toolVersion: TOOL_VERSION,
    operation: "guide",
    ok: true,
    topicId: historicalTopic.id,
    level,
    title: historicalTopic.title,
    summary: historicalTopic.summary,
    sections: level === "index"
      ? Object.freeze([])
      : level === "quick"
        ? historicalQuick
        : Object.freeze([...historicalQuick, ...historicalDetail]),
    syntax: level === "index" ? Object.freeze([]) : Object.freeze([
      "perttool dag history <file> [--rev <endpoint>] [--base <lower-boundary>]",
      "  [--history first-parent|three-way] [--view snapshot|lineage|timeline]",
      "  [--snapshot <full-commit-id>] [--analysis none|precedence|resource|both]",
    ]),
    examples: level === "detail" ? historicalExamples : Object.freeze([]),
    related: level === "index"
      ? Object.freeze([])
      : Object.freeze(["analysis", "actuals", "plan-assurance"]),
    topics: Object.freeze([]),
    diagnostics: Object.freeze([]),
  });
}

export function getAssuranceGuide(
  topicId: string | null,
  level: HelpLevel,
): AssuranceGuideResult {
  if (topicId === "plan-assurance") return custom(level);
  if (topicId === "historical-dag") return historical(level);
  const base = getActualsGuide(topicId, level);
  const override = topicId === null
    ? undefined
    : activeTopicOverrides[topicId];
  return Object.freeze({
    ...base,
    cliContractVersion: 7,
    summary: override?.summary ?? base.summary,
    sections: activeSections(topicId, base.sections),
    syntax: override?.syntax ?? base.syntax,
    related: level === "index"
      ? base.related
      : override?.related ?? base.related,
    topics: topicId === null
      ? Object.freeze([
          ...base.topics.map((item) => Object.freeze({
            ...item,
            summary: activeTopicOverrides[item.id]?.summary ?? item.summary,
          })),
          topic,
          historicalTopic,
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
