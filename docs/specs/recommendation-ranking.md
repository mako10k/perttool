# Recommendation Ranking Policy 仕様

- 文書状態: Normative Draft 0.1
- 作成日: 2026-07-22
- Algorithm ID: `perttool.recommendation-ranking.lexicographic-frontier`
- Algorithm version: `1`
- 対象: AI Project Control Planeの決定的なrecommended set選択
- Structured explanation: [recommendation-explanation.md](recommendation-explanation.md)
- Recommendation interface: [recommendation-interface.md](recommendation-interface.md)
- Human override: [recommendation-override.md](recommendation-override.md)
- 関連Issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. 目的

本仕様は、[Recommendation Semantics仕様](recommendation.md)が定義するactual `ready` task集合`P`から、現在cycleで開始を推奨する集合`R`を決定的に選ぶranking policyを固定する。

次を定義する。

- ranking対象と、project modelから取得するtyped fact
- critical path、float、明示priority、後続解放、gate、milestone距離の優先規則
- recommendationのselection horizon
- active allocationを含むjoint resource feasibility
- empty setと複数taskのparallel recommendation
- 完全なtie-breakとalgorithm identity
- 現行resource schedulerおよび`runnable_now`との非循環な境界
- 後続decision traceへ渡すwinner、alternative、decisive rule

本policyは決定的なheuristicであり、resource-constrained project completionのglobal optimumを証明しない。

## 2. 規範上の位置

意味や設計が競合する場合は次の順で解決する。

1. [要件定義](../requirements.md)のMust requirement
2. [Recommendation Semantics仕様](recommendation.md)
3. 本仕様
4. [Analysis仕様](analysis.md)
5. [Graph Semantics仕様](graph-semantics.md)
6. `docs/basic-design.md`、example、test、help、implementation

本仕様はrecommendation tierを再定義しない。`R`選択後の`recommended`、`allowed`、`deferred`、`discouraged`分類はRecommendation Semantics仕様の形式的順序を使用する。

## 3. Scope

対象:

- 単一の有効なproject snapshot
- actual `ready` taskの新規`start`判断
- precedence CPMとproject graphから決定的に導出できるfact
- applied capacity、active allocation、task requirement
- 1回のanalysis request内でのrecommended set選択

対象外:

- active taskの継続、中断、cancel
- future eventまでを含むresource scheduleの最適化
- recommendationのweight tuning、学習、確率score
- reason code taxonomyと構造化expression schema
- Core type、CLI、JSON、text layout、schema migration
- human overrideの永続化
- 複数projectまたはmacro/detail planをまたぐranking
- title、description、tag、owner、source、chat historyから意味を推測するranking
- release固有semantics、rework risk、情報不足、置換予定、任意milestoneの業務的重要度の推測
- recommendation実装

Grammar version 1にはrelease、rework risk、information sufficiencyを表す規範fieldがない。`RELEASE`などのID、title、tag、自然言語descriptionを解釈してranking factへ変換してはならない。

## 4. Algorithm identityと決定性

Version 1のalgorithm identityを次とする。

```text
algorithm_id      = perttool.recommendation-ranking.lexicographic-frontier
algorithm_version = 1
optimal           = false
```

同じcanonical document、analysis option、applied capacity、critical epsilon、algorithm ID/versionから、同じcandidate fact、candidate order、selection horizon、`R`、comparisonを返さなければならない。

次の変更はalgorithm versionの変更を必要とする。

- ranking keyの追加、削除、順序変更
- selection horizonの条件変更
- counterfactual unlockまたはdistanceの定義変更
- resource selection scanの変更
- tie-breakの文字列比較規則変更

Description文言、renderer layout、field encodingだけの変更は[Recommendation Interface Contract仕様](recommendation-interface.md)のversioning対象であり、ranking algorithm versionを自動的には変更しない。

## 5. Ranking domain

Recommendation Semantics仕様のactual `ready` task集合を`P`とする。

```text
P = { t | classification(t) == ready }
```

明示的negative factを持つtask集合を`N`とし、normal ranking candidateを`C`とする。

```text
N = { t in P | explicitNegativeFact(t) == true }
C = P - N
```

Version 1のgrammarには`explicitNegativeFact`の正本fieldが存在しないため、version 1 documentでは`N`は常にemptyである。将来fact modelを追加して`N`を非emptyにする場合は、そのfactの規範仕様とranking algorithm versionを更新する。

