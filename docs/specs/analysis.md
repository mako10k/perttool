# perttool Analysis仕様

- 文書状態: Draft 0.2
- Analysis version: 1
- Scheduler: `parallel-sgs` version 1
- 作成日: 2026-07-21
- 対応要件: [../requirements.md](../requirements.md)
- Graph semantics: [graph-semantics.md](graph-semantics.md)
- 文法仕様: [dsl-grammar.md](dsl-grammar.md)
- 対応基本設計: [../basic-design.md](../basic-design.md)

## 1. 目的

本書は、有効なperttool graphから次を決定的に計算する規範仕様である。

- exact Rationalによるduration、PERT expected、variance
- precedence-only CPMのforward/backward pass
- total float、free float、critical subgraph、代表critical path
- renewable resource capacityを守る実行可能schedule
- `runnable_now`とresource不足説明
- capacity 2以上と複数resourceに対応するresource release witness arc
- resource待ちを含むschedule constraint graphとschedule critical path
- rounding、tie-break、path count、diagnostic

通常のprecedence critical pathと、選択されたresource schedule上のschedule critical pathを別resultとして返す。MVPのresource scheduleを最適解と表示してはならない。

## 2. 規範の優先順位と境界

不一致がある場合は次の順で解消する。

1. `docs/requirements.md`のMust requirement
2. [Graph Semantics仕様](graph-semantics.md)の有効graph、state、frontier
3. 本書の数値・分析・scheduler規則
4. [DSL文法仕様](dsl-grammar.md)のliteral規則
5. `docs/basic-design.md`と`docs/examples/`

本書はparse、reference resolution、cycle、state consistencyを再実装しない。Graph errorがある場合はanalysisを開始しない。

本書の対象外:

- calendar、休日、shift、timezone、setup time、skill
- consumable resource、preemption、途中のrequirement増減
- exact solverをMVP既定経路にすること
- target duration完了確率、Monte Carlo simulation、複数pathの厳密な完了確率
- JSON Schema、CLI option spelling、post-MVP adapter wire contract

## 3. Analysis input view

### 3.1 canonical residual view

分析はsource document全体ではなく、Graph Semantics仕様のcanonical residual viewを使用する。

```text
R       = effective reached set
E_a     = { e | dst(e) not in R }
V_a     = { project.finish } union endpoints(E_a)
F_a     = R intersection V_a
G_a     = (V_a, E_a)
```

- `F_a`をcurrent frontierとする
- `E_a`にはunfinished task、未到達joinに必要なdone task/gateが残る
- targetがreachedの過去edgeは分析対象外
- resource declarationは元graphからすべて参照できる
- project completeなら`V_a = {finish}`、`E_a = empty`、makespanは0

このviewにより、canonical advanceの前後で、retained taskのanalysis結果が変わらない。

Projectの`critical_epsilon`はproject unitの0以上のexact Rationalへ正規化し、省略時は0とする。`target_duration`は入力metadataとして保持するが、Analysis version 1では完了確率を計算しない。

### 3.2 analysis options

Analysis version 1が意味として受け取るoption:

- resource schedule: `precedence`、`resource`、`both`
- resource capacity override map
- display precision
- critical path enumeration limit

Optionの具体的CLI/JSON名はinterface仕様で固定する。Optionの指定順は結果へ影響しない。

### 3.3 result separation

Primary resultは少なくとも次を分離する。

```text
analysis
├── numeric metadata
├── precedence result
├── resource result        optional by mode
├── next-task annotations
└── diagnostics/qualifiers
```

Resource resultをprecedence fieldへ上書きしない。`makespan`だけを文脈なしで返さず、`precedenceMakespan`と`resourceMakespan`を区別する。

## 4. Rational arithmetic

### 4.1 canonical form

すべてのduration、time、float、variance、utilizationをexact Rationalで計算する。

```ts
interface Rational {
  numerator: bigint;
  denominator: bigint;
}
```

Canonical invariant:

- denominatorは正
- `gcd(abs(numerator), denominator) = 1`
- zeroは`0/1`
- signはnumeratorだけに持つ
- arithmetic途中でJavaScript `number`へ変換しない

### 4.2 decimal conversion

有限小数`whole.fraction`を次でexact変換する。

