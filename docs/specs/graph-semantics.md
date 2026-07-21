# perttool Graph Semantics仕様

- 文書状態: Draft 0.1
- Semantics version: 1
- 作成日: 2026-07-21
- 対応要件: [../requirements.md](../requirements.md)
- 文法仕様: [dsl-grammar.md](dsl-grammar.md)
- 対応基本設計: [../basic-design.md](../basic-design.md)

## 1. 目的

本書は、構文上有効な`.pert`文書をDAGとして解決し、milestoneの到達状態、task/gateの充足、次タスク分類、frontier、resourceとの境界、`advance`後に残す最小graphを決定する規範仕様である。

PERT/CPMの数式、resource scheduleのevent生成、capacity 2以上のresource arc、schedule critical pathは`docs/specs/analysis.md`で定義する。本書は、それらの入力となる有効graphと保存状態の意味を固定する。

## 2. 規範の優先順位

不一致がある場合は次の順で解消する。

1. `docs/requirements.md`のMust requirement
2. 本書のgraph、state、advance規則
3. [DSL文法仕様](dsl-grammar.md)の構文・field規則
4. `docs/basic-design.md`の実装構造
5. `docs/examples/*.pert`とhelp表示

構文上受理できることは、graphとして有効であることを意味しない。parseまたはfield validationにerrorがある文書へ本書のgraph分析を適用してはならない。

## 3. 対象と非対象

本書が定義するもの:

- entity IDとreferenceの解決
- task/gateをedgeとするDAG
- root、finish、finish reachability
- stored milestone stateとeffective reached closure
- task statusとedge satisfaction
- `active`、`ready`、`blocked_now`、`upcoming`の集合
- resource referenceと時刻0のactive allocation整合性
- frontierとproject completion
- `advance`のsemantic rewriteと不変条件
- graph diagnostic code、順序、source location

本書が定義しないもの:

- duration、expected、variance、floatの数式
- ready taskの最終表示順位
- resource scheduleの最適性
- resource waitを説明するresource arcの選択
- formatterのcomment移動規則
- file write、atomic replace、optimistic lock
- Mermaid metadata、JSON Schema、MCP wire contract

## 4. 正規graph model

### 4.1 記号

参照解決後のgraphを次で表す。

```text
G = (V, E)
E = T union Q
```

- `V`: milestone集合
- `T`: task edge集合
- `Q`: gate edge集合
- `src(e)`: edgeの`from` milestone
- `dst(e)`: edgeの`to` milestone
- `In(v)`: `dst(e) = v`であるedge集合
- `Out(v)`: `src(e) = v`であるedge集合
- `finish`: `project.finish`が参照するmilestone

Resourceは`G`のvertexまたはedgeではない。taskからresourceへのrequirementは別の二部関係として保持する。

### 4.2 ID domain

project、resource、milestone、task、gateのIDは1つのglobal namespaceを共有する。

Rules:

- IDは文書全体で一意
- exact lowercaseの予約語はentity IDに使用不可
- task/gate endpointはmilestoneだけを参照できる
- task requirementはresourceだけを参照できる
- title、宣言順、source位置をreference解決に使用しない
- forward referenceを許可する

### 4.3 edge identity

task/gate IDがedge identityである。同じ`from`と`to`を持つparallel edgeを許可し、それぞれ独立した依存条件として数える。

Milestoneのindegreeはedge数であり、endpoint pair数ではない。parallel edgeを1本へ自動統合してはならない。

## 5. Graph build pipeline

有効graphは次の順で構築する。

```text
field-valid AST
 -> collect global IDs
 -> resolve finish/endpoints/resources
 -> build stable adjacency
 -> self-loop/cycle validation
 -> finish/reachability validation
 -> effective reached closure
 -> state consistency validation
 -> active resource validation
 -> valid PertGraph
```

Rules:

