# AI開発ガイド

- 文書状態: Draft 0.1
- 作成日: 2026-07-21
- 共有指示: [../../AGENTS.md](../../AGENTS.md)
- 自己利用計画: [self-use.md](self-use.md)

## 1. 目的

Codex、GitHub Copilot、その他のcoding agentが、同じ正本、作業境界、検証command、Git規則を参照してperttoolを開発できるrepository構成を維持する。

AIごとに別のproduct判断を持たせず、project固有の意味は文書とtestへ、tool固有の入口だけを`AGENTS.md`、`.github/`、`.codex/`へ置く。

## 2. 参照したlocal repository

`~/`直下の更新時刻が新しく、AI開発導線を持つcheckoutを2026-07-21に確認した。

| Repository | 抽出したpattern | perttoolでの採用 |
| --- | --- | --- |
| `~/kafs` | project map、実在command、task start gate、PERTによるnext-task選択、保守的Codex設定 | 簡潔化して`AGENTS.md`へ採用 |
| `~/power-limit-cdt` | `AGENTS.md`を共有正本とするCodex/Copilot互換、要件から検証までのtraceability、remote操作前の確認 | 共有指示とGit規則へ採用 |
| `~/kscr_selfhost` | repositoryを先に調べる、risk-first review、focused commit、proportional validation、`secdat exec` | workflowとreview規則へ採用 |
| `~/secexec` | agent入口とproject固有のhard ruleを分離し、詳細のsource of truthを明示する | domain invariantを正本文書へ寄せる方針を採用 |
| `~/openai-xmpp-bot-20250923` | `.editorconfig`と単一CI入口 | whitespace規約とrepository check CIへ採用 |

次は採用しなかった。

- product固有の安全規則やdeploy手順
- 現段階では役割が重複する多数のcustom agent
- issue、branch、worktree、PRをすべての変更へ強制する大規模repository向けworkflow
- 存在しないbuild、lint、test commandの先行定義
- 現在のperttoolでは検証できない抽象的な完了gate

## 3. Instruction architecture

```text
AGENTS.md                         shared canonical guidance
├── .github/copilot-instructions.md  Copilot entrypoint and mandatory summary
├── .codex/config.toml               conservative project-local defaults
├── docs/process/ai-development.md   rationale and operating workflow
├── package.json                     executable repository check
│   └── npm run check                typecheck、test、docs
├── scripts/check-docs.sh            documentation sub-check
└── .github/workflows/ci.yml         same npm check in CI
```

規則を追加する場合は、違反を検出できるtestまたは具体的なreview checkpointを優先する。単なる心構えを増やして`AGENTS.md`を長くしない。

## 4. Standard workflow

### 4.1 Start

1. `git status --short --branch`と`git log`でcurrent stateを確認する
2. 利用者の目的、作業種別、変更範囲を確認する
3. `AGENTS.md`の優先順で正本を読む
4. acceptance criteria、non-goal、検証commandを決める
5. 文書と実装のどちらを先に変更すべきか判断する

### 4.2 Change

- 1つのcoherent capabilityまたは仕様判断を1つのchangeにする
- 無関係なcleanupを混ぜない
- 安定ID、決定性、source span、loss reportなど既存contractを維持する
- 仕様変更はsampleとtestへ伝播させる
- user変更があるfileでは、上書きせず既存diffと統合する

### 4.3 Validate and review

現段階の共通check:

```sh
npm ci
npm run check
git diff --check
```

変更範囲に応じて`npm run typecheck`、`npm test`、`npm run check:docs`をnarrow checkとして先に実行する。

その後、`git diff -- <対象file>`で次を確認する。

- 正本間の矛盾がないか
- requirementまたはacceptance criteriaが抜けていないか
- exampleが仕様を実際に表しているか
- heuristic、推論、厳密結果を混同していないか
- 将来実装へ未確定事項を黙って押し込んでいないか

### 4.4 Close out

1. `git status --short`で対象fileだけが変更されていることを確認する
2. 対象fileを明示的にstageする
3. staged diffと`git diff --cached --check`を確認する
4. 実行したcheckと未実行checkを区別する
5. remote writeは`secdat exec`経由で行う
6. push後にlocal branchとremote tracking branchを確認する

## 5. Next-task selection and self-use

実装前は`docs/requirements.md`の推奨仕様作業と未確定事項を使う。「次のタスク」はcurrent checkoutでhard predecessorが閉じていることを確認してから提案する。

`docs/process/self-use.md`のStage 1を満たした後は、perttool自身の`.pert`計画を正本に加える。その時点からは次の順で選択する。

1. `mvp.pert`と現在の詳細planを`perttool dsl check`し、計画が有効であることを確認する
2. `mvp.pert`を`dag analyze`、`dag next`し、macro critical pathとrunnable work packageからworkstreamを選ぶ
3. 選んだwork packageに対応する詳細planを`dag analyze`、`dag next`し、runnable frontierを取得する
4. 外部blockと利用可能resourceを確認する
5. 詳細planのcriticalまたはleast-slack frontierから作業を選ぶ

異なる詳細planのtaskをmacro判断なしに直接比較しない。複数work packageがrunnableの場合はmacroのcritical判定、total float、明示priority、resource capacityを判断根拠とする。Issue #1のrecommendation APIが実装されるまでは、この選択規則を明示的なprocessとして維持する。

tool出力は選択根拠であり、task完了の独立証拠ではない。完了は対応仕様、code、test結果で確認する。

## 6. Evolution rule

TypeScript scaffoldでは次を固定した。

- Node.js 24以上、npm、ESM、TypeScript 7.0系
- `npm ci`、`npm run build`、`npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run check:link`、`npm run check:package`、`npm run check`
- CIはNode.js 24で`npm run check`
- sourceは`src/`、test/fixtureは`test/`、生成物は`dist/`
- `node_modules/`、`dist/`、coverage、tsbuildinfoはGit管理外
- runtime dependencyは現時点で0。必要になった場合だけ追加判断する

AI設定だけが実装workflowより先に複雑化しないようにする。
