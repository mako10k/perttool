# Recommendation Structured Explanation 仕様

- 文書状態: Normative 1.0
- Explanation model version: 1
- Expression version: 1
- Description registry version: 1
- 作成日: 2026-07-22
- 対応要件: [../requirements.md](../requirements.md)
- Recommendation semantics: [recommendation.md](recommendation.md)
- Recommendation ranking: [recommendation-ranking.md](recommendation-ranking.md)
- Reason taxonomy: [recommendation-reasons.md](recommendation-reasons.md)
- Recommendation interface: [recommendation-interface.md](recommendation-interface.md)
- Human override: [recommendation-override.md](recommendation-override.md)
- 関連Issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. 目的

本仕様は、recommendationの結論をstable reason codeだけで終わらせず、AIと人間が「なぜこのtaskで、別のtaskではないのか」をrankingの再推論なしに回答できるstructured explanation modelを固定する。

次を定義する。

- exact valueとprovenanceを持つtyped fact
- factに対する制限付きboolean expression
- versioned ruleの適用過程を示すdecision step
- winner、alternative、decisive rule、contributing ruleを持つcomparison
- recommended set選択とtier付与を再現できるdecision trace
- stable description keyとtyped parameterからの派生text
- 決定性、versioning、integrity、truncationの境界

本仕様はsemantic modelである。Core type名、JSON field名、text layout、CLI option、schema migrationは[Recommendation Interface Contract仕様](recommendation-interface.md)で固定する。

## 2. 規範上の位置

意味や設計が競合する場合は次の順で解決する。

1. `docs/requirements.md`のMust requirement
2. [Recommendation Semantics仕様](recommendation.md)
3. Rankingの意味は[Recommendation Ranking Policy仕様](recommendation-ranking.md)
4. Reason codeとfact categoryの意味は[Recommendation Reason Taxonomy仕様](recommendation-reasons.md)
5. 本仕様
6. Analysis、Interface、basic design、example、test、help、implementation

本仕様はranking factorの優先順、reason codeの発生条件、recommendation tierを再定義しない。

## 3. Scope

対象:

- actual `ready` taskごとのnormal recommendation判断
- result-levelのrecommended set `R`選択
- ranking、selection horizon、resource feasibility、tier classificationの説明
- stable reason occurrence、fact、comparison、decision stepの参照関係
- human-readable descriptionを派生するためのnon-text契約
- AIが比較対象と決定条件を機械的に読む契約

対象外:

- recommendation rankingの変更
- reason taxonomyへのcodeを追加すること
- human overrideのaudit trace
- Core/CLI/JSONの具体的schema
- localeごとの実テンプレートと翻訳catalog
- explanation level、byte limit、既定text表示量
- lifecycle上のnon-ready taskのupcoming explanationの置き換え
- recommendation実装

## 4. Model identityと全体構造

Version 1のidentityを次とする。

```text
explanation_model_version     = 1
expression_version            = 1
description_registry_version  = 1
```

Conceptual modelは次の参照graphを持つ。

```text
Recommendation explanation
├── result decision
├── task decisions[]
│   ├── decision steps[]
│   ├── reason occurrences[]
│   ├── comparison references[]
│   └── description projection
├── facts[]
└── comparisons[]
```

Factはproject snapshotまたはversioned analysisから導出した値、expressionはfactに対する検査可能な条件、decision stepはversioned ruleの1回の適用、reason occurrenceはTaxonomy codeと判断上の役割、comparisonはtask間またはset/resource判断の対比を表す。

Natural language descriptionはこのgraphからの派生projectionであり、graphを復元する入力にしない。

## 5. Stable identity

各1 request内でfact ID、decision ID、decision step ID、reason occurrence ID、comparison ID、description projection IDを付与する。

Identityは次のsemantic componentから決定的に導出する。

- subject entity kindとstable ID
- fact kindまたはrule ID
- ranking phaseまたはtier phase
- alternative entityがある場合はそのstable ID
- 同じsemantic keyが複数回出る場合はversioned ruleが定義するcanonical occurrence index