```text
digits      = concatenate(whole, fraction)
scale       = length(fraction)
rational    = integer(digits) / 10^scale
```

変換後に約分する。`0.10`と`0.1`は同じRationalである。Duration unitはproject unitへfield validation済みであることを前提とする。

### 4.3 operations

加算、減算、乗算、除算、比較、絶対値、平方をBigIntで実装する。

- 0除算はinternal error
- compareはcross multiplicationで行う
- `max`、`min`の同値時は値だけを返し、entity tie-breakはcallerが行う
- varianceのdenominatorも約分する
- resource quantityとpriorityはintegerのまま保持し、duration Rationalと混在させない

### 4.4 exact output

機械可読resultはexact valueを失ってはならない。

```text
numerator: signed decimal integer string
denominator: positive decimal integer string
unit: day | hour | day^2 | hour^2 | ratio
```

人間向けdecimalは派生表示であり、比較、critical判定、tie-breakへ再利用しない。

## 5. Duration and variance

### 5.1 effective duration

Analysis edge duration`d(e)`を次で定義する。

```text
d(gate) = 0
d(done task) = 0
d(deterministic unfinished task) = declared duration
d(PERT unfinished task) = expected duration
```

`unfinished`は`planned`、`active`、`blocked`を含む。`active`の見積りはsnapshot時点の残量である。

### 5.2 PERT expected and variance

三点見積り`O`、`M`、`P`について:

```text
expected = (O + 4M + P) / 6
variance = ((P - O) / 6)^2
```

- 計算途中で丸めない
- deterministic taskのvarianceは0
- gateとdone taskの残varianceは0
- variance unitはproject duration unitの二乗
- path varianceはtaskが独立である近似の下でtask varianceを加算する
- blocked外部待ち時間のmean/varianceを推測しない

### 5.3 blocked qualifier

Residual graphに`blocked` taskが1件以上ある場合、precedence/resource resultの両方へ次を付ける。

```text
conditionalOnBlocksResolved = true
blockedTaskIds = sorted IDs
```

表示する完了見込みは、blockが時刻0で解消し、記載された残durationだけを要する条件付き値である。

## 6. Precedence CPM

### 6.1 virtual boundary

`G_a`へvirtual source `@START`とvirtual sink `@FINISH`を加える。

- `@START -> v`を全`v in F_a`へweight 0で接続する
- `finish -> @FINISH`をweight 0で接続する
- virtual elementをDSL entityやMermaid正本へ保存しない

Project completeの場合、`@START -> finish -> @FINISH`の0-duration pathとして扱う。

### 6.2 forward pass

Frontier milestoneのearliestを0とする。

```text
E(v) = 0                                      if v in F_a
ES(e) = E(src(e))
EF(e) = ES(e) + d(e)
E(v) = max(EF(e) for e in In_a(v))           otherwise
precedenceMakespan = E(finish)
```

MilestoneはGraph Semantics仕様のstable topological orderを`V_a`へfilterした順で処理する。同値のincoming edgeがある場合、値は同じであり、path predecessor選択だけedge IDでtie-breakする。

### 6.3 backward pass

```text
L(finish) = precedenceMakespan
LF(e) = L(dst(e))
LS(e) = LF(e) - d(e)
L(v) = min(LS(e) for e in Out_a(v))
```

Reverse stable topological orderを使う。`finish`以外の全milestoneはfinish reachableなので、少なくとも1本のoutgoing edgeを持つ。

### 6.4 float

```text
totalFloat(e) = LS(e) - ES(e)
              = L(dst(e)) - E(src(e)) - d(e)

freeFloat(e) = E(dst(e)) - EF(e)
             = E(dst(e)) - E(src(e)) - d(e)

milestoneSlack(v) = L(v) - E(v)
```

有効入力ではfloatとmilestone slackは0以上である。負値はroundingで0へ補正せず、analysis invariant failureとして扱う。

## 7. Precedence critical result

### 7.1 critical and driving

User-facing critical判定:

```text
isCritical(e) = abs(totalFloat(e)) <= criticalEpsilon
```

Exact longest pathを構成するdriving判定:

```text
isDriving(e) = totalFloat(e) == 0
```

