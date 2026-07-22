# Recommendation Human Override Contract 仕様

- 文書状態: Normative 1.0
- Override contract version: 1
- Override artifact schema: `Perttool.OverrideDecision.v1`
- 作成日: 2026-07-22
- 対応要件: [../requirements.md](../requirements.md)
- Recommendation semantics: [recommendation.md](recommendation.md)
- Recommendation ranking: [recommendation-ranking.md](recommendation-ranking.md)
- Reason taxonomy: [recommendation-reasons.md](recommendation-reasons.md)
- Structured explanation: [recommendation-explanation.md](recommendation-explanation.md)
- Recommendation interface: [recommendation-interface.md](recommendation-interface.md)
- 関連Issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. 目的

本仕様は、人間がnormal recommendationから意図的に逸脱する判断を、暗黙のtask選択やchat上の一言で終わらせず、元のrecommendation、選択task、置き換えたtask、理由、resource feasibility、actor、時刻へ結び付けるcontractを固定する。

Human overrideはproject modelの判断を消去または改ざんする機能ではない。Normal recommendationをそのsnapshotの事実として保持したまま、人間が別のfeasible start setを明示的に承認したdecision eventである。

次を定義する。

- overrideが必要なstart selectionと不要なselection
- human authorityが上書きできる境界と、上書きできないgraph/resource invariant
- normal recommendationへのstable reference
- actor、reason code、reason text、evidence、decision time
- override start setのresource validation
- deterministicなoverride IDとcanonical artifact
- Git historyを使うrepository-native audit方針
- stale判定、single-use、state change後の全体再解析

本仕様は設計契約である。Override command、task status mutation、Git commit、audit writeを実装したとはみなさない。

## 2. 規範上の位置

意味や設計が競合する場合は次の順で解決する。

1. `docs/requirements.md`のMust requirement
2. lifecycle、tier、start authorityは[Recommendation Semantics仕様](recommendation.md)
3. normal selected setとcomparisonは[Recommendation Ranking Policy仕様](recommendation-ranking.md)
4. normal reasonは[Recommendation Reason Taxonomy仕様](recommendation-reasons.md)
5. normal traceは[Recommendation Structured Explanation仕様](recommendation-explanation.md)
6. normal wire identityは[Recommendation Interface Contract仕様](recommendation-interface.md)
7. 本仕様
8. Graph Semantics、CLI Interface、basic design、process、example、test、implementation

Overrideはnormal tierを再分類しない。Override reason codeをnormal ranking inputまたはnormal Reason Taxonomy codeとして使用しない。

## 3. Scope

対象:

- actual `ready` taskの`start` action
- `allowed`をrecommended workの代わりに選ぶ判断
- `deferred`または`discouraged`を選ぶ判断
- 複数taskを含むreplacement start set
- human-supplied reasonとcaller-asserted actor
- source recommendation snapshotへ固定したread-only validation artifact
- Git-managed projectでのdurable audit envelope

対象外:

- non-ready taskを強制開始すること
- dependency、gate、blocked status、resource capacity violationの無視
- automatic priority、duration、dependency、capacity変更
- override reasonからranking weightを学習すること
- approval workflow、RBAC、identity provider、signature、authentication
- generic issue trackerまたはchat historyの保存
- overrideを適用するCLI commandとwrite implementation
- Git commandの自動実行
- external audit service、network write、notification

## 4. Human authority boundary

### 4.1 上書きできる判断

人間は、normal recommendationが持つ「現在どのready taskを優先するか」というdecision authorityをoverrideできる。

- recommended setの一部または全部を現在開始しない
- resource-feasibleな`allowed` taskをrecommended workの代わりに開始する
- resource-feasibleな`deferred` taskをrecommended taskと入れ替えて開始する
- modeled negative factを認識した上でresource-feasibleな`discouraged` taskを開始する

Override後も元taskのnormal tier、decisive reason、higher-priority task、resource witnessを変更しない。

### 4.2 上書きできない判断

Human overrideは次をbypassしない。

- `ready`ではないtaskのeligibility
- unreached dependencyまたはgate
- `blocked` status
- active taskをもう一度startすること
- done taskをstartすること
- applied capacityを超える同時start set
- invalid document、cycle、undefined reference、analysis invariant failure

これらを変更する必要がある場合、人間はtask state、dependency、capacityなどのproject modelを明示的に修正し、安全なwrite pathで再解析する。Override artifactだけでproject factを偽装しない。

### 4.3 Feasible replacement

