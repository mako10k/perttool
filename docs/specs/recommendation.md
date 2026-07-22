# Recommendation Semantics 仕様

- 文書状態: Normative Draft 0.1
- 作成日: 2026-07-22
- 対象: AI Project Control Planeの実行可否・推奨度model
- Ranking policy: [recommendation-ranking.md](recommendation-ranking.md)
- Reason taxonomy: [recommendation-reasons.md](recommendation-reasons.md)
- Structured explanation: [recommendation-explanation.md](recommendation-explanation.md)
- Recommendation interface: [recommendation-interface.md](recommendation-interface.md)
- Human override: [recommendation-override.md](recommendation-override.md)
- 関連Issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. 目的

本仕様は、`dag next`が現在返すtask状態・resource選択と、将来追加するrecommendationを別の意味として定義する。

次を固定する。

- recommendationを評価するactionとtask集合
- lifecycle/eligibility、resource selection、recommendation tierの分離
- `recommended`、`allowed`、`deferred`、`discouraged`の形式的意味
- `blocked`をrecommendation tierとして使用しない判断
- active、ready、blocked_now、upcoming、doneとの整合
- 複数taskを同時にrecommendedとするための不変条件
- human overrideと再解析の境界
- ranking、reason code、構造化説明、interfaceへ送る責務

本仕様は設計契約である。現行`Perttool.NextResult.v2`へrecommendation fieldを追加したとはみなさない。

## 2. 規範上の位置

意味や設計が競合する場合は次の順で解決する。

1. `docs/requirements.md`のMust requirement
2. 本仕様
3. [Analysis仕様](analysis.md)
4. [CLI Interface仕様](interfaces.md)
5. `docs/basic-design.md`
6. example、test、help、implementation

本仕様の用語`ready`、`blocked_now`、effective reachedは[Graph Semantics仕様](graph-semantics.md)、precedence/resource analysisと`runnable_now`は[Analysis仕様](analysis.md)を前提とする。

## 3. Scope

対象:

- 単一project snapshotで新しくtaskを開始する判断
- current frontierから導出したunfinished task
- active allocationを含む現在resource capacity
- project modelに明示されたfactだけに基づくrecommendation
- AIと人間が同じ意味で利用できるdecision authority

対象外:

- active taskを継続、中断、cancelする判断
- ranking inputの優先順、weight、tie-break
- reason code一覧と構造化expression schema
- Core/CLI field、JSON schema、text layout、option、exit code
- overrideの永続化commandとaudit storage
- Issue #3の複数plan、backlog、macro/detail composition
- project modelに存在しないrework risk、情報不足、release固有意味の推測
- recommendation実装

## 4. 3つの直交する判断

### 4.1 Lifecycle / eligibility classification

既存classificationはtaskの工程状態を表す。

| Classification | 意味 |
| --- | --- |
| `active` | すでに実行中 |
| `ready` | precedenceとstatus上、新規開始候補になれる |
| `blocked_now` | sourceはreachedだが外部block中 |
| `upcoming` | source milestoneが未到達 |
| `done` | 完了済み。Next resultのtask候補へ含めない |

このclassificationをrecommendation tierへ置き換えない。

### 4.2 Resource selection

`runnable_now`は、active allocationを差し引いた後、現行scheduler candidate orderで選んだjointly feasibleなready task集合である。これはclassification enumではなく、ready taskへの直交membershipである。

`runnable_now=false`は、task自体が永久に実行不能であることを意味しない。同じsnapshotでも、先に選ぶtask集合が変わればresource上開始できる場合がある。

### 4.3 Recommendation tier

Recommendation tierは、project control planeが新規開始actionへ与えるdecision authorityを表す。Eligibility、resource capacity、工程上のpriorityを入力にするが、それらの別名ではない。

概念上のtier集合を次とする。

```text
recommended | allowed | deferred | discouraged
```

`blocked`は含めない。実行不能または未到達の理由は既存classificationとresource factで表現する。

## 5. Evaluation domain

MVP recommendationのactionは`start`だけとする。

Recommendationを評価するtask集合`P`は、actual `ready` task集合である。

- `active`: 新規開始actionではないためrecommendationを持たない
- `ready`: 必ず1つのrecommendation tierを持つ
- `blocked_now`: recommendationを持たない
- `upcoming`: recommendationを持たない
- `done`: resultへ含めない

JSONでは[Recommendation Interface Contract仕様](recommendation-interface.md)に従い、actual ready taskだけを`task_decisions`へ含め、non-ready taskのtier fieldを生成しない。`not_recommended`や`blocked`を便宜的なtierとして追加してはならない。

## 6. Resource feasibility