- `active`、`blocked_now`、`upcoming`、`done`、gateは`P`へ含めない
- capacity不足はcandidateからの除外条件ではない
- resource requirementを持たないtaskも`C`へ含める
- `C`がemptyならselection horizonと`R`もemptyである

## 6. Ranking input facts

### 6.1 Authoritative input

各candidate`t`について次のfactだけをrankingへ使用する。

| Fact | 型 | 導出元 |
| --- | --- | --- |
| `precedence_total_float` | exact Rational | precedence CPM |
| `precedence_critical_class` | `driving | near_critical | non_critical` | total floatとproject `critical_epsilon` |
| `explicit_priority` | Integer | task `priority`。省略時0 |
| `new_ready_task_count` | nonnegative Integer | §6.2のcompletion counterfactual |
| `new_satisfied_gate_count` | nonnegative Integer | §6.2のcompletion counterfactual |
| `new_reached_milestone_count` | nonnegative Integer | §6.2のcompletion counterfactual |
| `next_gate_task_distance` | nonnegative Integerまたは`infinity` | §6.3のresidual graph距離 |
| `finish_task_distance` | nonnegative Integer | §6.3のresidual graph距離 |
| `expected_duration` | exact Rational | Analysis仕様のeffective duration |
| `task_id` | Identifier | canonical entity ID |
| `requirements` | resource IDからpositive Integerへのmap | resolved requirement |

Set selectionには、applied capacity map、resourceごとのactive usage、active task IDを追加で使用する。Capacity overrideを指定した場合は宣言capacityではなくapplied capacityを使用する。

`precedence_critical_class(t)`を次で定義する。有効analysisではtotal floatは0以上である。

```text
driving       if precedence_total_float(t) == 0
near_critical if 0 < precedence_total_float(t) <= critical_epsilon
non_critical  otherwise
```

`critical_epsilon = 0`なら`near_critical`は存在しない。User-facing critical判定と同様にnear-criticalを認識するが、exact drivingと同一視しない。

### 6.2 Completion counterfactual

後続解放factは、candidate`t`だけが現在snapshotで完了したと仮定する局所counterfactualから導出する。所要時間、他taskの進行、resource release eventは進めない。

1. 現在のeffective reached集合を`R*`とする
2. `t`だけを`done`としてsatisfiedにする
3. 他taskのstatusとmilestone stored stateを変更しない
4. Graph Semantics仕様のall-incoming ruleとgate closureを固定点まで適用し、`R*t`を得る

次を定義する。

```text
new_reached_milestones(t) = R*t - R*

new_reached_milestone_count(t) = size(new_reached_milestones(t))

new_ready_tasks(t) = {
  u |
  u != t and
  status(u) == planned and
  src(u) in R*t and
  src(u) not in R*
}

new_ready_task_count(t) = size(new_ready_tasks(t))

new_satisfied_gates(t) = {
  g |
  kind(g) == gate and
  src(g) in R*t and
  src(g) not in R*
}

new_satisfied_gate_count(t) = size(new_satisfied_gates(t))
```

All-incoming joinの他branchが未完了なら、`t`だけで到達しないmilestoneとその後続をunlockへ数えない。Blocked taskは`new_ready_tasks`へ数えない。`new_satisfied_gate_count`は明示されたdependency gateの構造的影響であり、release承認や品質gateなどの業務意味を表さない。

### 6.3 Structural distance

Distanceはcandidate`t`のdestination milestoneからproject finishへ向かうresidual graph上で計算する。Gateとretained `done` taskのcostを0、その他のunfinished task edgeのcostを1とする。

```text
edgeTaskCost(e) = 0  if kind(e) == gate or status(e) == done
                  1  otherwise

finish_task_distance(t) =
  minimum sum(edgeTaskCost(e)) over paths dst(t) -> project.finish
```

有効graphではfinish reachableなので`finish_task_distance`は有限である。

`next_gate_task_distance(t)`は、`dst(t)`から最初にgate edgeを通るまでのunfinished task edge costの最小値とする。`dst(t)`から直接gateを通る場合は0、downstreamにgateが存在しない場合は`infinity`とする。比較時はすべての有限値を`infinity`より先に置く。

