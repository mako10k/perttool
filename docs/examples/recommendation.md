# Recommendation規範例

- 文書状態: Normative 1.0
- 作成日: 2026-07-22
- 対応要件: [../requirements.md](../requirements.md)
- Recommendation semantics: [../specs/recommendation.md](../specs/recommendation.md)
- Ranking policy: [../specs/recommendation-ranking.md](../specs/recommendation-ranking.md)
- Reason taxonomy: [../specs/recommendation-reasons.md](../specs/recommendation-reasons.md)
- Structured explanation: [../specs/recommendation-explanation.md](../specs/recommendation-explanation.md)
- Interface contract: [../specs/recommendation-interface.md](../specs/recommendation-interface.md)
- Human override: [../specs/recommendation-override.md](../specs/recommendation-override.md)
- 関連Issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. 目的

本書は、Recommendation仕様群を実装とtestへ移すときに意味を変えないため、競合する小さなsnapshotと期待判断を固定する規範例である。

各例は次を区別する。

- lifecycle上のactual `ready`集合`P`
- selection horizon `H`
- resource-feasibleなrecommended set `R`
- ready taskごとのtier
- winner、alternative、decisive rule、typed fact
- canonical description projection
- human overrideが不要、必要、不可能となる境界

表中のfact snapshotは既存DSLから導出されるanalysis projectionであり、新しいDSL構文ではない。`NextResult.v3`とoverride validationは未実装なので、本書のJSON fragmentを現在のCLI実行結果とはみなさない。実装sliceでは同じ意味を持つ最小`.pert` fixture、complete JSON golden、text goldenへ展開する。

## 2. 共通条件

特記しない限り、全例で次を使用する。

```text
action                       = start
algorithm_id                 = perttool.recommendation-ranking.lexicographic-frontier
algorithm_version            = 1
reason_taxonomy_version      = 1.0
explanation_model_version    = 1
expression_version           = 1
description_registry_version = 1
description_locale           = en
critical_epsilon             = 0
explicitNegativeFact(t)      = false
policyDefers(t)              = false
```

Version 1のnormal producerは`discouraged`を生成しない。Fact表にないranking keyはtask間で同値とする。Resource表がない例では`startFeasible(S) = true`である。

`H`と`R`の配列はscan orderで記載するが、`R`は集合であり、複数task間に暗黙の実行順を与えない。

## 3. Normal recommendation

### REC-001 Critical pathは明示priorityより先に比較する

入力fact:

| Task | Classification | Critical class | Total float | Priority | Resource |
| --- | --- | --- | ---: | ---: | --- |
| `CRITICAL_FIX` | `ready` | `driving` | `0p` | 10 | none |
| `OPTIONAL_POLISH` | `ready` | `non_critical` | `3/2p` | 100 | none |

期待判断:

```text
P = [CRITICAL_FIX, OPTIONAL_POLISH]
H = [CRITICAL_FIX]
R = [CRITICAL_FIX]

CRITICAL_FIX   tier=recommended  recommended_set_member=true
OPTIONAL_POLISH tier=allowed     recommended_set_member=false
```

`CRITICAL_FIX`と`OPTIONAL_POLISH`のpairwise comparisonは、priorityを見る前の`critical_class`がdecisive ruleになる。`OPTIONAL_POLISH`はhorizon外でも`startFeasible(R union {OPTIONAL_POLISH}) = true`なので`allowed`であり、non-criticalであることだけを理由に`deferred`または`discouraged`にしない。

必須の説明観測点:

```text
winner_task_id              = CRITICAL_FIX
alternative_task_id         = OPTIONAL_POLISH
decisive_rule_id            = critical_class
decisive_winner_fact        = driving
decisive_alternative_fact   = non_critical
primary_higher_priority_task_id(OPTIONAL_POLISH) = CRITICAL_FIX
```

この例は「priority 100のtaskよりpriority 10のtaskを選んだのはなぜか」へ、priorityの無視ではなく、より前段のcritical classで比較が決着したと回答できなければならない。

### REC-002 先行ruleのtieとgate近傍のdecisive ruleを保持する

入力fact:

| Factor | `GATE_NEAR` | `GATE_FAR` |
| --- | ---: | ---: |
| Critical class | `driving` | `driving` |
| Total float | `0p` | `0p` |
| Priority | 50 | 50 |
| New ready task count | 1 | 1 |
| New satisfied gate count | 0 | 0 |
| New reached milestone count | 1 | 1 |
| Next gate task distance | 0 | 2 |
| Finish task distance | 1 | 3 |

両taskは同じhorizonへ属する。Resource capacity 1で両方が同じresourceを1 unit要求するものとする。

期待判断:

```text
H = [GATE_NEAR, GATE_FAR]
R = [GATE_NEAR]
GATE_NEAR tier=recommended
GATE_FAR  tier=deferred
```

Comparisonは次を保持する。

```text
prior_tied_rule_ids = [
  critical_class,
  lower_total_float,
  higher_explicit_priority,
  higher_new_ready_count,
  higher_new_gate_count,
  higher_new_milestone_count
]
decisive_rule_id = shorter_next_gate_distance
contributing_rule_ids = [shorter_finish_distance]
```

`shorter_finish_distance`はdecisive ruleより後にwinnerを補強するが、決定ruleへ昇格させない。Task titleやgate reasonの自然言語をgate近傍factとして使用しない。

### REC-003 後続解放数が最初の差ならdecisiveになる

`UNLOCK_TWO`と`UNLOCK_ONE`はcritical class、total float、priorityまで同値で、それぞれの単独完了counterfactualが新しくreadyにするtask数だけ異なる。

```text
new_ready_task_count(UNLOCK_TWO) = 2
new_ready_task_count(UNLOCK_ONE) = 1
```

期待するpairwise comparisonのdecisive ruleは`higher_new_ready_count`である。All-incoming joinの他branchが未完了であるtaskを解放数へ数えず、単なる後続edge数を代用しない。

### REC-004 同じhorizonのfeasible taskを並列推薦する

入力resource snapshot:

```text
capacity(DEV) = 2
activeUsage(DEV) = 0
requirement(PARALLEL_A, DEV) = 1
requirement(PARALLEL_B, DEV) = 1
```

両taskは`ready`かつ`driving`で同じhorizonへ属する。

期待判断:

```text
H = [PARALLEL_A, PARALLEL_B]
R = [PARALLEL_A, PARALLEL_B]
startFeasible(R) = true
PARALLEL_A tier=recommended
PARALLEL_B tier=recommended
```

Candidate orderはscan再現のため保持するが、「`PARALLEL_A`を完了してから`PARALLEL_B`」というdependencyや排他選択を生成しない。

### REC-005 Selected taskとのresource競合をdeferredとして説明する

入力resource snapshot:

```text
capacity(ENV) = 1
activeUsage(ENV) = 0
requirement(ENV_HIGH, ENV) = 1
requirement(ENV_LOW, ENV) = 1
priority(ENV_HIGH) = 20
priority(ENV_LOW) = 10
```

両taskは`ready`、`driving`、total float `0p`で同じhorizonへ属する。他の先行ranking keyは同値とする。

期待判断:

```text
H = [ENV_HIGH, ENV_LOW]
R = [ENV_HIGH]
ENV_HIGH tier=recommended
ENV_LOW  tier=deferred
```

`ENV_LOW`の必須witness:

```text
resource_id       = ENV
capacity          = 1
active_usage      = 0
selected_usage    = 1
required          = 1
deficit           = 1
selected blockers = [ENV_HIGH]
active blockers   = []
```

Ranking comparisonのdecisive ruleは`higher_explicit_priority`、tier classificationのdecisive reasonは`recommended_set_resource_conflict`である。両者を1つのopaque reasonへ潰さない。

### REC-006 Active allocationだけのrejectでready-task winnerを捏造しない

入力resource snapshot:

```text
capacity(ENV) = 1
activeUsage(ENV) = 1 by ACTIVE_TEST
requirement(FRONTIER_TEST, ENV) = 1
requirement(SIDE_DOCS, ENV) = 0
```

`FRONTIER_TEST`は`ready`かつ`driving`、`SIDE_DOCS`は`ready`かつ`non_critical`とする。

期待判断:

```text
H = [FRONTIER_TEST]
R = []
FRONTIER_TEST tier=deferred
SIDE_DOCS     tier=allowed
```

`FRONTIER_TEST`のresource comparisonは次を満たす。

```text
scope               = resource_selection
subject_task_id     = FRONTIER_TEST
alternative_task_id = null
winner_task_id      = null
loser_task_id       = null
decisive_rule       = joint_resource_feasibility
active blockers     = [ACTIVE_TEST]
selected blockers   = []
```

`SIDE_DOCS`のranking上のhigher-priority taskは`FRONTIER_TEST`である。`FRONTIER_TEST`がresource rejectされたことを理由に`SIDE_DOCS`をrecommendedへ繰り上げず、`allowed`のままにする。

### REC-007 全blockedまたはready task 0件は正常なempty resultになる

`TASK_BLOCKED`だけが`blocked_now`でactual `ready` taskがないsnapshotを使用する。

期待判断:

```text
P = []
H = []
R = []
task_decisions = []
startFeasible(R) = true
```

`recommendation` root、result decision、empty setのjoint feasibility factは省略しない。Textは`RECOMMENDED SET -`と4つのempty tier sectionを表示し、既存`BLOCKED NOW` sectionへ`TASK_BLOCKED`を残す。`blocked`というrecommendation tierや`PTREC-*` diagnosticを生成しない。

## 4. Structured explanationとinterface projection

### REC-008 「なぜAでBではないか」をtyped comparisonから回答する

REC-001のcomparisonは、少なくとも次の意味を持つ。これはwire fieldを追加するJSON例ではなく、complete `NextResult.v3`内のrecord間関係を表すsemantic projectionである。

```text
comparison:
  scope              = ranking
  subject            = task:CRITICAL_FIX
  alternative        = task:OPTIONAL_POLISH
  winner             = task:CRITICAL_FIX
  loser              = task:OPTIONAL_POLISH
  decisive_rule      = policy_rule:critical_class
  prior_tied_rules   = []
  decisive_expression =
    Compare(
      fact(CRITICAL_FIX.precedence_critical_class),
      less_than,
      fact(OPTIONAL_POLISH.precedence_critical_class)
    )

facts:
  CRITICAL_FIX.precedence_critical_class =
    {type: enum, enum_type: precedence_critical_class, value: driving}
  OPTIONAL_POLISH.precedence_critical_class =
    {type: enum, enum_type: precedence_critical_class, value: non_critical}

description:
  key    = recommendation.reason.ranking_comparison
  locale = en
  text   = "CRITICAL_FIX ranks above OPTIONAL_POLISH by rule critical_class: driving less_than non_critical."
```

実際のwire recordではfactを`facts[]`へ置き、comparisonは`fact_ids`と`decisive_expression`で参照する。Record ID、provenance、description parameterもInterface Contractに従ってcomplete graphへ含める。

Consumerは次の順で回答を構成できる。

1. task decisionから`primary_higher_priority_task_id`とdecisive stepを読む
2. decisive stepからcomparison IDを読む
3. comparisonからwinner、alternative、rule、typed fact、expressionを読む
4. description keyとtyped parameterからcanonical textを検証する

Description textだけからruleやfactを逆推論してはならない。

### REC-009 Exact Rationalとcanonical descriptionを保持する

REC-001のtotal floatを補足表示する場合、`OPTIONAL_POLISH`の値`3/2p`は次のtyped valueとunitを使用する。

```json
{
  "value": {
    "type": "rational",
    "numerator": "3",
    "denominator": "2"
  },
  "unit": {
    "kind": "duration",
    "value": "point"
  }
}
```

Binary floating pointの`1.5`を正本factへ入れず、canonical textは`3/2p`とrenderする。Expressionはfact reference間の`less_than`をexact評価し、評価結果とwinnerが一致しなければ`PTREC-301`とする。

### REC-010 Complete JSONとtext summaryを混同しない

同じsnapshotのJSONは次を満たす。

```text
explanation_status.level                   = full
explanation_status.complete                = true
explanation_status.decisive_chain_complete = true
explanation_status.truncated               = false
all omitted_counts                         = 0
```

