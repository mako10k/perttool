# perttool CLI Interface仕様

- 文書状態: Draft 0.3
- Interface version: 2
- CLI contract version: 2
- 作成日: 2026-07-21
- 更新日: 2026-07-22
- 対応要件: [../requirements.md](../requirements.md)
- 文法仕様: [dsl-grammar.md](dsl-grammar.md)
- Graph semantics: [graph-semantics.md](graph-semantics.md)
- Analysis仕様: [analysis.md](analysis.md)
- Recommendation semantics: [recommendation.md](recommendation.md)
- 対応基本設計: [../basic-design.md](../basic-design.md)

## 1. 目的とMVP境界

本書はperttool MVPのCLI command、option、標準入出力、exit code、text表示、CLI JSON resultを固定する規範仕様である。

MVPのprimary interfaceはローカルCLIとする。AI agentもMCPではなく、CLIの`--format json`を使用してcheck、analyze、next、preview mutationを実行する。

MCP、LSP、editor adapterはMVP後とし、本書ではtool名、action schema、transport、server起動commandを定義しない。MVP実装へMCP SDKまたはserver dependencyを追加してはならない。

## 2. 規範の優先順位と対象外

不一致がある場合は次の順で解消する。

1. `docs/requirements.md`のMust requirementとMVP境界
2. [DSL文法仕様](dsl-grammar.md)のsyntax contract
3. [Graph Semantics仕様](graph-semantics.md)のgraph/state contract
4. [Analysis仕様](analysis.md)の数値・schedule contract
5. 本書のCLIとserialization contract
6. `docs/basic-design.md`とsample/help表示

本書の対象外:

- Node.js対応version、package manager、配布package名
- shell completion、GUI、TUI、daemon、network API
- MCP/LSP/editorのwire contract
- Mermaid lossless metadataの内部record schema
- calendar、exact resource solver、target duration完了確率

## 3. CLI dispatchと共通規則

### 3.1 top-level grammar

```text
perttool --version
perttool --help
perttool <resource> <action> [operands] [options]
perttool <resource> <action> --help
```

MVP resourceは`dsl`、`dag`、`task`、`milestone`、`resource`である。Resource名、action名、option名はcase-sensitiveとする。

Rules:

- unknown resource、action、option、余分なoperandはusage error
- long optionのprefix省略を許さない
- `--name value`と`--name=value`の両方を受理する
- boolean optionへ値を付けない
- optionの意味は記載順に依存しない
- repeatableでないoptionの重複はusage error
- pathが`-`から始まる場合は`--`でoption parsingを終了できる
- response file、暗黙のenvironment option、config file、network accessはMVPに含めない

`--version`は`perttool <semantic-version>`と末尾newlineをstdoutへ出す。`--version`と`--help`はterminal optionであり、相互または他のoperand/optionと併用しない。Commandの`--help`は必須operandなしで使用でき、常にtextを返す。機械可読なdomain guidanceには`dsl help --format json`を使う。

### 3.2 document input

`<file>`はUTF-8 document pathまたは`-`である。`-`はstdinを表す。

- read-only operationとpreview operationはstdinを受理する
- 1 invocationでdocument inputは1つだけ
- stdin使用時、diagnostic source名は`<stdin>`
- inputを読み切ってからparseを開始する
- file pathをURLとして扱わない
- invalid UTF-8、read failureはI/O error
- input digestはBOMを含むraw UTF-8 bytesのSHA-256
- digest文字列表現は`sha256:<64 lowercase hex digits>`

### 3.3 common result options

Resultを返すcommandは次を使用する。

| Option | Value | Default | Meaning |
| --- | --- | --- | --- |
| `--format` | `text` or `json` | `text` | CLI result serialization |
| `--color` | `auto`, `always`, `never` | `auto` | text diagnosticのANSI color |
| `--warnings-as-errors` | flag | off | warningが1件以上ならexit 1 |
| `--max-diagnostics` | integer | `100` | 1..1000。返すdocument diagnostic件数の上限 |

`--format json`では`--color always`をusage errorとする。JSONへANSI escapeを含めない。`--color auto`はstdout/stderrそれぞれがTTYかを独立に判定する。