Random UUID、arrayへの追加順、locale text、表示用decimal、memory addressをidentityに使用しない。外部文字列へのencodingは[Recommendation Interface Contract仕様](recommendation-interface.md)で固定する。

## 6. Typed fact

### 6.1 Fact occurrence

Fact occurrenceは少なくとも次の意味を持つ。

```text
fact_id
fact_kind
subject_entity
value
unit
provenance
```

`fact_kind`はReason TaxonomyまたはRanking Policyに登録されたtyped fact/factorを参照する。`subject_entity`はkind付きentity referenceである。`unit`はRationalまたはintegerが単位付きquantityを表す場合だけ適用し、無次元valueでは非適用とする。

### 6.2 Value type

Version 1のfact valueは次の有限typeに限定する。

- boolean
- arbitrary-precision integer
- exact Rational
- finite enum
- kind付きentity reference
- 上記の同typeからなる有限ordered list
- 上記の同typeからなる有限set
- resource IDなどstable keyから同type valueへの有限map

Binary floating point、NaN、数値infinity、locale-formatted string、自由記述text、opaque objectをfact valueに使用しない。Structural distanceの`infinity`はRanking Policyが定義するfinite enum sentinelとして扱う。

Setはsemantic上無順序である。Canonical projectionではvalue type、entity kind、stable ID、exact valueの順に安定化する。Ordered listはruleが順序の意味を明示した場合だけ使用する。

### 6.3 Provenance

Provenanceは値の導出元を次のいずれかとして示す。

- `document`: DSL entityの明示field、stored state、dependency
- `precedence_analysis`: analysis versionとsource entity
- `ranking_algorithm`: ranking algorithm ID/version、rule/factor ID
- `resource_snapshot`: applied capacity option、active allocation、selected set snapshot
- `recommendation_model`: set membership、tier、derived invariant

Provenanceはsource digest、関連entity reference、algorithm/model versionを、fact自身またはresult-level contextへの参照として特定できなければならない。Source spanは[Recommendation Interface Contract仕様](recommendation-interface.md)に従ってdocument factだけへ適用できるが、document factかanalysis factかの区別は失ってはならない。

## 7. Restricted expression

### 7.1 目的と制限

Expressionはreasonが発生した条件とdecision stepの結果を機械的に再評価するboolean ASTである。Version 1は次のnodeだけを持つ。

```text
ScalarTerm = FactReference | Literal

Expression =
  Compare(ScalarTerm, relation, ScalarTerm)
  All(Expression[])
  Any(Expression[])
```

`Literal`は第6.2節のtypeの値である。`FactReference`は同じexplanation graph内のfact IDを参照する。

### 7.2 Relation

Version 1はrelationを次に限定する。

| Relation | 適用type | 意味 |
| --- | --- | --- |
| `equal` | すべての同type | 厳密に等しい |
| `not_equal` | すべての同type | 厳密に等しくない |
| `less_than` | integer、Rational、登録済みordered enum | 左が右より小さい |
| `less_or_equal` | integer、Rational、登録済みordered enum | 左が右以下 |
| `greater_than` | integer、Rational、登録済みordered enum | 左が右より大きい |
| `greater_or_equal` | integer、Rational、登録済みordered enum | 左が右以上 |
| `contains` | setまたはmapと要素/key | 左が右を含む |

Typeの異なるvalue間の比較、unitの異なるnumeric value間の比較、unordered enumへの大小比較はexpression invariant failureとする。

### 7.3 Evaluation

- `Compare`は左右のtermを解決し、exact relationを評価する
- `All`は1件以上のchildrenがすべてtrueの場合だけtrue
- `Any`は1件以上のchildrenのうち1件以上がtrueの場合だけtrue
- childrenがemptyの`All`または`Any`はexpression invariant failureとする
- missing fact、unknown relation、type mismatchをfalseへ変換しない
- reason occurrenceが参照するemission expressionはtrueでなければならない
- decision stepはexpressionの実測resultを持ち、再評価resultと一致しなければならない

