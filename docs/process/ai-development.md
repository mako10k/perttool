# AI開発ガイド

- 文書状態: Draft 0.4
- 作成日: 2026-07-21
- 更新日: 2026-07-23
- 共有指示: [../../AGENTS.md](../../AGENTS.md)
- 自己利用計画: [self-use.md](self-use.md)
- Recommendation migration: [recommendation-migration.md](recommendation-migration.md)
- Recommendation design review: [recommendation-design-review.md](recommendation-design-review.md)

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
├── scripts/publish-npm.sh            npm dry-runと明示release tarball publish gate
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

npm publishは通常のclose outに含めない。[npm publication手順](npm-publication.md)のrelease gate、同一tarball、remote commit/tag、registry上の未公開versionを確認し、利用者がactual publishを明示許可した場合だけ`secdat`から`NPM_TOKEN`をprocess限定で注入する。曖昧なpublish responseを確認せずretryしない。

## 5. Next-task selection and self-use

実装前は`docs/requirements.md`の推奨仕様作業と未確定事項を使う。「次のタスク」はcurrent checkoutでhard predecessorが閉じていることを確認してから提案する。

`docs/process/self-use.md`のStage 1を満たした後は、perttool自身の`.pert`計画を正本に加える。Stage 3ではediting commandと`dag advance`をpreview-first、expected digest、write後再解析の手順で正本writerとして使用できる。Task selectionは次の順で行う。

1. `mvp.pert`と現在の詳細planを`perttool dsl check`し、計画が有効であることを確認する
2. `mvp.pert`を`dag analyze`、`dag next`し、macro critical pathとrunnable work packageからworkstreamを選ぶ
3. 選んだwork packageに対応する詳細planを`dag analyze`、`dag next`し、runnable frontierを取得する
4. 外部blockと利用可能resourceを確認する
5. 詳細planのcriticalまたはleast-slack frontierから作業を選ぶ

異なる詳細planのtaskをmacro判断なしに直接比較しない。複数work packageがrunnableの場合はmacroのcritical判定、total float、明示priority、resource capacityを判断根拠とする。Issue #1のrecommendation APIはv3として公開され、self-use shadow gateも受け入れ済みだが、[Recommendation migration](recommendation-migration.md)のadoption gateを満たすまでは、この選択規則を明示的なprocessとして維持する。

2026-07-22の[Recommendation設計受け入れ](recommendation-design-review.md)、grammar受け入れ、formatter/mutation preview、safe write、Mermaid export/import round-trip、advance Core/CLIは完了し、Stage 3で自己利用している。[Release readiness監査](mvp-release-readiness.md)でMVP受け入れ条件16の未実装を確認したため、MIG-01からMIG-07を[Recommendation実装plan](../../plans/recommendation.pert)へ22pで詳細化し、macro release gateへ追加した。2026-07-23にMIG-01からMIG-04とMIG-06の累計17pを完了し、recommendation実測`17p/1d`で残るresource 5pを`5/17d`へforecastした。[5 planのshadow評価](recommendation-shadow-review.md)は受け入れ済みである。Macroの残るprecedence/resource makespanは`2.294118d`で、`RECOMMENDATION_IMPLEMENTATION`が唯一のreadyかつ`runnable_now`なcritical work package、detailでは`OVERRIDE_VALIDATION`がrecommended、`AUTHORITY_ADOPTION`がdeferred、`RELEASE_E2E`はupcomingである。V3 adoption gateを満たすまでは本節のmanual selectionを維持する。

### 5.1 Recommendation導入後のtask selection

`Perttool.NextResult.v3`公開だけでは本節を有効化しない。Self-use shadow gateを満たし、`AGENTS.md`と`.github/copilot-instructions.md`を同じadoption changeで更新した後に、次へ切り替える。

1. macro planのcomplete JSON recommendationからwork packageを選ぶ
2. 選んだwork packageのdetail planを再解析し、そのcomplete JSON recommendationからtaskを選ぶ
3. recommended taskのsubset、または`R`全件を維持してresource-feasibleなallowed taskを1件追加した集合だけをnormal authorityで選ぶ
4. decisive step、higher-priority task、comparisonを確認し、選択理由をproject factから説明する
5. unknown schema/version、incomplete trace、`PTREC-*`では自動選択を停止する
6. detail taskのstart、completion、block、capacity変更後はそのdetail planを再解析し、macro work packageのstatus、roll-up duration、capacityが変わった場合はmacro planも再解析する

`deferred`または`discouraged`を選ぶ人間指示はnormal recommendationと区別する。Override apply gateを満たすまでは適用済みartifactを捏造せず、AIは差と未解禁のaudit/apply境界を提示する。Provider別prompt、skill、agent、hookはIssue #2のguideから同じruleへ到達させ、provider固有のpriority規則を追加しない。

tool出力は選択根拠であり、task完了の独立証拠ではない。完了は対応仕様、code、test結果で確認する。

## 6. Worktree分離によるparallel Agent workflow

Sub-agent、delegation、parallel Agent workは、利用者が明示的に求めた場合、または有効なruntime policyが許可した場合だけ使用する。`dag next`が複数taskを`runnable_now`と返すことは工程上の並行可能性であり、Agent利用の許可そのものではない。

### 6.1 適用条件

次をすべて満たす場合だけparallel workの候補とする。