`--warnings-as-errors`は`dsl help`以外のdocument-processing commandで受理する。Help commandにはdocument warningがないため指定をusage errorとする。
`--max-diagnostics`もdocument-processing commandだけで受理し、`dsl help`ではusage errorとする。

### 3.4 command helpとdomain help

- `perttool --help`はresource一覧とglobal usageをstdoutへ出す
- `<resource> <action> --help`はそのcommandのoperand/option usageをstdoutへ出す
- command helpはexit 0で、documentを読まない
- DSL、分析、workflowの学習用helpは`perttool dsl help`を使う
- syntax error diagnosticはdomain help topic IDを返す

## 4. Command surface

### 4.1 complete surface

```text
perttool dsl check <file>
perttool dsl format <file>
perttool dsl help [<topic> [<subtopic>]]

perttool dag analyze <file>
perttool dag next <file>
perttool dag render <file> --to mermaid|svg|json
perttool dag import <file> --from mermaid
perttool dag advance <file>

perttool task add <file> <id> <from> <to>
perttool task set <file> <id>
perttool task remove <file> <id>
perttool task finish <file> <id>

perttool milestone add <file> <id>
perttool milestone set <file> <id>
perttool milestone remove <file> <id>

perttool resource add <file> <id>
perttool resource set <file> <id>
perttool resource remove <file> <id>
```

`dag render --to svg|json`はpost-MVP targetとしてcommand namespaceを予約する。MVP実装がadvertiseして受理する必須targetは`mermaid`だけである。Targetを追加するchangeでparser enum、command help、renderer、golden testを同時に追加する。

## 5. DSL commands

### 5.1 `dsl check`

```text
perttool dsl check <file>
  [--warnings-as-errors]
  [--max-diagnostics <integer>]
  [--format text|json]
  [--color auto|always|never]
```

Grammar、field、reference、cycle、state、frontier、finish reachability、active resource allocationを検査する。Analysis scheduleは計算しない。

### 5.2 `dsl format`

```text
perttool dsl format <file>
  [--check]
  [--diff]
  [--write [--expect-digest <digest>] | --out <path>]
  [--warnings-as-errors]
  [--format text|json]
  [--color auto|always|never]
```

- defaultは候補documentをstdoutへ出すpreview
- `--diff`は候補documentの代わりにunified diffをstdoutへ出す
- `--check`は変更が必要ならexit 1とし、fileを書かない
- `--check`は`--write`、`--out`と併用不可
- formatterはcandidateを再parse・再検査する
- inputが既にcanonicalなら`changed=false`

### 5.3 `dsl help`

```text
perttool dsl help [<topic> [<subtopic>]]
  [--level index|quick|detail]
  [--format text|json]
  [--color auto|always|never]
```

- 引数なしのdefault levelは`index`
- topic指定時のdefault levelは`quick`
- `<topic> <subtopic>`はhelp ID `<topic>.<subtopic>`へ正規化する
- dotを含む単一topic IDも受理する
- positional topicとsubtopicを連結した結果がregistryに存在しなければusage errorではなくhelp lookup error、exit 1
- help resultはgrammar parseを必要とせず、`document_id`を持たない

初期top-level topic:

```text
syntax analysis next editing mermaid workflows errors samples
```

## 6. DAG commands

### 6.1 shared analysis options

`dag analyze`と`dag next`は次を共有する。

| Option | Value | Default | Constraint |
| --- | --- | --- | --- |
| `--capacity` | `<resource-id>=<integer>` | none | repeatable、integerは1..2147483647 |
| `--precision` | integer | `3` | 0..9、displayだけに適用 |

同一resource IDへの`--capacity`重複はusage errorとする。Unknown resource ID、requirement未満のcapacity、active allocation超過はdocument/analysis errorである。Overrideはsource documentを書き換えない。

### 6.2 `dag analyze`

```text
perttool dag analyze <file>
  [--schedule precedence|resource|both]
  [--capacity <resource-id>=<integer>]...
  [--max-paths <integer>]
  [--precision <integer>]
  [--max-diagnostics <integer>]
  [--warnings-as-errors]
  [--format text|json]
  [--color auto|always|never]
```

- default scheduleは`both`
- `--max-paths`は0..1000、default 1
- representative pathとexact path countは`--max-paths`にかかわらず返す
- enumerationがpath count未満なら`paths_truncated=true`
- `precedence`はresource resultを生成しない
- `resource`はfull precedence resultを表示しないが、resource result内にprecedence lower boundを保持する
- `both`はprecedence/resource resultを分離して返す

