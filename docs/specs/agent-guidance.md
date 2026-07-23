# AI Agent Guidance Registry 仕様

- 文書状態: Normative 1.0
- Agent Guidance interface version: 1
- Target schema: `Perttool.AgentGuidanceResult.v1`
- Profile schema: `Perttool.AgentGuidanceProfile.v1`
- 作成日: 2026-07-23
- 対応要件: [../requirements.md](../requirements.md)
- Current CLI interface: [interfaces.md](interfaces.md)
- Provider baseline: [../process/agent-guidance-provider-baseline.md](../process/agent-guidance-provider-baseline.md)
- 規範例: [../examples/agent-guidance.md](../examples/agent-guidance.md)
- 関連Issue: [Issue #2](https://github.com/mako10k/perttool/issues/2)

## 1. 目的

本仕様は、AI coding agentへperttoolの工程制御方針を適用するためのread-only guidance registryを固定する。AIまたは人間が`agent help`の1 resultから、providerで利用できる共有方針の配置先、適用scope、support status、risk、根拠source、stalenessを機械的に取得できることを目的とする。

本仕様が答える問いは次である。

- どのproviderと共通surfaceを認識するか
- project control、共通surface、provider固有guidanceをどの順で合成するか
- どのartifactへ何を配置でき、どのriskを確認すべきか
- support statusをなぜその値にしたか
- provider資料のunknown、preview、deprecated、stalenessをどうfail-closedで扱うか
- Core、JSON、textが同じoffline snapshotをどう公開するか

本仕様はprovider機能を自動設定する仕様ではない。Version 1はhelpだけを返し、file、hook、network、provider、project stateを変更しない。

## 2. 規範上の位置

意味や設計が競合する場合は次の順で解決する。

1. `docs/requirements.md`のMust requirement
2. project authorityとnext-work判断はRecommendation仕様群
3. 本仕様
4. [CLI Interface仕様](interfaces.md)の共通CLI、stream、diagnostic、exit code
5. provider profile、provider baseline
6. basic design、example、test、help、implementation

Provider profileは、task ranking、recommendation reason、human overrideを再定義してはならない。Providerが異なっても「何を実行すべきか」はproject modelと`dag next`が決める。Guidance registryは、その判断を各providerへ伝える配置と安全境界を説明する。

## 3. Scope

対象:

- Codex、GitHub Copilot、Claude Code、Grok Build、Antigravity
- instruction、workflow、delegated agent、enforcement、prompt、connector
- stable ID、alias、support status、artifact、scope、guidance、risk
- version付きoffline provider profileとstaleness
- pure Core queryと`Perttool.AgentGuidanceResult.v1`
- `agent help`のindex、provider、surface、quick/detail
- deterministic text/JSON projection
- unknown lookup、invalid profile、invariant failure
- 将来のaudit、scaffold、enforcementへの互換性境界

対象外:

- provider fileの探索、読込、生成、変更
- hook、skill、workflow、agent、prompt、connectorの実行
- runtime web refreshまたはprovider APIへの接続
- repositoryの適合性監査
- provider設定のscaffoldまたはapply
- `dag next`の代行、project-specific task priorityの複製
- provider featureの品質評価またはprovider間ranking
- MCP、Issue #3のmulti-plan composition、autonomous planning

## 4. Version identity

Version 1の組合せを次とする。

```text
result_schema_version           = Perttool.AgentGuidanceResult.v1
guidance_interface_version      = 1
profile_schema_version          = Perttool.AgentGuidanceProfile.v1
profile_data_version            = 1
guidance_taxonomy_version       = 1
risk_taxonomy_version           = 1
description_registry_version    = 1
description_locale              = en
staleness_policy_version        = 1
```

各versionは独立した互換性境界である。

| Version | 変更対象 |
| --- | --- |
| result schema | public JSON shape、required field、field semantics |
| guidance interface | Core query/resultの意味、ordering、projection |
| profile schema | offline profile fileのshapeとvalidation |
| profile data | provider mapping、alias、artifact、source、日付 |
| guidance taxonomy | guidance IDまたはdirectiveの意味 |
| risk taxonomy | risk ID、kind、mitigation関係の意味 |
| description registry | canonical description templateと文言 |
| staleness policy | 日付比較、状態、warning条件 |

Pre-release全体のstrict compatibilityは要求しない。ただし一度採用した`Perttool.AgentGuidanceResult.v1`を破壊的に変更する場合はresult schemaを上げる。Provider mappingだけの変更はprofile data version、既存IDの意味変更は対応taxonomy version、canonical文言だけの変更はdescription registry versionを上げる。

Runtime resultへ現在時刻、生成時刻、random IDを含めない。

## 5. Stable taxonomy

### 5.1 Provider IDとalias

Canonical provider orderを次で固定する。

```text
codex
github-copilot
claude-code
grok-build
antigravity
```

Version 1のaliasは次の1件だけである。

```text
grok -> grok-build
```

Aliasはinput normalizationだけに使用し、resultは常にcanonical provider IDを返す。Case folding、空白除去、prefix一致、fuzzy match、非規範aliasを行わない。`Grok`、`grok_build`、`copilot`はunknown providerである。

### 5.2 Surface ID

Canonical surface orderを次で固定する。

```text
instruction
workflow
delegated_agent
enforcement
prompt
connector
```

| Surface | 共通意味 |
| --- | --- |
| `instruction` | sessionまたはtaskをまたいで有効になるproject/user instruction |
| `workflow` | 明示的に再利用する手順、skill、command package |
| `delegated_agent` | 親agentから役割またはsubtaskを委譲するagent定義 |
| `enforcement` | eventへ反応し、許可、拒否、検査、command実行を行いうるhook/policy |
| `prompt` | 人が明示起動するprompt templateまたはcommand |
| `connector` | 外部contextまたはtoolをagentへ公開するconnection |

Provider用語をsurface IDの代わりに返さない。1つのprovider artifactが複数surfaceへ対応する場合、surface recordごとに同じpathを参照できるが、各surfaceのguidanceとriskは独立に保持する。

### 5.3 Support status

Support status vocabularyを次で固定する。

```text
native
compatible
preview
deprecated
unsupported
unknown
```

Statusはproviderの優劣、projectでの推奨順位、provider release全体のmaturityを表さない。

| Status | 必須条件 |
| --- | --- |
| `native` | 現行official sourceがprovider固有のsurfaceまたはartifactを記述している |
| `compatible` | provider固有surfaceではなく、official sourceが他provider形式との互換利用を明記している |
| `preview` | official sourceが対象surfaceまたはartifactをpreview、beta、experimental相当と明記している |
| `deprecated` | official sourceが対象surfaceまたはartifactをdeprecatedと明記している |
| `unsupported` | official sourceが対象surfaceまたはartifactを利用不可と明記している |
| `unknown` | official sourceだけでは上記のいずれも立証できない |

単にartifact pathが空、maturityが未記載、資料が見つからない、別providerで利用できるという理由で`unsupported`を生成しない。Artifact pathの不明は`artifact_resolution=unknown`、release maturityの未記載はstatus evidenceのnoteとして分離する。

同じ対象について複数条件が明記される場合は、次の決定順を使う。

```text
explicitly unavailable -> unsupported
deprecated             -> deprecated
preview/beta           -> preview
compatibility only     -> compatible
provider-native        -> native
otherwise              -> unknown
```

例えばcompatibleなartifactがpreviewでもある場合、public `support_status`は`preview`とし、compatibility fact、`compatibility_not_native` risk、source参照を保持する。単一statusへ直交する全事実を詰め込まない。

1 provider/surfaceに複数artifactがある場合、各artifactは自身の`support_status`を持つ。Surface summary statusは次の規則で選ぶ。

1. profileが`primary=true`とするartifactまたはcapabilityを1件だけ選ぶ
2. primaryのstatusをsurface summaryへ投影する
3. primaryがない場合はsurface summaryを`unknown`にする
4. secondary artifactのstatusでsummaryを上書きしない

したがって、nativeなprimaryとcompatibleなsecondaryを持つsurfaceは`native`であり、compatible pathもartifact recordには残る。

### 5.4 Status evidence

全support statusは次の構造化根拠を持つ。

```text
SupportStatusEvidence:
  evidence_kind
    "official_native_documentation" |
    "official_compatibility_documentation" |
    "official_preview_notice" |
    "official_deprecation_notice" |
    "official_unsupported_notice" |
    "insufficient_official_evidence"
  source_ids          string[]
  facts               string[]
  description         GuidanceDescription | null
```

`source_ids`は同じproviderのofficial sourceを1件以上参照する。ただし`unknown`では検索・確認したsourceを1件以上参照し、なぜ結論できないかを`facts`へ記録する。`facts`はprofile-ownedな安定英文であり、runtime生成の要約ではない。Profileではdescriptionを必須とするが、public quick projectionでは`description=null`、detail projectionでは非nullとする。

Statusと`evidence_kind`の合法な対応は1対1とする。

| Status | Evidence kind |
| --- | --- |
| `native` | `official_native_documentation` |
| `compatible` | `official_compatibility_documentation` |
| `preview` | `official_preview_notice` |
| `deprecated` | `official_deprecation_notice` |
| `unsupported` | `official_unsupported_notice` |
| `unknown` | `insufficient_official_evidence` |

Provider baselineの`maturity_evidence.status`は調査時の事実入力であり、public support statusへ機械的にcopyしない。`public_preview`と`deprecated`は対応するofficial noticeの候補になるが、`documented`、`surface_specific`、`not_stated`だけから`native`、`compatible`、`unsupported`、`unknown`を決めない。Profile作成時にartifact/capabilityごとのofficial fact、primary、互換関係を5.3の決定順へ適用し、5.4の構造化根拠を固定する。

### 5.5 Artifact resolutionとscope

Artifact placementはsupport statusと別に次を返す。

```text
artifact_resolution = known | not_applicable | unknown
```

- `known`: official sourceからpathまたは配置単位を特定できる
- `not_applicable`: file artifactを持たないsession/runtime capability
- `unknown`: capabilityは観測できるがdurable artifactの配置を立証できない

Scope vocabularyを次で固定する。

```text
repository directory workspace user organization enterprise managed
session conversation local admin system plugin compatibility
```

Scopeの配列は上記順に並べる。Provider用語は`provider_terms`へ保持し、共通scopeへ根拠なく変換しない。

### 5.6 Guidance ID

Version 1のguidanceを次で固定する。`directive`は`must`、`should`、`may`のいずれかである。

| Guidance ID | Origin | Directive | 意味 |
| --- | --- | --- | --- |
| `project_plan_is_authority` | project control | must | project modelをpriorityの正本とする |
| `consult_dag_next_before_start` | project control | must | 新しいwork開始前に`dag next`を確認する |
| `recompute_after_state_change` | project control | must | state advance後にproject全体を再解析する |
| `require_explicit_human_override` | project control | must | 推奨外workは人間の明示判断として扱う |
| `keep_provider_priority_identical` | project control | must | providerごとにpriority規則を変えない |
| `use_narrowest_durable_surface` | common surface | should | 必要scopeを満たす最小の永続surfaceを選ぶ |
| `preserve_scope_and_precedence` | common surface | must | providerのscopeとprecedenceを保持する |
| `review_executable_customization` | common surface | must | code/toolを実行しうるcustomizationをreviewする |
| `treat_unknown_as_unavailable` | common surface | must | unknownを利用可能と推測しない |
| `review_stale_profile_before_adoption` | common surface | should | review due profileを新規採用前に再確認する |

Provider固有guidanceを追加する場合も`provider.<provider_id>.<name>`形式のstable IDを使い、project control guidanceと同じ意味の別IDを作らない。

上表はVersion 1のcommon guidance registryである。Provider profileがprovider固有IDを追加する場合、そのIDをprofile dataとguidance taxonomyの両方へ登録し、両versionを上げる。Profile dataだけへ未登録IDを追加しない。

### 5.7 Risk ID

Version 1のriskを次で固定する。

| Risk ID | Kind |
| --- | --- |
| `instruction_precedence_changes_effective_policy` | scope |
| `instruction_truncation_hides_policy` | scope |
| `workflow_executes_commands` | execution |
| `delegation_loses_parent_context` | delegation |
| `parallel_writes_conflict` | delegation |
| `hook_executes_code` | execution |
| `hook_can_block_or_mutate_flow` | execution |
| `prompt_not_persistent` | scope |
| `connector_accesses_external_data` | external_access |
| `connector_can_execute_external_action` | external_access |
| `provider_surface_availability_varies` | compatibility |
| `profile_may_be_stale` | staleness |
| `artifact_path_unknown` | compatibility |
| `compatibility_not_native` | compatibility |

Riskはseverity scoreやprovider rankingを持たない。各risk recordは`mitigation_guidance_ids`を1件以上持ち、参照先guidanceをresult closureへ含める。

### 5.8 Canonical description

Guidance、risk、status evidenceは次のdescriptionを持つ。

```text
GuidanceDescription:
  key         string
  parameters  [{name: string, value: string}]
  text        string
```

`key`とparameterはmachine-readableな正本、`text`はdescription registry version 1、locale `en`から決定的に生成した派生値である。同じkeyとparameterから異なるtextを生成してはならない。Consumerは判断に`text`だけを使用せず、stable ID、directive、status、evidence、risk関係を使用する。

## 6. Project guidance composition

### 6.1 Composition order

適用順を次で固定する。

```text
project_control
common_surface
provider
```

これは「後勝ち」のoverride順ではない。後段は前段を具体化できるが、否定、緩和、並べ替えをしてはならない。

Project control guidanceは全provider、全surfaceへ適用する。Common surface guidanceはsurface IDから決まり、provider guidanceはofficial provider behaviorの配置・scope・riskだけを補足する。

### 6.2 Conflict

次はprofile invariant failureである。

- provider guidanceがproject model以外をpriority authorityにする
- `dag next`確認なしのtask selectionを正規経路として許可する
- human overrideを暗黙化する
- providerごとにRecommendation rankingまたはreasonを変更する
- common guidanceの`must`をprovider guidanceが`should`または`may`へ弱める

Conflictを「provider固有差分」として出力せず、`PTAGT-302`でprofile全体を拒否する。

### 6.3 Project-specific facts

Version 1は`.pert` documentを読まず、現在のrecommended task、critical path、float、resource conflictをresultへ複製しない。Guidanceは`consult_dag_next_before_start`を返し、project固有の回答は`dag next`へ委譲する。

## 7. Offline profile

### 7.1 Profile identity

Bundled profileは`Perttool.AgentGuidanceProfile.v1`であり、少なくとも次を持つ。

```text
schema_version
profile_data_version
guidance_taxonomy_version
risk_taxonomy_version
description_registry_version
description_locale
staleness_policy_version
snapshot_as_of
provider_order
surface_order
aliases
providers
guidance_registry
risk_registry
sources
```

Profile digestはUTF-8、末尾newline付きcanonical JSON bytesのSHA-256で、`sha256:<64 lowercase hex digits>`とする。Object keyはprofile serializerのschema order、registry配列は本仕様のcanonical orderで並べ、runtimeで再sortした別bytesをdigest対象にしない。

### 7.2 Source

Source recordは次を持つ。

```text
source_id
provider_id
title
url
verified_at
```

Version 1 profileはofficial provider sourceだけを根拠にする。Blog、search result、AI生成要約、repositoryの推測をofficial sourceの代用にしない。URLはruntimeでfetchしない。

### 7.3 Staleness

Stalenessはwall clockではなくprofileに固定した日付だけで計算する。

```text
Staleness:
  status       verified | review_due | unknown
  verified_at  YYYY-MM-DD | null
  review_after YYYY-MM-DD | null
  basis_date   YYYY-MM-DD
```

`basis_date`はprofile rootの`snapshot_as_of`と一致する。

- `verified`: `verified_at`と`review_after`があり、`snapshot_as_of <= review_after`
- `review_due`: 両日付があり、`snapshot_as_of > review_after`
- `unknown`: いずれかの日付をofficial evidenceから固定できない

Review間隔はCoreへhard-codeせず、profile ownerがsource volatilityを考慮して`review_after`を明示する。Runtime invocation dateからstatusを変えない。Textは日付を必ず表示し、「現在有効」とは表現しない。

`review_due`は`PTAGT-202` warning、`unknown` stalenessは`PTAGT-203` warningを返す。どちらもlookup自体は成功するが、新規artifact採用前に再検証する。

## 8. Core API

### 8.1 Query

Pure Coreは次の概念interfaceを持つ。

```text
getAgentGuidance(profile, query) -> AgentGuidanceResult

AgentGuidanceQuery:
  provider_id  string | null
  surface_id   string | null
  level        index | quick | detail
```

Coreはfile、environment、network、clock、locale catalog、provider APIへアクセスしない。Alias normalization、validation、reference closure、ordering、projectionをCoreで一度だけ行い、CLI rendererは再判定しない。

`surface_id`は`provider_id`なしで指定できない。

### 8.2 Projection level

| Level | Projection |
| --- | --- |
| `index` | provider ID、display name、alias、available surface ID |
| `quick` | surface status、artifact path/scope、guidance/risk ID、staleness |
| `detail` | quickに加えてcanonical description、provider terms、status evidence、source title/URL |

引数なしのdefault levelは`index`、providerまたはsurface指定時は`quick`とする。明示levelはどのquery shapeでも受理する。Levelは同じentityのID、status、orderingを変えず、情報量だけを変える。

### 8.3 Completeness

Resultはquery projectionで参照するguidance、risk、sourceだけをroot registryへ含める。Riskから参照するmitigation guidance、status evidenceから参照するsourceを再帰的に含め、dangling referenceを許可しない。

`index`ではsurface detailを返さないため、guidance、risk、source registryは空配列にできる。`quick`ではsource IDをsurfaceへ保持し、source registryはIDとprovider IDだけのprojectionを返す。`detail`ではsource URLを含む。

Positional filterを先に適用し、その後level projectionを行う。Surface指定の`index`は1 providerと指定した1件の`available_surface_ids`を返し、`surfaces=[]`とする。Providerだけの`index`はそのproviderの全surface ID、filterなしの`index`は全providerの全surface IDを返す。

## 9. Public result schema

### 9.1 Root

JSON root field orderとrequired fieldを次で固定する。

```text
schema_version
guidance_interface_version
profile_schema_version
profile_data_version
guidance_taxonomy_version
risk_taxonomy_version
description_registry_version
description_locale
staleness_policy_version
tool_version
operation
ok
profile_digest
snapshot_as_of
query
providers
guidance_records
risk_records
sources
capabilities
diagnostics
```

固定値:

```text
schema_version = Perttool.AgentGuidanceResult.v1
operation      = agent.help
```

`profile_digest`はbundled profileのcanonical digestである。`agent help`は既存`dsl help`と同じくdocument operationではないため、`document_id`、`source`、`source_digest`、`diagnostics_truncated`を持たない。Unknown lookupでもversion identity、profile identity、query、空のresult配列、diagnosticを持つcomplete envelopeを返す。

### 9.2 Query projection

```text
query:
  input_provider_id      string | null
  canonical_provider_id  string | null
  surface_id             string | null
  level                  index | quick | detail
  alias_applied           boolean
```

Unknown providerでは`canonical_provider_id=null`、known aliasではcanonical IDと`alias_applied=true`を返す。

### 9.3 Provider

```text
ProviderGuidance:
  provider_id
  display_name
  aliases
  available_surface_ids
  surfaces
```

`aliases`はcanonical alias order、`available_surface_ids`はsurface orderである。Provider queryは1 provider、全体queryはprovider order、unknown queryは空配列を返す。

### 9.4 Surface

```text
SurfaceGuidance:
  surface_id
  support_status
  primary_artifact_id
  artifact_resolution
  provider_terms
  scopes
  artifacts
  guidance_ids
  risk_ids
  status_evidence
  staleness
```

`primary_artifact_id`はfile artifactを持たないcapabilityまたはunknown placementでは`null`にできる。`guidance_ids`はcomposition order、各origin内はtaxonomy order、`risk_ids`はrisk taxonomy orderである。

### 9.5 Artifact

```text
GuidanceArtifact:
  artifact_id
  path
  scope_ids
  primary
  support_status
  status_evidence
```

`path`は`artifact_resolution=known`の場合だけnon-nullとする。`scope_ids`は1件以上をscope orderで持ち、同じpathがrepositoryとdirectoryの両方へ適用される場合も1つのartifactに両scopeを保持する。Placeholderは`<skill-name>`のように山括弧で表し、実pathと誤認する生成値を返さない。Artifact自身のstatusにも5.4の`status_evidence`を必須とする。

### 9.6 Guidance、risk、source

```text
GuidanceRecord:
  guidance_id
  origin              project_control | common_surface | provider
  directive           must | should | may
  surface_ids
  description         GuidanceDescription | null

RiskRecord:
  risk_id
  kind                scope | execution | delegation | external_access |
                      compatibility | staleness
  surface_ids
  mitigation_guidance_ids
  description         GuidanceDescription | null

GuidanceSource:
  source_id
  provider_id
  title               string | null
  url                 string | null
  verified_at
```

Quick projectionではdescription、title、urlを`null`、detailでは非nullとする。Field自体をlevelごとに省略しない。

Surfaceの`provider_terms`、status evidenceの`facts`と`description`もquickではそれぞれ空配列、空配列、`null`とし、detailでprofile値を返す。Source ID、status、artifact、scope、guidance/risk関係はquickでも省略しない。

Project control guidanceの`surface_ids=[]`は全surfaceへの適用を表す。Common surfaceとprovider guidanceは1件以上のsurface IDをcanonical orderで持つ。空配列を「適用先なし」と解釈しない。

### 9.7 Capability declaration

Version 1は常に次を返す。

```text
capabilities:
  reads_project_files       false
  writes_files              false
  executes_hooks            false
  executes_commands         false
  accesses_network          false
  reads_provider_state      false
  writes_provider_state     false
```

Renderer、alias、lookup結果によって値を変えない。

## 10. Ordering and determinism

Canonical orderingを次で固定する。

1. provider: 5.1のprovider order
2. surface: 5.2のsurface order
3. alias: profile alias declaration order
4. scope: 5.5のscope order
5. artifact: primary first、先頭scope IDのscope order、pathのUTF-8 byte order、artifact ID
6. guidance: composition order、taxonomy order、guidance ID
7. risk: taxonomy order、risk ID
8. source: provider order、source IDのUTF-8 byte order
9. diagnostic: severityではなく発生phase、code、provider ID、surface ID

同じtool version、profile bytes、queryからCore objectの意味、JSON bytes、text bytesを同一にする。Object insertion order、filesystem order、network response、locale、timezone、wall clockに依存しない。JSONは2-space indent、UTF-8、末尾newline、keyはschema orderとする。

## 11. CLI contract

### 11.1 Command

```text
perttool agent help [<provider> [<surface>]]
  [--level index|quick|detail]
  [--format text|json]
  [--color auto|always|never]
```

- `<provider>`はcanonical IDまたはstable alias
- `<surface>`はcanonical surface IDだけ
- 最大2 operand
- `--warnings-as-errors`と`--max-diagnostics`は受理しない
- command helpは`perttool agent help --help`
- domain resultはprofile lookupを行うがproject documentを読まない
- provider/surface/level/formatは同じCore resultへ接続する

既存`dsl help`のtopic、default level、schema、PTHLP diagnostic、text/JSON byte出力を変更しない。

### 11.2 Text layout

Index:

```text
AGENT GUIDANCE schema=Perttool.AgentGuidanceResult.v1 profile=1 snapshot=2026-07-23
PROVIDER codex aliases=- surfaces=instruction,workflow,delegated_agent,enforcement,prompt,connector
PROVIDER github-copilot aliases=- surfaces=instruction,workflow,delegated_agent,enforcement,prompt,connector
PROVIDER claude-code aliases=- surfaces=instruction,workflow,delegated_agent,enforcement,prompt,connector
PROVIDER grok-build aliases=grok surfaces=instruction,workflow,delegated_agent,enforcement,prompt,connector
PROVIDER antigravity aliases=- surfaces=instruction,workflow,delegated_agent,enforcement,prompt,connector
READ-ONLY files=false hooks=false commands=false network=false provider-write=false
```

Quick/detail:

```text
AGENT GUIDANCE schema=<schema> profile=<data-version> snapshot=<date>
QUERY provider=<canonical-id> surface=<surface-or-*> level=<level> alias=<true|false>
PROVIDER <provider-id> <display-name>
SURFACE <surface-id> support=<status> artifact=<resolution>
ARTIFACT <artifact-id> primary=<true|false> scopes=<scope,...> status=<status> path=<path-or-?>
GUIDANCE <guidance-id> directive=<directive>
RISK <risk-id> kind=<kind> mitigated-by=<guidance-id,...>
STALENESS status=<status> verified-at=<date-or-?> review-after=<date-or-?> basis=<date>
EVIDENCE <kind> sources=<source-id,...>
DESCRIPTION <key>: <text>
SOURCE <source-id> <url>
READ-ONLY files=false hooks=false commands=false network=false provider-write=false
```

Quickは`DESCRIPTION`とURL付き`SOURCE`を省略する。Unknown pathは`?`とし、空文字や推測pathを表示しない。Textのsection order、label、ID、status、date、pathの意味をgoldenで固定する。Machine consumerはJSONを使用する。

## 12. Diagnostics and exit code

Agent guidance diagnosticは`PTAGT-*` namespaceを使用し、`PTHLP-*`を再利用しない。

| Code | Severity | Exit | Meaning |
| --- | --- | ---: | --- |
| `PTAGT-101` | error | 1 | unknown provider IDまたはalias |
| `PTAGT-102` | error | 1 | known providerに対するunknown surface ID |
| `PTAGT-201` | warning | 0 | support statusが`unknown` |
| `PTAGT-202` | warning | 0 | profile entryが`review_due` |
| `PTAGT-203` | warning | 0 | profile entryのstalenessが`unknown` |
| `PTAGT-301` | error | 1 | unsupported profile/schema/taxonomy version |
| `PTAGT-302` | error | 70 | reference、composition、ordering invariant failure |
| `PTAGT-303` | error | 70 | canonical descriptionまたはprofile digest invariant failure |

Unknown lookupは`ok=false`、空のprovider/guidance/risk/source配列、1 diagnosticを返す。Known providerの`unsupported`または`unknown` surfaceはlookup成功であり、`ok=true`である。`unknown`だけ`PTAGT-201` warningを伴う。

Unknown option、余分なoperand、surfaceだけの指定、invalid levelは`PTCLI-001`、exit 2とする。Envelope生成前のI/OはVersion 1にはなく、internal exceptionはexit 70である。JSONのstream規則はCLI Interface仕様9章を継承する。

## 13. Validation invariants

Profile validatorは少なくとも次を検査する。

- version identityがsupported combinationと一致する
- provider/surface/orderが本仕様と一致し、重複しない
- aliasがcanonical providerまたは他aliasと衝突しない
- 全providerが6 surfaceをcanonical orderで持つ
- statusとevidence kindが合法に対応する
- primary artifact/capabilityがsurfaceごとに高々1件
- artifact resolution、path、primary IDが矛盾しない
- artifactのscope配列が空でなく、canonical orderである
- surfaceとartifactのstatus evidenceが各statusへ合法に対応する
- guidance、risk、source参照が閉じている
- riskが少なくとも1 mitigation guidanceを持つ
- composition orderと`must` directiveが弱められていない
- source providerが参照元providerと一致する
- URLがabsolute HTTPSである
- dateがcanonical `YYYY-MM-DD`で、`verified_at <= review_after`かつ`verified_at <= snapshot_as_of`
- stalenessが固定日付から一意に導出される
- description key/parameter/textがregistryと一致する
- canonical profile bytesとdigestが一致する

Invalid profileからpartial guidanceを返さない。Unsupported versionはconsumerが理解できるenvelopeを作れる場合だけ`PTAGT-301`を返し、shape自体を解釈できない場合はinternal safe stopとする。

## 14. Migration boundaries

### 14.1 Version 1: help

Version 1はbundled profileに対するread-only queryだけを公開する。Repositoryやprovider environmentへの適合性を主張しない。

### 14.2 Future audit

`agent audit`を追加する場合:

- 読むpath、symlink、encoding、ignore、trust境界を別仕様で固定する
- help resultをaudit resultへ流用しない
- `Perttool.AgentGuidanceAuditResult.v1`のような別schemaを使う
- read-onlyであることをcapabilityへ明示する

### 14.3 Future scaffold

`agent scaffold`を追加する場合:

- preview、diff、collision、ownership、safe-write、optimistic lockを別仕様で固定する
- defaultでfileを書かない
- provider fileを上書きまたはmergeする規則を推測しない
- help/audit schemaをwrite resultへ流用しない

### 14.4 Future enforcement

Hookまたはpolicy enforcementを追加する場合:

- 実行event、input/output、timeout、failure mode、trust、secret、command executionを別仕様で固定する
- `dag next` recommendation versionとhuman override validationへ明示的にbindする
- provider hookがtask priorityを独自計算しない
- Version 1 helpの`executes_hooks=false`を変更せず、新しいoperation/resultで公開する

## 15. Acceptance trace

| Issue #2 acceptance | Contract |
| --- | --- |
| 5 provider | 5.1、7章、9.3 |
| 6 common surfaces | 5.2、9.4 |
| stable ID/alias | 5章 |
| support/unknown/staleness | 5.3、5.4、7.3 |
| versioned offline profile | 4章、7章 |
| deterministic Core | 8章、10章 |
| text/JSON same Core | 8章、9章、11章 |
| diagnostic/exit | 12章 |
| project authority | 2章、6章 |
| read-only/no network | 3章、9.7 |
| legacy help non-regression | 11.1 |
| audit/scaffold/enforcement boundary | 14章 |

[規範例](../examples/agent-guidance.md)と`test/fixtures/agent-guidance/contract.v1.json`は、この表をcase IDへ展開する。Core実装はfixtureを都合よく変更せず、契約変更が必要なら本仕様とversionを先に更新する。