Normal recommended setを`R`、overrideで現在開始するready task集合を`O`とする。Valid overrideは次を満たす。

```text
O is a subset of P
startFeasible(O) == true
O differs from an authority-preserving start selection
```

Resource feasibilityはactive allocationとapplied capacityを含め、Recommendation Semantics仕様と同じexact判定を使う。`startFeasible(R union {t}) == false`でdeferredとなったtaskも、`R`の一部を外した`O`ならfeasibleになり得る。Task自身がactive allocationだけで開始不能な場合、overrideをvalidにせずcapacity/state変更を要求する。

## 5. Override requirement classification

### 5.1 Override不要

次はnormal authorityの範囲内であり、override artifactを要求しない。

- recommended taskを1件以上開始する。複数recommended taskのsubset選択に暗黙順序はない
- recommended setを維持し、resource-feasibleな`allowed` taskを追加開始する
- 現在はtaskを開始しない

Recommended set全件を同時開始しないことだけを逸脱とみなさない。

### 5.2 Override必要

次のtrigger codeを使用する。

| Trigger code | 厳密な条件 |
| --- | --- |
| `allowed_replaces_recommended` | selected `allowed` taskがあり、normal recommended taskの1件以上を開始集合から外す |
| `deferred_selected` | selected taskのnormal tierが`deferred` |
| `discouraged_selected` | selected taskのnormal tierが`discouraged` |

1 eventが複数条件を満たす場合、上表順で該当codeをすべて保持する。`recommended` taskのsubsetを選ぶこと、taskを選ばないこと、追加allowed workだけではtriggerを生成しない。

### 5.3 Override不可能

次はvalid override artifactを生成せず、rejected resultとする。

- `O`にnon-ready taskがある
- `startFeasible(O) == false`
- source recommendationがstaleまたはincomplete
- selected taskのnormal decisionをsource graphから参照できない
- actor、decision time、reasonが要件を満たさない
- trigger codeが0件でoverride不要

Override不要caseを監査件数のためだけにoverrideとして記録しない。

## 6. Human reason taxonomy

Override reasonはnormal project factではなく、人間が責任を持ってassertする判断理由である。Version 1は次のstable codeを持つ。

| Reason code | 意味 |
| --- | --- |
| `human_priority_decision` | project model外の人間判断で現在優先順位を変える |
| `external_commitment` | 顧客、契約、期限など外部commitmentを優先する |
| `incident_response` | incidentまたは緊急対応を優先する |
| `plan_correction_pending` | modelの不足または誤りを認識し、修正前に限定的に逸脱する |
| `resource_reallocation_pending` | 実際のresource割当変更をmodelへ反映する前に選択を変える |
| `risk_acceptance` | modeled negative factまたは既知riskを人間が受容する |
| `experiment` | bounded experimentとして意図的に別taskを開始する |
| `other_explicit_reason` | 上記に該当しない理由を明示する |

`reason_code`だけでは不十分であり、nonempty `reason_text`を必須とする。Reason textをnormal reason code、ranking fact、task priorityへ自動変換しない。

## 7. Override request

Pure validationへ渡すrequestは次の意味を持つ。

```text
source_schema_version          "Perttool.NextResult.v3"
source_digest                  sha256 digest
source_result_decision_id      string
selected_task_ids              string[]
actor:
  kind                         "human"
  id                           string
  authentication              "caller_asserted"
decided_at                     RFC 3339 UTC string
reason_code                    HumanOverrideReasonCode
reason_text                    string
evidence_references            OverrideEvidenceReference[]
acknowledged_negative_fact_reason_ids string[]
```

Rules:

- `source_digest`とresult decision IDはcomplete source recommendationと一致する
- `selected_task_ids`は1件以上、duplicateなし、source `task_decisions`のcanonical orderで安定化する
- perttoolはactorを認証したと表示せず、`authentication=caller_asserted`を固定する
- `decided_at`はcallerが明示した`YYYY-MM-DDTHH:mm:ssZ`とし、現在時刻を自動挿入しない
- actor IDは前後にUnicode White_Spaceを持たず、UTF-8で1..256 bytes、NULなしとする
- `reason_text`は前後にUnicode White_Spaceを持たず、UTF-8で1..4096 bytes、NULなしとする
- selected `discouraged` taskのdecisive negative fact reason IDを`acknowledged_negative_fact_reason_ids`へすべて明示する。それ以外のIDを混入させない
- evidenceは0..16件、各valueは前後にUnicode White_Spaceを持たないUTF-8 1..1024 bytes、NULなしとする
- secret、credential、tokenをreason/evidenceへ含めないことをhelpで警告する

