# Recommendation Interface Contract 仕様

- 文書状態: Normative Draft 0.1
- Recommendation interface version: 1
- Target schema: `Perttool.NextResult.v3`
- 作成日: 2026-07-22
- 対応要件: [../requirements.md](../requirements.md)
- Current CLI interface: [interfaces.md](interfaces.md)
- Recommendation semantics: [recommendation.md](recommendation.md)
- Recommendation ranking: [recommendation-ranking.md](recommendation-ranking.md)
- Reason taxonomy: [recommendation-reasons.md](recommendation-reasons.md)
- Structured explanation: [recommendation-explanation.md](recommendation-explanation.md)
- Human override: [recommendation-override.md](recommendation-override.md)
- 関連Issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. 目的

本仕様は、normal recommendationをCore API、CLI JSON、CLI textへ同じ意味で公開するinterface contractを固定する。AIが`dag next --format json`の1 resultだけから、現在開始すべきtask、他taskのtier、比較対象、適用rule、exact fact、decision traceを取得できることを目的とする。

次を定義する。

- Core recommendation typeと既存`NextResult`への接続
- `Perttool.NextResult.v3`のwire schema
- typed value、entity reference、expression、traceのencoding
- stable description keyから生成するcanonical English text
- CLI textのsummary layoutとCLI JSONのcomplete graph
- `NextResult.v2`からのmigration
- unknown version、invariant failure、determinismの境界

本仕様は設計契約である。現行実装が`Perttool.NextResult.v3`を返す、またはrecommendationを計算するとはみなさない。

## 2. 規範上の位置

意味や設計が競合する場合は次の順で解決する。

1. `docs/requirements.md`のMust requirement
2. recommendation tierは[Recommendation Semantics仕様](recommendation.md)
3. 選択順とruleは[Recommendation Ranking Policy仕様](recommendation-ranking.md)
4. reason codeは[Recommendation Reason Taxonomy仕様](recommendation-reasons.md)
5. fact、expression、trace、description keyは[Recommendation Structured Explanation仕様](recommendation-explanation.md)
6. 本仕様
7. 現行[CLI Interface仕様](interfaces.md)の共通CLI、diagnostic、stream規則
8. basic design、example、test、help、implementation

本仕様はranking、tier、reason codeの意味を再定義しない。現行Interface v2の共通result、CLI stream、exit codeは、明示したv3差分以外そのまま継承する。

## 3. Scope

対象:

- `dag next`のnormal recommendation
- actual `ready` taskの`start` action
- complete recommendation graphを持つCLI JSON
- 全ready taskのtierとprimary reasonを示すCLI text
- Coreとadapterが共有するstable typeとordering
- pre-release中の`NextResult.v2`からv3への一回のmigration

対象外:

- recommendation algorithmの実装
- human overrideの入力、永続化、audit result
- non-ready taskのupcoming explanationの置き換え
- MCP、LSP、provider固有tool schema
- localized template catalogとlocale選択option
- graph pagination、streaming、partial result query
- byte単位のhard output limit
- backward-compatibleなv2同時出力mode

## 4. Version identity

Version 1の組合せを次とする。

```text
next_schema_version                = Perttool.NextResult.v3
recommendation_interface_version  = 1
ranking_algorithm_id              = perttool.recommendation-ranking.lexicographic-frontier
ranking_algorithm_version         = 1
reason_taxonomy_version           = 1.0
explanation_model_version         = 1
expression_version                = 1
description_registry_version      = 1
description_locale                = en
```

これらは別々の互換性境界であり、1つの`version` fieldへ畳み込まない。`schema_version`はwire shape、algorithm versionは選択結果、taxonomy versionはreason vocabulary、explanation/expression versionはtrace semantics、description registryとlocaleは派生textを識別する。

## 5. Core API contract

### 5.1 Type names

Core/Application layerは少なくとも次のstable conceptual typeを持つ。

