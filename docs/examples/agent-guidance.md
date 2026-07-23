# AI Agent Guidance Registry 規範例

- 文書状態: Normative 1.0
- 作成日: 2026-07-23
- 対応要件: [../requirements.md](../requirements.md)
- Interface contract: [../specs/agent-guidance.md](../specs/agent-guidance.md)
- Provider baseline: [../process/agent-guidance-provider-baseline.md](../process/agent-guidance-provider-baseline.md)
- 関連Issue: [Issue #2](https://github.com/mako10k/perttool/issues/2)

## 1. 目的

本書は、AI Agent Guidance Registry仕様をCore、CLI、golden testへ移すときに意味を変えないため、queryと期待projectionを固定する規範例である。

例は次を区別する。

- provider/surface lookupとalias normalization
- surface summary statusとartifact固有status
- support statusとartifact path resolution
- stable guidance/risk IDとcanonical description
- profile snapshot時点のstaleness
- successful unsupported/unknownとlookup error
- read-only helpと将来のaudit/scaffold/enforcement

例中のprofile fragmentはVersion 1 contract fixtureの意味を説明するものであり、provider設定fileではない。Core実装taskでbundled profileへ展開する。

## 2. 共通条件

特記しない限り次を使用する。

```text
schema_version              = Perttool.AgentGuidanceResult.v1
guidance_interface_version  = 1
profile_schema_version      = Perttool.AgentGuidanceProfile.v1
profile_data_version        = 1
guidance_taxonomy_version   = 1
risk_taxonomy_version       = 1
description_registry_version = 1
description_locale          = en
staleness_policy_version    = 1
snapshot_as_of              = 2026-07-23
operation                   = agent.help
```

全resultは次のcapabilityを持つ。

```json
{
  "reads_project_files": false,
  "writes_files": false,
  "executes_hooks": false,
  "executes_commands": false,
  "accesses_network": false,
  "reads_provider_state": false,
  "writes_provider_state": false
}
```

## 3. Lookupとordering

### AGT-001 Provider index

Query:

```text
provider_id = null
surface_id  = null
level       = index
```

期待するprovider order:

```text
codex
github-copilot
claude-code
grok-build
antigravity
```

全providerの`available_surface_ids`は次の順である。

```text
instruction
workflow
delegated_agent
enforcement
prompt
connector
```

`grok-build`だけがVersion 1 alias `grok`を持つ。Indexはsurface detail、guidance、risk、sourceを含めず、全配列をcanonical orderで返す。

### AGT-002 Aliasはcanonical providerへ正規化する

CLI:

```sh
perttool agent help grok workflow --format json
```

期待query:

```json
{
  "input_provider_id": "grok",
  "canonical_provider_id": "grok-build",
  "surface_id": "workflow",
  "level": "quick",
  "alias_applied": true
}
```

Provider record、artifact ID、sourceのprovider IDはすべて`grok-build`を返す。Outputへaliasをprovider IDとして残さない。

### AGT-003 非規範aliasを推測しない

次はすべて`PTAGT-101`、exit 1である。

```text
Grok
grok_build
copilot
claude
```

Resultは`ok=false`、`canonical_provider_id=null`、provider/guidance/risk/sourceは空配列である。Suggestionやfuzzy matchをcanonical resultへ混ぜない。

## 4. Support statusと説明

### AGT-004 Native primaryとcompatible secondary

仮に1 surfaceが次を持つ。

```text
primary artifact:
  id       = grok-build.instruction.agents
  path     = AGENTS.md
  status   = native
  evidence = official_native_documentation

secondary artifact:
  id       = grok-build.instruction.claude
  path     = CLAUDE.md
  status   = compatible
  evidence = official_compatibility_documentation
```

Surface summaryはprimaryの`native`である。Secondaryがcompatibleである事実はartifact record、`compatibility_not_native` risk、source参照へ残す。Surface全体をcompatibleにせず、compatible pathをnativeとも表示しない。

### AGT-005 Previewはexplicit noticeを必要とする

GitHub Copilotの`prompt`はprovider baselineでofficial sourceがpublic previewを明記しているため、Version 1 profileの対応artifactは次を持つ。

```text
support_status      = preview
evidence_kind       = official_preview_notice
source_ids          = [github-prompt-files]
```

単に新しい、変更が多い、IDE限定であるという推論からpreviewを生成しない。

### AGT-006 Deprecatedはpreferred replacementと分離する

Codexの`prompt`はcustom promptsを示し、official sourceがdeprecatedと明記しているため次を持つ。

```text
support_status      = deprecated
evidence_kind       = official_deprecation_notice
source_ids          = [codex-custom-prompts]
risk_ids            = [prompt_not_persistent, provider_surface_availability_varies]
```

Replacementとしてworkflow/Skillを説明できるが、prompt artifact自身のstatusをnativeへ戻さない。Provider固有の移行説明はproject control guidanceを変更しない。

### AGT-007 Unsupportedとunknownを区別する

Contract fixtureはstatus判定を次の2 sentinelで固定する。

```text
explicit unsupported:
  status        = unsupported
  evidence_kind = official_unsupported_notice
  diagnostic    = none
  ok            = true

insufficient evidence:
  status        = unknown
  evidence_kind = insufficient_official_evidence
  diagnostic    = PTAGT-201 warning
  ok            = true
```

Current provider profileに該当するunsupported surfaceがない場合でも、consumerが認識するvocabularyから削除しない。一方、資料が見つからないことをunsupported sentinelへ割り当ててはならない。

### AGT-008 Capabilityはnativeでもartifact pathはunknownになりうる

Providerがdelegated agent capabilityをofficialに説明しているがdurable definition pathを立証できない場合:

```text
support_status      = native
artifact_resolution = unknown
primary_artifact_id = null
risk_ids includes artifact_path_unknown
```

空pathのartifactを生成せず、`unsupported`へ降格せず、他providerのpathを流用しない。

## 5. Guidance composition

### AGT-009 Enforcement detail

CLI:

```sh
perttool agent help codex enforcement --level detail --format json
```

少なくとも次のguidanceをこの順で返す。

```text
project_plan_is_authority
consult_dag_next_before_start
recompute_after_state_change
require_explicit_human_override
keep_provider_priority_identical
use_narrowest_durable_surface
preserve_scope_and_precedence
review_executable_customization
```

少なくとも次のriskをtaxonomy orderで返す。

```text
hook_executes_code
hook_can_block_or_mutate_flow
provider_surface_availability_varies
profile_may_be_stale
```

各riskは少なくとも1 guidance IDを`mitigation_guidance_ids`へ持つ。例えば`hook_executes_code`は`review_executable_customization`を参照する。

Provider detailはCodex hookのpath、scope、trust behaviorを説明できるが、hookによるtask start可否を独自に定義しない。

### AGT-010 Canonical descriptionはstable IDを補助する

Detail resultのguidance例:

```json
{
  "guidance_id": "consult_dag_next_before_start",
  "origin": "project_control",
  "directive": "must",
  "surface_ids": [],
  "description": {
    "key": "guidance.consult_dag_next_before_start",
    "parameters": [],
    "text": "Consult the project recommendation before starting new work."
  }
}
```

AIは「なぜこの指示が表示されたか」へ、自然言語だけでなく次の構造から回答できる。

```text
origin       = project_control
directive    = must
guidance_id  = consult_dag_next_before_start
applies_to   = all providers and surfaces
```

Text変更だけでguidance IDまたはdirectiveの意味を変えない。

## 6. Staleness

### AGT-011 Snapshot-relative review due

Profile entry:

```text
verified_at  = 2026-04-01
review_after = 2026-07-01
snapshot_as_of = 2026-07-23
```

期待:

```text
staleness.status = review_due
staleness.basis_date = 2026-07-23
diagnostic = PTAGT-202 warning
ok = true
```

同じprofile bytesを2027年に実行してもresultは変わらない。更新が必要ならprofile data version、snapshot date、review date、profile digestを更新する。

### AGT-012 Unknown staleness

`verified_at`または`review_after`を固定できないentryは`staleness.status=unknown`、`PTAGT-203` warningである。Runtime dateを補完せず、profile build dateをverified dateとして代用しない。

## 7. Text/JSON parity

### AGT-013 Quick text

Command:

```sh
perttool agent help github-copilot prompt
```

Textには少なくとも次を含める。

```text
QUERY provider=github-copilot surface=prompt level=quick alias=false
SURFACE prompt support=preview artifact=known
GUIDANCE consult_dag_next_before_start directive=must
RISK prompt_not_persistent kind=scope
STALENESS status=verified verified-at=2026-07-23 review-after=<profile-date> basis=2026-07-23
READ-ONLY files=false hooks=false commands=false network=false provider-write=false
```

同じqueryのJSONとprovider ID、surface ID、support status、artifact、guidance/risk ID、staleness、capabilityが一致する。Text rendererがstatusやriskを再判定しない。

### AGT-014 Detail source

Detailだけがsource title、official URL、canonical description textを返す。Quickにもsource IDは残すため、detailで別sourceへ差し替えない。URLは表示するだけでfetchしない。

## 8. Errorとread-only boundary

### AGT-015 Unknown surface

```sh
perttool agent help codex policy --format json
```

期待:

```text
diagnostic code = PTAGT-102
severity        = error
exit            = 1
ok              = false
providers       = []
```

`policy`を`enforcement`へ自動変換しない。

### AGT-016 Usage error

次はdomain lookupではなく`PTCLI-001`、exit 2である。

```sh
perttool agent help codex enforcement extra
perttool agent help --level exhaustive
perttool agent help codex --warnings-as-errors
```

### AGT-017 Helpは外部状態を変えない

全caseで次を検査する。

- project fileをopenしない
- provider configを探索しない
- hook/commandを実行しない
- network socketを開かない
- environmentからprovider stateを推測しない
- fileまたはprovider stateを書かない

Source URLがresultに含まれることはnetwork accessを意味しない。

## 9. Migration

### AGT-018 Auditはhelp resultではない

将来の`agent audit`はrepository fileの有無や内容を検査できるが、`Perttool.AgentGuidanceResult.v1`へ`found`、`compliant`、local path contentを追加しない。別query、別capability、別result schemaを使う。

### AGT-019 Scaffoldはpreview-first

将来の`agent scaffold`はcandidate、diff、collision、digest、write resultを別契約で返す。Version 1 helpの`writes_files=false`をoptionでtrueにしない。

### AGT-020 EnforcementはRecommendationへbindする

将来hookを生成または実行する場合、hookはproject-specific priorityを再実装せず、supported `dag next` resultと明示的human overrideへbindする。Provider hook成功だけでproject stateをadvanceしない。

## 10. Test mapping

| Case | 主なtest |
| --- | --- |
| AGT-001..003 | provider order、surface order、alias、unknown lookup |
| AGT-004..008 | 6 status、evidence kind、artifact resolution |
| AGT-009..010 | composition、reference closure、description |
| AGT-011..012 | fixed-date staleness、warning |
| AGT-013..014 | Core/text/JSON parity、source projection |
| AGT-015..016 | PTAGT/PTCLI、exit code |
| AGT-017 | no-side-effect boundary |
| AGT-018..020 | future operation/schema isolation |

`test/fixtures/agent-guidance/contract.v1.json`はstable vocabularyとcase expectationを機械可読に固定する。Provider mappingの事実入力は`provider-baseline.v1.json`を正とし、規範例から新しいprovider pathを推測しない。
