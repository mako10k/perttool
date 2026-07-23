# AI Agent Guidance Provider baseline

- 文書状態: Active 0.1
- 検証日: 2026-07-23
- 対象Issue: [#2 AI開発ガイドを出力する仕組み](https://github.com/mako10k/perttool/issues/2)
- 実装計画: [../../plans/agent-guidance.pert](../../plans/agent-guidance.pert)
- 機械可読入力: [../../test/fixtures/agent-guidance/provider-baseline.v1.json](../../test/fixtures/agent-guidance/provider-baseline.v1.json)
- 公開contract: [../specs/agent-guidance.md](../specs/agent-guidance.md)

## 1. 目的

Codex、GitHub Copilot、Claude Code、Grok Build、Antigravityの公式資料を同じ観点で再検証し、Issue #2の共通contractを設計するための入力を固定する。

この文書とfixtureは規範interfaceではない。公開するsurface ID、support status、schema、projection、diagnosticは後続の[AI Agent Guidance Registry仕様](../specs/agent-guidance.md)を正とする。ここにある`maturity_evidence`もperttoolによるsupport判定ではなく、公式資料が明示する調査時点の状態を記録した証拠である。

## 2. 調査方法と境界

- 2026-07-23時点の各provider公式documentationだけを根拠とした
- Web参照はこの設計時調査に限定し、将来のruntime registryはversioned offline snapshotだけを読む
- 成果物pathが公式資料に明記されない場合は空配列とし、他providerとの類似から補完しない
- provider間で同名の機能が異なる場合は、共通語へ強制変換せず`provider_terms`と事実説明を保持する
- hook、skill内shell、MCP、delegated agentなど実行能力を持つsurfaceは、成果物pathだけでなくtrust、権限、side effectのriskも保持する
- GitHub CopilotやAntigravityのように製品surfaceごとの差がある場合は、一つの製品全体へ一般化しない

fixtureのsourceはURLと検証日を持つ。実装時にWebへ接続して更新したり、日付だけを自動更新したりしない。再検証は人間が公式資料との差分をreviewし、fixtureを通常のsource changeとして更新する。

## 3. 比較結果

| Provider | Instruction | Workflow | Delegated agent | Enforcement | Prompt | Connector |
| --- | --- | --- | --- | --- | --- | --- |
| Codex | `AGENTS.md` / override | Agent Skills | Subagents / custom agent TOML | hooks | custom promptsはdeprecated | MCP in `config.toml` |
| GitHub Copilot | Copilot instructions、path instructions、agent instructions | Agent Skills | custom agent profile | hooksはCoding Agent/CLI依存 | `*.prompt.md`は一部IDEでpublic preview | MCPはCLI fileとGitHub設定でsurface差 |
| Claude Code | `CLAUDE.md` / rules | Skills | subagent Markdown | settings内hooks | Skills、互換custom commands | `.mcp.json`等 |
| Grok Build | `AGENTS.md` familyとClaude互換instruction | Skills | subagents、plugin/Claude互換agent | hooksとpermission rules | user-invocable skill/command | Grok configとMCP互換file |
| Antigravity | global `GEMINI.md` / workspace rules | Skills / Workflows | built-inと会話内dynamic custom subagent | `hooks.json` | slash invocationするWorkflow | `mcp_config.json` |

この表は索引であり、path、scope、maturity、risk、根拠はfixtureを正とする。

## 4. 推測を避けた箇所

### 4.1 Antigravity

公式Rules/Workflows資料はWorkflowがglobalまたはworkspace scopeのMarkdownであることを説明するが、保存pathを明記していない。このため`prompt`のartifactは空配列にした。Custom subagentは`define_subagent`で会話中に定義され、会話終了まで再利用できるため、`delegated_agent`にも永続artifact pathを置いていない。

### 4.2 Grok Build

公式資料はsubagent、agentを含むplugin、Claude Code agent互換を説明する。一方、nativeなloose custom-agent fileのpathは確認できなかったため、`delegated_agent`のartifactは空配列にした。Claude互換pathをGrok native pathとして複製していない。

### 4.3 GitHub Copilot

instructions、skills、custom agents、hooks、prompt files、MCPはCopilot Coding Agent、CLI、IDEで対応範囲と格納方法が異なる。fixtureは確認したsurfaceとscopeを説明へ残し、全Copilot機能が同じartifactを読むとは扱わない。

### 4.4 Codex

Custom promptsは公式にdeprecatedで、Skillsが推奨されている。`prompt`観点を欠落させずdeprecatedのまま記録し、将来のガイドが旧方式を推奨しないための入力にする。Project-local hookとMCPはtrusted project境界を持ち、hookはcommandを実行できるため、単なるhelp textとして安全扱いしない。

## 5. 後続contractへの入力

`GUIDANCE_CONTRACT`は本baselineから次を[公開contract](../specs/agent-guidance.md)へ確定した。

1. provider、surface、guidance、risk、aliasのstable ID
2. `native`、`compatible`、`preview`、`deprecated`、`unsupported`、`unknown`のsupport statusと、本baselineのmaturity evidenceとの変換規則
3. provider製品surface差、空artifact path、stalenessを失わないversioned result
4. project guidanceとprovider guidanceの合成順
5. text/JSON projection、diagnostic、exit code
6. read-only v1と、将来のaudit、scaffold、enforcement、runtime refreshの境界

本baseline工程では公開契約、Core、CLI、file生成、hook実行、provider connector接続を実装していない。公開contractは後続設計工程で追加したが、Core、CLI、file生成、hook実行、provider connector接続はさらに後続taskのままである。
