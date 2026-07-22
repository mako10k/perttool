# Recommendation Reason Taxonomy 仕様

- 文書状態: Normative Draft 0.1
- Taxonomy version: 1.0
- 作成日: 2026-07-22
- 対応要件: [../requirements.md](../requirements.md)
- Recommendation semantics: [recommendation.md](recommendation.md)
- Recommendation ranking: [recommendation-ranking.md](recommendation-ranking.md)
- Structured explanation: [recommendation-explanation.md](recommendation-explanation.md)
- Recommendation interface: [recommendation-interface.md](recommendation-interface.md)
- Human override: [recommendation-override.md](recommendation-override.md)
- Analysis仕様: [analysis.md](analysis.md)
- 関連Issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. 目的

本仕様は、recommendationのset選択とtier付与に使うreasonを、安定した機械可読codeとproject factへ分解する規範仕様である。

次を固定する。

- lower snake caseのstable reason code
- codeごとの発生条件
- reasonのeffectとdecision上のrole
- codeが要求するtyped factとentity参照
- recommended set選択と4 tierへの対応
- 未model化factをreasonへ混入させない境界
- taxonomyとunknown codeの互換性
- 構造化expression、decision trace、description projectionへ渡す入力

Reason codeだけで「なぜこのtaskで別taskではないか」を説明したとはみなさない。Codeはreasonの分類であり、適用rule、typed fact、比較対象、決定条件を置き換えない。

## 2. 規範上の位置とscope

意味や設計が競合する場合は次の順で解決する。

1. `docs/requirements.md`のMust requirement
2. [Recommendation Semantics仕様](recommendation.md)
3. Rankingの意味は[Recommendation Ranking Policy仕様](recommendation-ranking.md)、reasonの意味は本仕様
4. [Analysis仕様](analysis.md)
5. [Recommendation Structured Explanation仕様](recommendation-explanation.md)、[Recommendation Interface Contract仕様](recommendation-interface.md)
6. example、test、help、implementation

対象:

- actual `ready` taskに対するnormal recommendation
- recommended set `R`への選択または非選択
- `recommended`、`allowed`、`deferred`、`discouraged`のtier決定
- project modelとversioned policyから導出できるfact/rule category
- AI、人間、adapterが同じ意味で解釈するreason vocabulary

対象外:

- ranking factorの優先順、weight、selection horizon、tie-break
- critical、float、priority、successor impact、gate/milestone distanceの計算規則
- 自然言語description、localization、template、message ID
- expression AST、decision traceのnode構造と評価規則
- Core type、JSON field、schema、text layout、ordering、size limit
- human override reasonとaudit storage。[Recommendation Human Override Contract仕様](recommendation-override.md)を正とする
- lifecycle diagnostic、`blocked_reason`、`runnable_now`の既存resource rejectionの置換
- interfaceまたは実装の変更

Ranking factorの意味と比較規則は[Recommendation Ranking Policy仕様](recommendation-ranking.md)が固定する。本仕様は、それらを安定codeから参照するcategoryと、set/tier決定へ接続する条件を固定する。

## 3. Reasonの構成

Reason occurrenceは概念上、次の情報を持つ。

```text
reason occurrence
├── stable reason code
├── effect
├── decision role
├── typed facts
└── entity references
```

これはwire schemaではない。Field名、入れ子、配列、cardinalityはStructured Explanation Modelと[Recommendation Interface Contract仕様](recommendation-interface.md)で固定する。

### 3.1 Effect

Effectは、評価対象taskを現在開始する判断に対してreasonが持つ向きを表す。

| Effect | 意味 |
| --- | --- |
| `supporting` | taskの選択または開始を支持する |
| `opposing` | 他のfactまたはruleと比較してtaskの選択を弱めるが、それ単独では開始不能を意味しない |
| `blocking` | normal recommendationでは特定のset membershipまたはstart authorityを成立させない |
| `neutral` | tie、適用domain、集合不変条件など、向きを持たないdecision contextを表す |