- errorが1件以上ある場合、public analyzerへ`PertGraph`を渡さない
- 独立したerrorは可能な範囲で同じcheckに報告する
- cycleに依存する到達性やstate errorは、誤誘導を避けるため抑制できる
- warningだけならgraphを生成し、analysisを続行できる
- adjacency内のedgeはedge IDの辞書順とする

## 6. 構造的な有効性

### 6.1 self-loopとDAG

すべてのtask/gateについて`src(e) != dst(e)`でなければならない。

taskとgateを区別せず全edgeを含めたgraphがDAGでなければならない。resource共有関係、owner、priorityはcycle検査へ含めない。

### 6.2 stable topological order

Kahn algorithmを使用し、入次数0の候補milestoneをID辞書順で選ぶ。edgeを処理するときはedge ID辞書順とする。

全milestoneを処理できない場合はcycle errorとし、未処理subgraphから少なくとも1つのcycle witnessを返す。

Cycle witnessは次の順で決定する。

1. 未処理milestoneのうちID辞書順で最初のものからDFSする
2. outgoing edgeをedge ID、次にtarget IDの順で走査する
3. 最初のback edgeで閉じるcycleを採用する
4. 表示上は最小milestone IDから始まるようrotateする
5. milestone ID列とedge ID列の両方を返す

### 6.3 finish

- `project.finish`は存在するmilestoneを参照する
- `Out(finish)`はemptyでなければならない
- finish自身はfinishへ到達可能とする
- zero-task projectは、finishが唯一のmilestoneかつ明示`reached`なら有効な完了済みprojectにできる

### 6.4 finish reachability

finishから全edgeを逆向きに走査する。

有効graphでは次を満たす。

```text
for every v in V: v can reach finish
for every e in E: dst(e) can reach finish
```

未完了edgeだけでなく、一時的に残されたdone taskとgateも対象にする。finishへ至らない過去専用subgraphを履歴目的で残すことは許可しない。

Resource declarationはfinish reachabilityの対象外であり、未使用resourceを宣言してもgraph errorにしない。

### 6.5 roots

`In(v)`がemptyのmilestoneをrootとする。

- すべてのrootは明示的に`state reached`でなければならない
- rootは複数存在でき、すべて現在frontierの独立入口として扱う
- rootでないmilestoneを明示`reached`にできるが、後述のincoming consistencyを満たす必要がある

## 7. 保存状態とedge satisfaction

### 7.1 stored milestone state

Milestoneの保存状態は次の2値である。

- `planned`: 省略時の値。到達済みかどうかはclosureで導出する
- `reached`: 現行snapshotの明示的な到達事実

`state`は計算cacheではない。明示frontierをGit管理可能な文書へ保存するために使用する。

### 7.2 task status

Task statusは排他的である。

| Status | 実行状態 | edge satisfaction | 時刻0のresource占有 |
| --- | --- | --- | --- |
| `planned` | 未着手 | unsatisfied | なし |
| `active` | 実行中 | unsatisfied | 全requirements |
| `blocked` | 外部要因で実行していない | unsatisfied | なし |
| `done` | 作業条件を満たした | source reachedならsatisfied | なし |

`active` taskのduration/estimateはsnapshot時点の残所要時間を表す。

Grammar version 1では`active`と`blocked`を同時に表せない。停止中もresourceを保持する作業や、途中でresourceを解放・再取得する作業は表現対象外とする。

### 7.3 satisfaction function

Milestone集合`R`に対するedge satisfactionを次で定義する。

```text
sat(task e, R) = status(e) == done and src(e) in R
sat(gate e, R) = src(e) in R
```

Rules:

- gateはduration、status、resource requirementを持たない
- gateはsourceがreachedになった同じclosure計算内で即座にsatisfiedになる
- `done`だけを見てsource未到達のtaskをsatisfiedにしてはならない
- `active` taskのtargetは、残durationが0であっても自動到達しない
- resource空き状況はsatisfactionへ影響しない

