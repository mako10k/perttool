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
    related: [
      "syntax.project",
      "syntax.resource",
      "syntax.milestone",
      "syntax.task",
      "syntax.gate",
      "syntax.estimate",
      "syntax.velocity",
      "analysis",
      "errors",
    ],
  },
  {
    id: "syntax.project",
    title: "Project syntax",
    summary: "文書先頭にexactly one置くproject declarationです。",
    quick: [
      {
        id: "required",
        title: "Required fields",
        body: "title、duration_unit、finishが必須です。Point文書では正のvelocityも必須です。",
      },
    ],
    detail: [
      {
        id: "version",
        title: "Grammar version",
        body: "version省略時は1として扱い、指定する場合もversion 1だけを受理します。",
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
    related: ["syntax", "syntax.duration", "syntax.velocity", "syntax.text"],
  },
  {
    id: "syntax.resource",
    title: "Resource syntax",
    summary: "Renewable resourceと同時利用可能な整数capacityを宣言します。",
    quick: [
      {
        id: "capacity",
        title: "Capacity",
        body: "titleと1以上のcapacityが必須です。Taskのrequiresからresource IDを参照します。",
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
    summary: "AoA nodeと現在frontierのreached状態を宣言します。",
    quick: [
      {
        id: "state",
        title: "Milestone state",
        body: "titleが必須です。stateはplannedまたはreachedで、readyは保存せず依存関係から導出します。",
      },
    ],
    detail: [],
    syntax: ["milestone ID:", "  title \"...\"", "  state reached"],
    examples: [
      { id: "minimal", title: "Reached frontier", text: "docs/examples/minimal.pert" },
    ],
    related: ["syntax", "syntax.task", "syntax.gate", "syntax.tags", "syntax.text"],
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
    ],
  },
  {
    id: "syntax.gate",
    title: "Gate syntax",
    summary: "所要時間0のdependency edgeとしてmilestone間を接続します。",
    quick: [
      {
        id: "reason",
        title: "Reason",
        body: "reasonが必須です。Gateはresourceを要求せず、task durationも持ちません。",
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
    id: "syntax.string",
    title: "String syntax",
    summary: "JSON string literalと同じdouble-quoted textを使用します。",
    quick: [],
    detail: [
      {
        id: "unicode",
        title: "Unicode and escapes",
        body: "Unicodeは直接記述でき、escapeはJSON形式を使用します。Unpaired surrogateは受理しません。",
      },
    ],
    syntax: ["\"text\"", "\"\\u65e5\\u672c\""],
    examples: [],
    related: ["syntax", "syntax.text", "syntax.tags"],
  },
  {
    id: "syntax.text",
    title: "Text field syntax",
    summary: "description、blocked_reason、reasonはStringまたはblock textを取ります。",
    quick: [],
    detail: [
      {
        id: "block",
        title: "Block text",
        body: "nonblank contentのcommon indentを除去し、paragraph blankと残りのindentを保持します。",
      },
    ],
    syntax: ["  description \"...\"", "  description |", "    first line"],
    examples: [],
    related: ["syntax", "syntax.string", "syntax.comments"],
  },
  {
    id: "syntax.tags",
    title: "Tag list syntax",
    summary: "Bare IdentifierまたはStringを角括弧内へcomma区切りで記述します。",
    quick: [],
    detail: [],
    syntax: ["  tags [alpha, \"two words\"]", "  tags []"],
    examples: [],
    related: ["syntax", "syntax.string"],
  },
  {
    id: "syntax.comments",
    title: "Comment syntax",
    summary: "独立行の#以降をCST triviaとして保持します。",
    quick: [
      {
        id: "standalone",
        title: "Standalone only",
        body: "grammar version 1ではinline commentを許可しません。Stringとblock text内の#はcontentです。",
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
    summary: "Projectを文書先頭に置き、各declarationをcolumn 0から開始します。",
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
    summary: "NextResult.v3で工程上の推奨taskと、active、ready、runnable_now、blocked_now、upcomingを返します。",
    quick: [
      {
        id: "classification",
        title: "Task classification",
        body: "readyは依存関係上開始可能なplanned task、runnable_nowは現在のactive allocationを差し引いて同時開始できるreadyの部分集合です。",
      },
      {
        id: "recommendation",
        title: "Recommendation authority",
        body: "recommendationはready taskをrecommended、allowed、deferred、discouragedへ分類します。recommended setは同時開始可能ですがheuristicであり、optimal=falseです。",
      },
    ],
    detail: [
      {
        id: "consumer-safety",
        title: "Machine-readable explanation",
        body: "--format jsonはcompleteなPerttool.NextResult.v3説明graphを返します。Consumerはschema_versionと各model versionを先に検査し、未知のdecisive semanticsではtaskを自動開始しません。Textはcomplete=falseのsummaryです。",
      },
      {
        id: "selection",
        title: "Resource selection",
        body: "runnable_nowは既存scheduler順で選ぶoperational subset、recommendationはversion付きranking policyで選ぶauthorityであり、同じ集合とは限りません。CLI rendererはrankingを再実装しません。",
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
        title: "Complete recommendation graph",
        text: "perttool dag next docs/examples/parallel.pert --format json",
      },
    ],
    related: ["analysis", "analysis.resources"],
  },
  {
    id: "editing",
    title: "Safe editing",
    summary: "dsl format、task/milestone/resource mutation、atomic batch、dag advanceをpreviewし、検査済み候補を安全にwriteできます。",
    quick: [
      {
        id: "current-surface",
        title: "Current surface",
        body: "dsl formatはplanFormat、Entity commandとmutation applyはplanMutation、dag advanceはplanAdvanceの再検査済みcandidate、UTF-16 TextEdit、digest、diffをtext/JSONへ投影します。既定はfileを変更しないpreviewです。",
      },
    ],
    detail: [
      {
        id: "write-gate",
        title: "Safe write",
        body: "--writeは初回read digestとwrite直前digestを照合してatomic replaceし、--expect-digestでcaller lockを追加できます。--outは既存targetを上書きせず新規作成します。--diffはpreview専用です。",
      },
    ],
    syntax: [
      "perttool dsl format FILE [--check] [--diff] [--write [--expect-digest DIGEST] | --out PATH]",
      "perttool task add|set|remove|finish ... [--write [--expect-digest DIGEST] | --out PATH]",
      "perttool milestone add|set|remove ... [--write [--expect-digest DIGEST] | --out PATH]",
      "perttool resource add|set|remove ... [--write [--expect-digest DIGEST] | --out PATH]",
      "perttool mutation apply FILE --request REQUEST.json [--write [--expect-digest DIGEST] | --out PATH]",
      "perttool dag advance FILE [--diff] [--write [--expect-digest DIGEST] | --out PATH]",
    ],
    examples: [
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
    ],
    related: ["workflows"],
  },
  {
    id: "mermaid",
    title: "Mermaid conversion",
    summary: "dag renderとdag importでlossless Mermaid profileを往復でき、plain importの損失を明示できます。",
    quick: [
      {
        id: "authority",
        title: "Profile authority",
        body: "%% perttool: semantic recordが正規化DSL意味モデルの復元正本で、flowchart node/edgeは人間向けprojectionです。",
      },
    ],
    detail: [
      {
        id: "fidelity",
        title: "Lossless boundary",
        body: "losslessはgrammar v1の正規化意味同値です。comment、blank line、field/declaration順、escape spelling、line endingのbyte同一性は対象外です。",
      },
      {
        id: "integrity",
        title: "Fail-closed validation",
        body: "canonical JSON record、record count、metadata/projection SHA-256、node/edge対応を検査します。Profile header検出後の破損をplain importへ黙って降格しません。",
      },
      {
        id: "availability",
        title: "Current availability",
        body: "exportMermaid/importMermaid Coreとdag render/importは利用できます。perttool profileは復元用semantic metadataをfail-closed検査し、plain import/exportはstable PTCNV lossを返します。SVG、JSON targetは後続sliceです。",
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
    quick: [
      {
        id: "recovery",
        title: "Error recovery",
        body: "独立した構文errorは可能な範囲で複数返し、同じinvalid blockの子行は1 error regionとして抑制します。",
      },
    ],
    detail: [
      {
        id: "phases",
        title: "Phase suppression",
        body: "parse errorがある文書ではfield/graph validationを実行せず、原因を直す前の派生PTSEM/PTDAG diagnosticを返しません。",
      },
      {
        id: "limit",
        title: "Diagnostic limit",
        body: "--max-diagnosticsは1..1000、default 100です。上限超過はdiagnostics_truncatedで確認できます。",
      },
    ],
    syntax: [
      "perttool dsl check FILE --max-diagnostics 20 --format json",
      "perttool dag analyze FILE --max-diagnostics 20 --format json",
      "perttool dag next FILE --max-diagnostics 20 --format json",
    ],
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