Distanceはedge数ではなくunfinished task数であり、durationを二重にscore化しない。Milestone titleやgate reasonの自然言語はdistanceへ影響しない。

### 6.4 Excluded analysis facts

Version 1は次をranking inputにしない。

- resource schedule上のscheduled start/finish
- resource wait、resource arc、schedule float、schedule critical path
- resource makespan、utilization、peak usage
- 現行`runnable_now` membershipまたはscheduler scan position
- PERT variance、target duration、velocity forecast
- owner、tag、description、blocked reason、source text

これらをsupporting informationとして将来表示する場合も、version 1の順位を変更してはならない。

## 7. Complete candidate order

Candidateを次のtupleで昇順比較する。

```text
(
  critical_class_rank,
  precedence_total_float,
  -explicit_priority,
  -new_ready_task_count,
  -new_satisfied_gate_count,
  -new_reached_milestone_count,
  next_gate_task_distance,
  finish_task_distance,
  -expected_duration,
  task_id
)
```

`critical_class_rank`は`driving = 0`、`near_critical = 1`、`non_critical = 2`とする。Rationalはexact比較し、表示用decimalを使用しない。Integerの負号は「大きい値を先にする」比較方向を示し、overflowするmachine integerへの変換を要求しない。`task_id`はUTF-8 byte列やlocale collationではなく、grammarのIdentifierに対するASCII code point辞書順で比較する。

このtupleはcomplete orderである。異なるtaskは最後の`task_id`で必ず順序が決まる。

優先規則の意味:

1. exact driving taskをnear-critical、non-criticalより先にする
2. 同じcritical classではtotal floatが小さいtaskを先にする
3. 同じ工程余裕では人間が明示したpriorityが大きいtaskを先にする
4. 単独完了で新しくreadyにするtaskが多いtaskを先にする
5. dependency gateとmilestone closureへの直接的な影響が大きいtaskを先にする
6. 次のgateとfinish milestoneへ構造的に近いtaskを先にする
7. なお同値ならlongest-processing-time heuristicとしてexpected durationが大きいtaskを先にする
8. 最後にtask IDで安定化する

このorderはopaqueな合成scoreを作らない。比較理由は最初に異なるkeyから一意に決まる。

## 8. Selection horizon

Selection horizonは、全ready taskを自動的に`recommended`へ昇格させず、現在の工程上もっとも緊急なcohortへ推薦を限定する境界である。

Candidate集合`C`がnonemptyの場合、critical classの最良値を`k`とする。

```text
k = minimum critical_class_rank(t) for t in C
```

Horizon`H`を次で定義する。

```text
if k in {driving, near_critical}:
  H = { t in C | critical_class_rank(t) == k }
else:
  f = minimum precedence_total_float(t) for t in C
  H = { t in C | precedence_total_float(t) == f }
```

したがって、actual readyにexact driving taskがあれば全exact driving taskが同じhorizonへ入る。Exact driving taskがなくnear-critical taskがあれば、全near-critical taskが入る。どちらもなければ、最小total floatのtask群が入る。

Horizon外であることだけを`policyDefers(t)`の根拠にしない。Version 1では明示的な追加defer ruleを持たず、normal analysisの`policyDefers(t)`は全taskについて`false`とする。Horizon外のtaskは、`R`へ個別追加してresource-feasibleなら`allowed`、競合するなら`deferred`になる。

Selection horizonはsnapshot時刻0の新規startだけを対象にする。Future resource release後の候補、active task完了後のhorizon、project全期間の開始順を予測しない。

## 9. Recommended set selection

### 9.1 Resource feasibility

[Recommendation Semantics仕様](recommendation.md)の`startFeasible(S)`を使用する。

```text
for every resource r:
  activeUsage(r) + sum(requirement(t, r) for t in S) <= appliedCapacity(r)
```

Resource requirementをprecedenceへ変換しない。Candidateの要求量がapplied capacity以下でも、active usageによって現在開始できない場合がある。

### 9.2 Deterministic scan

`R`を次で選ぶ。

```text
R = empty ordered selection

for t in sort(H, complete candidate order):
  if startFeasible(R union {t}):
    append t to R
  else:
    record rejection snapshot for t

recommended_set = task IDs in R
```

`recommended_set`の意味は集合であり、複数recommended task間に実行上の暗黙順序を付けない。Scan orderはselectionと説明を再現するために保持する。