### 6.3 `dag next`

```text
perttool dag next <file>
  [--capacity <resource-id>=<integer>]...
  [--explain-depth <integer>]
  [--precision <integer>]
  [--max-diagnostics <integer>]
  [--warnings-as-errors]
  [--format text|json]
  [--color auto|always|never]
```

- `--explain-depth`は0..32、default 1
- active、ready、runnable_now、blocked_now、upcomingをすべて返す
- capacity overrideは`runnable_now`とschedule annotationだけを変え、ready分類を変えない
- 表示順とresource選択順を混同しない

### 6.4 `dag render`

```text
perttool dag render <file>
  --to mermaid|svg|json
  [--profile perttool|plain]
  [--analysis none|precedence|resource|both]
  [--capacity <resource-id>=<integer>]...
  [--strict-loss]
  [--out <path>]
  [--warnings-as-errors]
  [--format text|json]
  [--color auto|always|never]
```

- default profileは`perttool`
- default analysisは`none`
- text resultのdefaultはartifact bodyをstdoutへ出す
- JSON resultはartifactとloss reportをenvelopeに含める
- `--out`指定時、text resultのstdoutは空、write summaryはstderr
- 既存`--out`を上書きしない
- `--strict-loss`でlossy recordが1件以上ならartifactを書かずexit 4
- `--to`はartifact種別、`--format`はCLI result serializationであり別概念

### 6.5 `dag import`

```text
perttool dag import <file>
  --from mermaid
  [--strict-loss]
  [--out <path>]
  [--warnings-as-errors]
  [--format text|json]
  [--color auto|always|never]
```

- defaultは候補DSLをstdoutへ出すpreview
- source artifactをin-placeでDSLへ上書きする`--write`は提供しない
- `--out`は既存pathを上書きしない
- loss reportとgenerated ID mappingを常に生成する
- `--strict-loss`でlossy recordが1件以上なら候補を書かずexit 4

### 6.6 `dag advance`

```text
perttool dag advance <file>
  [--diff]
  [--write [--expect-digest <digest>] | --out <path>]
  [--warnings-as-errors]
  [--format text|json]
  [--color auto|always|never]
```

Defaultはcandidate document previewである。削除対象task/milestone、advance前後のfrontier、ready set comparisonをresultへ含める。

## 7. Entity mutation commands

### 7.1 common mutation output options

`task`、`milestone`、`resource`の全actionは次を受理する。

```text
[--diff]
[--write [--expect-digest <digest>] | --out <path>]
[--warnings-as-errors]
[--format text|json]
[--color auto|always|never]
```

Rules:

- defaultは変更後documentのpreview
- `--diff`はpreview時だけ使用できる
- `--write`と`--out`は相互排他
- `--write`はstdinで使用不可
- `--expect-digest`は`--write`とだけ使用できる
- `--expect-digest`省略時もread直後のdigestをwrite直前に再確認する
- `--out`は既存pathを上書きしない
- candidateがparse/semantic checkに失敗した場合は出力・writeしない
- action全体を1 mutationとして扱い、部分適用しない
- 同じfieldへの矛盾するoptionはusage error

### 7.2 task

`task add`:

```text
perttool task add <file> <id> <from> <to>
  (--duration <duration> |
   --optimistic <duration> --most-likely <duration> --pessimistic <duration>)
  --title <text> [--description <text>]
  [--status planned|active|blocked|done]
  [--priority <integer>] [--owner <text>]
  [--blocked-reason <text>] [--source <text>]
  [--tag <tag>]...
  [--require <resource-id>=<integer>]...
```

`task set`は`--from`、`--to`と上記field optionを任意の変更fieldとして受理し、`--title`も必須ではない。三点見積りへ変更するときは3 optionすべてを同じinvocationで指定し、既存durationを置換する。`--duration`は既存estimateを置換する。`--duration`と三点見積りは相互排他である。

```text
perttool task set <file> <id>
  [--from <milestone-id>] [--to <milestone-id>]
  [--title <text>] [--description <text>]
  [--duration <duration> |
   --optimistic <duration> --most-likely <duration> --pessimistic <duration>]
  [--status planned|active|blocked|done]
  [--priority <integer>] [--owner <text>]
  [--blocked-reason <text>] [--source <text>]
  [--require <resource-id>=<integer>]...
```