Evidence reference:

```text
kind   "issue" | "commit" | "document" | "url" | "other"
value  string
```

Producerはreference先へnetwork/file lookupを行わない。同一kind/valueをdeduplicateし、kind、valueのASCII/UTF-8 byte orderで安定化する。

## 8. Override validation

Validationはsource `NextResult.v3`とrequestだけを入力とするpure operationであり、normal rankingを変更しない。

```text
validateOverride(sourceNextResult, request): OverrideValidationResult
```

Validation order:

1. source schema、interface、algorithm、taxonomy、explanation versionを理解できる
2. source resultが`ok=true`かつcomplete、not truncatedである
3. source digest、result decision IDがrequestと一致する
4. selected taskがすべてactual readyでtask decisionを持つ
5. trigger codeを第5章から導出する
6. selected set `O`の`startFeasible(O)`をactive allocationとapplied capacityでexact評価する
7. discouraged taskのnegative fact、deferred taskのblocker、displaced recommended taskをsource traceから参照する
8. actor、time、reason、evidence、negative fact acknowledgementを検査する
9. canonical artifactとoverride IDを生成する

途中で失敗してもsource normal recommendationを変更しない。Validation failureをhuman approvalで成功へ読み替えない。

## 9. `Perttool.OverrideDecision.v1`

### 9.1 Result envelope

```text
schema_version          "Perttool.OverrideDecision.v1"
tool_version            string
operation               "recommendation.override.validate"
ok                      boolean
diagnostics             Diagnostic[]
diagnostics_truncated   boolean
override                HumanOverrideDecision|null
```

`ok=true`では`override`がnon-null、`ok=false`では`override=null`とする。これはmutation resultではなく、file、task status、Git repositoryを変更しないvalidation artifactである。

### 9.2 HumanOverrideDecision

```text
override_contract_version        1
override_id                      "override:sha256:" + 64 lowercase hex digits
source:
  schema_version                 "Perttool.NextResult.v3"
  tool_version                   string
  source_digest                  sha256 digest
  recommendation_interface_version 1
  ranking_algorithm_id           string
  ranking_algorithm_version      integer
  reason_taxonomy_version        string
  explanation_model_version      integer
  expression_version             integer
  description_registry_version   integer
  result_decision_id             string
  recommended_task_ids           string[]
  capacity_overrides             [{resource_id: string, capacity: integer}]
actor                            OverrideActor
decided_at                       RFC 3339 UTC string
reason:
  code                           HumanOverrideReasonCode
  text                           string
  evidence_references            OverrideEvidenceReference[]
selection:
  selected_task_ids              string[]
  retained_recommended_task_ids  string[]
  displaced_recommended_task_ids string[]
  selected_nonrecommended_task_ids string[]
  trigger_codes                  OverrideTriggerCode[]
task_decisions                  OverrideTaskDecision[]
feasibility                     OverrideFeasibility
single_use                      true
```

`retained_recommended_task_ids`は`O intersection R`、`displaced_recommended_task_ids`は`R minus O`、`selected_nonrecommended_task_ids`は`O minus R`である。

### 9.3 Per-task decision reference

```text
task_id                       string
normal_decision_id            string
normal_tier                   "recommended" | "allowed" | "deferred" | "discouraged"
normal_decisive_step_id       string
normal_reason_occurrence_ids  string[]
normal_comparison_ids         string[]
override_selected             true
trigger_codes                 OverrideTriggerCode[]
acknowledged_negative_fact_reason_ids string[]
```

Selected taskだけを含む。`acknowledged_negative_fact_reason_ids`はnormal tierが`discouraged`の場合にdecisive negative fact reasonをすべて含め、他tierではemptyとする。Normal reasonをcopyして別意味へ変換せずsource IDで参照する。

`normal_reason_occurrence_ids`はtier必須reasonとdecisive chain closure、`normal_comparison_ids`はそれらが参照するcomparisonをcanonical orderで含む。Unrelated taskのreasonや、判断に使わなかった総当たりcomparisonを追加しない。

### 9.4 Feasibility

```text
selected_set_reference       {kind: "derived_set", id: "O"}
start_feasible               true
active_task_ids              string[]
resource_witnesses:
  resource_id                string
  capacity                   integer
  active_usage               integer
  selected_usage             integer
  used                        integer
  available_after_selection  integer
  selected_task_ids          string[]
expression                   RecommendationExpression|null
```

