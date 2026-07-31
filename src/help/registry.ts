import type { Diagnostic } from "../model/diagnostics.js";

export type HelpLevel = "index" | "quick" | "detail";

export interface HelpSection {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export interface HelpExample {
  readonly id: string;
  readonly title: string;
  readonly text: string;
}

export interface HelpNode {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly quick: readonly HelpSection[];
  readonly detail: readonly HelpSection[];
  readonly syntax: readonly string[];
  readonly examples: readonly HelpExample[];
  readonly related: readonly string[];
}

export interface HelpResult {
  readonly ok: boolean;
  readonly topicId: string | null;
  readonly level: HelpLevel;
  readonly title: string;
  readonly summary: string;
  readonly sections: readonly HelpSection[];
  readonly syntax: readonly string[];
  readonly examples: readonly HelpExample[];
  readonly related: readonly string[];
  readonly topics: readonly Pick<HelpNode, "id" | "title" | "summary">[];
  readonly diagnostics: readonly Diagnostic[];
}

const nodes: readonly HelpNode[] = [
  {
    id: "syntax",
    title: "DSL syntax",
    summary: "Grammar versions 1 through 5 for declaring projects, governance metadata, resources, milestones, tasks, gates, and explicit task work events.",
    quick: [
      {
        id: "declarations",
        title: "Declarations",
        body: "Place exactly one project first, followed by resource, milestone, task, gate, and Grammar 5 work-event declarations.",
      },
    ],
    detail: [
      {
        id: "indentation",
        title: "Indentation",
        body: "Fields use 2 spaces; child fields in estimate and requires use 4 spaces. Tabs are not allowed.",
      },
    ],
    syntax: [
      "project ID:",
      "milestone ID:",
      "task ID FROM -> TO:",
      "gate ID FROM -> TO:",
      "resource ID:",
      "work_event ID:",
    ],
    examples: [
      {
        id: "minimal",
        title: "Minimal document",
        text: "docs/examples/minimal.pert",
      },
    ],
    related: [
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
    ],
  },
  {
    id: "syntax.project",
    title: "Project syntax",
    summary: "The exactly-one project declaration at the start of a document.",
    quick: [
      {
        id: "required",
        title: "Required fields",
        body: "title, duration_unit, and finish are required. Point documents also require a positive velocity.",
      },
    ],
    detail: [
      {
        id: "version",
        title: "Grammar version",
        body: "An omitted version is treated as 1. Version 2 adds temporal fields; version 3 additionally accepts exact Fraction Duration; version 4 adds declared goal/DAG owners and delegates.",
      },
    ],
    syntax: [
      "project ID:",
      "  title \"...\"",
      "  duration_unit day|hour|point",
      "  finish MILESTONE_ID",
    ],
    examples: [
      { id: "minimal", title: "Minimal project", text: "docs/examples/minimal.pert" },
    ],
    related: ["syntax", "syntax.duration", "syntax.velocity", "syntax.temporal", "syntax.text"],
  },
  {
    id: "syntax.resource",
    title: "Resource syntax",
    summary: "Declares a renewable resource and its integer capacity for concurrent use.",
    quick: [
      {
        id: "capacity",
        title: "Capacity",
        body: "title and a capacity of at least 1 are required. Tasks reference the resource ID from requires.",
      },
    ],
    detail: [],
    syntax: ["resource ID:", "  title \"...\"", "  capacity 1"],
    examples: [
      { id: "parallel", title: "Resource declarations", text: "docs/examples/parallel.pert" },
    ],
    related: ["syntax", "syntax.task", "syntax.tags", "syntax.text", "analysis.resources"],
  },
  {
    id: "syntax.milestone",
    title: "Milestone syntax",
    summary: "Declares an AoA node and its reached state in the current frontier.",
    quick: [
      {
        id: "state",
        title: "Milestone state",
        body: "title is required. state is planned or reached; ready is derived from dependencies and is not stored.",
      },
    ],
    detail: [],
    syntax: ["milestone ID:", "  title \"...\"", "  state reached"],
    examples: [
      { id: "minimal", title: "Reached frontier", text: "docs/examples/minimal.pert" },
    ],
    related: ["syntax", "syntax.task", "syntax.gate", "syntax.temporal", "syntax.tags", "syntax.text"],
  },
  {
    id: "syntax.task",
    title: "Task syntax",
    summary: "A task is an AoA edge connecting milestones.",
    quick: [
      {
        id: "required",
        title: "Required fields",
        body: "Specify title and exactly one of duration or estimate.",
      },
    ],
    detail: [
      {
        id: "resources",
        title: "Resources",
        body: "All resources in the requires block are acquired together and held until the task completes.",
      },
    ],
    syntax: ["task ID FROM -> TO:", "  title \"...\"", "  duration 1d"],
    examples: [
      { id: "minimal", title: "Deterministic task", text: "docs/examples/minimal.pert" },
    ],
    related: [
      "syntax",
      "syntax.duration",
      "syntax.estimate",
      "syntax.resource",
      "syntax.text",
      "syntax.tags",
      "analysis.resources",
      "syntax.temporal",
    ],
  },
  {
    id: "syntax.work-event",
    title: "Work-event syntax",
    summary: "Grammar 5 records explicit task-owned lifecycle evidence in the same PERT document.",
    quick: [
      {
        id: "identity",
        title: "Event identity and time",
        body: "Each work_event has model 1, a task reference, one lifecycle kind, and an explicit fixed-offset occurred_at date-time. Stable event IDs make identical retries deterministic.",
      },
    ],
    detail: [
      {
        id: "kind-fields",
        title: "Kind-specific fields",
        body: "start records planned_value. suspend may record reason. finish may record active_time in hours and effort in person-hours. Fields forbidden for a kind fail validation.",
      },
      {
        id: "sequence",
        title: "Lifecycle sequence",
        body: "A complete sequence starts, may alternate suspend and resume, and finishes once. The stored task state and event-derived state must agree.",
      },
    ],
    syntax: [
      "work_event ID:",
      "  model 1",
      "  task TASK_ID",
      "  kind start|suspend|resume|finish",
      "  occurred_at DATE_TIME",
      "  planned_value DURATION",
      "  active_time HOURS",
      "  effort PERSON_HOURS",
      "  reason \"...\"",
    ],
    examples: [
      {
        id: "project-actuals",
        title: "Complete lifecycle",
        text: "docs/examples/project-actuals.md",
      },
    ],
    related: ["actuals", "syntax.task", "syntax.duration", "editing"],
  },
  {
    id: "syntax.gate",
    title: "Gate syntax",
    summary: "Connects milestones with a zero-duration dependency edge.",
    quick: [
      {
        id: "reason",
        title: "Reason",
        body: "reason is required. A gate requires no resources and has no task duration.",
      },
    ],
    detail: [],
    syntax: ["gate ID FROM -> TO:", "  reason \"...\""],
    examples: [
      {
        id: "point-velocity",
        title: "Dependency gates",
        text: "docs/examples/point-velocity.pert",
      },
    ],
    related: ["syntax", "syntax.milestone", "syntax.text"],
  },
  {
    id: "syntax.estimate",
    title: "PERT estimate syntax",
    summary: "Specifies a three-point estimate: optimistic, most_likely, and pessimistic.",
    quick: [
      {
        id: "order",
        title: "Ordering constraint",
        body: "optimistic <= most_likely <= pessimistic and pessimistic > 0 are required.",
      },
    ],
    detail: [
      {
        id: "unit",
        title: "Duration unit",
        body: "All three values use the same suffix, matching the project duration_unit (day/hour/point).",
      },
    ],
    syntax: [
      "  estimate:",
      "    optimistic 1d",
      "    most_likely 2d",
      "    pessimistic 4d",
    ],
    examples: [
      {
        id: "pert-estimate",
        title: "Three-point estimate",
        text: "docs/examples/pert-estimate.pert",
      },
    ],
    related: ["syntax.duration", "analysis"],
  },
  {
    id: "syntax.duration",
    title: "Duration syntax",
    summary: "An exact Decimal or, in Grammar 3, reduced Fraction followed by d, h, or p.",
    quick: [],
    detail: [],
    syntax: ["1d", "2.5h", "3p", "1/3d", "0d"],
    examples: [],
    related: ["syntax.estimate", "syntax.velocity", "analysis"],
  },
  {
    id: "syntax.temporal",
    title: "Temporal syntax",
    summary: "Grammar 2 and 3 add milestone deadline plus task not_before and deadline fields.",
    quick: [
      {
        id: "anchor",
        title: "Explicit anchor",
        body: "Any deadline or not_before requires project.as_of. Date and offset date-time values remain distinct, and perttool never invents a clock or host time zone.",
      },
    ],
    detail: [
      {
        id: "semantics",
        title: "Temporal meaning",
        body: "not_before is a release constraint for a new task start. Deadlines are desired completion or reach times, not dependency edges or hard caps. Mixed valid calendar kinds remain source-valid but may make a projection unavailable.",
      },
    ],
    syntax: [
      "project ID:",
      "  version 2|3",
      "  as_of DATE|OFFSET_DATE_TIME",
      "milestone ID:",
      "  deadline DATE|OFFSET_DATE_TIME",
      "task ID FROM -> TO:",
      "  not_before DATE|OFFSET_DATE_TIME",
      "  deadline DATE|OFFSET_DATE_TIME",
    ],
    examples: [
      {
        id: "temporal-units",
        title: "Normative temporal examples",
        text: "docs/examples/temporal-units.md",
      },
    ],
    related: ["syntax.project", "syntax.task", "syntax.milestone", "analysis.temporal", "editing"],
  },
  {
    id: "syntax.velocity",
    title: "Velocity syntax",
    summary: "Specifies the project-wide velocity for converting between points and days or hours.",
    quick: [
      {
        id: "forecast",
        title: "Velocity forecast",
        body: "duration_unit point requires velocity. PERT values are calculated in p and converted values are returned separately as a velocity forecast.",
      },
    ],
    detail: [
      {
        id: "units",
        title: "Units",
        body: "Use the form 20p/10d or 20p/80h. The relationship between day and hour is not inferred implicitly.",
      },
      {
        id: "scope",
        title: "MVP scope",
        body: "velocity is constant across the project. Per-team, per-resource, and time-varying velocity are outside the MVP scope.",
      },
    ],
    syntax: [
      "project ID:",
      "  duration_unit point",
      "  velocity 20p/10d",
    ],
    examples: [
      {
        id: "point-velocity",
        title: "Point estimate and velocity forecast",
        text: "docs/examples/point-velocity.pert",
      },
    ],
    related: ["syntax.duration", "syntax.estimate", "analysis"],
  },
  {
    id: "syntax.indentation",
    title: "Indentation",
    summary: "Structural indentation uses ASCII spaces only.",
    quick: [],
    detail: [],
    syntax: ["field: 2 spaces", "nested field: 4 spaces"],
    examples: [],
    related: ["syntax"],
  },
  {
    id: "syntax.string",
    title: "String syntax",
    summary: "Uses double-quoted text with the same rules as a JSON string literal.",
    quick: [],
    detail: [
      {
        id: "unicode",
        title: "Unicode and escapes",
        body: "Unicode may be written directly, and escapes use JSON syntax. Unpaired surrogates are not accepted.",
      },
    ],
    syntax: ["\"text\"", "\"\\u65e5\\u672c\""],
    examples: [],
    related: ["syntax", "syntax.text", "syntax.tags"],
  },
  {
    id: "syntax.text",
    title: "Text field syntax",
    summary: "description, blocked_reason, and reason accept a String or block text.",
    quick: [],
    detail: [
      {
        id: "block",
        title: "Block text",
        body: "Removes the common indent from nonblank content while preserving paragraph blanks and remaining indentation.",
      },
    ],
    syntax: ["  description \"...\"", "  description |", "    first line"],
    examples: [],
    related: ["syntax", "syntax.string", "syntax.comments"],
  },
  {
    id: "syntax.tags",
    title: "Tag list syntax",
    summary: "A comma-separated list of bare Identifiers or Strings in square brackets.",
    quick: [],
    detail: [],
    syntax: ["  tags [alpha, \"two words\"]", "  tags []"],
    examples: [],
    related: ["syntax", "syntax.string"],
  },
  {
    id: "syntax.comments",
    title: "Comment syntax",
    summary: "Preserves # and the following text on standalone lines as CST trivia.",
    quick: [
      {
        id: "standalone",
        title: "Standalone only",
        body: "Grammar version 1 does not allow inline comments. # within a String or block text is content.",
      },
    ],
    detail: [],
    syntax: ["# top-level comment", "  # field comment"],
    examples: [],
    related: ["syntax", "syntax.text"],
  },
  {
    id: "syntax.top-level",
    title: "Top-level declaration syntax",
    summary: "Place the project declaration at the start of the document and begin every declaration at column 0.",
    quick: [],
    detail: [],
    syntax: [
      "project ID:",
      "resource ID:",
      "milestone ID:",
      "task ID FROM -> TO:",
      "gate ID FROM -> TO:",
    ],
    examples: [
      { id: "minimal", title: "Top-level declarations", text: "docs/examples/minimal.pert" },
    ],
    related: ["syntax", "syntax.project", "syntax.indentation"],
  },
  {
    id: "analysis",
    title: "Analysis",
    summary: "Returns PERT/CPM precedence results separately from the resource schedule.",
    quick: [
      {
        id: "results",
        title: "Separated results",
        body: "The precedence makespan is a lower bound that ignores resources; the resource makespan is a deterministic heuristic result that respects capacity.",
      },
    ],
    detail: [
      {
        id: "exact",
        title: "Exact arithmetic",
        body: "expected, variance, float, and makespan use exact Rational arithmetic; only display values are rounded with --precision. Point documents also convert velocity forecasts exactly.",
      },
      {
        id: "paths",
        title: "Critical paths",
        body: "Distinguishes the near-critical subgraph from exact driving paths, and returns the path count independently of the enumeration limit.",
      },
    ],
    syntax: [
      "perttool dag analyze FILE [--schedule precedence|resource|both]",
      "  [--capacity RESOURCE=COUNT]... [--max-paths 0..1000] [--precision 0..9]",
    ],
    examples: [
      {
        id: "parallel-analysis",
        title: "Precedence and resource schedule",
        text: "perttool dag analyze docs/examples/parallel.pert",
      },
    ],
    related: ["analysis.resources", "analysis.temporal", "next"],
  },
  {
    id: "analysis.resources",
    title: "Resource analysis",
    summary: "A deterministic heuristic schedule that respects renewable capacity.",
    quick: [
      {
        id: "capacity",
        title: "Capacity override",
        body: "--capacity is a what-if input and does not rewrite the source document.",
      },
    ],
    detail: [
      {
        id: "algorithm",
        title: "parallel-sgs v1",
        body: "Scans candidates by priority, precedence float, expected duration, and task ID. optimal=false.",
      },
      {
        id: "witness",
        title: "Resource witness",
        body: "Resource waits are explained by analysis-only resource arcs from releasing tasks to starting tasks and are not stored in the authoritative DAG.",
      },
    ],
    syntax: [
      "perttool dag analyze FILE --capacity RESOURCE=COUNT",
      "perttool dag analyze FILE --schedule resource --format json",
    ],
    examples: [
      {
        id: "parallel-capacity",
        title: "Capacity what-if",
        text: "perttool dag analyze docs/examples/parallel.pert --capacity DEVELOPERS=3",
      },
    ],
    related: ["analysis", "next"],
  },
  {
    id: "analysis.temporal",
    title: "Temporal analysis",
    summary: "Projects exact calendar schedules and deadline states separately for precedence and heuristic resources.",
    quick: [
      {
        id: "views",
        title: "Separate views",
        body: "AnalysisResult v3 retains base analysis and adds temporal precedence, temporal resource, and deadline evaluations. The resource view remains heuristic and optimal=false.",
      },
    ],
    detail: [
      {
        id: "availability",
        title: "Unavailable causes",
        body: "Missing or incomparable calendar relationships, Point/time conversion limits, completed history, and unresolved blocks remain explicit states and causes rather than guessed values.",
      },
      {
        id: "ranking",
        title: "Ranking boundary",
        body: "Deadline facts are informational for Recommendation version 1. NextResult v4 applies not_before only as a separate release gate after recommendation.",
      },
    ],
    syntax: [
      "perttool dag analyze FILE --format json",
      "perttool dag next FILE --format json",
    ],
    examples: [
      {
        id: "temporal-units",
        title: "Temporal and deadline cases",
        text: "docs/examples/temporal-units.md",
      },
    ],
    related: ["analysis", "analysis.resources", "next", "syntax.temporal"],
  },
  {
    id: "next",
    title: "Next tasks",
    summary: "Returns NextResult.v5 recommendations, temporal start authority, and active, ready, runnable_now, blocked_now, and upcoming tasks.",
    quick: [
      {
        id: "classification",
        title: "Task classification",
        body: "ready consists of planned tasks whose dependencies permit them to start; runnable_now is the subset of ready tasks that can start concurrently after accounting for current active allocations.",
      },
      {
        id: "recommendation",
        title: "Recommendation authority",
        body: "recommendation classifies ready tasks as recommended, allowed, deferred, or discouraged. The recommended set can start concurrently, but is heuristic and optimal=false.",
      },
    ],
    detail: [
      {
        id: "consumer-safety",
        title: "Machine-readable explanation",
        body: "--format json returns a complete Perttool.NextResult.v5 with the unchanged Recommendation version 1 explanation graph and a separate temporal release gate. Consumers validate every identity and do not start when decisive or temporal authority is unknown.",
      },
      {
        id: "authority-adoption",
        title: "AI task selection authority",
        body: "AI uses only a known Perttool.NextResult.v5 from --format json, Recommendation interface 1, ranking algorithm 1, reason taxonomy 1.0, explanation/expression/description model 1, locale en, a complete non-truncated trace, and temporal policy recommendation_v1_plus_release_gate. Start only IDs in startable_recommended_task_ids. Stop for unknown, incomplete, malformed, future, or unavailable authority, PTREC diagnostics, and deferred or discouraged selections. Reanalyze after task-state or capacity changes.",
      },
      {
        id: "selection",
        title: "Resource selection",
        body: "runnable_now is an operational subset selected by the existing scheduler order, while recommendation is the authority selected by a versioned ranking policy; they are not necessarily the same set. The CLI renderer does not reimplement ranking.",
      },
      {
        id: "override-validation",
        title: "Human override validation",
        body: "The public Core validateOverride deterministically produces Perttool.OverrideDecision.v1 from a complete NextResult.v5 and an explicit request, and cannot bypass a future or unavailable temporal release gate. This is read-only validation and does not change task state, files, Git, or the network.",
      },
      {
        id: "explanation",
        title: "Upcoming explanation",
        body: "upcoming returns unreached starting milestones and unsatisfied incoming edges. --explain-depth is 0..32; the default is 1.",
      },
    ],
    syntax: [
      "perttool dag next FILE [--capacity RESOURCE=COUNT]...",
      "  [--explain-depth 0..32] [--precision 0..9] [--format text|json]",
    ],
    examples: [
      {
        id: "parallel-next",
        title: "Complete recommendation graph",
        text: "perttool dag next docs/examples/parallel.pert --format json",
      },
    ],
    related: ["analysis", "analysis.resources", "analysis.temporal"],
  },
  {
    id: "editing",
    title: "Safe editing",
    summary: "Preview document formatting, project/task/gate/milestone/resource mutations, atomic batches, and DAG advancement, then safely write validated candidates.",
    quick: [
      {
        id: "current-surface",
        title: "Current surface",
        body: "project show returns project metadata read-only. project init creates the smallest valid candidate without writing by default. document format projects planFormat; project/entity commands and batch apply project planMutation; and dag advance projects the revalidated candidate from planAdvance, UTF-16 TextEdits, digest, and diff as text/JSON. Direct gate add/set/remove commands and connected atomic batches use the same preview-first mutation path. The default is a preview that does not modify files.",
      },
    ],
    detail: [
      {
        id: "write-gate",
        title: "Safe write",
        body: "--write atomically replaces a file after comparing the initial-read digest with the digest immediately before writing; --expect-digest adds a caller lock. --out creates a new target without overwriting an existing one. --diff is for previews only.",
      },
      {
        id: "advance-history",
        title: "Advance history safety",
        body: "A changed in-place dag advance proves every removed or replaced entity range against the target path in HEAD and the stage-0 index. Dirty ranges retained by the candidate are allowed; destructive uncommitted overlap or unavailable proof emits PTADV-101 and does not write. A source, HEAD, or stage-0-index race after assessment emits PTADV-102, returns exit 5, and does not write. The result reports modification time, byte and diff counts, entity IDs, and supplemental digests. --force-history-loss bypasses only that initial block for the exact request, emits PTADV-103, and remains subject to governance, warning, digest, race, and atomic-write controls.",
      },
    ],
    syntax: [
      "perttool project init PROJECT_ID --title TITLE --duration-unit UNIT --initial-milestone ID --initial-milestone-title TITLE --finish ID [--out PATH]",
      "perttool project show FILE [--format text|json]",
      "perttool project set FILE [--velocity VELOCITY]... [--write [--expect-digest DIGEST] | --out PATH]",
      "perttool document format FILE [--check] [--diff] [--write [--expect-digest DIGEST] | --out PATH]",
      "perttool task add|set|remove|finish ... [--write [--expect-digest DIGEST] | --out PATH]",
      "perttool gate add|set|remove ... [--write [--expect-digest DIGEST] | --out PATH]",
      "perttool milestone add|set|remove ... [--write [--expect-digest DIGEST] | --out PATH]",
      "perttool resource add|set|remove ... [--write [--expect-digest DIGEST] | --out PATH]",
      "perttool batch apply FILE --request REQUEST.json [--write [--expect-digest DIGEST] | --out PATH]",
      "perttool dag advance FILE [--diff] [--write [--expect-digest DIGEST] [--force-history-loss] | --out PATH]",
    ],
    examples: [
      {
        id: "project-velocity",
        title: "Inspect and preview velocity",
        text: "perttool project show plan.pert --format json\nperttool project set plan.pert --velocity 20p/1d --diff",
      },
      {
        id: "task-preview",
        title: "Preview a task update",
        text: "perttool task set plan.pert TASK_ID --status active --diff",
      },
      {
        id: "task-write",
        title: "Commit a reviewed task update",
        text: "perttool task set plan.pert TASK_ID --status active --write --expect-digest sha256:<64 lowercase hex digits>",
      },
      {
        id: "advance-write",
        title: "Advance committed history",
        text: "perttool dag advance plan.pert --diff\nperttool dag advance plan.pert --write --expect-digest sha256:<64 lowercase hex digits>",
      },
    ],
    related: ["editing.unit-migration", "syntax.temporal", "workflows"],
  },
  {
    id: "editing.unit-migration",
    title: "Exact unit migration",
    summary: "Migrates the complete Duration inventory between Point and matching day or hour units.",
    quick: [
      {
        id: "directions",
        title: "Exact directions",
        body: "Supported directions are point to day or hour and the matching time unit back to point. A declared or explicit replacement velocity supplies the exact relationship; day-to-hour is never inferred.",
      },
    ],
    detail: [
      {
        id: "safety",
        title: "Preview and safe write",
        body: "project migrate-unit previews by default, preserves every absolute temporal token, validates one complete candidate, and shares diff, write, out, digest-lock, race, symlink, and post-write checks with ordinary mutations.",
      },
      {
        id: "batch",
        title: "Batch exclusion and reversibility",
        body: "Automatic migration is not a batch.apply member. UnitMigrationResult v3 reports exact converted records, grammar and velocity dispositions, qualifications, and whether values and metadata are reversible.",
      },
    ],
    syntax: [
      "perttool project migrate-unit FILE --to-unit day|hour|point [--replacement-velocity VELOCITY]",
      "  [--diff] [--write [--expect-digest DIGEST] | --out PATH]",
    ],
    examples: [
      {
        id: "point-to-day",
        title: "Preview Point-to-day migration",
        text: "perttool project migrate-unit plan.pert --to-unit day --diff",
      },
    ],
    related: ["editing", "syntax.duration", "syntax.velocity", "syntax.temporal"],
  },
  {
    id: "actuals",
    title: "Task actuals and lifecycle",
    summary: "Records explicit start, suspend, resume, and finish evidence and reads qualified Git-recorded project history.",
    quick: [
      {
        id: "explicit-events",
        title: "Explicit lifecycle evidence",
        body: "Grammar 5 work events are task-owned evidence. task start, suspend, resume, and eventful finish require an explicit --at value; no command reads the wall clock. Preview, governance, digest, and safe-write controls apply before persistence.",
      },
      {
        id: "read-only-observation",
        title: "Read-only history and observation",
        body: "project history reconstructs first-parent evidence without changing Git. project observe-velocity reports exact, qualified candidates separately from project.velocity and never adopts one automatically.",
      },
    ],
    detail: [
      {
        id: "legacy-status",
        title: "Legacy status compatibility",
        body: "Grammar 1 through 4 retain status-only task finish. In Grammar 5, eventless legacy tasks may use direct planned, active, blocked, or done status changes; once a work event exists, lifecycle commands are required and suspended remains distinct from blocked.",
      },
      {
        id: "advance-ownership",
        title: "Advance ownership",
        body: "dag advance removes work events owned by removed done tasks. Commit the exact pre-advance task and event snapshot before applying advance so read-only history can reconstruct the evidence.",
      },
    ],
    syntax: [
      "perttool task start FILE TASK --at DATE_TIME [--event-id ID]",
      "perttool task suspend FILE TASK --at DATE_TIME [--event-id ID] [--reason TEXT]",
      "perttool task resume FILE TASK --at DATE_TIME [--event-id ID]",
      "perttool task finish FILE TASK --at DATE_TIME [--event-id ID] [--active-time HOURS] [--effort PERSON_HOURS]",
      "perttool project history FILE [--rev REV] [--task TASK]...",
      "perttool project observe-velocity FILE [--rev REV] [--task TASK]... [--evidence declared|git-recorded|all]",
    ],
    examples: [
      {
        id: "complete-lifecycle",
        title: "Record and inspect a complete lifecycle",
        text: "perttool task start plan.pert WORK --at 2026-07-29T09:00:00+09:00 --write\nperttool task finish plan.pert WORK --at 2026-07-29T17:00:00+09:00 --active-time 8 --effort 8 --write\nperttool project history plan.pert --task WORK --format json",
      },
    ],
    related: ["editing", "analysis", "next", "syntax"],
  },
  {
    id: "mermaid",
    title: "Mermaid conversion",
    summary: "Round-trip a lossless Mermaid profile with dag render and dag import, and explicitly report plain-import loss.",
    quick: [
      {
        id: "authority",
        title: "Profile authority",
        body: "%% perttool: semantic records are the authoritative source for restoring the normalized DSL semantic model; flowchart nodes and edges are a human-facing projection.",
      },
    ],
    detail: [
      {
        id: "fidelity",
        title: "Lossless boundary",
        body: "Lossless means normalized semantic equivalence for grammar v1. Byte identity for comments, blank lines, field/declaration order, escape spelling, and line endings is out of scope.",
      },
      {
        id: "integrity",
        title: "Fail-closed validation",
        body: "Validates canonical JSON records, record count, metadata/projection SHA-256 values, and node/edge correspondence. Corruption detected after a profile header is not silently downgraded to plain import.",
      },
      {
        id: "availability",
        title: "Current availability",
        body: "The exportMermaid/importMermaid Core and dag render/import are available. The perttool profile fail-closed validates restoration metadata, and plain import/export returns stable PTCNV losses. SVG and JSON targets are later slices.",
      },
    ],
    syntax: [
      "perttool dag render <file> --to mermaid",
      "  [--profile perttool|plain] [--analysis none|precedence|resource|both]",
      "  [--capacity <resource-id>=<integer>]... [--strict-loss] [--out <path>]",
      "  [--max-diagnostics <integer>] [--warnings-as-errors] [--format text|json]",
      "perttool dag import <file> --from mermaid",
      "  [--strict-loss] [--out <path>] [--max-diagnostics <integer>]",
      "  [--warnings-as-errors] [--format text|json]",
    ],
    examples: [
      {
        id: "mermaid-profile",
        title: "Normative profile",
        text: "docs/examples/mermaid-profile.md",
      },
    ],
    related: ["syntax", "analysis"],
  },
  {
    id: "workflows",
    title: "Workflows",
    summary: "Operate in the order check, analyze, next, preview, and Git commit.",
    quick: [],
    detail: [],
    syntax: [],
    examples: [],
    related: ["editing", "analysis", "next"],
  },
  {
    id: "errors",
    title: "Diagnostics",
    summary: "Reports problems with stable codes, source spans, and local help topics.",
    quick: [
      {
        id: "recovery",
        title: "Error recovery",
        body: "Returns multiple independent syntax errors where possible, and suppresses child lines in the same invalid block as one error region.",
      },
    ],
    detail: [
      {
        id: "phases",
        title: "Phase suppression",
        body: "For documents with parse errors, field/graph validation does not run, so derived PTSEM/PTDAG diagnostics are not returned before the cause is fixed.",
      },
      {
        id: "limit",
        title: "Diagnostic limit",
        body: "--max-diagnostics is 1..1000, with a default of 100. diagnostics_truncated indicates when the limit is exceeded.",
      },
    ],
    syntax: [
      "perttool document check FILE --max-diagnostics 20 --format json",
      "perttool dag analyze FILE --max-diagnostics 20 --format json",
      "perttool dag next FILE --max-diagnostics 20 --format json",
    ],
    examples: [],
    related: ["syntax"],
  },
  {
    id: "samples",
    title: "Samples",
    summary: "Lists the repository's normative sample IDs.",
    quick: [],
    detail: [],
    syntax: [],
    examples: [
      { id: "minimal", title: "Minimal", text: "docs/examples/minimal.pert" },
      { id: "point-velocity", title: "Point and velocity", text: "docs/examples/point-velocity.pert" },
      { id: "parallel", title: "Resources", text: "docs/examples/parallel.pert" },
    ],
    related: ["syntax", "analysis"],
  },
];

const byId = new Map(nodes.map((node) => [node.id, node]));

export function getHelp(topicId: string | null, level: HelpLevel): HelpResult {
  if (topicId === null) {
    return {
      ok: true,
      topicId: null,
      level: "index",
      title: "perttool DSL help",
      summary: "Select a topic to use.",
      sections: [],
      syntax: [],
      examples: [],
      related: [],
      topics: nodes
        .filter((node) => !node.id.includes("."))
        .map(({ id, title, summary }) => ({ id, title, summary })),
      diagnostics: [],
    };
  }
  const node = byId.get(topicId);
  if (node === undefined) {
    return {
      ok: false,
      topicId,
      level,
      title: "Unknown help topic",
      summary: "The specified help topic does not exist.",
      sections: [],
      syntax: [],
      examples: [],
      related: [],
      topics: [],
      diagnostics: [
        {
          code: "PTHLP-001",
          severity: "error",
          message: `unknown help topic: ${topicId}`,
          helpTopic: "syntax",
        },
      ],
    };
  }
  return {
    ok: true,
    topicId: node.id,
    level,
    title: node.title,
    summary: node.summary,
    sections: level === "index" ? [] : level === "quick" ? node.quick : [...node.quick, ...node.detail],
    syntax: level === "index" ? [] : node.syntax,
    examples: level === "detail" ? node.examples : [],
    related: level === "index" ? [] : node.related,
    topics: [],
    diagnostics: [],
  };
}