追加のset option:

```text
--add-tag <tag>...
--remove-tag <tag>...
--remove-require <resource-id>...
--clear description|status|priority|owner|blocked_reason|source|tags|requires
```

`task set`は少なくとも1変更optionを必要とする。`--status blocked`は同じcandidateで`blocked_reason`が存在することを要求する。`task remove`はcascade optionを持たず、削除後graphが無効なら拒否する。`task finish`はstatusを`done`へ変更し、同じsafe mutation pathを使う。

### 7.3 milestone

```text
perttool milestone add <file> <id>
  --title <text>
  [--description <text>]
  [--state planned|reached]
  [--tag <tag>]...

perttool milestone set <file> <id>
  [--title <text>] [--description <text>]
  [--state planned|reached]
  [--add-tag <tag>]... [--remove-tag <tag>]...
  [--clear description|state|tags]

perttool milestone remove <file> <id>
```

`milestone remove`はcascadeせず、endpoint/finish参照が残る場合は拒否する。

`milestone set`は少なくとも1変更optionを必要とする。

### 7.4 resource

```text
perttool resource add <file> <id>
  --title <text>
  --capacity <integer>
  [--description <text>]

perttool resource set <file> <id>
  [--title <text>] [--capacity <integer>]
  [--description <text>] [--clear description]

perttool resource remove <file> <id>
```

`resource remove`はtask requirementをcascade削除せず、参照が残る場合は拒否する。

`resource set`は少なくとも1変更optionを必要とする。Capacityは1..2147483647で、変更後の全requirementとactive allocationを再検査する。

## 8. Write safety

In-place writeは次の順を必須とする。

1. raw input bytesとdigestを読む
2. candidateとTextEditをCoreで生成する
3. candidateを再parse・再検査する
4. callerの`--expect-digest`があればinitial digestと比較する
5. write直前にpathのdigestを再読込し、initial digestと比較する
6. 同directoryにexclusive temporary fileを作る
7. permission modeを可能な範囲で引き継ぐ
8. bytesを書き、flush/fsyncする
9. atomic renameする
10. 可能ならparent directoryをfsyncする
11. written bytesを再読込しcandidate digestと比較する

Symlink inputへの`--write`はMVPでは拒否する。`--out`もsymlink targetまたは既存pathを拒否する。Raceまたはdigest不一致はexit 5で、元fileを変更しない。

## 9. stdout、stderr、exit code

### 9.1 stream contract

Text format:

- stdout: requested data、artifact、candidate document、diff
- stderr: diagnostic、warning、write summary
- success diagnosticをstderrへ出さない
- dataがないwrite successはstdoutを空にする

JSON format:

- stdout: operation result envelope 1個と末尾newline
- document diagnosticもenvelopeの`diagnostics`へ含める
- stderr: envelopeを生成できないI/O/usage/internal failureの短いmessageだけ
- JSONと同じdiagnosticをstderrへ重複出力しない

### 9.2 exit code

| Code | Stable meaning |
| ---: | --- |
| 0 | operation成功、または有効なdocument。warningはpolicy上許容 |
| 1 | DSL/semantic/analysis/help lookup error、format check差分、またはwarnings-as-errors |
| 2 | CLI usage error |
| 3 | input/output/encoding error |
| 4 | strict conversionでlossを検出 |
| 5 | optimistic lock、symlink、atomic write競合 |
| 70 | internal invariant/programmer error |

複数categoryが同時に起きる場合、CLI usageをdocument read前に検出する。Document処理開始後は`5 > 3 > 4 > 1 > 0`の優先順位で1つを返す。Signal終了の`128+signal`はperttool contractではない。

## 10. Text result contract

### 10.1 stability boundary

Textは人間向けである。Section順、field label、diagnostic code、ID、exact/display値の意味はgolden testで固定する。空白によるcolumn alignmentと将来の説明文追加はmachine contractではない。Machine consumerはJSONを使用する。

### 10.2 diagnostic

```text
PTDSL-012 error: task REQ の estimate 順序が不正です
  --> plan.pert:24:5
  related: plan.pert:22:3 previous declaration
  help: perttool dsl help syntax estimate --level quick
```