ASTはacyclic tree、最大depth 8とする。Function call、変数、代入、arithmetic、regex、script、current time、external lookup、natural language predicateを許可しない。必要な演算値はversioned analysis/rankingでtyped factとして先に導出する。

## 8. Comparison

Comparisonは少なくとも次の意味を持つ。

```text
comparison_id
scope
subject_task
alternative_task
winner_task
loser_task
decisive_rule
decisive_expression
prior_tied_rules
contributing_rules
fact_references
```

`scope`は`ranking | selection_horizon | resource_selection | tier`のいずれかとする。Task間の比較が成立しないactive allocationだけのresource rejectionでは、`alternative_task`、`winner_task`、`loser_task`を非適用とし、active blocker entityとresource witnessをfact referenceで示す。Task winnerを捏造しない。

`decisive_rule`は結果を最初に分けたregistered rule IDである。`prior_tied_rules`はdecisive ruleより前に評価してtieだったrule、`contributing_rules`はdecisive rule後にwinnerを支持したruleである。Ranking Policyの`supporting_rules`は、Reason Taxonomyでは`effect=supporting`かつ`role=contributing`のreason occurrenceへ対応する。

Comparisonはwinnerがrecommendedであることを暗黙に意味しない。Ranking winner、horizon membership、resource scan selection、final tierを独立に持つ。

## 9. Decision trace

### 9.1 Decision

Result-level decisionはrecommended set `R`とjoint feasibility、task-level decisionはready taskのset membershipとtierを対象とする。Task decisionは少なくとも次の意味を持つ。

```text
decision_id
subject_task
action = start
classification = ready
recommendation_tier
recommended_set_membership
steps
decisive_step
reason_occurrences
comparison_references
primary_higher_priority_task
description_projection
```

`primary_higher_priority_task`は次の場合だけ適用する。

- horizon外task: horizon内candidate orderの先頭task
- horizon内resource reject: Ranking Policyが定義する最初のready-task contributor
- modeled negative fact: 非適用
- active allocationだけのreject: 非適用

非適用の場合に別taskを推測して補完しない。

### 9.2 Decision step

Decision stepは次の意味を持つ。

```text
step_id
phase
rule_reference
input_fact_references
expression
result
effect
role
reason_occurrence_references
comparison_references
depends_on_steps
```

`phase`は次の固定順とする。

1. `eligibility`
2. `negative_fact_filter`
3. `selection_horizon`
4. `candidate_ranking`
5. `resource_selection`
6. `set_membership`
7. `tier_classification`

`effect`と`role`はReason Taxonomyの定義を使用する。`depends_on_steps`は前方stepだけを参照するDAGであり、cycleを許可しない。`decisive_step`かtier conclusionから完全なtyped factまで辿れないtraceはinvalidである。

### 9.3 Tierごとの必須trace

`recommended`:

- `task_ready`のeligibility step
- selection horizon所属を示すranking support step
- `recommended_set_selected`のset membership step
- result-level `recommended_set_feasible`への参照

`allowed`:

- `task_ready`のeligibility step
- primary higher-priority taskまたhorizon ruleとのdecisive comparison
- `recommended_set_not_selected`のset membership step
- `startFeasible(R union {t}) == true`のaddition feasibility step

`deferred`:

- `task_ready`のeligibility step
- `recommended_set_not_selected`のset membership step
- `policyDefers(t) == true`または`startFeasible(R union {t}) == false`のdecisive step
- resource conflictの場合は違反した全resource witnessとactive/selected contributor

`discouraged`:

- `task_ready`のeligibility step
- `recommended_set_not_selected`のset membership step
- 登録済みnegative factと適用ruleのdecisive step

Taxonomy version 1.0ではregistered negative factがないため、normal resultは`discouraged` traceを生成しない。