この選択は次を保証する。

- `R`は`P`のsubsetである
- `R`全体はactive allocationを含めてjointly feasibleである
- `R`はscan終了時に`H`に対してinclusion-maximalである
- `R`がtask数、priority合計、resource makespan、project completionを最適化するとは保証しない
- horizon外のtaskは、resourceに余裕があっても`R`へ自動追加しない

## 10. Empty setとparallel recommendation

`R`は次の場合にemptyになり得る。

- `P`がempty
- `C`がempty
- `H`の全taskがapplied capacityとactive allocationにより現在resource-feasibleでない

`H`にresource requirementを持たないtaskが1件以上あれば、そのtaskは必ず`R`へ入る。`H`のtaskが異なるresourceを使う、またはcapacity内で共存できる場合、複数taskを同時に`recommended`とする。

Parallel recommendationは「同時開始可能で、同じselection horizonに属する」ことを意味する。Task間のdependencyを追加せず、どれか1件だけを選ぶ排他的な意味を持たない。

`R`がemptyでもhorizon外のfeasible taskを自動的にrecommendedへ繰り上げない。そのtaskはRecommendation Semantics仕様に従って`allowed`になり得る。これにより、工程上の第一候補がresource待ちである事実と、余剰resourceで開始可能なworkを区別する。

## 11. Tier classificationへの接続

Version 1では`explicitNegativeFact(t)`と`policyDefers(t)`は常にfalseであるため、ready taskのnormal tierは次になる。

```text
if t in R:
  recommended
else if startFeasible(R union {t}):
  allowed
else:
  deferred
```

`discouraged`はversion 1では生成しない。将来、規範的negative factを追加するまで、推測したriskやrelease意味を理由にdiscouragedを返してはならない。

Allowed判定は各taskを`R`へ個別追加するcounterfactualである。複数allowed taskをまとめて開始できるとは保証しない。

## 12. Current schedulerとの非循環な境界

現行scheduler `parallel-sgs` version 1と`runnable_now`は本policyの入力ではない。

```text
precedence CPM facts ─┐
project graph facts  ├─> recommendation ranking ─> R
current capacity     ┘

precedence CPM facts ─┐
project graph facts  ├─> parallel-sgs v1 ─> resource schedule / runnable_now
current capacity     ┘
```

- `R`をscheduler candidate orderから導出しない
- `runnable_now` membershipをranking keyにしない
- schedulerのresource arc、schedule critical path、resource waitをrankingへ戻さない
- `R`をresource scheduleのhard precedenceとして注入しない
- `R`導入時も現行`runnable_now`の意味とscheduler version 1を変更しない

Resource schedule criticalityをranking inputにすると、candidate orderがscheduleを変え、変化したschedule criticalityが再びcandidate orderを変える循環が生じる。Version 1はこれを明示的に禁止する。

将来resource schedule factを採用する場合は、recommendationに依存しないbaseline schedulerを先に固定するか、収束条件を持つ反復algorithmを別versionとして規範化しなければならない。単に現在のschedule resultをversion 1へ追加してはならない。

## 13. Decision traceへの出力契約

本節は[Recommendation Structured Explanation仕様](recommendation-explanation.md)へ渡すsemantic inputを定義する。JSON field名やserialization schemaは固定しない。

### 13.1 Stable rule ID

Candidate comparisonの各keyへ次のstable rule IDを割り当てる。

| Order | Rule ID | Winner condition |
| ---: | --- | --- |
| 1 | `critical_class` | より高いcritical class |
| 2 | `lower_total_float` | exact total floatが小さい |
| 3 | `higher_explicit_priority` | priorityが大きい |
| 4 | `higher_new_ready_count` | new ready task数が多い |
| 5 | `higher_new_gate_count` | new satisfied gate数が多い |
| 6 | `higher_new_milestone_count` | new reached milestone数が多い |
| 7 | `shorter_next_gate_distance` | 次のgateまでのtask数が小さい |
| 8 | `shorter_finish_distance` | finishまでのtask数が小さい |
| 9 | `longer_expected_duration` | expected durationが大きい |
| 10 | `task_id_tiebreak` | task IDがASCII辞書順で小さい |

Resource selectionには`joint_resource_feasibility`、selection horizonには`selection_horizon`を使用する。これらはreason code taxonomyではなく、ranking decisionを識別するrule IDである。