Diagnosticはseverity `error`、`warning`、`info`の順ではなく、source position、code、entity IDの規範順で表示する。Source位置を持たないdiagnosticは位置付きdiagnosticの後へcode順で置く。

### 10.3 check

Success stdout:

```text
OK plan.pert project=PLAN milestones=7 tasks=5 gates=4 resources=2
```

Error時はstdoutを空にし、diagnosticをstderrへ出す。

### 10.4 analyze

Section順:

```text
PERTTOOL ANALYSIS <document-id>
QUALIFIERS
PRECEDENCE
PRECEDENCE CRITICAL
RESOURCE SCHEDULE
RESOURCE CRITICAL
RESOURCE UTILIZATION
```

未要求sectionは省略する。Precedence task tableはstable topological position、ID順で、`ID EXPECTED ES EF LS LF TF FF CRITICAL`を表示する。Resource task tableはscheduled start、finish、ID順で、`ID ELIGIBLE START FINISH WAIT REQUIREMENTS`を表示する。

Heuristic schedule見出しには`algorithm@version`と`optimal=false`を必ず表示する。Blocked conditional、path truncation、capacity overrideは`QUALIFIERS`で隠さない。

### 10.5 next

Section順は`ACTIVE`、`RUNNABLE NOW`、`READY / WAITING RESOURCE`、`BLOCKED NOW`、`UPCOMING`とする。各taskはpresentation orderで並べ、priority、critical、total float、expected、resource requirementを表示する。Runnableでないready taskは不足resourceとoccupantを直下へ表示する。

### 10.6 mutation and conversion

- preview default: candidate documentそのもの
- `--diff`: unified diff、path labelはinput operandとcandidate
- `--write`/`--out`: stdout empty、stderrにtargetとdigest
- import default: candidate DSL
- render default: artifact body
- JSON formatでは上記raw textの代わりに対応result envelopeを返す

## 11. JSON common contract

### 11.1 encoding and naming

- RFC 8259 JSON、UTF-8、BOMなし、末尾newlineあり
- field名は`snake_case`
- mapのkeyはASCII辞書順、entity arrayは各domainのstable順
- integer safe range内のcount/quantityはJSON number
- Rational numerator/denominatorとBigInt path countはdecimal string
- `undefined`相当fieldは出力しない
- schema上nullableと定義したfieldだけ`null`を使う
- consumerは同じmajor versionの未知optional fieldを無視する

### 11.2 document result envelope

Document operationは次をrootに持つ。

```text
schema_version  string   "Perttool.<ResultType>.v1"
tool_version    string   semantic version
operation       string   resource.action
ok              boolean  CLI warning policy適用後の成功
document_id     string|null
source          string   operand spellingまたは"<stdin>"
source_digest   string|null
diagnostics     Diagnostic[]
diagnostics_truncated boolean
```

`schema_version`はresult typeとmajor versionを同時に識別する。`tool_version`をschema互換性判断に使用しない。

`diagnostics_truncated=true`の場合、`diagnostics`はsource順の先頭`--max-diagnostics`件だけを持つ。Text出力はdiagnostic末尾へ`DIAGNOSTICS_TRUNCATED true limit=<N>`を出し、打ち切りを黙って成功扱いにしない。

### 11.3 source location

```text
Position:
  offset         integer  0-based UTF-16 code unit
  line           integer  1-based
  column         integer  1-based UTF-16 code unit column

Span:
  start          Position
  end            Position  half-open
```

### 11.4 diagnostic

```text
Diagnostic:
  code             string
  severity         "error" | "warning" | "info"
  message          string
  entity_id        string|null
  span             Span|null
  related          RelatedLocation[]
  help_topic       string|null
  expected_syntax  string|null
  fixes            SuggestedFix[]
  data             object
```

`data`はdiagnostic code固有の安定fieldだけを持ち、free-form stack traceを含めない。Internal errorのstack traceは通常出力せず、明示的debug modeは将来仕様とする。

Help registry lookup diagnosticは`PTHLP-*` namespaceを使用する。Unknown topicは`PTHLP-001`、exit 1とする。

### 11.5 Rational value