### 9.4 Minimal comparison witness

各non-recommended taskは、非選択の決定理由となったcomparisonまたはresource/negative witnessを少なくとも1件持つ。

- horizon外のallowed/deferred taskは、horizon先頭taskとのdirect comparisonを持つ
- horizon内resource rejectは、先行selected contributorとresource capacity witnessを持つ
- active allocationだけのrejectはactive taskとresource witnessを持ち、ready-task winnerを持たない
- negative factはrelevant fact/ruleを持ち、無関係な上位taskを指さない

特定の2 task間の追加comparisonはRanking Policyのcomplete orderから決定的に導出できる。[Recommendation Interface Contract仕様](recommendation-interface.md)のVersion 1 resultは、実際のset/tier判断で発生したcomparisonとminimal witnessを完全に含めるが、判断に使用しなかった全task pairの総当たりcomparisonやquery optionは持たない。Minimal witnessを省略してconsumerへ全rankingの再推論を求めてはならない。

## 10. Reason occurrence

Reason occurrenceは少なくとも次の意味を持つ。

```text
reason_occurrence_id
reason_code
subject_entity
effect
role
fact_references
emission_expression
decision_step_reference
comparison_references
description_projection_if_applicable
```

- task-level reasonの`subject_entity`はtask、result-levelの`recommended_set_feasible`はderived set `R`とする
- `reason_code`は宣言Taxonomy versionへ登録済みである
- `effect`と`role`はcodeが許可する組み合わせである
- `emission_expression`はfactからtrueへ再評価できる
- `decisive`のreasonは必ずdecisive stepまたはそのancestor stepへ接続する
- outcome codeと因果codeを同じoccurrenceへ混在させない
- Version 1 registryに対応するreason-level description keyがある場合だけdescription projectionを要求する。Task decisionのsummary descriptionは常に要求する
- 自然言語textをfact referenceやexpressionの代用にしない

Reasonの発生順序はdecision phase、rule order、subject entity kind、subject stable ID、alternative task ID、reason code、occurrence IDの順に安定化する。

## 11. Description projection

Description projectionは人間向けtextを決定的に生成する入力であり、次の意味を持つ。

```text
description_key
description_registry_version
parameters
source_reason_occurrences
source_comparisons
```

Parameter valueは第6.2節のtypeに限定し、名前はASCII lower snake caseとする。Mapはparameter名のASCII辞書順で安定化する。Task titleやresource titleは表示用entity lookupとして追加できるが、stable IDの代用にしない。

### 11.1 Version 1 key registry

| Description key | 適用条件 | 必須parameter |
| --- | --- | --- |
| `recommendation.summary.recommended` | task tierが`recommended` | `task_id`、`decisive_rule_id` |
| `recommendation.summary.allowed` | task tierが`allowed` | `task_id`、`higher_priority_task_id`、`decisive_rule_id` |
| `recommendation.summary.deferred_resource` | resource conflictで`deferred` | `task_id`、`resource_ids`、`higher_priority_task_ids`、`active_blocker_task_ids`。後二者の1つ以上はnonempty |
| `recommendation.summary.deferred_policy` | policy deferで`deferred` | `task_id`、`decisive_rule_id` |
| `recommendation.summary.discouraged` | modeled negative factで`discouraged` | `task_id`、`negative_fact_kind`、`decisive_rule_id` |
| `recommendation.reason.ranking_comparison` | task間ranking comparison | `winner_task_id`、`alternative_task_id`、`rule_id`、`winner_value`、`alternative_value`、`relation` |
| `recommendation.reason.resource_conflict` | set additionがresource infeasible | `task_id`、`resource_id`、`capacity`、`used`、`required`、`deficit`、`occupant_task_ids` |
| `recommendation.reason.policy_deferral` | `policyDefers(t) == true` | `task_id`、`rule_id` |
| `recommendation.reason.negative_fact` | registered negative factが適用 | `task_id`、`negative_fact_kind`、`rule_id` |