すべてのdeclared resourceについてwitnessを返すか、usageが1以上のresourceだけを返すかはVersion 1では後者とし、resource ID順に並べる。`used = active_usage + selected_usage`、`available_after_selection = capacity - used`をexact integerで検査する。`expression`は各witnessのprecomputed `used <= capacity`をunit付きliteralで比較する制限付き`All`式とする。Witnessが0件ならresource制約はvacuously feasibleであり`expression=null`とする。Expressionがfalse、またはarithmetic invariantが一致しない場合はvalid artifactを生成しない。

## 10. Deterministic identity

Override IDは、`override_id`を除く`HumanOverrideDecision` payloadをschema記載順、canonical array order、UTF-8、改行なしのcompact JSONへserializationし、そのbytesのSHA-256から生成する。

```text
override_id = "override:sha256:" + lowercaseHex(sha256(canonical_payload_without_id))
```

次をidentityへ含む。

- source digestと全semantic version
- result decision IDとnormal recommended set
- selected、retained、displaced task
- trigger codeとnormal decision reference
- exact resource witness
- actor ID、caller-supplied decision time
- human reason code/text/evidence

Localized description、current time、hostname、username、absolute path、random nonceをidentityへ含めない。同じrequestとsource resultからbyte-identical artifactとoverride IDを返す。

## 11. Durable audit policy

### 11.1 General rule

Override対象taskを開始する前に、canonical `Perttool.OverrideDecision.v1` artifactを、project policyが定めるdurable append-only audit sinkへ保存する。Chat history、terminal scrollback、AI内部contextだけをaudit先にしない。

perttool Coreはaudit writeを行わない。Validation artifactの生成と、保存・state mutation・executionは別authorityとする。

### 11.2 Repository-native default

Git-managed `.pert` projectのdefault audit sinkは、overrideに対応するtask state変更commitのcommit messageとする。Commit body末尾に次の2 trailerを置く。

```text
Perttool-Override: override:sha256:<64 lowercase hex digits>
Perttool-Override-Record: <canonical compact Perttool.OverrideDecision.v1 JSON>
```

Rules:

- record trailerのJSONから再計算したIDが`Perttool-Override`と一致する
- 同じcommitでselected taskのstart stateを正本へ反映する
- unrelated overrideを1 commitへ混在させない
- commitを作成せず実行だけ開始した状態をdurable audit完了とみなさない
- perttoolはGitを自動実行せず、commit作成はhuman/execution workflowの責務とする
- secretをcommit messageへ保存しない

Write surfaceが未実装のStage 1ではoverride適用を自己利用へ解禁しない。本contractの存在だけでread-only gateを越えない。

### 11.3 External sink

Project policyがexternal audit systemを使用する場合も、canonical artifact全体またはlossless content-addressed blobを保存し、override IDから取得できなければならない。Issue URLやticket IDだけを残してartifactを失わない。External sinkへのnetwork writeはperttool Coreの責務外である。

## 12. Apply、single-use、stale boundary

Validated overrideはsource digestとsource recommendationへ固定されたsingle-use authorizationである。

Apply前に次を再検査する。

- current canonical document digestがsource digestと一致する
- capacity overrideとanalysis optionがsource recommendationと一致する
- selected taskが引き続きreadyである
- selected setが引き続きresource-feasibleである
- override IDとartifact digestが一致する
- durable auditを同じstate transitionへ結び付けられる

1件でも変化していればstaleとして拒否し、`dag next`からやり直す。古いoverrideを新しいsnapshotへ再baseしない。

Applyは概念上、selected taskのstart state transitionとaudit envelopeを1つのlogical changeとして扱う。Partial apply、selected taskの一部だけのstart、同じoverride IDの再利用を許可しない。具体的mutation command、atomic file write、Git integrationは後続implementation/process設計で固定する。

## 13. Re-analysis contract

Override apply後は、selected taskをactive、開始しなかったtaskを元のstateとしてproject documentへ反映した新snapshotから、check、analyze、nextを全体再実行する。

- source recommendationとoverride artifactを次cycleのranking resultとして再利用しない
- displaced recommended taskを自動deferredへ書き換えない
- human reasonをpriority、dependency、negative factへ自動変換しない
- normal recommendation historyはGit/audit artifactで追跡し、現行resultは新snapshotから再計算する
- plan correction pendingなどmodel更新を示すreasonでも、別の明示changeなしにmodelを変更しない

再解析後のrecommendationが同じtaskを再度非推奨にしても、それは正常である。継続して別start actionを行う場合は、新しいresultに対してoverride要否を再判定する。

## 14. Explainability