JSON goldenはresult decision、全ready task decision、参照closureを満たすstep、fact、comparison、reason、descriptionを含む。REC-008のような抜粋をcomplete resultとして保存しない。

Text goldenはsummary projectionとして次を明示する。

```text
EXPLANATION detail=summary complete=false machine_trace="--format json"
```

Textからraw factやASTを復元させず、既存の`ACTIVE`、`RUNNABLE NOW`、`READY / WAITING RESOURCE`、`BLOCKED NOW`、`UPCOMING` sectionを維持する。

V2由来の`groups`、`tasks`、`tasks[].resource_rejections`、`tasks[].explanation`はfieldと意味を維持する。Goldenはv2 projectionとv3の同名fieldを比較し、recommendation root追加によってscheduler rejectionやupcoming dependency explanationが変化していないことを検査する。

### REC-011 Invariant failureを不完全な成功resultへ変換しない

次を独立したnegative testにする。

| Broken invariant | Expected diagnostic |
| --- | --- |
| tierとset membershipの不一致、false expressionをdecisive winnerとして参照、reference closure欠落 | `PTREC-301` |
| 宣言versionに未登録のrule、reason、fact kind、expression nodeを出力 | `PTREC-302` |
| description key、typed parameter、canonical rendered textの不一致 | `PTREC-303` |

いずれも成功した`NextResult.v3`を出力せず、CLIはinternal error exit `70`を使用する。Ready task 0件やresource起因のempty `R`はこのnegative testへ含めない。

## 5. Human override

### OVR-001 Allowed taskがrecommended taskを置き換える

REC-001のnormal resultで、human selectionを`O = [OPTIONAL_POLISH]`とする。

```text
override required                 = true
trigger_codes                     = [allowed_replaces_recommended]
retained_recommended_task_ids     = []
displaced_recommended_task_ids    = [CRITICAL_FIX]
selected_nonrecommended_task_ids  = [OPTIONAL_POLISH]
startFeasible(O)                  = true
```

Normal comparisonとtierは変更せず、override artifactは`OPTIONAL_POLISH`のnormal decision、decisive step、reason、comparison IDを参照する。

### OVR-002 Deferred taskとのfeasible replacementはcapacity violationではない

REC-005のnormal resultで`O = [ENV_LOW]`とする。

```text
override required              = true
trigger_codes                  = [deferred_selected]
displaced_recommended_task_ids = [ENV_HIGH]
startFeasible(O)               = true
```

`startFeasible(R union {ENV_LOW}) = false`と`startFeasible(O) = true`を区別する。Overrideはcapacity超過を承認せず、現在開始するreplacement setを変更する。

### OVR-003 Normal authority内の選択へoverrideを作らない

次はoverride不要である。

- REC-004の`R`からrecommended taskを1件以上選ぶsubset
- REC-001の`R`を維持し、resource-feasibleな`OPTIONAL_POLISH`を追加する集合
- 現在はtaskを開始しない判断

最初の2件をotherwise-validなvalidation requestとして渡した場合は`PTOVR-106`とし、artifactを生成しない。Taskを開始しない場合は`selected_task_ids`が1件以上というrequest契約を満たさないためvalidationを呼ばない。監査件数を増やす目的でoverride artifactを生成しない。

### OVR-004 Eligibility、active allocation、stale snapshotはoverrideできない

| Input | Expected result |
| --- | --- |
| `selected_task_ids`に`blocked_now`または`upcoming` taskを含む | `PTOVR-103` |
| REC-006で`O = [FRONTIER_TEST]` | `PTOVR-104` |
| requestのsource digestまたはresult decision IDがsource resultと不一致 | `PTOVR-102` |
| valid artifact生成後にdocument、capacity、task stateが変化 | apply時に`PTOVR-201` |

Human reasonでこれらを成功へ読み替えない。

### OVR-005 Discouraged risk acceptanceは将来model用の予約fixtureである

Taxonomy version 1.0にはconcrete negative fact kindがないため、現在のnormal producerから`discouraged` taskを作るfixtureは禁止する。

将来、正本fieldとconcrete negative fact kindを別versionで追加した場合は、次を満たすfixtureを有効化する。