`recommended` summaryの`decisive_rule_id`はselection horizonまたはresource scanでmembershipを決めたruleを指す。単に`recommended_set_selected`というoutcome codeをruleの代わりにしない。

Parameter名が`task_id`、`resource_id`、`rule_id`、`negative_fact_kind`またはそれらの複数形で終わる場合、値は裸のstringではなく、対応するkind付きentity referenceまたはその有限collectionとする。`relation`は登録済みenum、数量valueはfactと同じexact numeric valueとunitを使用する。

Allowed taskでprimary higher-priority taskが定義上存在しないcaseはVersion 1 Ranking Policyで生じない。将来algorithmがそのcaseを許す場合はdescription registry versionを更新し、必須parameterを黙って省略しない。

### 11.2 Derived text

Rendererはdescription keyに対応するversioned templateにtyped parameterを適用してtextを生成する。

- locale選択は同typed inputの表示だけを変え、tier、reason、comparison、stepを変えない
- Rationalはexact numerator/denominatorを保持し、display precisionは派生情報とする
- unknown description keyを別keyへ推測変換しない
- Templateまたはlocaleがない場合はraw keyとtyped parameterを表示可能にし、意味を捏造しない
- textだけを保存してsource occurrenceとcomparisonを破棄しない

Canonical default localeとtemplate文言、text/JSONの既定表示は[Recommendation Interface Contract仕様](recommendation-interface.md)で固定する。

## 12. Deterministic orderingとdeduplication

Semantic modelのcanonical orderを次とする。

1. task decision: Ranking Policyのcomplete candidate order、非適用はtask ID順
2. decision step: 第9.2節のphase、rule order、step ID順
3. comparison: scope、subject task ID、alternative task ID、decisive rule ID、comparison ID順
4. fact: fact kind、subject entity kind、subject stable ID、fact ID順
5. reason occurrence: 第10章の順
6. description parameter: parameter名順

同じreason codeでもsubject、role、expression、comparisonが異なるoccurrenceをdeduplicateしない。Semantic identity componentがすべて一致するoccurrenceだけを1件にする。

## 13. Completenessとtruncation boundary

Core semantic explanationは、第9.3節のtier必須traceと第9.4節のminimal comparison witnessを完全に持つ。Decisive chainの途中、必須fact、全resource conflict witnessを黙って省略しない。

Adapterは[Recommendation Interface Contract仕様](recommendation-interface.md)が許可する場合だけ表示projectionをtruncateできる。その場合も次を満たす。

- source semantic modelは切り詰めない
- truncationがあることと省略数を明示する
- tier、primary reason、decisive rule、primary higher-priority taskまたはblockerを残す
- 詳細を取得する手段を提供する
- truncated textをcomplete decision traceと表示しない

Size limit、explanation level、pagination、CLIのデフォルトは[Recommendation Interface Contract仕様](recommendation-interface.md)で固定する。

## 14. Integrityとre-analysis

Explanation producerは少なくとも次を検査する。

1. すべてのreference先が同じresultまたはdeclared registryに存在する
2. fact type、unit、provenanceがfact kindと一致する
3. expressionがtype-correctで再評価可能である
4. reason emission expressionがtrueである
5. step resultがexpression resultと一致する
6. decisive stepからすべての必須factへ到達できる
7. comparisonのwinner/alternativeとRanking Policyのcomplete orderが一致する
8. reason code、effect、role、必須factがTaxonomyと一致する
9. task tierとset membershipがRecommendation Semanticsと一致する
10. task decisionにsummary descriptionがあり、適用されたdescription keyの必須parameterが欠けていない
11. non-ready taskがtask recommendation decisionを持たない
12. 同じsnapshot/options/versionから同じidentity、order、traceを返す

違反をdescription欠落やunknown reasonとして黙って継続せず、analysis invariant failureとする。Diagnosticとexit codeは[Recommendation Interface Contract仕様](recommendation-interface.md)で固定する。