`criticalEpsilon > 0`の場合、critical subgraphはnear-critical edgeを含み得る。代表critical pathとpath countは、makespanを実際に達成するexact driving edgeだけから作る。

### 7.2 critical subgraph

Resultに次を含める。

- critical milestone IDs
- critical task IDs
- critical gate IDs
- driving edge IDs
- edgeごとのES、EF、LS、LF、total/free float、expected、variance
- milestoneごとのearliest、latest、slack

Critical elementの表示順はstable topological position、同位置ではID辞書順とする。

### 7.3 representative path

Driving subgraph上で`@START`から`@FINISH`へ到達できるarcだけを残す。

代表pathは各nodeで、sinkへdriving pathを持つoutgoing arcのうちarc IDが最小のものを選ぶ。Virtual frontier arc IDは`frontier:<milestone-id>`、task/gate arc IDはentity IDとする。

返すpathはvirtual arcを除いたtask/gate ID列である。Project completeの場合はempty pathを返す。

### 7.4 path count and enumeration

Exact driving path数をreverse topological dynamic programmingでBigInt計算し、decimal integer stringで返す。

```text
count(@FINISH) = 1
count(v) = sum(count(dst(a)) for driving outgoing arc a)
```

- path countは列挙しなくても計算する
- path enumerationは`maxPaths`を超えない
- 列挙順はarc ID列の辞書順
- `pathCount > emittedPaths`なら`pathsTruncated=true`
- pathごとにtask variance合計をexact Rationalで返す

## 8. Display rounding

### 8.1 default

Default display precisionは小数3桁とする。Callerは0以上の有限な桁数を指定できる。Interface仕様は安全な最大値を設定する。

### 8.2 rule

Rationalを10進表示するときだけround half away from zeroを使用する。

```text
13/6 -> 2.167  at precision 3
-1/8 -> -0.13  at precision 2
```

- trailing zeroを省略するcompact表示と固定桁表示をrenderer optionで分けられる
- negative zeroを出力しない
- exact numerator/denominatorを常に保持する
- durationにはproject unit、varianceにはunit squaredを付ける
- rounded valueを後続計算へ入力しない

## 9. Resource scheduling model

### 9.1 scheduler identity

MVP schedulerの識別子:

```text
algorithm = parallel-sgs
version = 1
optimal = false
```

同じresidual graph、capacity、scheduler versionから同じscheduleを返す。

### 9.2 execution assumptions

- renewable integer capacity
- non-preemptive task
- taskは全required resourceを同時取得
- allocation intervalは`[start, finish)`
- expected durationをschedule durationとして使用
- active taskはstart 0で固定し、残duration全体でresourceを保持
- done taskとgateはduration/resource usage 0
- blocked taskはblockが時刻0で解消したconditional taskとしてscheduleへ含める
- resourceを要求しないtaskも同じevent loopで扱う
- calendar timeへ変換しない

### 9.3 simulated milestone state

Simulation開始時:

1. frontier milestoneをtime 0でreachedにする
2. retained done taskをtime 0でcompletedにする
3. source reachedのgateをtime 0でsatisfiedにする
4. all-incoming ruleを固定点まで伝播する
5. active taskをstart 0、finish `d(t)`でrunningへ登録する
6. active requirementsをcapacityから差し引く

Task completion時にedgeをsatisfiedにし、milestone/gate closureをその時刻で伝播する。Milestone reached timeは全incoming satisfaction timeの最大値である。

### 9.4 eligibility

未開始task`t`は次の場合にschedule-eligibleである。

```text
simulated source milestone is reached
and status(t) in {planned, blocked}
```

Activeはすでにrunning、doneはcompletedでありcandidateへ含めない。

### 9.5 candidate order

同一時刻のeligible taskを次のtupleで昇順比較する。

```text
(-priority, precedenceTotalFloat, -expectedDuration, taskId)
```

- priorityは大きい方を先
- total floatは小さい方を先
- expected durationは大きい方を先
- task IDはASCII辞書順
- critical booleanを別keyにせず、exact/near-critical float値で決まる

Active taskの固定startにはこの順位を適用しない。

### 9.6 event loop