```text
normal tier                              = discouraged
override trigger                         = discouraged_selected
human reason code                        = risk_acceptance
acknowledged_negative_fact_reason_ids    = all decisive negative fact reason IDs
normal negative fact                     = unchanged
startFeasible(O)                         = true
```

Chat上の「riskがありそう」という推測を、このfixtureのnegative factとして使用しない。

### OVR-006 Override artifactのidentityとaudit envelopeを検証する

Valid requestについて次をgolden testへ固定する。

1. 同じsource resultとrequestからbyte-identicalなcanonical artifactを2回生成する
2. `override_id`を除くpayloadのcompact JSONからSHA-256を再計算する
3. 再計算値が`override:sha256:<digest>`と一致する
4. actorは`authentication=caller_asserted`、時刻はrequestで明示したUTC値のままにする
5. normal reasonをcopyまたはhuman reasonへ変換せず、source record IDで参照する
6. commit messageの`Perttool-Override`と`Perttool-Override-Record` trailerから同じIDを再計算できる

MIG-08のoverride apply/audit gateを満たすまではtrailerを実commitへ適用せず、fixture stringへのpure verificationだけを行う。

## 6. Test観点とfixture対応

実装sliceでは、最低限次のtest層へ同じcase IDを付ける。

| Layer | 固定する内容 |
| --- | --- |
| `.pert` fixture | lifecycle、dependency、gate、duration、priority、resource、active allocation |
| Ranking unit | `P`、candidate facts、complete order、`H`、scan、`R` |
| Explanation unit | decisive chain、prior tie、contributing rule、resource witness、expression evaluation |
| Core result | 全ready taskのtier、reference closure、canonical ordering、byte determinism |
| JSON golden | complete `Perttool.NextResult.v3`、exact value、entity reference、description |
| Text golden | 4 tier summary、`complete=false`、JSON導線、既存v2 sectionの維持 |
| Invariant test | `PTREC-301`から`PTREC-303`、unknown decisive semanticsの安全側処理 |
| Override unit | 不要、必要、不可能、deterministic ID、single-use、stale判定 |

最低限のcase coverage:

| Case | Ranking | Resource | Empty | Explanation | Override |
| --- | --- | --- | --- | --- | --- |
| REC-001 | critical対priority、horizon外allowed | none | no | higher-priority comparison | OVR-001、OVR-003 |
| REC-002 | prior tie、gate近傍、contributing | selected conflict | no | decisive chain | - |
| REC-003 | successor unlock | none | no | counterfactual fact | - |
| REC-004 | parallel recommended | jointly feasible | no | set semantics | OVR-003 |
| REC-005 | priority scan | selected blocker | no | rankingとtier reasonの分離 | OVR-002 |
| REC-006 | horizon外allowed | active-only blocker | `R=[]` | null task winner | OVR-004 |
| REC-007 | no candidate | none | `P=[]`、`R=[]` | result-level closure | - |
| REC-008..011 | - | - | - | typed comparison、Rational、projection、invariant | - |
| OVR-005 | future version only | feasible replacement | no | normal/override trace分離 | discouraged acknowledgement |

実装時にfixtureを統合してもよいが、上表の観測点を失ってはならない。特にREC-006とREC-007を同じempty resultとして潰さず、「ready taskはあるがactive allocationで`R`がempty」と「ready task自体が0件」を別々に検査する。

## 7. Acceptance

- critical対priority、unlock、gate近傍、parallel recommendationを固定した
- selected blockerとactive-only blockerを分離した
- horizon外allowedを第一候補へ自動昇格させないcaseを固定した
- ready task 0件とresource起因のempty recommended setを分離した
- winner、alternative、decisive rule、prior tie、contributing ruleを固定した
- exact Rational、typed entity、expression、canonical descriptionの観測点を固定した
- complete JSONとsummary textの責務を分離した
- v2 field維持と`PTREC-301`から`PTREC-303`のnegative testを固定した
- override不要、allowed/deferred replacement、不可能、stale、audit identityを固定した
- `discouraged`を現行versionで捏造せず、将来fixtureの有効化条件を固定した
- current CLI、schema、implementation、write pathを変更していない