```text
RationalValue:
  numerator       signed decimal integer string
  denominator     positive decimal integer string
  unit            "day" | "hour" | "point" | "day^2" | "hour^2" | "point^2" | "ratio"
  display         decimal string rounded by --precision
```

`display`を再計算へ使用してはならない。Duration displayへsuffixを付けた人間向け文字列はtext rendererが生成し、JSONの`display`にはunit suffixを含めない。

## 12. Operation JSON results

### 12.1 CheckResult

`schema_version = "Perttool.CheckResult.v1"`

```text
grammar_version  integer|null
summary:
  resources      integer
  milestones     integer
  tasks          integer
  gates          integer
  errors         integer
  warnings       integer
```

Parse不能でcountを信頼できない場合は各entity countを0、`grammar_version=null`とする。
`summary.errors`と`summary.warnings`は上限適用前の総数とし、`diagnostics.length`より大きい場合がある。

### 12.2 AnalysisResult

`schema_version = "Perttool.AnalysisResult.v2"`

Version 2は`duration_unit point`、`velocity`、`velocity_forecast`を追加する。Version 1の`duration_unit` enumを拡張するためmajorを更新し、Version 2 producerはday/hour文書にもVersion 2を返す。

Root:

```text
mode              "precedence" | "resource" | "both"
precision         integer
duration_unit     "day" | "hour" | "point"
critical_epsilon  RationalValue
velocity          Velocity|null
velocity_forecast AnalysisVelocityForecast|null
precedence        PrecedenceResult|null
resource          ResourceScheduleResult|null
```

`Velocity`:

```text
points             RationalValue  unit=point
period             RationalValue  unit=day|hour
```

`AnalysisVelocityForecast`:

```text
qualifier           "velocity_forecast"
source_unit         "day" | "hour" | "point"
target_unit         "day" | "hour" | "point"
precedence_makespan RationalValue|null
resource_makespan   RationalValue|null
```

Velocity forecastは基準単位のresultを置き換えない。`precedence_makespan`と`resource_makespan`は対応する基準resultが生成された場合だけnon-nullとする。

`PrecedenceResult`:

```text
makespan                       RationalValue
conditional_on_blocks_resolved boolean
blocked_task_ids                string[]
milestones                      MilestoneTiming[]
edges                           EdgeTiming[]
critical                        CriticalResult
```

`MilestoneTiming`は`id`、`earliest`、`latest`、`slack`を持つ。`EdgeTiming`は次を持つ。

```text
id source target kind status
expected variance
es ef ls lf total_float free_float
is_critical is_driving
```

`kind`は`task|gate`、時間/float/expectedは`RationalValue`、`status`はtask statusまたはgateの`null`である。

`CriticalResult`:

```text
milestone_ids       string[]
task_ids            string[]
gate_ids            string[]
driving_edge_ids    string[]
representative_path CriticalPath
path_count          decimal integer string
paths               CriticalPath[]
paths_truncated     boolean
```

`CriticalPath`は`edge_ids`、`task_ids`、`gate_ids`、`variance`を持つ。

`ResourceScheduleResult`:

```text
algorithm:
  id                "parallel-sgs"
  version           integer
  optimal           false
conditional_on_blocks_resolved boolean
blocked_task_ids    string[]
capacities          ResourceCapacity[]
precedence_lower_bound RationalValue
makespan            RationalValue
resource_delay      RationalValue
tasks               ScheduledTask[]
resources           ResourceStatistic[]
resource_arcs       ResourceArc[]
constraint_graph_replay:
  ok                boolean
schedule_critical   ScheduleCriticalResult
```

`ResourceCapacity`は`id`、`declared`、`override` nullable、`effective`をintegerで持つ。

`ScheduledTask`:

```text
id status expected variance
eligible_time start finish resource_wait
requirements        [{resource_id, units}]
priority_key        {priority, precedence_total_float, expected, task_id}
conditional_blocked boolean
```

`ResourceStatistic`:

```text
id capacity amount_time utilization peak_usage last_release
timeline [{task_id, start, finish, units}]
```

`ResourceArc`:

```text
id from_task_id to_task_id at_time wait_from
resources [{resource_id, contributed_units}]
schedule_float is_critical is_driving
```

`ScheduleCriticalResult`はprecedence criticalと別に`task_ids`、`resource_arc_ids`、`driving_constraint_ids`、`representative_path`、`path_count`、`paths`、`paths_truncated`を持つ。Schedule pathは次を持つ。