```text
t = 0
register active tasks and allocations
propagate time-0 done/gates

while finish milestone is not reached:
  complete every running task with finish == t, task ID order
  release all of their resources
  propagate milestone/gate closure at t
  collect newly/all eligible unscheduled tasks
  sort by candidate order
  scan once:
    if all requirements fit current availability:
      start task at t and allocate all requirements
    else:
      record rejection snapshot and continue scanning
  if finish reached: stop
  if running is empty and unfinished tasks remain: error
  t = minimum finish among running tasks
```

Rules:

- 同時刻はcompletion/release、closure、startの順
- candidateがfitしなくても、後続candidateがfitすれば開始する
- scan中に開始したtaskのallocationは後続candidateから見える
- 同じeventで開始したtaskを再走査しない
- positive durationにより開始taskは同じeventで完了しない
- 結果はinclusion-maximalだが、task数、priority合計、makespanを最適化した集合とは限らない

## 10. Resource schedule result

### 10.1 task interval

各residual taskについて次を返す。

- status
- expected durationとvariance
- eligible time
- scheduled start/finish
- resource wait
- requirements
- conditional blocked flag
- selected priority tuple

```text
resourceWait(t) = scheduledStart(t) - eligibleTime(t)
```

Active taskはeligible/start 0、done taskはstart/finish 0とする。Resource waitは0以上である。

### 10.2 makespan and delay

```text
resourceMakespan = simulated reached time of project.finish
resourceDelay = resourceMakespan - precedenceMakespan
```

`resourceDelay`は0以上でなければならない。Heuristic scheduleのmakespanをbest possibleまたはoptimalと表示しない。

### 10.3 resource statistics

Resource`r`について:

```text
amountTime(r) = sum(units(t,r) * duration(t) for scheduled non-done t)
utilization(r) = amountTime(r) / (capacity(r) * resourceMakespan)
peakUsage(r) = max simultaneous allocated units
lastRelease(r) = max finish of tasks using r, or 0
```

Resource makespanが0ならutilizationを0とする。Amount-timeとutilizationはexact Rationalで返す。Timeline intervalはstart、finish、task ID、unitsを含み、start、finish、task ID順に安定化する。

### 10.4 qualifiers

Resource resultに次を含める。

- algorithmとversion
- `optimal=false`
- applied capacity mapとoverride元
- conditional blocked task IDs
- precedence lower bound
- resource delay
- resource arc一覧
- constraint graph replay status

## 11. runnable_now

### 11.1 selection

`runnable_now`はGraph Semantics仕様のactual `ready` taskだけを対象にする。Blocked taskを即時解消と仮定するresource forecastとは区別する。

1. active taskのtime-0 allocationをcapacityから差し引く
2. ready taskをscheduler candidate orderでsortする
3. 1回scanし、fitするtaskを選択・仮allocationする
4. 選択task ID集合を`runnable_now`として返す

Resource requirementを持たないready taskは必ず選択する。Resultはinclusion-maximalだが、最大task数や最適な組合せを保証しない。

### 11.2 rejection explanation

選択されなかったready taskについて、そのtaskをscanした瞬間のsnapshotを返す。

Resourceごとに:

- capacity
- active usage
- earlier selected usage
- total used before decision
- task required units
- available units
- deficit units
- occupying active task IDs
- same-selectionで先に選ばれたtask IDs

不足resourceをresource ID辞書順で返す。後続candidateのallocationを遡って理由へ加えてはならない。

### 11.3 presentation order

Next resultの表示順はresource選択順と別に次を使用する。

```text
(-priority, -isPrecedenceCritical, totalFloat, earliestStart, taskId)
```

`runnable_now` membershipは表示sortで再計算しない。

## 12. Resource release witness arcs

### 12.1 purpose

Resource arcは、選択scheduleでtask開始を遅らせたcapacity競合を説明し、schedule constraint graphで同じ開始時刻を再生する派生情報である。

- 正本DSLへ保存しない
- hard precedenceと表示上区別する
- schedule/capacity/scheduler versionが変われば再生成する
- resourceWaitが0のtaskには生成しない
- active/done taskをarc targetにしない

### 12.2 start-event quantities

Resource waitを持つtask`t`が時刻`s`に開始するとする。Resource`r`について、task`t`をscanする直前のevent情報を次で表す。