```text
NextResultV3
RecommendationAnalysis
RecommendationResultDecision
RecommendationTaskDecision
RecommendationDecisionStep
RecommendationFact
RecommendationExpression
RecommendationComparison
RecommendationReasonOccurrence
RecommendationDescription
RecommendationEntityReference
RecommendationValue
RecommendationProvenance
RecommendationExplanationStatus
```

TypeScript実装ではrepository規約に従ってpropertyをcamelCase、JSON adapterではsnake_caseに写像する。Type名とpropertyの意味をadapterごとに再定義しない。

### 5.2 Purityとcompleteness

`selectNextTasks(text, options)`はrecommendation実装後に`NextResultV3`を返し、I/O、現在時刻、locale lookup、network lookupを行わない。Recommendation calculationは同じparse/semantic/analysis resultを使い、CLI rendererがrankingを再実装しない。

Coreの`RecommendationAnalysis`はStructured Explanation仕様のtier必須trace、minimal comparison witness、全resource conflict witness、発生したcontributing/tie evidenceをすべて保持する。Core typeをtext表示量に合わせて切り詰めない。

### 5.3 Existing resultとの直交性

`NextResultV3`はv2のclassification、`runnable_now`、resource rejection、upcoming explanationを保持し、新規root field `recommendation`を追加する。

- `groups.ready`はeligibilityであり、recommended setではない
- `groups.runnable_now`は現行scheduler selectionであり、recommended setではない
- `tasks[].resource_rejections`は`runnable_now`のwitnessであり、recommendation conflictではない
- `tasks[].explanation`はupcoming dependency explanationであり、recommendation traceではない
- recommendationはroot `recommendation`だけを正本とし、既存field名を再利用しない

## 6. Common wire primitives

### 6.1 Entity reference

Entity referenceは次のobjectとする。

```text
kind  "project" | "task" | "milestone" | "gate" | "resource" |
      "policy_rule" | "ranking_factor" | "negative_fact_kind" | "derived_set"
id    string
```

裸のID stringをkind付きreferenceの代用にしない。既存のtask ID配列などv2由来fieldは互換性のためstringのまま保持する。

### 6.2 Typed value

Scalar valueはtagged unionとする。

```text
{type: "boolean", value: boolean}
{type: "integer", value: decimal integer string}
{type: "rational", numerator: decimal integer string, denominator: positive decimal integer string}
{type: "enum", enum_type: string, value: string}
{type: "entity", value: RecommendationEntityReference}
```

Collection valueは同じscalar typeだけを含む。

```text
{type: "list", item_type: string, items: RecommendationScalarValue[]}
{type: "set", item_type: string, items: RecommendationScalarValue[]}
{type: "map", key_type: string, value_type: string,
 entries: [{key: RecommendationScalarValue, value: RecommendationScalarValue}]}
```

IntegerとRationalをJSON numberで返さない。Setとmap entryはStructured Explanation仕様のcanonical orderで並べる。Duplicate set itemまたはmap keyを許可しない。

### 6.3 Unit

Factの`unit`は次のいずれか、または`null`とする。

```text
{kind: "duration", value: "day" | "hour" | "point"}
{kind: "resource", resource: {kind: "resource", id: string}}
{kind: "ratio"}
null
```

Boolean、enum、entity referenceには`unit=null`を要求する。IntegerまたはRationalでも無次元countは`unit=null`とする。

### 6.4 Provenance

```text
kind                "document" | "precedence_analysis" | "ranking_algorithm" |
                    "resource_snapshot" | "recommendation_model"
source_digest       "sha256:" followed by 64 lowercase hex digits
entity_references   RecommendationEntityReference[]
producer            {id: string, version: string}
source_span         Span|null
```

`source_span`はdocument上の1箇所へ直接対応するfactだけで使用する。Derived factへ推測したspanを付けない。`source_digest`はresult rootと一致しなければならない。

### 6.5 Record ID encoding

Decision graph内のrecord IDは次の形とする。

```text
rec:<record_kind>:<semantic_component>[:<semantic_component>...]
```