```text
task_ids             string[]
constraints          [{from_task_id, to_task_id, kind, resource_arc_id}]
connector_ids        string[]
```

`kind`は`precedence|gate|resource`で、resource以外の`resource_arc_id`は`null`とする。

### 12.3 NextResult

`schema_version = "Perttool.NextResult.v2"`

```text
precision             integer
duration_unit         "day" | "hour" | "point"
velocity              Velocity|null
velocity_forecast      NextVelocityForecast|null
```

`NextVelocityForecast`:

```text
  qualifier            "velocity_forecast"
  source_unit          "day" | "hour" | "point"
  target_unit          "day" | "hour" | "point"
```

NextResult rootの続き:

```text
capacity_overrides    [{resource_id, capacity}]
groups:
  active              string[]
  ready               string[]
  runnable_now        string[]
  blocked_now         string[]
  upcoming            string[]
tasks                 NextTask[]
```

`NextTask`:

```text
id title status classification runnable_now
priority owner blocked_reason
expected total_float earliest_start
forecast_expected forecast_total_float forecast_earliest_start
precedence_critical schedule_critical
requirements          [{resource_id, units}]
resource_rejections   ResourceRejection[]
explanation           ExplanationNode[]
```

`classification`は`active|ready|blocked_now|upcoming`である。`runnable_now`はready taskへの直交booleanであり、classification enumへ混ぜない。

`Perttool.NextResult.v2`はrecommendation tier、recommended set、recommendation explanationを持たない。[Recommendation Semantics仕様](recommendation.md)は将来interfaceの意味modelであり、本sectionのfieldや既存`explanation`を無言で再解釈しない。Schema version、field名、text layout、migrationは`INTERFACE_CONTRACT`で確定する。

`title`はstring、`status`はtask status、`priority`はinteger、`owner`と`blocked_reason`はstringまたは`null`とする。`expected`、`total_float`、`earliest_start`は基準単位の`RationalValue`である。`forecast_*`はvelocityがある場合だけtarget unitの`RationalValue`、それ以外は`null`とする。

`tasks`と`groups`はunfinished taskだけを対象とし、retained `done` taskを次task候補へ含めない。

`ResourceRejection`:

```text
resource_id capacity active_usage earlier_selected_usage
used_before_decision required available deficit
active_task_ids earlier_selected_task_ids
```

`ExplanationNode`:

```text
milestone_id          string
reached               boolean
unsatisfied_edges     UnsatisfiedEdge[]
children              ExplanationNode[]
truncated             boolean
```

`UnsatisfiedEdge`:

```text
edge_id               string
kind                  "task" | "gate"
status                task status | null
source_milestone_id   string
source_reached        boolean
```

Upcoming taskの`explanation`はtaskの直接`from` milestoneをrootとする。Rootではunsatisfied incoming edgeを常に返し、`--explain-depth 0`はそこで停止する。Depthを1増やすごとに、unsatisfied edgeの未到達source milestoneをID辞書順で`children`へ追加する。上限で未展開sourceが残るnodeは`truncated=true`とする。DAG上の同一pathで同じmilestoneを再訪しない。

### 12.4 MutationResult

`schema_version = "Perttool.MutationResult.v1"`

```text
changed          boolean
original_digest  string
updated_digest   string|null
updated_text     string|null
diff             string|null
edits            TextEdit[]
write:
  mode            "preview" | "out" | "in_place"
  target          string|null
  written         boolean
```

`TextEdit`は0-based UTF-16 `start_offset`、`end_offset`、`replacement`を持つ。`--format json`ではpreview/write modeにかかわらず、candidate生成成功時に`updated_text`と`diff`の両方を返す。

`dag advance`は追加で次を持つ。

```text
advance:
  removed_task_ids
  removed_gate_ids
  removed_milestone_ids
  frontier_before
  frontier_after
  ready_before
  ready_after
```

### 12.5 HelpResult

`schema_version = "Perttool.HelpResult.v1"`

Help result rootは`tool_version`、`operation="dsl.help"`、`ok`、`diagnostics`を持ち、document fieldを持たない。