- `C(r)`: `s`より後まで継続するrunning taskのusage
- `F(r)`: `s`で完了・releaseしたtaskのusage合計
- `A(r)`: 同じ時刻`s`のscanで`t`より前に開始したtaskのusage
- `q(r)`: `t`のrequirement
- `cap(r)`: effective capacity

Releaseがなかったcounterfactualで`t`をfitさせるために必要なrelease量:

```text
neededRelease(t,r) = max(0, C(r) + F(r) + A(r) + q(r) - cap(r))
```

Actual scheduleがfeasibleなので`neededRelease(t,r) <= F(r)`である。Resource waitが正なら、少なくとも1つのrequired resourceでneededReleaseが正になる。

### 12.3 deterministic witness selection

各resourceをresource ID辞書順で独立に処理する。

1. `s`で完了しresource`r`をreleaseしたtaskを集める
2. release unitsの大きい順、同値ならtask ID辞書順にsortする
3. accumulated unitsが`neededRelease(t,r)`以上になるまで選ぶ
4. 最後のtaskのcontributionはremaining needed unitsまでとする

この集合はper-resourceの決定的な少数witnessであり、複数resource全体でのglobal minimum arc集合は要求しない。

同じ`fromTask -> toTask`が複数resourceで選ばれた場合は1つのarcへmergeし、resource別contribution mapを持つ。

### 12.4 arc record

Resource arcは少なくとも次を持つ。

```text
id = resource:<from-task-id>:<to-task-id>
fromTask
toTask
atTime
waitFrom
resources: { resourceId -> contributedUnits }
```

`waitFrom`はtarget taskの`eligibleTime`、`atTime`は`scheduledStart`であり、`atTime - waitFrom`がtargetのresource waitに一致する。

Arc source taskは`finish(fromTask) == start(toTask)`を満たす。Positive durationとevent orderによりresource arcは時間を逆行せず、schedule constraint graphへcycleを作らない。

## 13. Schedule constraint graph

### 13.1 nodes

選択scheduleから派生するanalysis-only graph`H`を作る。

- `@START`、`@FINISH`
- 各`V_a` milestoneの`M:<milestone-id>`
- 各residual taskの`S:<task-id>`と`F:<task-id>`

このgraphはDSLのAoA modelを置き換えず、resource scheduleの説明専用である。

### 13.2 constraint arcs

| Arc kind | From | To | Weight | Stable ID |
| --- | --- | --- | ---: | --- |
| frontier | `@START` | `M:v` | 0 | `frontier:<v>` |
| task start | `M:src(t)` | `S:t` | 0 | `task-start:<t>` |
| task duration | `S:t` | `F:t` | `d(t)` | `task-duration:<t>` |
| task finish | `F:t` | `M:dst(t)` | 0 | `task-finish:<t>` |
| gate | `M:src(q)` | `M:dst(q)` | 0 | `gate:<q>` |
| resource | `F:u` | `S:t` | 0 | `resource:<u>:<t>` |
| project finish | `M:finish` | `@FINISH` | 0 | `project-finish` |

Frontier arcは全`v in F_a`へ追加する。Done taskのduration weightは0である。

### 13.3 replay invariant

`H`のlongest-path earliest timeを全nodeについて計算する。

```text
distance(@START) = 0
distance(y) = max(distance(x) + weight(x,y))
```

次がactual scheduleと一致しなければならない。

```text
distance(S:t) = scheduledStart(t)
distance(F:t) = scheduledFinish(t)
distance(M:v) = simulatedReachedTime(v)
distance(@FINISH) = resourceMakespan
```

不一致はresource arc生成またはschedulerのinternal errorであり、scheduleを成功扱いで返さない。

## 14. Schedule critical result

### 14.1 schedule float

`H`でforward longest distanceとresourceMakespanからbackward latest timeを計算する。

Constraint arc`a: x -> y`について:

```text
scheduleFloat(a) = latest(y) - earliest(x) - weight(a)
```

User-facing schedule critical判定は`abs(scheduleFloat) <= criticalEpsilon`、exact driving判定は`scheduleFloat == 0`とする。

### 14.2 schedule critical tasks and arcs