- macro/detail planのcheckとanalysisが成功し、対象taskがhard predecessorとresource条件上並行可能である
- current main worktreeがcleanで、全Agentを同じbase commitへ固定できる
- file ownershipを排他的に分けられるか、共有fileをintegration ownerだけが変更する境界を作れる
- 各taskのacceptance criteria、non-goal、narrow validation、commit条件を独立に記述できる
- deploy、push、issue更新などの共有external side effectをAgentへ並行実行させない

同じ正本fileの編集、未解決の単一semantic decision、直列dependency、利用者の未commit変更と重なる作業は並行化しない。単にfileが別であることだけでsemantic independenceを仮定しない。

### 6.2 Integration ownerとAgentの責務

Integration ownerは次を単独で管理する。

- base commit、branch名、worktree絶対path
- Agentごとの専有file、読み取り可能な正本、編集禁止file
- shared requirements、親仕様、plan status、golden、process文書の統合
- Agent commitのレビュー順、統合後の意味調整、全体検証

各Agentは指定worktree以外を変更せず、専有fileだけを1つのcoherent commitにする。Agentはshared planのtaskを`done`にせず、remote pushや他branchのcherry-pickを行わない。完了報告にcommit hash、変更file、検証、未解決事項を含める。

### 6.3 Worktree setup

作成前にmainのstatus、base commit、既存worktree、branch、対象pathが衝突しないことをread-only commandで確認する。

```sh
git status --short --branch
git worktree list --porcelain
git branch --list 'agent/<task-id>'
git worktree add -b agent/<task-id> <validated-absolute-path> <base-commit>
git -C <validated-absolute-path> status --short --branch
```

Target pathはtaskごとの明示的な絶対pathにする。`~`、`$HOME`、workspace root、未解決globをcreate/remove対象に使用しない。各Agent promptにworktree path、branch、base、専有file、参照正本、acceptance、validation、remote禁止を明記する。

### 6.4 Reviewとintegration

Agentごとに次を順番に行う。

1. 対象worktreeがclean、branchが予定通り、commitがbaseの直系であることを確認する
2. `git show --stat <commit>`と実diffで専有file境界、仕様、missing testをレビューする
3. mainがcleanなことを再確認し、1commitずつcherry-pickする
4. すべてのAgent commit統合後に、integration ownerがshared正本とplan/goldenを1つのlogical changeとして更新する
5. `npm run check`と`git diff --check`を実行し、macro/detail planのcheck/analyze/next結果を再確認する

Cherry-pickでconflictがないことはsemantic consistencyの証明ではない。両Agentが同じ用語、version、invariantを別の意味で固定していないか、integration ownerが横断レビューする。矛盾がある場合は機械的に両方を採用せず、共有判断をmainで解決する。

### 6.5 Success、failure、cleanup

Parallel trialは次をすべて満たした場合に成功とする。

- 各Agentが専有fileだけをcommitし、narrow validationが成功する
- mainへの個別統合で意図しないdiffが生じない
- 仕様間の横断レビューとshared正本の調整が完了する
- repository全checkと再解析後のplan goldenが成功する
- commit履歴がAgent成果とintegration changeのlogical unitを保つ

Agentが失敗、timeout、scope逸脱した場合は、対象worktreeとbranchを保持してstatus/diffを確認する。Force-remove、force-delete、未レビューcommitの自動統合を行わない。成功後にcleanupする場合も、worktreeがcleanでbranch commitがmainへ統合済みであることを確認し、検証済み絶対pathに対する`git worktree remove`と、通常の`git branch -d`だけを使用する。Cherry-pick後はcommit hashが変わるためancestor判定だけに依存せず、`git cherry main agent/<task-id>`の対象commitが`-`であることと、main側の実diffを確認してpatch equivalenceを検証する。この場合は通常の`git branch -d`がancestry上の未mergeとして削除を拒否し得る。`-D`へ自動切り替えせず、明示的な削除許可がなければsource branchを保持する。

### 6.6 2026-07-22 trial

`RANKING_POLICY`と`REASON_CODE_TAXONOMY`は、`plans/control-plane.pert`上で両方がreadyかつ`runnable_now`であることを確認し、commit `aaabd83`から別branch/worktreeへ分離した。各Agentは新規仕様1fileだけをcommitし、mainへ`7333a12`と`9eb47cb`としてconflictなく統合できた。

Integration ownerは、reason taxonomyのrecommended taskに因果ranking reasonを必須化し、両仕様の規範参照、requirements、basic design、plan、goldenを調整した。`npm run check`は90 test、21 Markdown、3 self-use plan、link/package checkを含めて成功した。

このtrialで、Agentの完了時間が異なってもmainと他worktreeをcleanに保てること、file conflictを防げることを確認した。Patch equivalenceとclean statusの確認後、2worktreeは削除した。Source branchはcherry-pickによりancestry上は未mergeのため通常削除が拒否され、force-deleteせず保持した。一方で、仕様間のsemantic consistency、shared traceability、plan更新は自動的に解決しない。これらは引き続integration ownerの単一責務とする。

## 7. Evolution rule

TypeScript scaffoldでは次を固定した。

- Node.js 24以上、npm、ESM、TypeScript 7.0系
- `npm ci`、`npm run build`、`npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run check:link`、`npm run check:package`、`npm run check`
- CIはNode.js 24で`npm run check`
- sourceは`src/`、test/fixtureは`test/`、生成物は`dist/`
- `node_modules/`、`dist/`、coverage、tsbuildinfoはGit管理外
- runtime dependencyは現時点で0。必要になった場合だけ追加判断する

AI設定だけが実装workflowより先に複雑化しないようにする。