Recommendation Semantics仕様の再解析条件に加え、Ranking algorithm version、Taxonomy version、Explanation model version、Expression version、Description registry versionのいずれかが変わった場合は古いexplanationを再利用しない。Description templateだけの変更はdecision traceを無効にしないが、派生textは再生成する。

## 15. Conceptual example

次はwire schemaではなく、minimal explanationの意味例である。

```text
Task: TASK_A
Tier: recommended
Reason: ranking_rule_supports_task (decisive)
Rule: lower_total_float
Expression: fact(TASK_A.total_float) less_than fact(TASK_B.total_float)
Facts: TASK_A.total_float = 0p, TASK_B.total_float = 3p
Comparison: winner=TASK_A, alternative=TASK_B
Description key: recommendation.reason.ranking_comparison
Description params:
  winner_task_id = TASK_A
  alternative_task_id = TASK_B
  rule_id = lower_total_float
  winner_value = 0p
  alternative_value = 3p
  relation = less_than

Task: TASK_B
Tier: allowed
Higher priority: TASK_A
Reason: ranking_rule_opposes_task (decisive)
Additional capacity: startFeasible(R union {TASK_B}) = true
```

Rendererは例えば「TASK_Aはtotal float 0pで、TASK_Bの3pより小さいため優先された」というtextを派生できる。このtextは例であり、比較の正本はrule、expression、typed fact、comparisonである。

## 16. Versioning

次はExplanation model versionの変更を必要とする。

- fact occurrence、decision、step、comparison、reason occurrenceの必須意味の変更
- decisive chainまたはminimal witnessの完全性変更
- phaseの追加、削除、並び変更
- semantic identityまたはcanonical orderの変更

次はExpression versionの変更を必要とする。

- node、relation、value type、evaluation、depth制限の変更

Description keyの追加はDescription registryのminor-compatibleな更新として扱えるが、既存keyの意味変更、削除、必須parameterの互換性を壊す変更はmajor更新とする。外部version表現は[Recommendation Interface Contract仕様](recommendation-interface.md)で固定する。

## 17. 後続設計taskへ送る事項

### [`INTERFACE_CONTRACT`](recommendation-interface.md)（確定）

- Core type名と`NextResult.v3` serialization schema
- `NextResult.v2`からのbreaking migration
- complete JSONとsummary textの固定projection
- canonical locale `en`とversion 1 template
- pagination、size limit、JSON truncationをVersion 1へ入れない判断
- unknown version/keyのadapter behavior
- `PTREC-*` invariant diagnosticとexit 70

### `NORMATIVE_EXAMPLES`

[Recommendation規範例](../examples/recommendation.md)で次を固定した。

- critical対priority、resource conflict、parallel recommended、horizon外allowed
- active allocationだけのrejectでtask winnerを捏造しないcase
- decisive ruleより前のtieと後のcontributing rule
- description key/parameterからの派生text
- summary projectionとcomplete Core traceの分離

### [`HUMAN_OVERRIDE_CONTRACT`](recommendation-override.md)（確定）

- normal recommendation traceとoverride decision artifactを分離する
- normal decision/reason/comparison IDをcopyせず参照する
- replacement setのresource witnessに制限付きexpressionを使用する
- human reason textをnormal ranking factへ戻さない

## 18. 本sliceのacceptance

- typed factのvalue、provenance、identityを定義した
- 制限付きboolean expression ASTとexact evaluationを定義した
- winner、alternative、decisive/contributing ruleのcomparisonを定義した
- result/task decision、phase、step dependencyを定義した
- tierごとの必須traceとminimal comparison witnessを定義した
- Reason Taxonomyのcode/effect/role/fact契約へ接続した
- stable description keyとtyped parameterからtextを派生する境界を定義した
- Core semantic modelのcompletenessとadapter truncationを分離した
- model/expression/description registryのversioningを定義した
- current interfaceとimplementationを変更していない