```text
topic_id      string|null
level         "index" | "quick" | "detail"
title         string
summary       string
sections      [{id, title, body}]
syntax        string[]
examples      [{id, title, text}]
related       string[]
topics        [{id, title, summary}]
```

Index levelでは`topics`を使用する。Sample参照はabsolute pathでなくstable example IDを使用する。

### 12.6 ConversionResult

Renderは`Perttool.ExportResult.v1`、importは`Perttool.ImportResult.v1`を使用する。

```text
artifact_format  "mermaid" | "svg" | "json" | "pert"
artifact         string|object|null
loss_report:
  lossless       boolean
  records        ConversionLoss[]
generated_ids    [{source_element, generated_id}]
write            {mode, target, written}
```

`ConversionLoss`は`code`、`severity`、`message`、`element_id` nullable、`span` nullable、`lossy` booleanを持つ。

`loss_report`の型schema IDは`Perttool.ConversionLossReport.v1`とし、Export/Import resultの`$defs`から同じ定義を参照する。

## 13. CLI error serialization

UsageまたはI/O errorでdocument resultを生成できない場合、textではstderrへ1件の`PTCLI-*` diagnosticとusage hintを出す。

Invocationに完全な`--format json`が含まれ、JSON rendererを選択できた場合はstdoutへ次を返す。

```text
schema_version  "Perttool.CliError.v1"
tool_version
operation       string|null
ok              false
diagnostics     Diagnostic[]
```

Unknownまたは壊れた`--format`自体が原因の場合はJSONを推測せずtext stderrを使用する。

## 14. Determinism and privacy

- resultへ現在時刻、hostname、username、absolute cwdを自動挿入しない
- sourceはcallerが渡したoperand spellingを保持し、勝手にabsolute化しない
- diagnostic messageへdocument全体を複製しない
- stable resultへtemporary path、stack trace、random IDを含めない
- output arrayは各domain仕様のstable orderを使用する
- 同じdocument bytes、options、grammar/semantics/analysis/interface version、tool versionからbyte-identical JSONを返す
- text rendererはterminal widthでentity順や値を変えない

## 15. MVP acceptance

CLI実装時は最低限、次を自動検査する。

1. 全resource/actionのunknown command/option/extra operandをexit 2で拒否
2. fileとstdinでread-only resultが意味的に一致
3. textはdata stdout、diagnostic stderrを守る
4. JSONはvalid、ANSIなし、末尾newline、stable key/entity order
5. text/JSON diagnostic code、severity、span、help topicが一致
6. CheckResultがvalid/invalid fixtureと一致
7. AnalysisResultがanalysis goldenとexact Rationalで一致
8. `--schedule` modeがresult sectionを正しく分離
9. capacity overrideがdocumentを変更せずresource/next resultだけを変更
10. NextResultのclassificationとrunnable_nowが直交
11. `--precision`がdisplayだけを変えexact値を変えない
12. `--max-paths`がpath countを変えず列挙だけを制限
13. help index/quick/detailとJSONが同一registryから生成される
14. mutation defaultがpreviewでfileを変更しない
15. mutation JSONがupdated text、diff、TextEditを一致させる
16. candidate invalid時にpreview/writeを返さない
17. digest race、symlink、既存`--out`を安全に拒否
18. writeがatomicで、write後documentを再検査
19. Mermaid export/import loss reportとstrict-loss exit 4が一致
20. CLI JSONと直接Core API resultのsemantic payloadが一致
21. warning policyとexit codeの全組合せがgoldenと一致
22. internal invariant failureをdocument errorまたはexit 0へ変換しない

MVP acceptanceにMCP server、MCP tool schema、CLI/MCP parity testを含めない。

## 16. Versioning and post-MVP adapter boundary

Interface version 1はgrammar version 1、semantics version 1、analysis version 1を対象とする。

次はbreaking changeでありInterface major versionを上げる。

- resource/action/required operandの削除または意味変更
- option名、default、exit code stable meaningの破壊的変更
- JSON required fieldの削除、型変更、enum narrowing
- source position baseまたはdigest表現の変更
- textをmachine interfaceとして保証する範囲の変更

Future MCP adapterを追加する場合も、CLI processをsubprocessとして呼ぶのではなく同じApplication/Core APIを利用する。MCP固有summary、transport error、tool schemaは別versioned仕様で定義し、CLI MVPの完成条件へ遡及追加しない。