`record_kind`は`decision|step|fact|comparison|reason|description`のいずれかとする。ComponentはStructured Explanation仕様のsemantic identity順に並べ、非適用値は`-`、canonical occurrence indexは0以上のdecimalとする。Component内でASCII unreserved `A-Z a-z 0-9 - . _ ~`以外のUTF-8 byteを`%HH`のuppercase percent encodingへ変換する。Delimiter `:`をcomponentから未escapeで出さない。

例:

```text
rec:decision:task:TASK_A
rec:step:TASK_A:eligibility:task_ready:0
rec:comparison:ranking:TASK_A:TASK_B:lower_total_float:0
rec:reason:TASK_A:recommended_set_selected:decisive:0
rec:description:TASK_A:recommendation.summary.recommended:0
```

Random UUID、array indexだけのID、locale text、display value、source offsetをrecord IDへ使用しない。

## 7. `Perttool.NextResult.v3`

### 7.1 Root差分

v3 rootはv2の全fieldに次を追加する。

```text
schema_version                    "Perttool.NextResult.v3"
recommendation_interface_version  1
recommendation                    RecommendationAnalysis
```

`recommendation`は成功した`dag next` resultで常に存在する。Ready taskが0件でも省略せず、empty recommended setとresult-level feasibility decisionを返す。

### 7.2 RecommendationAnalysis

```text
action                         "start"
algorithm:
  id                           "perttool.recommendation-ranking.lexicographic-frontier"
  version                      1
  optimal                      false
reason_taxonomy_version        "1.0"
explanation_model_version      1
expression_version             1
description_registry_version   1
description_locale             "en"
recommended_task_ids           string[]
result_decision                RecommendationResultDecision
task_decisions                 RecommendationTaskDecision[]
decision_steps                 RecommendationDecisionStep[]
facts                          RecommendationFact[]
comparisons                    RecommendationComparison[]
reason_occurrences             RecommendationReasonOccurrence[]
descriptions                   RecommendationDescription[]
explanation_status             RecommendationExplanationStatus
```

`optimal=false`はheuristicであることを示す。Field名を`score`、`best`、`optimal`などへ言い換えてglobal optimumを暗示しない。

`recommended_task_ids`はRanking Policyのrecommended setをscan orderで返す。Setの意味に暗黙の実行順を与えない。`task_decisions`はすべてのactual ready taskについてexactly one存在し、non-ready taskのdecisionを含まない。

### 7.3 Explanation status

CLI JSON v3はcomplete graphだけを返す。

```text
level                     "full"
complete                  true
decisive_chain_complete   true
truncated                 false
omitted_counts:
  decision_steps          0
  facts                   0
  comparisons             0
  reason_occurrences      0
  descriptions            0
```

Producerはsizeを理由に配列を黙って省略せず、上記固定値を満たせないresultを成功扱いにしない。

## 8. Decision graph wire schema

### 8.1 Result decision

```text
id                         string
action                     "start"
recommended_task_ids       string[]
joint_feasibility_fact_id  string
step_ids                   string[]
reason_occurrence_ids      string[]
```

`joint_feasibility_fact_id`は`startFeasible(R) == true`のfactを参照する。Recommended setがemptyでもfactを省略しない。

### 8.2 Task decision

```text
id                               string
subject_task_id                  string
action                           "start"
classification                   "ready"
tier                             "recommended" | "allowed" | "deferred" | "discouraged"
recommended_set_member           boolean
step_ids                         string[]
decisive_step_id                 string
reason_occurrence_ids            string[]
comparison_ids                   string[]
primary_higher_priority_task_id  string|null
summary_description_id           string
description_ids                  string[]
```

`recommended_set_member=true`と`tier=recommended`は同値でなければならない。`primary_higher_priority_task_id`の適用条件はStructured Explanation仕様を正とし、非適用時に上位taskを捏造しない。

### 8.3 Decision step