`blocking`はtaskが永久に実行不能であることを意味しない。例えばresource conflictは`R`を維持した同時開始を妨げるだけであり、project stateまたは選択集合が変われば解消し得る。

### 3.2 Decision role

Decision roleは、そのoccurrenceが現在の結論へどう寄与したかを表す。

| Role | 意味 |
| --- | --- |
| `decisive` | この条件または規則がなければ、set membershipまたはtierの結論が変わり得る |
| `contributing` | 結論を支持または反対するが、単独では現在の結論を決めていない |
| `context` | domain、不変条件、tieなどを示し、選択差を直接生んでいない |

同じcodeで許されるroleはtaxonomy tableで制限する。実際のroleはversioned ranking ruleの適用順とRecommendation Semantics仕様のclassification orderから決定し、表示側が推測してはならない。

## 4. Code identifierと安定性

Reason codeはASCII lower snake caseとし、次を満たす。

```text
[a-z][a-z0-9]*(?:_[a-z0-9]+)*
```

- codeはlocale、task ID、resource ID、rule ID、数値を埋め込まない
- 同じcodeを別の発生条件または別のeffectへ再利用しない
- code名を自然言語descriptionとして分割、翻訳、言い換えない
- project固有のtag、title、自由記述から動的codeを生成しない
- codeだけを受け取って、欠けたfact、rule、比較対象をconsumerが再推論しない

Entity固有情報と値はtyped factとentity referenceで運ぶ。

## 5. Typed fact category

本仕様は後続schemaへ渡す意味上のfact kindを固定する。値のwire表現は固定しない。

| Fact kind | 必須の意味 | 参照するentity |
| --- | --- | --- |
| `task_classification` | snapshotから導出したtaskのclassification | task |
| `recommendation_set_membership` | taskがderived recommended set `R`へ含まれるか | task、derived set |
| `set_start_feasibility` | 指定task集合について`startFeasible(S)`がtrueかfalseか | task集合、resource集合、derived set |
| `resource_capacity_witness` | resourceごとのcapacity、active usage、selected usage、対象task requirement、available、deficitとoccupant | resource、対象task、active/selected task |
| `ranking_rule_application` | versioned ruleをどのtaskへ適用し、支持、反対、tieのどれを得たか | policy rule、対象task、必要ならalternative task |
| `ranking_comparison` | 同じrule/factorで比較したsubject値、alternative値、relationとwinner/loser | policy rule、ranking factor、2件以上のtask |
| `policy_deferral` | `policyDefers(t)`の値と、それを導出したversioned rule | policy rule、task |
| `modeled_negative_fact` | 登録済みnegative fact kindが対象taskの現在startへ適用されること | negative fact kind、task、factが参照するentity |

`ranking_rule_application`と`ranking_comparison`の値は、boolean、integer、exact Rational、有限enum、entity reference、またはそれらの有限collectionとして型を保持する。表示用decimalや自然言語textを比較値の正本にしない。

### 5.1 Entity reference

Entity referenceは少なくとも次のkindを区別する。

- `project`
- `task`
- `milestone`
- `gate`
- `resource`
- `policy_rule`
- `ranking_factor`
- `negative_fact_kind`
- `derived_set`

Project entityは正本ID、task/milestone/gate/resourceはDSLのstable IDを参照する。Policy rule、ranking factor、negative fact kindは、それぞれのversioned specificationに登録されたstable IDを参照する。Recommended setはsnapshotから導出したsymbolic set `R`を参照し、titleや表示順をidentityにしない。

同じ文字列が異なるkindに存在し得るため、IDだけでentity kindを推測してはならない。

## 6. Stable reason code taxonomy

### 6.1 Applicabilityとset outcome

| Code | 厳密な発生条件 | Effect | 許可role | 必須fact | 対応 |
| --- | --- | --- | --- | --- | --- |
| `task_ready` | `classification(t) == ready` | `neutral` | `context` | `task_classification` | 全tierの評価domain |
| `recommended_set_selected` | `t in R` | `supporting` | `decisive` | `recommendation_set_membership(present=true)` | `recommended`、set inclusion |
| `recommended_set_not_selected` | `t not in R` | `opposing` | `decisive` | `recommendation_set_membership(present=false)` | `allowed`、`deferred`、`discouraged`、set exclusion |
| `recommended_set_feasible` | `startFeasible(R) == true` | `neutral` | `context` | `set_start_feasibility(R, true)` | recommended set全体の不変条件 |