## 8. Effective reached closure

### 8.1 least fixed point

明示`state reached`の集合を`S`とする。次の関数を固定点まで適用してeffective reached集合`R*`を求める。

```text
F(R) = R union {
  v |
  In(v) is not empty and
  every e in In(v) satisfies sat(e, R)
}

R* = least_fixed_point(F, S)
```

DAGなのでstable topological orderで1回前向きに処理できる。実装がqueue方式を使う場合も同じ`R*`を返さなければならない。

### 8.2 all-incoming join

Milestoneはincoming edgeのうち1本ではなく、すべてがsatisfiedになった場合だけ導出到達する。

- taskとgateを同じincoming conditionとして数える
- parallel edgeもそれぞれ満たす必要がある
- blocked、active、planned taskはいずれもjoinを満たさない
- done branchとunfinished branchが合流する場合、done edgeはunfinished branch完了まで現行graphに必要である

### 8.3 state consistency

Closure計算後に次を検証する。

- 明示`reached` milestoneのincoming edgeは、すべて`R*`に対してsatisfiedでなければならない
- `active`または`done` taskのsourceは`R*`に含まれなければならない
- rootが`R*`に含まれない状態はerror
- `planned`保存状態だがclosureで到達したmilestoneは有効だが、`advance`可能warningを返す

明示`reached`を根拠に自身の不完全incomingを無視してはならない。incoming inconsistencyがあるgraphはanalysisへ渡さない。

### 8.4 project completion

有効graphについて次で定義する。

```text
projectComplete = finish in R*
```

有効graphでprojectがcompleteなら、finishへ至る全taskは`done`である。off-path unfinished taskはfinish reachability ruleにより存在できない。

## 9. Derived task classification

Task classificationは保存fieldではなく、statusと`R*`から導出する。

```text
active = {
  t | status(t) == active
}

ready = {
  t | status(t) == planned and src(t) in R*
}

blocked_now = {
  t | status(t) == blocked and src(t) in R*
}

upcoming = {
  t |
  status(t) in {planned, blocked} and
  src(t) not in R*
}
```

Rules:

- `done` taskをnext candidateに含めない
- `active` taskをready/upcomingへ重複分類しない
- source未到達のblocked taskは`upcoming`であり、依存到達後に`blocked_now`になる
- gateはtask classificationに含めない
- priority、resource capacity、owner、durationはready判定を変更しない
- 1 taskは上記の最大1集合にだけ属する

`runnable_now`は`ready`の部分集合である。時刻0のactive allocationを差し引き、analysis仕様の決定的なresource選択規則を適用して求める。resourceを要求しないready taskは常にresource-feasible candidateである。

## 10. Gate semantics

GateはAoA上のdummy dependency edgeである。

- source reachedならsatisfied
- target reachabilityには他のincoming edgeと同じall-incoming ruleを適用
- durationは常に0
- varianceとresource usageは0
- task status、owner、priority、requiresを持たない
- cycle、finish reachability、advance retentionの対象になる
- taskへ暗黙変換せず、可視化とdiagnosticで種別を保持する

Gate chainはclosure内で連続伝播できる。gateだけで到達できるmilestoneを利用者が手動で`reached`へ変更する必要はない。

## 11. Resource semantics boundary

### 11.1 resolved requirements

各task requirementは`resource ID -> positive integer units`のmapとして解決する。

- resource IDが存在し、resource kindであること
- unitsは宣言capacity以下であること
- 同一task内でresource IDが一意であること
- 全requirementsを同時取得すること

Resource requirementはprecedence edgeではなく、topological order、cycle、reached、readyへ影響しない。

### 11.2 active allocation

Resource`r`のsnapshot時刻0における使用量を次で定義する。

```text
activeUsage(r) = sum(requirement(t, r) for t in active)
```