```text
id                            string
phase                         "eligibility" | "negative_fact_filter" |
                              "selection_horizon" | "candidate_ranking" |
                              "resource_selection" | "set_membership" |
                              "tier_classification"
rule                          RecommendationEntityReference
input_fact_ids                string[]
expression                    RecommendationExpression
result                        boolean
effect                        "supporting" | "opposing" | "blocking" | "neutral"
role                          "decisive" | "contributing" | "context"
reason_occurrence_ids         string[]
comparison_ids                string[]
depends_on_step_ids           string[]
```

`rule.kind`は`policy_rule`とする。`depends_on_step_ids`は同じdecision graph内の前方stepだけを参照する。

### 8.4 Fact

```text
id          string
kind        string
subject     RecommendationEntityReference
value       RecommendationValue
unit        RecommendationUnit|null
provenance  RecommendationProvenance
```

`kind`は宣言Taxonomy/Ranking/Explanation versionで登録済みでなければならない。表示用decimalを`value`へ入れない。

### 8.5 Expression

Termは次のいずれかとする。

```text
{kind: "fact", fact_id: string}
{kind: "literal", value: RecommendationValue, unit: RecommendationUnit|null}
```

Expressionは次のいずれかとする。

```text
{kind: "compare", left: Term,
 relation: "equal" | "not_equal" | "less_than" | "less_or_equal" |
           "greater_than" | "greater_or_equal" | "contains",
 right: Term}
{kind: "all", children: RecommendationExpression[]}
{kind: "any", children: RecommendationExpression[]}
```

Unknown nodeやrelationを既知nodeへ変換しない。`all`と`any`のchildrenは1件以上でなければならない。

### 8.6 Comparison

```text
id                         string
scope                      "ranking" | "selection_horizon" | "resource_selection" | "tier"
subject_task_id            string
alternative_task_id        string|null
winner_task_id             string|null
loser_task_id              string|null
decisive_rule              RecommendationEntityReference
decisive_expression        RecommendationExpression
prior_tied_rule_ids        string[]
contributing_rule_ids      string[]
fact_ids                   string[]
```

Active allocationだけのresource rejectionではtask間fieldを`null`とし、active blockerをfactで参照する。Empty stringや対象task自身をwinnerとして補完しない。

### 8.7 Reason occurrence

```text
id                         string
code                       string
subject                    RecommendationEntityReference
effect                     "supporting" | "opposing" | "blocking" | "neutral"
role                       "decisive" | "contributing" | "context"
fact_ids                   string[]
emission_expression        RecommendationExpression
decision_step_id           string
comparison_ids             string[]
description_id             string|null
```

`code`はTaxonomy version 1.0のASCII lower snake case identifierである。Task-level reasonの`subject.kind`は`task`、result-levelの`recommended_set_feasible`は`derived_set`とする。Reason-level description keyがregistryにある場合だけ`description_id`をnon-nullにし、codeから表示文やrule IDを推測しない。各task decisionの`summary_description_id`は常にnon-nullである。

### 8.8 Description

```text
id                         string
key                        string
registry_version           1
parameters                 [{name: string, value: RecommendationValue,
                             unit: RecommendationUnit|null}]
source_reason_ids          string[]
source_comparison_ids      string[]
locale                     "en"
text                       string
render_status              "rendered"
```

Parameterは名前のASCII辞書順で並べる。`text`はkeyとtyped parameterから導出するconvenience projectionであり、decision inputではない。Producerが登録済みkeyのtemplateを持たない場合はraw fallbackを成功resultへ入れず、invariant failureとする。

## 9. Canonical description rendering

### 9.1 Localeとvalue rendering

Interface version 1はcanonical locale `en`だけを持ち、locale optionを追加しない。将来localeを追加しても同じkey、parameter、tier、traceを変更しない。

Canonical value rendering:

- entity reference: stable `id`
- boolean: `true`または`false`
- integer: leading zeroのないdecimal
- Rational: denominatorが1ならnumerator、他は`numerator/denominator`
- duration unit: `d`、`h`、`p`
- resource unit: 対応resource IDを` <RESOURCE_ID>-units`として後置
- enum: 登録済みvalueをそのまま使用
- list/set: `[item1, item2]`、emptyは`[]`
- relation: registry valueをそのまま使用