`recommended_set_selected`と`recommended_set_not_selected`はmembership outcomeであり、単独では選択原因を説明しない。非選択taskには、6.2または6.3の因果reasonを少なくとも1件関連付ける。

### 6.2 Ranking rule category

| Code | 厳密な発生条件 | Effect | 許可role | 必須fact | 対応 |
| --- | --- | --- | --- | --- | --- |
| `ranking_rule_supports_task` | 登録済みversioned ranking ruleの適用結果が、subject taskを選択する向きである | `supporting` | `decisive`、`contributing` | `ranking_rule_application`。比較ruleでは`ranking_comparison`も必須 | 主にset inclusion。alternative比較にも使用 |
| `ranking_rule_opposes_task` | 登録済みversioned ranking ruleの適用結果が、subject taskよりalternativeまたはpolicy条件を優先する向きである | `opposing` | `decisive`、`contributing` | `ranking_rule_application`。比較ruleでは`ranking_comparison`も必須 | set exclusion、上位taskの説明 |
| `ranking_rule_tied` | 登録済みversioned ranking ruleでsubjectとalternativeが等価となり、そのruleでは順序が決まらない | `neutral` | `context` | `ranking_rule_application`と`ranking_comparison(relation=equal)` | 後続ruleまたはtie-breakへ進んだtrace |

Ranking factor名をreason codeへ埋め込まない。例えばcritical、float、priorityを使う場合もcodeは上表を使い、どのfactor、値、relation、ruleが作用したかをtyped factで区別する。これにより、codeを増殖させずに「どのproject factがtask Aをtask Bより上位にしたか」を保持する。

`ranking_rule_supports_task`または`ranking_rule_opposes_task`を発生させるには、参照したruleとfactorがversioned Ranking Policyへ登録され、入力値とrelationを再計算できなければならない。Rule IDだけ、scoreだけ、自由記述だけのreasonは不十分である。

### 6.3 Tierとstart authority

| Code | 厳密な発生条件 | Effect | 許可role | 必須fact | 対応 |
| --- | --- | --- | --- | --- | --- |
| `recommended_set_addition_feasible` | `t not in R`かつ`startFeasible(R union {t}) == true` | `supporting` | `decisive`、`contributing` | `set_start_feasibility(R union {t}, true)` | `allowed`のcapacity条件。policy defer時は`deferred`へcontributingにもなり得る |
| `recommended_set_resource_conflict` | `t not in R`かつ`startFeasible(R union {t}) == false` | `blocking` | `decisive`、`contributing` | `set_start_feasibility(R union {t}, false)`と、違反した全resourceの`resource_capacity_witness` | `deferred`のresource条件 |
| `policy_defers_start` | `policyDefers(t) == true` | `blocking` | `decisive`、`contributing` | `policy_deferral(true)`と、その判断に使った`ranking_rule_application` | `deferred`のpolicy条件。先行するnegative factがある場合はcontributingになる |
| `modeled_negative_fact_applies` | 登録済みnegative fact kindについて`explicitNegativeFact(t) == true` | `blocking` | `decisive` | 1件以上の`modeled_negative_fact`と適用rule | `discouraged`のnegative条件 |

`recommended_set_resource_conflict`は、違反resourceを1件だけ代表表示してはならない。複数resourceがcapacity制約へ違反する場合、全witnessをtyped factとして保持する。Natural language表示とcomplete JSONの境界は[Recommendation Interface Contract仕様](recommendation-interface.md)の責務である。

## 7. Set selectionとの対応

Recommended set `R`について、次を満たす。