すべてのresourceについて`activeUsage(r) <= capacity(r)`でなければならない。超過はanalysis不能なresource errorとする。

`planned`、`blocked`、`done`、gateは時刻0にresourceを占有しない。`blocked` taskの外部待ち時間は推測せず、将来scheduleはblockが時刻0で解消した条件付き結果として扱う。

### 11.3 capacity override

What-if用capacity overrideはanalysis requestの一時入力である。

- 正本resource declarationを書き換えない
- reference resolutionと正の整数constraintを再検査する
- activeUsageを下回るoverrideはerror
- effective reachedとready集合を変更しない
- runnable_now、resource schedule、schedule critical pathは変更し得る

## 12. Frontier

### 12.1 future-required edges

有効graphのeffective reached集合を`R*`とし、次を定義する。

```text
E_keep = { e in E | dst(e) not in R* }
V_keep = { finish } union endpoints(E_keep)
```

State consistencyが成立する有効graphでは、次が成り立つ。

- targetがreachedのedgeはsatisfied済みの過去condition
- targetがunreachedのedgeは、unfinished workまたは未到達joinに必要なsatisfied condition
- unfinished taskのtargetは必ずunreached

### 12.2 frontier set

現在frontierを次で定義する。

```text
frontier = R* intersection V_keep
```

Project completeの場合は`frontier = {finish}`とする。

Frontierには次の両方が含まれる。

- planned/active/blocked taskのsourceであるreached milestone
- 未到達joinへ入るdone taskまたはsatisfied gateのsourceとして、部分合流を記憶するreached milestone

したがってfrontierは単なる「unfinished taskの開始点」ではない。合流条件を失わないためのrootも含む。

## 13. Advance semantics

### 13.1 precondition

`advance` plannerは次を満たす場合だけcandidateを生成する。

- parse、field、reference、DAG、state、resource validationにerrorがない
- effective reached closureを決定できる
- input digestとsource textが呼出時点で対応している

Warningはpreviewを妨げないが、candidateに含めて表示する。

### 13.2 canonical rewrite

`R*`、`E_keep`、`V_keep`を前節どおり求め、次のgraphを生成する。

```text
V' = V_keep
E' = E_keep

storedState'(v) =
  reached  if v in R*
  planned  otherwise
```

Rules:

- `E'`に含まれるtask/gateのID、field、status、requirementを変更しない
- `V'`に含まれるmilestoneのIDとuser fieldを維持する
- `R*`に含まれるretained milestoneを明示`state reached`にする
- `V'`外のmilestoneと`E'`外のedgeを削除する
- resource declarationは自動削除しない
- project ID、finish、duration unit、target durationを変更しない
- `as_of`はwall clockから自動生成せず、callerが明示した場合だけ別mutationとして変更する
- declaration/commentのtext edit規則はmutation仕様へ送る

### 13.3 retention rule

Edgeの保持条件はtargetが未到達かどうかだけで決まる。

| Edge state | Target | Advance |
| --- | --- | --- |
| done task | reached | remove as past |
| gate | reached | remove as past |
| done task | unreached join | keep as partial satisfaction |
| satisfied gate | unreached join | keep as partial satisfaction |
| planned/active/blocked task | unreached | keep as future work |
| gate from unreached source | unreached | keep as future dependency |

この規則により、合流前のdone branchを誤って削除しない。

### 13.4 postcondition

Advance candidateは再parse・再検査し、次を満たさなければならない。

- global ID、reference、DAG、finish reachabilityが有効
- residual graphの全rootが明示`reached`
- retained milestoneのeffective reached集合がinputと一致
- unfinished taskのID、status、duration/estimate、resource requirementが一致
- `active`、`ready`、`blocked_now`、`upcoming`がtask ID単位で一致
- precedence/resource analysisのcurrent-boundary入力が意味的に一致
- project completion判定が一致
- 同じcandidateへ再度`advance`してもsemantic diffがempty

