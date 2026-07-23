# AI Agent Guidance Registry v1受け入れ記録

- 文書状態: Accepted 1.0
- 受け入れ日: 2026-07-23
- 対象Issue: [Issue #2](https://github.com/mako10k/perttool/issues/2)
- 規範仕様: [AI Agent Guidance Registry仕様](../specs/agent-guidance.md)
- 規範例: [AI Agent Guidance Registry規範例](../examples/agent-guidance.md)
- Provider根拠: [AI Agent Guidance Provider baseline](agent-guidance-provider-baseline.md)
- 詳細plan: [../../plans/agent-guidance.pert](../../plans/agent-guidance.pert)

## 1. 判定

Issue #2のread-only AI Agent Guidance Registry v1を受け入れる。Codex、GitHub Copilot、Claude Code、Grok Build、Antigravityのversion付きoffline profileを、provider固有名称と共通surfaceを分離した同一Coreから参照できる。`agent help`のtextとJSONは同じCore resultから決定的に生成され、package-installed CLIとpublic libraryも同じprofileを使用する。

本受け入れは`agent help`だけを対象とする。`agent audit`、`agent scaffold`、hook実行、enforcement、provider設定変更、runtime network refreshは未実装かつnon-goalであり、受け入れによって解禁しない。

## 2. Issue #2 acceptance trace

| ID | Acceptance criterion | 規範・実装 | 自動検証 |
| --- | --- | --- | --- |
| AGT-AC-01 | 共通surface taxonomyとstable guidance code | 仕様5.2、6章、`src/guidance/types.ts`、`src/guidance/profile.ts` | `test/agent-guidance-contract.test.mjs`、`test/agent-guidance-core.test.mjs` |
| AGT-AC-02 | Provider用語を共通conceptへmapping | 仕様5.2、7章、Provider baseline | `test/agent-guidance-provider-baseline.test.mjs`、`test/agent-guidance-core.test.mjs` |
| AGT-AC-03 | Provider ID、alias、support、staleness、unknown契約 | 仕様5章、7.3節、12章 | `test/agent-guidance-contract.test.mjs`、`test/agent-guidance-core.test.mjs` |
| AGT-AC-04 | Read-only command、Core result、text/JSON、exit code | 仕様3章、8章から12章、`src/application/agent-help.ts` | `test/agent-guidance-core.test.mjs`、`test/agent-guidance-publication.test.mjs` |
| AGT-AC-05 | TextとJSONを同一registryから決定的に生成 | `src/guidance/query.ts`、`src/guidance/text.ts`、`src/cli.ts` | Core serializer/CLI byte parity、text golden |
| AGT-AC-06 | 5 providerのartifact、scope、maturity、risk、source、確認日 | Provider baseline、`test/fixtures/agent-guidance/provider-baseline.v1.json` | Provider baseline completeness、Core profile parity |
| AGT-AC-07 | 6 support statusのfixture | `test/fixtures/agent-guidance/contract.v1.json` | support/evidence一対一、全status Core検証 |
| AGT-AC-08 | Provider orderingとprojectionのfixture/golden | Provider/contract fixture、`test/golden/agent-guidance/` | 5 provider × 6 surface順序、index/quick/detail、alias、source closure |
| AGT-AC-09 | Legacy `dsl help`非回帰 | 仕様11.1節、独立したstructured command help registry | `legacy-dsl-help-index.expected.json` byte golden |
| AGT-AC-10 | README、basic design、AI process、help同期 | `README.md`、`docs/basic-design.md`、`docs/process/ai-development.md`、`src/help/registry.ts` | documentation/link check、CLI help/publication test |
| AGT-AC-11 | Offline/read-onlyでhook、file生成、network refreshなし | 仕様3章、9.7節、read-only capability、pure Core境界 | 空環境・一時directory実行、capability、package-installed CLI検証 |
| AGT-AC-12 | Audit、scaffold、enforcement migration境界 | 仕様14章、beta release手順 | contract normative case AGT-018からAGT-020、documentation check |

Issue本文の12 criteriaと本表は一対一である。規範的な意味はIssue本文ではなく、仕様15章のacceptance traceと上記参照先を正とする。

## 3. Provider evidence

Provider baselineとbundled profileの`verified_at`および`snapshot_as_of`は`2026-07-23`である。Provider baseline専用testは次を検査する。

- 5 providerが固定順で存在し、各providerが同じ6 surfaceを持つ
- 各surfaceがscope、maturity evidence、risk observation、official source参照、確認日を持つ
- Official sourceがproviderに対応するhostだけを使用する
- 公式資料でpathを確定できないartifactは空配列のまま保持し、推測で補わない
- Baselineからbundled profileへのprovider、surface、artifact、source mappingが閉じている

## 4. Security boundary

`src/guidance/`は固定profileと引数だけを入力とするpure Coreで、file、environment、clock、locale catalog、network、provider APIを参照しない。CLI adapterは結果の表示だけを担当する。

受け入れtestはproject外の空の一時directoryと空environmentで`agent help`を実行し、fileが生成されないことを確認する。公開capabilityは次の全項目を`false`として固定する。

- project file read
- file write
- hook execution
- command execution
- network access
- provider state read/write

表示されるhook、workflow、connectorのriskはprovider機能についての説明であり、perttoolがそれらを実行したことを意味しない。

## 5. Verification

Repository root、Node.js 24以上で次を実行し、すべて成功した。

```sh
npm run build
node --test \
  test/agent-guidance-provider-baseline.test.mjs \
  test/agent-guidance-contract.test.mjs \
  test/agent-guidance-core.test.mjs \
  test/agent-guidance-publication.test.mjs
npm run check:package
npm run check
git diff --check
```

専用testは30件を実行した。Package checkはrelease tarballを一時directoryへpack/installし、public library、installed `agent help`、既存command、package内容、publish dry-runを検査した。Actual publish、GitHub release、npm dist-tag変更は実行していない。

## 6. Betaへの引き継ぎ

本受け入れでIssue #2 feature gateを閉じる。次の工程はmacro planの`BETA_RELEASE_E2E`であり、[beta release手順](beta-release.md)に従ってsuffixなし`0.1.0`、同一tarball、GitHub prerelease、npm `beta`、既存`latest`不変、registry隔離installを検証する。

本記録はbeta distribution完了を表さない。Version変更、beta release commitとそのpush、tag、GitHub prerelease、npm publishは`BETA_RELEASE_E2E`の明示的な実行時にだけ行う。