1. `t in R`の各taskは`task_ready`、`recommended_set_selected`、selection horizonへの所属またはscan選択を示す`ranking_rule_supports_task`を持つ
2. `t not in R`の各ready taskは`task_ready`と`recommended_set_not_selected`を持つ
3. Result全体は`recommended_set_feasible`を持つ
4. `recommended_set_not_selected`には、少なくとも1件の`ranking_rule_opposes_task`、`policy_defers_start`、`recommended_set_resource_conflict`、`modeled_negative_fact_applies`のいずれかを伴う
5. Ranking Policyが空の`R`を許す場合も、各ready taskの非選択に適用したversioned ruleまたはresource witnessを`ranking_rule_opposes_task`、`policy_defers_start`、`recommended_set_resource_conflict`のいずれかで示す
6. Set selectionが複数task間の比較に依存する場合、winnerとalternativeを同じ`ranking_comparison`で参照可能にする

Membership outcomeだけ、task ID順だけ、opaque scoreだけを非選択理由としてはならない。Task ID tie-breakを使う場合、それ自体を登録済みpolicy rule/factorとして値とrelationを記録する。

## 8. Tierとの対応

Recommendation Semantics仕様のclassification orderに従い、各tierへ次のreasonを対応させる。

| Tier | 必須reason | 条件付きreason | 禁止される決定reason |
| --- | --- | --- | --- |
| `recommended` | `task_ready`、`recommended_set_selected`、`ranking_rule_supports_task`、result-levelの`recommended_set_feasible` | 0件以上の`ranking_rule_tied` | `recommended_set_not_selected`、`policy_defers_start`、`modeled_negative_fact_applies` |
| `allowed` | `task_ready`、`recommended_set_not_selected`、`recommended_set_addition_feasible` | `ranking_rule_opposes_task`、`ranking_rule_tied` | `policy_defers_start`、`modeled_negative_fact_applies`、`recommended_set_resource_conflict` |
| `deferred` | `task_ready`、`recommended_set_not_selected`と、`policy_defers_start`または`recommended_set_resource_conflict`の1件以上 | ranking evidence、addition feasibility | `modeled_negative_fact_applies`をdecisive reasonにすること |
| `discouraged` | `task_ready`、`recommended_set_not_selected`、`modeled_negative_fact_applies` | ranking evidence、resource feasibility/conflict | なし。ただしnegative factがclassification order上のdecisive reasonであること |

`deferred` taskがpolicy deferとresource conflictの両方を持つ場合、Recommendation Semantics仕様のclassification orderで先に成立した条件だけを`decisive`とし、他方は`contributing`とする。`discouraged` taskでもpolicy deferやresource conflictを`contributing`として保持できるが、tierを決めたreasonは`modeled_negative_fact_applies`である。

Allowed taskの非選択理由は`recommended_set_not_selected`だけで終えてはならず、少なくとも1件の`ranking_rule_opposes_task`を伴う。これにより、AIはrecommended taskとallowed alternativeの比較を再推論せず回答できる。

## 9. 未model化fact

Taxonomy version 1.0では、`modeled_negative_fact`として登録されたconcrete fact kindは0件である。このため、Grammar/Semantics version 1のnormal analysisは次を満たす。

- `modeled_negative_fact_applies`を生成しない
- `explicitNegativeFact(t)`は全ready taskでfalseとして扱う
- `discouraged` tierを生成しない

特に、次をchat、issue本文、task title、tag、source、自由記述から推測してreasonへ使用してはならない。

- release固有semanticsまたはrelease gateであること
- rework riskまたは将来置換される可能性
- information sufficiency、仕様不足、調査不足
- taskの面白さ、実装容易性、一般的なcode quality価値

DSLの`gate`はmodel化されたdependency edgeだが、「release gate」というbusiness semanticsはmodel化されていない。Gate entityが存在することだけからrelease固有reasonを生成しない。

将来negative factを追加する場合は、正本field、validation、適用predicate、entity reference、ranking/overrideへの影響を仕様化し、concrete `negative_fact_kind`をtaxonomyへ登録してから生成する。未知情報を汎用`other`、`unknown_risk`、自由記述reasonとして正本判断へ混入させない。

## 10. Versioningとunknown code互換性