AIはoverride artifactから少なくとも次を回答できなければならない。

- normal recommendationは何だったか
- 人間がどのtaskを選び、どのrecommended taskを外したか
- selected taskのnormal tierとdecisive reasonは何だったか
- overrideが必要になったtriggerは何か
- 人間が示したreason code、reason text、evidenceは何か
- selected setがresource-feasibleである根拠は何か
- actor identityがcaller-assertedであり、perttool認証済みではないこと

Human reason textは人間のassertionとして引用可能だが、project factまたはnormal ranking reasonとして表示しない。Normal traceとoverride traceを1つのreason listへ混ぜない。

## 15. Diagnostics

| Code | Severity | 意味 |
| --- | --- | --- |
| `PTOVR-101` | error | source schema/versionを理解できない、またはsource explanationがincomplete |
| `PTOVR-102` | error | source digest/result decision不一致によるstale request |
| `PTOVR-103` | error | selected taskがnon-ready、unknown、duplicate |
| `PTOVR-104` | error | selected setがresource-infeasible |
| `PTOVR-105` | error | actor、decision time、reason、evidenceがinvalid |
| `PTOVR-106` | error | normal authority内でoverride不要 |
| `PTOVR-201` | error | apply時のsource/state/capacity変化でartifactがstale |
| `PTOVR-202` | error | override ID、canonical record、audit envelope不一致 |

Validation errorはdocument syntax errorへ変換しない。Read-only validationを将来CLIへ公開する場合、invalid requestはexit 1、usage errorはexit 2、I/O errorはexit 3、internal invariantはexit 70を使用する。Apply時のoptimistic lock conflictは既存exit 5を使用する。

## 16. Conceptual examples

### 16.1 Allowed work replaces recommended work

```text
Normal:
  R = [TASK_A]
  TASK_A = recommended
  TASK_B = allowed

Human selection:
  O = [TASK_B]

Override:
  trigger = allowed_replaces_recommended
  retained = []
  displaced = [TASK_A]
  selected_nonrecommended = [TASK_B]
  startFeasible(O) = true
```

TASK_BをTASK_Aと同時に追加する場合はnormal authority内だが、TASK_Aを外してTASK_Bだけを選ぶためoverrideが必要になる。

### 16.2 Deferred work replaces a conflicting recommendation

```text
Normal:
  R = [TASK_A]
  TASK_B = deferred because startFeasible(R union {TASK_B}) = false

Human selection:
  O = [TASK_B]
  startFeasible(O) = true

Override trigger:
  deferred_selected
```

Overrideはcapacity violationを許可したのではなく、TASK_Aを現在開始しないreplacement setを人間が選んだことを記録する。

### 16.3 Active allocation makes a task infeasible

```text
Normal:
  TASK_B = deferred
  startFeasible({TASK_B}) = false because ACTIVE_X occupies the resource

Human selection:
  O = [TASK_B]

Result:
  rejected with PTOVR-104
```

この場合はactive stateまたはcapacityを正本で変更し、再解析しなければならない。

## 17. 後続設計taskへ送る事項

### `NORMATIVE_EXAMPLES`

[Recommendation規範例](../examples/recommendation.md)で次を固定した。

- allowed replacement、deferred replacement、将来modelでのdiscouraged risk acceptance
- recommended subsetとadditional allowedでoverride不要となるcase
- non-ready、active-only conflict、stale digestのreject
- normal traceとoverride traceを分離したgolden artifact
- deterministic override IDとGit trailer verification

### `PROCESS_MIGRATION`

[Recommendation実装・自己利用migration](../process/recommendation-migration.md)で次を固定した。

- override validationをread-onlyで導入する順序
- write gate後のstate transitionとaudit commit手順
- AIがoverride artifactなしにdeferred/discouraged taskを開始しない運用gate
- secret reviewとcommit trailer verification

## 18. 本sliceのacceptance

- human authorityがoverrideできるpriority判断と、できないeligibility/resource invariantを分離した
- override必要、不要、不可能の条件を定義した
- stable trigger codeとhuman reason taxonomyを定義した
- caller-asserted actor、explicit UTC time、reason text、evidenceを定義した
- source recommendationへ固定したseparate artifactを定義した
- selected/retained/displaced taskとnormal decision referenceを定義した
- replacement setのexact resource feasibilityを必須にした
- deterministic override IDとsingle-use/stale ruleを定義した
- Git commit trailerをrepository-native audit defaultとして定義した
- apply後の全体再解析とnormal rankingへの非feedbackを定義した
- current CLI、write path、Git operationを変更していない
