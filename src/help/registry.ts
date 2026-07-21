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
    summary: "project、resource、milestone、task、gateを記述するgrammar version 1。",
    quick: [
      {
        id: "declarations",
        title: "Declarations",
        body: "projectを最初に1件置き、続けてresource、milestone、task、gateを記述します。",
      },
    ],
    detail: [
      {
        id: "indentation",
        title: "Indentation",
        body: "fieldは2 spaces、estimate/requiresの子fieldは4 spacesです。Tabは使用できません。",
      },
    ],
    syntax: [
      "project ID:",
      "milestone ID:",
      "task ID FROM -> TO:",
      "gate ID FROM -> TO:",
      "resource ID:",
    ],
    examples: [
      {
        id: "minimal",
        title: "Minimal document",
        text: "docs/examples/minimal.pert",
      },
    ],
    related: ["syntax.task", "syntax.estimate", "syntax.velocity", "analysis", "errors"],
  },
  {
    id: "syntax.task",
    title: "Task syntax",
    summary: "Taskはmilestone間を結ぶAoA edgeです。",
    quick: [
      {
        id: "required",
        title: "Required fields",
        body: "titleと、durationまたはestimateのどちらかexactly oneを指定します。",
      },
    ],
    detail: [
      {
        id: "resources",
        title: "Resources",
        body: "requires blockの全resourceを同時取得し、task完了まで保持します。",
      },
    ],
    syntax: ["task ID FROM -> TO:", "  title \"...\"", "  duration 1d"],
    examples: [],
    related: ["syntax", "syntax.duration", "syntax.estimate", "analysis.resources"],
  },
  {
    id: "syntax.estimate",
    title: "PERT estimate syntax",
    summary: "optimistic、most_likely、pessimisticの三点見積りを記述します。",
    quick: [
      {
        id: "order",
        title: "Ordering constraint",
        body: "optimistic <= most_likely <= pessimistic、かつpessimistic > 0が必要です。",
      },
    ],
    detail: [
      {
        id: "unit",
        title: "Duration unit",
        body: "3値は同じsuffixを使い、project duration_unit（day/hour/point）と一致させます。",
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
    summary: "Finite decimalにproject unit suffix d、h、pのいずれかを付けます。",
    quick: [],
    detail: [],
    syntax: ["1d", "2.5h", "3p", "0d"],
    examples: [],
    related: ["syntax.estimate", "syntax.velocity", "analysis"],
  },
  {
    id: "syntax.velocity",
    title: "Velocity syntax",
    summary: "Pointとday/hourを相互換算するproject-wide velocityを記述します。",
    quick: [
      {
        id: "forecast",
        title: "Velocity forecast",
        body: "duration_unit pointではvelocityが必須です。PERT値はpのまま計算し、換算値をvelocity forecastとして別に返します。",
      },
    ],
    detail: [
      {
        id: "units",
        title: "Units",
        body: "20p/10dまたは20p/80hの形式です。dayとhourの関係は暗黙に推測しません。",
      },
      {
        id: "scope",
        title: "MVP scope",
        body: "velocityはproject全体で一定です。team別、resource別、期間別velocityはMVP対象外です。",
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
    summary: "Structural indentationはASCII spacesだけを使用します。",
    quick: [],
    detail: [],
    syntax: ["field: 2 spaces", "nested field: 4 spaces"],
    examples: [],
    related: ["syntax"],
  },
  {
    id: "analysis",
    title: "Analysis",
    summary: "PERT/CPM precedence resultとresource scheduleを分離して返します。",
    quick: [
      {
        id: "results",
        title: "Separated results",
        body: "precedence makespanはresourceを無視した下限、resource makespanはcapacityを守る決定的heuristic resultです。",
      },
    ],
    detail: [
      {
        id: "exact",
        title: "Exact arithmetic",
        body: "expected、variance、float、makespanはexact Rationalで計算し、displayだけを--precisionで丸めます。Point文書ではvelocity forecastもexact換算します。",
      },
      {
        id: "paths",
        title: "Critical paths",
        body: "near-critical subgraphとexact driving pathを区別し、path countは列挙上限と独立に返します。",
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
    related: ["analysis.resources", "next"],
  },
  {
    id: "analysis.resources",
    title: "Resource analysis",
    summary: "Renewable capacityを守る決定的heuristic scheduleです。",
    quick: [
      {
        id: "capacity",
        title: "Capacity override",
        body: "--capacityはwhat-if入力であり、source documentを書き換えません。",
      },
    ],
    detail: [
      {
        id: "algorithm",
        title: "parallel-sgs v1",
        body: "priority、precedence float、expected duration、task IDの順でcandidateをscanします。optimal=falseです。",
      },
      {
        id: "witness",
        title: "Resource witness",
        body: "resource待ちはrelease taskから開始taskへのanalysis-only resource arcで説明し、正本DAGへ保存しません。",
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
    id: "next",
    title: "Next tasks",
    summary: "active、ready、runnable_now、blocked_now、upcomingを返します。",
    quick: [
      {
        id: "classification",
        title: "Task classification",
        body: "readyは依存関係上開始可能なplanned task、runnable_nowは現在のactive allocationを差し引いて同時開始できるreadyの部分集合です。",
      },
    ],
    detail: [
      {
        id: "selection",
        title: "Resource selection",
        body: "runnable_nowはpriority、precedence total float、expected duration、task IDのscheduler順で1回scanして選びます。表示順はこの選択順とは独立です。",
      },
      {
        id: "explanation",
        title: "Upcoming explanation",
        body: "upcomingは未到達の開始milestoneとunsatisfied incoming edgeを返します。--explain-depthは0..32、default 1です。",
      },
    ],
    syntax: [
      "perttool dag next FILE [--capacity RESOURCE=COUNT]...",
      "  [--explain-depth 0..32] [--precision 0..9] [--format text|json]",
    ],
    examples: [
      {
        id: "parallel-next",
        title: "Current runnable subset",
        text: "perttool dag next docs/examples/parallel.pert",
      },
    ],
    related: ["analysis", "analysis.resources"],
  },
  {
    id: "editing",
    title: "Safe editing",
    summary: "変更commandはpreviewを既定とし、明示した場合だけwriteします。",
    quick: [],
    detail: [],
    syntax: ["perttool task set FILE ID --status active"],
    examples: [],
    related: ["workflows"],
  },
  {
    id: "mermaid",
    title: "Mermaid conversion",
    summary: "AoA graphをMermaidへexportし、profileをlossless importします。",
    quick: [],
    detail: [],
    syntax: ["perttool dag render FILE --to mermaid"],
    examples: [],
    related: ["syntax"],
  },
  {
    id: "workflows",
    title: "Workflows",
    summary: "check、analyze、next、preview、Git commitの順で運用します。",
    quick: [],
    detail: [],
    syntax: [],
    examples: [],
    related: ["editing", "analysis", "next"],
  },
  {
    id: "errors",
    title: "Diagnostics",
    summary: "Stable code、source span、局所help topicで問題を報告します。",
    quick: [],
    detail: [],
    syntax: [],
    examples: [],
    related: ["syntax"],
  },
  {
    id: "samples",
    title: "Samples",
    summary: "Repositoryの規範sample IDを案内します。",
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
      summary: "利用するtopicを選択してください。",
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
      summary: "指定されたhelp topicは存在しません。",
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