Description textでは`--precision`のrounded displayを使用せず、exact valueを保持する。

### 9.2 Version 1 English templates

| Description key | Canonical template |
| --- | --- |
| `recommendation.summary.recommended` | `{task_id} is recommended by rule {decisive_rule_id}.` |
| `recommendation.summary.allowed` | `{task_id} is allowed as additional work, but {higher_priority_task_id} ranks higher by rule {decisive_rule_id}.` |
| `recommendation.summary.deferred_resource` | `{task_id} is deferred because resources {resource_ids} cannot fit it with the recommended set; selected blockers: {higher_priority_task_ids}; active blockers: {active_blocker_task_ids}.` |
| `recommendation.summary.deferred_policy` | `{task_id} is deferred by rule {decisive_rule_id}.` |
| `recommendation.summary.discouraged` | `{task_id} is discouraged because {negative_fact_kind} applies under rule {decisive_rule_id}.` |
| `recommendation.reason.ranking_comparison` | `{winner_task_id} ranks above {alternative_task_id} by rule {rule_id}: {winner_value} {relation} {alternative_value}.` |
| `recommendation.reason.resource_conflict` | `{task_id} cannot be added on {resource_id}: capacity {capacity}, used {used}, required {required}, deficit {deficit}, occupants {occupant_task_ids}.` |
| `recommendation.reason.policy_deferral` | `{task_id} is deferred by policy rule {rule_id}.` |
| `recommendation.reason.negative_fact` | `{task_id} is discouraged because {negative_fact_kind} applies under rule {rule_id}.` |

Template punctuation、ASCII space、parameter orderはregistry version 1の一部とする。Task titleやresource titleをtemplateへ自動挿入せず、stable IDを常に表示する。

## 10. CLI text contract

`dag next`のtextは既存headerとvelocity表示の後、`ACTIVE`より前に次のsummary sectionを追加する。

```text
RECOMMENDATION
ALGORITHM perttool.recommendation-ranking.lexicographic-frontier@1 optimal=false
EXPLANATION detail=summary complete=false machine_trace="--format json"
RECOMMENDED SET TASK_A,TASK_C

RECOMMENDED START
TASK_A tier=recommended rule=lower_total_float higher_priority=- blockers=-
  reason=ranking_rule_supports_task
  why: TASK_A is recommended by rule lower_total_float.

ALLOWED ADDITIONAL START
TASK_B tier=allowed rule=lower_total_float higher_priority=TASK_A blockers=-
  reason=ranking_rule_opposes_task
  why: TASK_B is allowed as additional work, but TASK_A ranks higher by rule lower_total_float.

DEFERRED START
-

DISCOURAGED START
-
```

Rules:

- 4 tier sectionを固定順で常に表示する
- taskはcomplete candidate orderで、各ready taskをexactly one sectionへ表示する
- empty sectionは`-`とする
- primary reasonはdecisive reason code、ruleはdecisive rule IDを表示する
- higher-priority taskが非適用なら`-`、blockerが複数ならstable orderのcomma listとする
- `why:`はsummary descriptionのcanonical English textを使用する
- recommended setがemptyなら`RECOMMENDED SET -`とする
- `optimal=false`とsummaryがcomplete traceではないことを省略しない
- 既存`ACTIVE`、`RUNNABLE NOW`、`READY / WAITING RESOURCE`、`BLOCKED NOW`、`UPCOMING` sectionを削除またはrecommendation tierへ置換しない

Text summaryからraw fact/ASTを復元させない。AIとautomationがdecision traceを必要とする場合は同じcommandの`--format json`を使用する。

## 11. JSON completeness、size、pagination

Version 1はdeterminismとexplainabilityを優先し、CLI JSONを常に`level=full`、`complete=true`で返す。

- explanation levelを変更するCLI optionを持たない
- graph paginationを持たない
- byte limitまたはrecord count limitを持たない
- task filterで他taskのcomparison witnessを欠落させない
- terminal width、TTY、environment variableで内容を変えない