Resource `r`の宣言capacityを`capacity(r)`、active taskの使用量を`activeUsage(r)`、ready task`t`の要求量を`requirement(t, r)`とする。

Ready task集合`S`について、次をすべて満たす場合に`startFeasible(S)`とする。

```text
for every resource r:
  activeUsage(r) + sum(requirement(t, r) for t in S) <= capacity(r)
```

Resource requirementを持たないtaskは、そのresourceについて0を要求する。

Recommendation ranking policyが選ぶrecommended setを`R`とする。`R`は少なくとも次を満たさなければならない。

```text
R is a subset of P
startFeasible(R) == true
```

同じtaskを複数回数えない。Active taskは`R`へ含めず、`activeUsage`としてcapacityから差し引く。

`R`の選択規則、空集合を許す条件、完全なtie-break、algorithm versionは[Recommendation Ranking Policy仕様](recommendation-ranking.md)で固定する。

Ranking Policyは、ready task`t`を現在cycleで追加開始せず後続cycleへ送る明示判断`policyDefers(t)`も定義する。Version 1では全taskについてfalseとし、selection horizon外でresource-feasibleなtaskを`allowed`として保持する。

## 7. Tier semantics

### 7.1 `recommended`

Task`t`が`t in R`を満たす場合、`recommended`である。

- AIが現在のcycleで新規開始する第一候補である
- `recommended` task集合全体を同時開始してもresource capacityを超えない
- 複数taskをrecommendedにできる
- 複数recommended task間に暗黙の順序を付けない
- recommendationはglobal optimumの証明を意味しない

### 7.2 `allowed`

Task`t`が次をすべて満たす場合、`allowed`である。

```text
t is in P
t is not in R
startFeasible(R union {t}) == true
explicitNegativeFact(t) == false
policyDefers(t) == false
```

- recommended setをresource上妨げず、追加のworkとして開始できる
- recommended taskを置き換えたり、先送りしたりする許可ではない
- 各allowed taskは`R`へ個別追加できることだけを保証する
- 複数allowed taskを同時追加した集合がfeasibleとは保証しない
- taskを1件開始するたびにstateを更新して再解析する

AIがallowed taskをrecommended taskの代わりに選ぶ場合はhuman overrideとして扱う。Recommended workを維持したまま追加capacityでallowed taskを選ぶ場合はoverrideを要求しない。

### 7.3 `deferred`

Task`t`がreadyだが、`recommended`、`allowed`、`discouraged`のいずれでもない場合、`deferred`である。

典型条件:

- recommended setとresource capacityが競合する
- 現在cycleでは上位workを置き換えなければ開始できない
- Ranking Policyが定義するselection horizonの外にある

`deferred`は一時的な工程判断である。Project state、capacity、active allocation、ranking inputが変わった後に再評価する。Human overrideなしにAIが選択してはならない。

### 7.4 `discouraged`

Task`t`がreadyであり、project modelに明示されたnegative factが現在の開始を否定する場合、`discouraged`である。

- 単にnon-critical、floatが大きい、priorityが低いだけではdiscouragedにしない
- chat context、AIの推測、実装上の興味をnegative factにしない
- human overrideなしにAIが選択してはならない
- override時もnegative factを消さず、判断根拠とともに表示する

Grammar version 1にはrework risk、replacement intent、information sufficiency、release固有semanticsの正本fieldがない。このため、それらを根拠に`discouraged`を生成してはならない。Interface v1は将来のmodeled negative factへ備えてJSON enumに`discouraged`を含めるが、Taxonomy version 1.0のnormal producerは生成しない。

## 8. Formal classification order

Normal analysisでは、ready task`t`を次の順で一意に分類する。

```text
if t is in R:
  recommended
else if explicitNegativeFact(t):
  discouraged
else if policyDefers(t):
  deferred
else if startFeasible(R union {t}):
  allowed
else:
  deferred
```

Ranking Policyはnormal analysisで明示的negative factを持つtaskを`R`へ含めてはならない。Human overrideを適用した結果はnormal recommendationと別に表現する。

同じsnapshot、capacity override、ranking algorithm versionから同じ`R`とtierを返す。

## 9. Classification consistency matrix

| Existing state | Recommendation applicability | Start authority |
| --- | --- | --- |
| `active` | 非適用 | continuation policyの対象。新規startしない |
| `ready` + `recommended` | 適用 | AIが選択可能 |
| `ready` + `allowed` | 適用 | recommendedを維持する追加workとしてAIが選択可能 |
| `ready` + `deferred` | 適用 | human overrideが必要 |
| `ready` + `discouraged` | 適用 | negative factを伴うhuman overrideが必要 |
| `blocked_now` | 非適用 | block解消前はstartしない |
| `upcoming` | 非適用 | predecessor達成前はstartしない |
| `done` | 非適用 | resultへ含めない |

