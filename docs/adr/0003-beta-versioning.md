# ADR 0003: `0.x.x` beta versioningとIssue #2 scope

- Status: Accepted
- Date: 2026-07-23
- Amended: 2026-07-23 (`v0.1.0` explicit `latest` promotion)
- Supersedes: ADR 0002の`v0.1.0` stable候補判断

## Context

`v0.1.0-alpha.2`でMVP受け入れ条件、recommendation authority、GitHub/npm同一artifact配布、registry installまで完了した。次の公開段階では、AI Project Control Planeの判断を各coding agentへ適用するread-only guidanceが必要である。

SemVerのprerelease suffixを長期間運用すると、perttoolが定義するproduct maturityとnpm/GitHubの表記が二重管理になる。1.0前は破壊的変更を許容するため、`-beta` suffixを各versionへ付け続ける必要もない。

## Decision

- `v0.1.0-alpha.2`を最後のalphaとする
- 最初のbeta候補はsuffixなしの`0.1.0`とする
- `0.x.x`をperttoolのbeta系列と定義し、`-alpha`、`-beta` suffixを使用しない
- stable系列は将来の`1.0.0`以降とする。npm `latest`はstabilityの宣言ではなく、明示的に推奨する既定install versionを表す
- alphaから最初のbetaへのstrict compatibilityは要求しない。必要な破壊的変更を許容する
- 破壊的変更では影響するschema version、仕様、migration、CHANGELOG、testを同じlogical changeで更新する
- alphaのdogfooding、local link、GitHub/npm artifact install実績をbeta移行に十分な利用期間とみなし、追加のsoak期間を要求しない
- beta scopeに[Issue #2](https://github.com/mako10k/perttool/issues/2)のread-only AI Agent Guidance Registry v1を含める
- Issue #3のbacklog階層・multi-plan composition、LSP server、VSIX、MCP server、guidance audit/scaffold/enforcementはbeta開始条件に含めない
- npm publishは`beta` dist-tagへ行い、そのpublish操作では既存`latest`を変更しない。Release受け入れ後、人間が明示的に許可した独立したdist-tag操作だけが、受け入れ済みbetaを`latest`へ昇格できる
- suffixなしの`0.x.x`でもGitHub Releaseはproduct maturityに合わせてprereleaseとして公開する

On 2026-07-23, after `v0.1.0` beta acceptance, the user explicitly promoted `perttool@0.1.0` to npm `latest`. The `beta` tag continues to point to the same version, and `alpha` remains on `0.1.0-alpha.2`.

## Beta gate

1. Issue #2の規範contract、5 provider baseline、Core、text/JSON、CLI、package、security境界を受け入れる
2. 既存commandに局所的な互換要件がある場合は、そのIssue acceptanceを満たす。Project全体のalpha互換は要求しない
3. `package.json`、CLI version、tag、GitHub asset、npm versionをsuffixなしの同じ`0.x.x`へ揃える
4. GitHubとnpmへ同一tarballを配布し、`beta` dist-tag、registry integrity、隔離installを検証する
5. The publish operation leaves `latest` unchanged. Any later promotion is a separately authorized post-acceptance action and is not part of the beta publication gate.

## Consequences

- `0.x.x`だけからstable compatibilityを推測できない。利用者はCHANGELOGとschema versionを確認する
- publish scriptのhard-coded `alpha`はbeta release taskでparameterizedなchannel検証へ置き換える
- 現行`0.1.0-alpha.2` packageは変更せず、Issue #2受け入れ後のrelease commitで初めて`0.1.0`へ更新する
- beta移行そのものを外部feedback待ちにせず、project modelのIssue #2とrelease gateで制御する
- An unqualified npm install follows the explicitly promoted `latest` tag. Product maturity remains beta until a separate `1.0.0` stable decision.