Result sizeはready task数、発生rule、fact、resource witnessに応じて増加する。将来size制御を追加する場合、cross-reference closure、continuation tokenのsnapshot binding、decisive chain completenessを別interface versionで固定する。Version 1 producerが独自limitでtruncated graphを返してはならない。

CLI textは明示的なsummary projectionであり、JSON graphのtruncationではない。`complete=false`とmachine trace導線をheaderへ表示する。

## 12. Orderingとdeterminism

JSON arrayは次の順を使用する。

1. `recommended_task_ids`: Ranking Policyのscan order
2. `task_decisions`: complete candidate order、candidateでないready taskはtask ID順
3. `decision_steps`: phase、rule order、step ID
4. `facts`: fact kind、subject kind、subject ID、fact ID
5. `comparisons`: scope、subject task、alternative task、decisive rule、comparison ID
6. `reason_occurrences`: decision phase、rule order、subject、alternative、code、occurrence ID
7. `descriptions`: source task order、key、description ID
8. reference ID配列: semantic ruleが順序を持つ場合はその順、他はstable ID順

JSON object keyはschema記載順、末尾newlineあり、ANSIなしとする。同じdocument bytes、options、全version、tool versionからbyte-identical JSONとtextを返す。Description locale `en`は環境の`LANG`やtimezoneで変えない。

## 13. Unknown versionとconsumer safety

Consumerは次を守る。

- unknown `schema_version`をv2/v3として推測解釈しない
- known schemaでもunknown tier enum、expression node、decisive reason code、decisive rule、model major versionを既知値へ変換しない
- unknown optional contributing reasonだけで既知のtierを再分類しない
- unknown decisive semanticsがあるtaskを自動開始しない
- unknown objectとtyped valueを可能な限りlosslessに保持する
- derived English `text`だけから欠けたauthorityを復元しない

Producerは自身が宣言するversionでunknown code、key、node、relationを出力してはならない。Minor-compatible taxonomy追加を知らないconsumerはraw code/factを表示できるが、理解していないdecisive reasonを基に自動実行しない。

## 14. Diagnosticsとexit code

Recommendation invariant failureには次のnamespaceを予約する。

| Code | Severity | 意味 |
| --- | --- | --- |
| `PTREC-301` | error | tier、set membership、decision trace、reference closureの不一致 |
| `PTREC-302` | error | declared algorithm/taxonomy/model versionとcode、rule、fact、expressionが不一致 |
| `PTREC-303` | error | description key、parameter、template、rendered textの不一致 |

これらはvalid user documentの入力errorではなくinternal invariant failureである。CLIは成功した`NextResult.v3`を出力せず、[CLI Interface仕様](interfaces.md)のinternal error exit `70`を使用する。Diagnosticには可能な範囲でdecision、task、fact、rule IDを`data`へ含めるが、stack trace、document全体、absolute pathを含めない。

Ready taskが0件、recommended setがempty、全horizon taskがresource conflictであることは正常resultであり、`PTREC-*`を生成しない。

## 15. `NextResult.v2`からのmigration

Recommendation実装を公開するlogical changeで`dag next`のdefault schemaをv2からv3へ上げる。

| v2 | v3 |
| --- | --- |
| `schema_version=Perttool.NextResult.v2` | `schema_version=Perttool.NextResult.v3` |
| recommendation fieldなし | required root `recommendation` |
| `groups`と`tasks` | fieldと意味を維持 |
| `tasks[].resource_rejections` | scheduler rejectionのまま維持 |
| `tasks[].explanation` | upcoming dependency explanationのまま維持 |
| textはoperational stateから開始 | recommendation summaryを先頭側へ追加 |

Migration rules:

1. v2 fieldをrecommendationとして再解釈しない
2. v3 consumerは`schema_version`を最初に検査する
3. v2 consumerがv3を黙って受理することに依存しない
4. `--schema-version 2`などのdual emission optionを追加しない
5. implementation、help、Core/CLI JSON parity test、golden、package documentationを同じlogical changeで更新する
6. pre-release中のbreaking migrationとしてCHANGELOGへ記録する