### 13.2 Pairwise comparison

任意の異なるcandidate`a`と`b`について、complete candidate orderで先になる方を`winner`、後になる方を`alternative`とする。`decisive_rule`はtupleで最初に異なるkeyのrule IDである。それより前の同値keyと、それより後にwinnerを補強するkeyは`supporting_rules`として保持できるが、decisive ruleと混同しない。

Comparison inputは少なくとも次の意味を保持する。

```text
winner_task_id
alternative_task_id
decisive_rule_id
decisive_winner_fact
decisive_alternative_fact
supporting_rule_ids
```

Factは§6の型とexact valueを保持する。自然言語descriptionをfact valueとして渡さない。

### 13.3 Per-task selection decision

各ready taskについて次を後続decision traceへ渡せなければならない。

- candidateかnegative factによる除外か
- critical classとhorizon membership
- complete ranking keyとscan position
- `R`への選択有無
- horizon内taskでは、選択直前のactive usage、earlier selected usage、available、required、deficit
- tier classificationに使用する`startFeasible(R union {t})`
- horizon外の場合、horizon先頭taskとのpairwise comparison
- horizon内でresource rejectされた場合、先に選択された競合taskとactive blocker

Resource rejectのready-task winnerは、deficitがあるresource ID辞書順、当該resourceを占有するearlier selected taskのscan順、task ID順で最初のtaskとする。複数taskの合計でのみdeficitが生じる場合は全contributorを保持する。Active allocationだけでrejectされた場合、ready-task winnerを捏造せず`winner_task_id`を非適用とし、active blocker task IDと`joint_resource_feasibility`を決定理由にする。

Horizon外taskのcomparison winnerは、`sort(H)`の先頭taskとする。そのtaskがactive resourceのため`R`へ選択されなかった場合も、これはranking上のwinnerであってselected taskではないことを区別する。

### 13.4 Winnerとselectionの区別

`winner`はpairwise rankingまたはresource allocation decisionで優先されたtaskを表し、常に`recommended` membershipを意味するとは限らない。後続modelは少なくとも次を混同してはならない。

- ranking上のwinner
- horizon membership
- resource scanで選択されたtask
- final recommendation tier

これにより、第一候補がactive resource待ちで`R`がemptyでも、「なぜ別taskがrecommendedではなくallowedなのか」をranking factとresource factから説明できる。

## 14. Re-analysisとcache boundary

次の変更後はranking fact、horizon、`R`、comparisonを再計算する。

- task start、completion、block、unblock
- milestone stateまたはeffective reached closure
- dependency、gate、finish milestone
- duration、estimate、priority、requirement
- resource capacityまたはcapacity override
- `critical_epsilon`
- ranking algorithm version

Resultをcacheする場合は、canonical source digest、analysis option、applied capacity map、precedence analysis version、ranking algorithm ID/versionへ条件付ける。古い`R`だけを新しいsnapshotへ再利用しない。

## 15. Version 1のnon-goalと将来拡張

Version 1は、明示factだけで説明可能なbounded heuristicを優先する。次は将来のfact modelまたは別algorithm versionが必要である。

- release gateと通常dependency gateの業務上の区別
- milestoneごとのbusiness importanceまたはdeadline
- rework/replacement risk、information sufficiency
- exact resource-constrained completion optimization
- resource schedule criticalityを使う反復ranking
- backlog、sprint、macro/detail compositionをまたぐpriority
- empirical outcomeからのweight学習

これらがないことをAIの推測や自然言語解釈で補ってはならない。

## 16. 本sliceのacceptance

- ranking domainをactual ready taskへ限定した
- version 1で利用できるtyped factと除外factを列挙した
- critical class、float、priority、unlock、gate、milestone distanceの完全な優先規則を定義した
- selection horizonとhorizon外の`allowed`可能性を定義した
- recommended setの決定的scanとjoint resource feasibilityを定義した
- empty setとparallel recommendationを定義した
- task IDまで含むcomplete tie-breakを固定した
- algorithm ID/versionとversion変更条件を固定した
- scheduler、schedule criticality、`runnable_now`との循環を排除した
- winner、alternative、decisive ruleをstructured decision traceへ渡す契約を定義した
- release semantics、rework risk、情報不足を推測していない
- current interfaceとimplementationを変更していない