Taxonomy versionは`major.minor`で管理する。Versionをwire上のどのfieldで返すかは[Recommendation Interface Contract仕様](recommendation-interface.md)で固定する。

- minor更新: 既存codeの意味を変えないcodeまたはfact kindの追加
- major更新: code削除、発生predicate変更、effect変更、必須factの互換性を壊す変更
- typo修正を含め、公開済みcodeのrenameは削除と追加として扱う
- 廃止codeを別の意味で再利用しない
- Ranking algorithm versionとTaxonomy versionを同一versionとみなさない

Consumerが未知codeを受け取った場合は次を守る。

1. 未知codeと理解できたtyped fact/entity referenceを可能な限り保持する
2. 未知codeを既知code、generic reason、自然言語へ推測変換しない
3. 未知codeが`decisive`なら、tier自体を別tierへ再分類せず、説明を完全に理解できないことを明示する
4. 未知codeだけを理由にresult全体を破棄しない。ただしconsumerが安全に実行できるactionは既知のtier authorityを超えない
5. Human-facing descriptionが得られない場合はraw codeを識別可能に表示し、意味を捏造しない

Unknown fact kind、entity kind、rule IDについても同じ原則を適用する。Strict validationを行うproducerは、自身が宣言するTaxonomy versionで未登録のcode/fact kindを出力してはならない。

## 11. Structured explanationへの入力境界

[Recommendation Structured Explanation仕様](recommendation-explanation.md)は、本仕様から次を入力として受け取る。

- stable reason code
- effectとactual decision role
- typed fact kindとexact value
- kind付きentity reference
- ranking rule/factor reference
- subject、winner、alternativeの関係
- set membershipとresource feasibility witness
- Taxonomy versionとRanking algorithm versionの分離

Structured Explanation仕様と[Recommendation Interface Contract仕様](recommendation-interface.md)が固定するもの:

- expression ASTのnode、operator、evaluation
- reason occurrence間の親子関係とdecision trace
- comparison ID、fact ID、rule application ID
- description key、parameter、template、locale、fallback text
- JSON field、schema、ordering、deduplication、truncation

後続taskはcodeの発生predicateやeffectを無言で変更してはならない。自然言語descriptionは[Structured Explanation仕様](recommendation-explanation.md)に従い、code、typed fact、comparison、decision traceから決定的に導出し、description textをranking inputへ戻してはならない。

## 12. Invariants

Reason生成は少なくとも次を検査する。

1. reason codeが宣言Taxonomy versionへ登録されている
2. codeが要求するtyped factとentity referenceが欠けていない
3. codeの発生predicateをfactから再評価できる
4. effectとroleがtaxonomyで許可された組合せである
5. ready taskだけがrecommendation reasonを持つ
6. 各ready taskがexactly oneのset membership outcomeを持つ
7. `recommended_set_selected` task集合が`R`と一致する
8. `recommended_set_feasible`がfalseのresultを成功扱いにしない
9. tierとrequired/forbidden reasonが第8章のmatrixと一致する
10. set exclusionに因果reasonと、必要なalternative/rule参照がある
11. 未登録negative factから`discouraged`を生成しない
12. 同じsnapshot、options、Ranking algorithm version、Taxonomy versionから同じreason multisetとroleを返す

違反はdescription欠落として黙って継続せず、analysis invariant failureとして扱う。具体的diagnostic codeと外部schemaは[Recommendation Interface Contract仕様](recommendation-interface.md)で固定する。

## 13. 本sliceのacceptance

- stable lower snake case codeと不変な意味を定義した
- codeごとの発生条件、effect、許可roleを定義した
- typed fact categoryとkind付きentity参照を定義した
- recommended set inclusion/exclusionを因果reasonへ接続した
- 4 tierの必須reasonと禁止reasonを定義した
- ranking factor固有意味をRanking Policyへ分離した
- 未model化のrelease semantics、rework risk、information sufficiencyを生成禁止にした
- Taxonomy versionとunknown codeの互換性を定義した
- Structured Explanation Modelへ渡す入力と、そこで初めて決める事項を分離した
- 自然言語description、JSON schema、interface、codeを変更していない