## 16. Minimal JSON example

次は参照形状を示す抜粋であり、complete resultではない。

```json
{
  "schema_version": "Perttool.NextResult.v3",
  "recommendation_interface_version": 1,
  "recommendation": {
    "action": "start",
    "algorithm": {
      "id": "perttool.recommendation-ranking.lexicographic-frontier",
      "version": 1,
      "optimal": false
    },
    "reason_taxonomy_version": "1.0",
    "explanation_model_version": 1,
    "expression_version": 1,
    "description_registry_version": 1,
    "description_locale": "en",
    "recommended_task_ids": ["TASK_A"],
    "task_decisions": [
      {
        "id": "rec:decision:task:TASK_A",
        "subject_task_id": "TASK_A",
        "action": "start",
        "classification": "ready",
        "tier": "recommended",
        "recommended_set_member": true,
        "step_ids": ["rec:step:TASK_A:eligibility:task_ready:0", "rec:step:TASK_A:set_membership:recommended_set_selected:0"],
        "decisive_step_id": "rec:step:TASK_A:set_membership:recommended_set_selected:0",
        "reason_occurrence_ids": ["rec:reason:TASK_A:recommended_set_selected:decisive:0"],
        "comparison_ids": ["rec:comparison:ranking:TASK_A:TASK_B:lower_total_float:0"],
        "primary_higher_priority_task_id": null,
        "summary_description_id": "rec:description:TASK_A:recommendation.summary.recommended:0",
        "description_ids": ["rec:description:TASK_A:recommendation.summary.recommended:0"]
      }
    ],
    "explanation_status": {
      "level": "full",
      "complete": true,
      "decisive_chain_complete": true,
      "truncated": false,
      "omitted_counts": {
        "decision_steps": 0,
        "facts": 0,
        "comparisons": 0,
        "reason_occurrences": 0,
        "descriptions": 0
      }
    }
  }
}
```

Actual resultは`result_decision`、全ready task decision、step、fact、comparison、reason、descriptionを含み、抜粋をcomplete resultとして出力してはならない。

## 17. 後続設計taskへ送る事項

### `NORMATIVE_EXAMPLES`

[Recommendation規範例](../examples/recommendation.md)で次のgolden/test観点を固定した。

- v3 complete JSON goldenとtext summary golden
- critical対priority、parallel recommended、horizon外allowed
- selected blockerとactive-only blockerを区別するresource conflict
- empty recommended set、ready task 0件
- exact Rational、entity reference、expression evaluation、description rendering
- v2 fieldの意味を維持するmigration test
- `PTREC-301`から`PTREC-303`のinvariant test

### `PROCESS_MIGRATION`

- recommendation実装sliceのCoreからadapterまでの順序
- v3切替時のCHANGELOG、help、consumer migration guide
- AI development flowでJSON recommendationをtask選択authorityにするgate

### [`HUMAN_OVERRIDE_CONTRACT`](recommendation-override.md)（確定）

- normal `recommendation` graphを変更せずoverrideを別resultへ接続する方法
- actor、reason、selected task、source recommendation identityの型
- read-only recommendationとwrite/audit boundary

## 18. 本sliceのacceptance

- Core conceptual typeとv3 root fieldを定義した
- typed value、unit、provenance、entity referenceのwire encodingを定義した
- decision、step、fact、expression、comparison、reason、descriptionのfieldを固定した
- canonical English templateとexact value renderingを定義した
- text summaryとcomplete JSONの責務を分離した
- v3ではpagination、size limit、truncationを採用しない判断を明示した
- unknown decisive semanticsを自動実行しないconsumer ruleを定義した
- recommendation invariant diagnosticとexit 70の境界を定義した
- `NextResult.v2`からv3へのbreaking migrationを定義した
- current interfaceとimplementationを変更していない
