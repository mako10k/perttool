# Beta Transition and Release Procedure

- Status: Accepted 1.1
- 決定日: 2026-07-23
- Versioning: [ADR 0003](../adr/0003-beta-versioning.md)
- Feature gate: [Issue #2](https://github.com/mako10k/perttool/issues/2)
- Feature acceptance: [AI Agent Guidance Registry v1受け入れ記録](agent-guidance-acceptance.md)
- Release acceptance: [`v0.1.0` beta release acceptance record](beta-release-acceptance.md)
- Macro plan: [../../plans/mvp.pert](../../plans/mvp.pert)
- Detail plan: [../../plans/agent-guidance.pert](../../plans/agent-guidance.pert)

## 1. Scope

最初のbetaはsuffixなしの`0.1.0`とし、AI Agent Guidance Registryのread-only v1を含める。Provider固有設定の生成、hook実行、audit、scaffold、enforcement、Issue #3、LSP server、VSIX、MCP serverは含めない。

Alphaからbetaへのstrict compatibilityは要求しない。必要な破壊的変更は許容するが、schema version、仕様、migration、CHANGELOG、fixture、helpを同じchangeで更新する。Alphaのdogfoodingとlocal利用は十分であり、追加の利用期間をrelease gateにしない。

## 2. Engineering gate

- `plans/agent-guidance.pert`の全taskが完了している
- [Issue #2受け入れ記録](agent-guidance-acceptance.md)により、acceptance criteriaを仕様、Core、CLI、text/JSON、fixture/golden、packageで満たす
- v1はofflineかつread-onlyで、hook、project code、file generation、network refreshを実行しない
- 5 provider profileのofficial sourceと`verified_at`を実装時点で再確認する
- `npm run check`と`git diff --check`が成功する
- Macroの`AGENT_GUIDANCE_IMPLEMENTATION`をpreview-firstで完了し、`BETA_RELEASE_E2E`がrecommendedになる

## 3. Release change

Release commitで次を同時に更新する。

- package、lock、CLI versionを`0.1.0`へ変更する
- CHANGELOGとREADMEをbeta導線へ変更する
- `publishConfig.tag`とpublish guardを`beta`へ変更する
- publish scriptを明示channel parameterまたはmanifest channelから検証し、hard-coded `alpha`を残さない
- `npm install --global perttool@beta`を規範install例にする

`0.1.0`はSemVer上suffixを持たないが、perttoolのproduct maturityではbetaである。GitHubではprereleaseとして公開し、npmの`latest`は変更しない。

## 4. Distribution gate

1. Clean release commitを`origin/main`へpushする
2. 同じcommitへannotated tag `v0.1.0`を作成・pushする
3. Worktree外でtarballを一度だけ生成してpackage検査する
4. Tarballと`SHA256SUMS`をGitHub prereleaseへ添付し、公開assetから隔離installする
5. 利用者のactual publish許可後、同じtarballを`secdat`のprocess限定`NPM_TOKEN`でnpm `beta`へ一度だけpublishする
6. Registry tarball、GitHub asset、local artifactのdigest一致、`beta` dist-tag、既存`latest`不変を確認する
7. Registryから隔離installし、CLI version、help、`agent help`、既存command smokeを確認する
8. Release記録を残して`BETA_RELEASE_E2E`を完了する

Git push、GitHub操作、npm publishはrepository規則どおり`secdat exec`配下で行う。Actual publishはこの計画追加だけでは許可されない。

## 5. Accepted outcome

The procedure was completed on 2026-07-23. The immutable release tag, artifact identity, GitHub prerelease, npm dist-tags, isolated registry installation, verification results, and post-release plan transition are recorded in the [`v0.1.0` beta release acceptance record](beta-release-acceptance.md).