- task duration arcがcriticalならtaskをschedule-criticalとする
- status doneでweight 0のtaskはconnectorとしてpathに現れ得るが、positive-duration critical task一覧から除外する
- resource constraint arcがcriticalならcritical resource arcとする
- precedence/gate/resource constraintをtype付きで返す
- precedence critical IDとschedule critical IDを別fieldにする

### 14.3 representative schedule critical path

Exact driving constraint subgraph上で`@START`から`@FINISH`まで、stable arc IDが最小のarcを順に選ぶ。

User-facing chainは次を保持する。

- ordered positive-duration task IDs
- task間のconstraint kind: precedence、gate、resource
- resource arcの場合はresource contribution map
- zero-duration connector IDs

Path countとenumerationはprecedence critical pathと同じBigInt DP、上限、辞書順規則を使用する。

### 14.4 capacity sensitivity

Resource schedule resultへ、使用したcapacity map、resource arc、schedule critical pathを含める。Capacity override間の比較では少なくとも次を比較できる。

- resource makespan
- precedence lower boundとの差
- task start/finish差
- resource arcの追加・削除
- schedule critical task/chain差

Precedence resultはcapacity変更で変化してはならない。

## 15. Normative examples

### 15.1 exact PERT estimate

[pert-estimate.pert](../examples/pert-estimate.pert):

```text
DESIGN expected        = 13/6 d
DESIGN variance        = 1/4 d^2
BUILD expected         = 3 d
precedence makespan    = 31/6 d
critical tasks         = [DESIGN, BUILD]
representative variance = 1/4 d^2
```

Default precision 3の表示はDESIGN expected `2.167d`、makespan `5.167d`である。Exact resultは丸めない。

### 15.2 parallel precedence result

[parallel.pert](../examples/parallel.pert)のtask result:

| Task | d | ES | EF | LS | LF | TF | FF | Critical |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `CORE` | 4 | 0 | 4 | 0 | 4 | 0 | 0 | yes |
| `CLI` | 3 | 0 | 3 | 1 | 4 | 1 | 0 | no |
| `DOCS` | 2 | 0 | 2 | 2 | 4 | 2 | 0 | no |
| `TEST` | 2 | 4 | 6 | 4 | 6 | 0 | 0 | yes |
| `PACKAGE` | 1 | 4 | 5 | 5 | 6 | 1 | 0 | no |

```text
precedence makespan = 6d
critical edge IDs = [CORE, CORE_READY, TEST, TEST_RELEASE_GATE]
representative critical task IDs = [CORE, TEST]
```

### 15.3 parallel resource schedules

| DEVELOPERS | TEST_ENV | Makespan | Resource arcs | Representative schedule-critical tasks |
| ---: | ---: | ---: | --- | --- |
| 2 | 1 | 8d | `CLI -> DOCS`, `TEST -> PACKAGE` | `CLI, DOCS, TEST, PACKAGE` |
| 3 | 1 | 7d | `TEST -> PACKAGE` | `CORE, TEST, PACKAGE` |
| 2 | 2 | 7d | `CLI -> DOCS` | `CLI, DOCS, TEST` |
| 3 | 2 | 6d | none | `CORE, TEST` |

既定capacityのtimeline:

```text
CORE     [0, 4)  DEVELOPERS 1
CLI      [0, 3)  DEVELOPERS 1
DOCS     [3, 5)  DEVELOPERS 1
TEST     [5, 7)  TEST_ENV 1
PACKAGE  [7, 8)  TEST_ENV 1
```

既定capacityのresource witness:

```text
resource:CLI:DOCS
  atTime 3d
  resources { DEVELOPERS: 1 }

resource:TEST:PACKAGE
  atTime 7d
  resources { TEST_ENV: 1 }
```

DEVELOPERS utilizationは`9/16`、TEST_ENV utilizationは`3/8`である。

### 15.4 runnable now

`parallel.pert`の既定capacityではcandidate順が`CORE`、`CLI`、`DOCS`である。

```text
runnable_now = [CORE, CLI]
DOCS rejection:
  DEVELOPERS capacity = 2
  used before decision = 2
  required = 1
  available = 0
  deficit = 1
  selected occupants = [CORE, CLI]
```