削除entity、state変更、保持したdone/gateと保持理由をpreview resultへ列挙する。

### 13.5 minimality

Grammar version 1の表現力では、`E_keep`の各edgeは未到達targetのincoming conditionなので削除できない。`V_keep`の各milestoneはfinishまたは保持edgeのendpointなので削除できない。

逆に、targetがreachedのedgeは将来の到達判定へ影響せず、そのedgeだけから参照されるmilestoneも将来graphに不要である。この意味でcanonical rewriteは、IDを新規合成せずに作れる最小residual graphである。

## 14. Determinism

同じdocument text、semantics version、optionから次が一致しなければならない。

- reference resolution result
- stable topological order
- cycle witness
- effective reached set
- task classification
- frontier
- advance keep/remove set
- diagnostics order

集合のJSON/text表示は、別途指定がない限りentity ID辞書順とする。

Diagnosticは次のkeyで並べる。

1. severity: error、warning、info
2. primary span start offset
3. diagnostic code
4. entity ID

## 15. Graph diagnostic code

### 15.1 reference and kind

| Code | Severity | Meaning | Primary span |
| --- | --- | --- | --- |
| `PTSEM-201` | error | duplicate global entity ID | 後のID |
| `PTSEM-202` | error | reserved wordをentity IDに使用 | entity ID |
| `PTSEM-203` | error | undefined `project.finish` | finish value |
| `PTSEM-204` | error | undefined task/gate endpoint | endpoint ID |
| `PTSEM-205` | error | endpointがmilestone kindでない | endpoint ID |
| `PTSEM-206` | error | undefined resource requirement | resource ID |
| `PTSEM-207` | error | requirement参照先がresource kindでない | resource ID |
| `PTSEM-208` | error | requirement unitsがcapacity超過 | units |

### 15.2 DAG and state

| Code | Severity | Meaning | Primary span |
| --- | --- | --- | --- |
| `PTDAG-201` | error | task/gate self-loop | arrow |
| `PTDAG-202` | error | directed cycle | witness先頭edge |
| `PTDAG-203` | error | finishにoutgoing edgeがある | outgoing edge header |
| `PTDAG-204` | error | milestone/edgeがfinishへ到達不能 | entity ID |
| `PTDAG-205` | error | rootが明示`reached`でない | milestone ID/state |
| `PTDAG-206` | error | 明示reached milestoneにunsatisfied incomingがある | milestone state |
| `PTDAG-207` | error | active/done taskのsourceがeffective reachedでない | task status |
| `PTDAG-208` | warning | planned milestoneがclosureでeffective reached | milestone ID/state |
| `PTDAG-209` | warning | canonical advanceで過去entityを除去可能 | 最初の対象entity |

### 15.3 resource state

| Code | Severity | Meaning | Primary span |
| --- | --- | --- | --- |
| `PTRES-201` | error | active taskの合計使用量がcapacity超過 | resource capacity |
| `PTRES-202` | error | what-if capacityがactiveUsage未満 | override value |

Duplicate、cycle、capacity errorでは、先行宣言、cycle構成edge、占有active taskをrelated locationとして返す。

## 16. Source mapping and result boundary

Graph entityは元AST/CSTのsource referenceを保持する。

- entity diagnosticはIDまたは最小のfield valueをprimary spanにする
- undefined referenceは参照tokenを指す
- state contradictionは`state`または`status` valueを指す
- `state` field省略時のroot errorはmilestone IDを指す
- cycleはwitness edgeすべてをrelated locationにする
- finish unreachableはentityごとにerrorを返せるが、callerの最大件数を尊重する

`check` resultは、parse/field diagnosticsとgraph diagnosticsを同じ共通modelで返す。Graph errorがある場合、analysis/next/advance resultを成功扱いで返してはならない。

## 17. Normative examples

### 17.1 minimal

[minimal.pert](../examples/minimal.pert)の期待値:

```text
effective reached = [NOW]
frontier           = [NOW]
active             = []
ready              = [WORK]
blocked_now        = []
upcoming           = []
project complete   = false
```

`WORK`を`done`へ変更すると`DONE`がeffective reachedになり、project completeとなる。canonical advance後はprojectと`state reached`の`DONE`だけがgraph entityとして残る。

### 17.2 resource-parallel

[parallel.pert](../examples/parallel.pert)の初期期待値:

```text
effective reached = [NOW]
ready              = [CLI, CORE, DOCS]
runnable_now       = [CORE, CLI]
```

`runnable_now`は既定capacityと初期resource priority ruleによる。DEVELOPERS capacityを3へoverrideしてもeffective reachedとreadyは変化せず、runnable_nowへ`DOCS`が追加される。

### 17.3 partial join before advance

[advance-partial-before.pert](../examples/advance-partial-before.pert)では、`BRANCH_A`と`A_JOIN_WORK`がdone、`BRANCH_B`がactiveである。

```text
effective reached = [A_DONE, NOW]
frontier           = [A_DONE, NOW]
active             = [BRANCH_B]
ready              = []
upcoming           = [RELEASE]
```

`JOINED`は`A_JOIN_WORK`だけがsatisfiedなのでunreachedである。`A_DONE`は保存状態plannedだがeffective reachedなので`PTDAG-208`を返す。

Canonical advanceは`BRANCH_A`を過去として削除するが、未到達`JOINED`の条件であるdone task `A_JOIN_WORK`を保持する。結果は[advance-partial-after.pert](../examples/advance-partial-after.pert)と意味的に一致する。

### 17.4 partial join after advance

[advance-partial-after.pert](../examples/advance-partial-after.pert)では`NOW`と`A_DONE`が明示rootである。再度advanceしてもdiffはemptyである。

`BRANCH_B`をdoneへ変更すると`JOINED`がeffective reachedになり、次のadvanceでは`A_JOIN_WORK`と`BRANCH_B`の両方を過去として削除し、`JOINED`を明示reachedにして`RELEASE`をreadyのまま保持する。

## 18. Invalid-state examples

最低限、次をfixtureで拒否する。

1. planned root
2. active task from unreached milestone
3. done task from unreached milestone
4. explicit reached join with planned/active/blocked incoming
5. task/gateを含むcycle
6. finish outgoing edge
7. finish-unreachable past subgraph
8. endpointがresource ID
9. requirementがmilestone ID
10. active resource oversubscription

## 19. Semantics acceptance

実装時は最低限、次を自動検査する。

1. declaration順に依存せず同じresolved graphを返す
2. parallel edgeを独立incomingとして保持する
3. stable topological orderとcycle witnessが決定的
4. root、finish、finish reachabilityを検査する
5. gate chainとdone taskを通じたleast fixed point closureを返す
6. partial joinで未完了branchがある間はtargetをreachedにしない
7. active/done source consistencyを検査する
8. taskをactive/ready/blocked_now/upcomingへ重複なく分類する
9. resource capacity変更がreached/readyを変えない
10. active allocation超過を検出する
11. canonical advanceがpartial joinのdone/gateを保持する
12. advance前後でunfinished task分類が一致する
13. advanceがidempotent
14. complete projectをfinishだけのresidual graphへできる
15. diagnostic code、primary span、related location、順序がgoldenと一致する

## 20. Versioning and next specification

Semantics version 1はgrammar version 1を対象とする。

本書の有効graphを入力とするduration、PERT/CPM、resource schedule、`runnable_now`、resource arc、schedule critical path、rounding、tie-breakは[Analysis仕様](analysis.md)で固定した。次は`docs/specs/interfaces.md`で外部resultと操作契約を固定する。

Graph semanticsを破壊的に変更する場合は、grammar変更の有無にかかわらずsemantics version、fixture、migration影響を明示する。