Ready taskへtierがない状態、またはnon-ready taskへtierがある状態はanalysis invariant failureとする。

## 10. `runnable_now`との関係

現行`runnable_now`集合を`L`、将来のrecommended setを`R`とする。

- `L`は現行scheduler candidate orderで得たresource-feasible subsetである
- `R`はRanking Policyで得るpreferredかつresource-feasible subsetである
- `L`と`R`は同じになるとは限らない
- `R`を導入するために`Perttool.NextResult.v2`の`runnable_now`を無言で再解釈しない
- `L`と`R`が異なる場合、どのtaskを入れ替え、どのruleとfactで判断したかを構造化説明で返す

Backward compatibility、schema version、field name、既定text表示は[Recommendation Interface Contract仕様](recommendation-interface.md)を正とする。Recommendation実装までは現行CLI出力を変更しない。

## 11. Explainability invariant

Recommendationはtierだけを返して完了としてはならない。

各ready taskについて、少なくとも次を説明できるmodelを要求する。

- 適用したranking rule
- project modelから取得したtyped fact
- selected taskとalternative taskの比較
- decisive ruleとsupporting ruleの区別
- recommended setへ含めた、または含めなかった理由
- より上位のtask ID
- resource feasibilityまたはconflict
- 人間向けdescriptionを導出するstable keyとparameter

Reason codeとtyped fact categoryは[Recommendation Reason Taxonomy仕様](recommendation-reasons.md)、制限付きexpression AST、decision trace、description projectionは[Recommendation Structured Explanation仕様](recommendation-explanation.md)、具体的なCore type、text/JSON field、schema migrationは[Recommendation Interface Contract仕様](recommendation-interface.md)を正とする。自然言語textだけを正本の理由にしない。

## 12. Human override boundary

本仕様でhuman overrideは次の意味を持つ。

- allowed taskをrecommended workの代わりに選ぶ
- deferred taskを現在開始する
- discouraged taskをnegative factを承知して開始する

Overrideはnormal recommendationを過去に遡って変更しない。[Recommendation Human Override Contract仕様](recommendation-override.md)は、override必要/不要の条件、feasible replacement set、caller-asserted actor、human reason、Git audit artifact、single-use、override後の再解析を固定する。Overrideはnon-ready taskやcapacity violationをbypassしない。

## 13. Re-analysis

次の変更後は古いrecommendationを再利用せず、document全体を再解析する。

- task start、completion、block、unblock
- milestone reachedまたはadvance
- capacity overrideまたはresource declaration
- task priority、duration、dependency、requirement
- human override
- ranking algorithm version

Recommendation resultはsource digest、capacity option、algorithm versionへ条件付けられる。具体的fieldは[Recommendation Interface Contract仕様](recommendation-interface.md)で固定する。

## 14. 後続設計taskへの入力

### [`RANKING_POLICY`](recommendation-ranking.md)

- `R`を選ぶproject factと優先規則
- selection horizon
- empty setと複数recommendedの条件
- complete tie-breakとalgorithm version
- current scheduler orderとのmigration

### [`REASON_CODE_TAXONOMY`](recommendation-reasons.md)

- tier付与とset選択のstable reason code
- supporting、opposing、blockingのpolarity
- fact IDと未model化factの扱い

### [`STRUCTURED_EXPLANATION_MODEL`](recommendation-explanation.md)

- typed fact
- 制限付きexpression AST
- winner/alternative comparison
- decisive/supporting rule
- description key、parameter、派生text

### [`INTERFACE_CONTRACT`](recommendation-interface.md)

- Core typeとJSON schema
- `NextResult.v2`からのmigration
- text sectionとordering
- explanation level、size limit、truncation

### [`HUMAN_OVERRIDE_CONTRACT`](recommendation-override.md)

- tierとoverride requirementの対応
- override reasonとaudit
- write boundaryと再解析

## 15. 本sliceのacceptance

- eligibilityとrecommendationを別軸として定義した
- `runnable_now`とrecommended setを同一視しない
- recommendationの評価対象をready taskのstart actionへ限定した
- 4 tierの形式的意味とauthorityを定義した
- `blocked`をrecommendation tierから除外した
- active、blocked_now、upcoming、doneへの非適用を定義した
- recommended setのjoint resource feasibilityを定義した
- allowed taskの個別追加と複数同時追加を区別した
- discouragedを明示的negative factだけに限定した
- explainability、override、re-analysisを後続contractへ接続した
- 現行CLI/JSONを変更していない