DEVELOPERSを3へoverrideすると`runnable_now = [CORE, CLI, DOCS]`になるが、ready集合とprecedence resultは変化しない。

## 16. Diagnostics and invariants

| Code | Severity | Meaning |
| --- | --- | --- |
| `PTDAG-301` | error | precedence float/longest-path invariant failure |
| `PTDAG-302` | warning | requested path enumerationを上限で打ち切り |
| `PTRES-301` | error | unfinished taskがあるのに次eventを生成不能 |
| `PTRES-302` | error | constraint graph replayがscheduleと不一致 |
| `PTRES-303` | warning | blocked taskを即時解消と仮定したconditional schedule |
| `PTRES-304` | warning | optional exact/near-optimal solver timeout |

Internal invariant failureを入力errorへ偽装しない。Diagnosticには関連task/resource/constraint arcを含める。

## 17. Complexity

- PERT duration計算: `O(T)`
- CPM forward/backward: `O(V + E)`、BigInt arithmetic costを除く
- critical path count: `O(V + E)`、BigInt arithmetic costを除く
- path enumeration: emitted path sizeに比例し、`maxPaths`で制限
- parallel SGS: eventごとのcandidate sort/scanを含み、単純実装のworst caseは`O(T^2 log T + T^2 R)`
- resource witness: start eventのrelease taskとrequired resource数に比例
- schedule constraint graph longest path: `O(|V_H| + |E_H|)`

Resource schedulerをCPMと同じ`O(V + E)`と表示してはならない。大規模化時は結果を変えずにeligible queueやresource indexを最適化する。

## 18. Optional exact/near-optimal solver boundary

将来solver adapterは同じresidual graph、effective duration、active固定interval、capacity、conditional blocked policyを入力にする。

Must if implemented:

- heuristicと別のsolver ID/versionを返す
- feasible scheduleを共通validatorで再検査する
- resource witnessとconstraint graphを返却scheduleから再生成する
- statusを`optimal`、`feasible`、`timeout`、`infeasible`で区別する
- lower bound、best found、gap、timeoutを返す
- optimal proofがない結果をoptimalと表示しない
- default `parallel-sgs` resultを無言で置換しない

MVP acceptanceはこのadapterを要求しない。

## 19. Analysis acceptance

実装時は最低限、次を自動検査する。

1. decimalとPERT `/6`をexact Rationalで保持する
2. deterministic/gate/done varianceが0
3. canonical advance前後でprecedence/resultが一致する
4. diamond、parallel edge、multiple frontierのCPMがgoldenと一致する
5. total/free floatとmilestone slackが非負
6. critical epsilon分類とexact driving pathを区別する
7. critical path countが列挙なしで一致する
8. path enumerationが安定順かつ上限付き
9. active taskをtime 0固定でscheduleする
10. blocked taskをconditionalとして明示する
11. multi-resource taskが全requirementsを同時取得する
12. fitしない上位candidateをskipして後続fit taskを開始できる
13. `runnable_now` rejection snapshotがscan時点と一致する
14. capacity 1の排他scheduleがgoldenと一致する
15. capacity 2以上でneededReleaseとwitness contributionが一致する
16. resource arc mergeが複数resourceで決定的
17. constraint graphが全task start/finishとmakespanを再生する
18. schedule critical tasks/arcs/pathがcapacityごとにgoldenと一致する
19. precedence resultがcapacity overrideで変化しない
20. utilization、peak、last releaseがexact値と一致する
21. same-time completion-before-startとID tie-breakが決定的
22. scheduler deadlock/replay invariant failureを成功扱いにしない

## 20. Versioning and next specification

Analysis version 1はgrammar version 1、semantics version 1を対象とする。

AnalysisResult/ResourceScheduleResult/NextResult JSON、exact Rationalとdisplay field、CLI option、exit code、text layout、path enumeration、capacity overrideは[CLI Interface仕様](interfaces.md)で固定した。MCP actionとschema parityはMVP対象外であり、将来adapterの別仕様へ送る。

Analysis ruleを破壊的に変更する場合はanalysis versionとscheduler versionのどちらが変わるかを区別する。候補順位、event order、witness選択を変える場合はscheduler versionを上げ、同じversionで別scheduleを返してはならない。
