# perttool 自己利用計画

- 文書状態: Active Stage 1 / Revision 0.9
- 作成日: 2026-07-21
- 関連設計: [../basic-design.md](../basic-design.md)

## 1. 目的

`perttool` が最低限の read-only 機能を備えた段階から、`perttool` 自身の開発管理に使用する。

最初の対象は DSL 文法の設計・実装作業とする。ただし、未完成の parser や formatter を正本へ無条件に適用する循環は避ける。

## 2. 正本の分離

| Artifact | 役割 | 正本 |
| --- | --- | --- |
| `docs/specs/dsl-grammar.md` | DSL の規範文法、EBNF、例、error policy | Markdown 文書 |
| `plans/mvp.pert` | MVP全体のmacro milestoneとwork package | `.pert` 文書 |
| `plans/grammar.pert` | 文法作業の現在・未来 DAG | `.pert` 文書 |
| `test/fixtures/grammar/` | parser が受理・拒否すべき具体例 | fixture/golden |
| Git history | 過去の計画、仕様、実装 | commit history |

`plans/grammar.pert` に EBNF そのものを埋め込んで規範仕様の代用にしない。

## 3. Stage 0: bootstrap（完了）

TypeScript CLI bootstrap、`dsl check`、`dag analyze`、`dag next`とbootstrap gateの検証を完了した。

Stage 0ではrequirementsとbasic designをMarkdownで管理し、grammar planを`.pert`で作成せず、toolがない状態を自己利用済みとはみなさなかった。

Exit criteria:

- `docs/specs/dsl-grammar.md` が実装可能な粒度に達する
- minimal valid/invalid fixture がレビューできる

## 4. Stage 1: read-only self-use

現在の段階。2026-07-21に開始条件を満たし、[MVP macro plan](../../plans/mvp.pert)と[grammar detail plan](../../plans/grammar.pert)をread-onlyの正本計画として使用する。

開始条件:

- `perttool dsl check <file>` が動く
- project、resource、milestone、task、gate を parse できる
- duplicate ID、undefined endpoint、self-loop、cycle、finish unreachable を検出できる
- `perttool dag analyze <file>` が expected、float、resource scheduleを計算できる
- `perttool dag next <file>` が active/ready/runnable_now/blocked_now/upcoming を返す
- text と JSON の fixture test が通る

開始時に実施した操作:

1. 手作業で `plans/grammar.pert` を作成した
2. `perttool dsl check plans/grammar.pert` を実行した
3. `perttool dag analyze plans/grammar.pert` を実行した
4. `perttool dag next plans/grammar.pert` を実行した
5. 3 commandを`npm run check:self-use`経由でCIのrequired checkへ追加した
6. check/analyze/nextのprojectionを[grammar golden](../../test/golden/self-use/grammar.expected.json)と[MVP golden](../../test/golden/self-use/mvp.expected.json)へ固定した

開始時の機械的な結果:

- precedence makespan: 8d
- resource-constrained makespan: 10d
- ready: `ERROR_RECOVERY`、`FIELD_FIXTURES`、`BLOCK_TEXT_SPANS`
- runnable_now: `ERROR_RECOVERY`、`BLOCK_TEXT_SPANS`
- `FIELD_FIXTURES`は`GRAMMAR_REVIEW` capacity 1を`ERROR_RECOVERY`が先に仮取得するためresource待ち

2026-07-21のPoint/velocity導入後、最初の対象である`plans/grammar.pert`を`duration_unit point`へ移行した。既存10d resource baselineを初期calibrationとして`velocity 10p/10d`を置き、PERT/CPMの基準値を8p/10p、velocity forecastを8d/10dとして分離してgoldenへ固定した。Velocityの変更履歴と将来の再calibrationはGitで追跡する。

同日に`ERROR_RECOVERY`を完了し、複数syntax error、phase suppression、diagnostic上限をfixture/CLI E2Eで固定した。完了taskは未実装のadvanceで安全に圧縮できるまで`done`で保持する。残計画はprecedence/resourceとも7p、velocity forecast 7dとなり、次の`FIELD_FIXTURES`と`BLOCK_TEXT_SPANS`は同時にrunnableである。

続いて`FIELD_FIXTURES`を完了し、project/resource/milestone/task/gateの全fieldを1つの正常fixtureで検査した。Identifier、string、duration、velocity、date、list、integer、enum、inline commentの異常fixtureと、missing/duplicate/field combinationの境界も独立入力へ固定した。仕様に存在した`PTDSL-011`の未到達を修正し、quoted string、tag list、block text内の`#`とinline commentを区別した。現在のrunnable taskは`BLOCK_TEXT_SPANS`だけである。

この段階で許可する操作:

- check
- analyze
- next
- CLI JSONによるcheck/analyze/next result
- Mermaid export が read-only で利用可能なら preview

この段階で禁止する操作:

- `format --write`
- `task ... --write`
- `milestone ... --write`
- `resource ... --write`
- `dag advance --write`

## 5. 最初の grammar plan

`plans/grammar.pert` は、作成時点で未完了の項目だけを含める。

想定する task group:

- lexical rule の確定
- indentation と block rule の確定
- identifier/string/comment rule の確定
- project/milestone/task/gate grammar の確定
- duration/estimate grammar の確定
- resource/capacity/requires/priority grammar の確定
- EBNF と sample の整合
- parser error recovery
- source span
- formatter round-trip
- help sample 同期

すでに完了している作業を履歴再現のためだけに追加しない。必要な過去情報は Git から参照する。

### 5.1 MVP macro planとの関係

`plans/mvp.pert`はM1からM6までのstage gateとwork packageだけを持つ。`GRAMMAR_WORK_PACKAGE`のdurationは`plans/grammar.pert`のresource makespanをroll-upするが、内部taskの状態を重複管理しない。

- macro milestoneと全体critical path: `mvp.pert`
- 現在の実装taskとresource待ち: `grammar.pert`
- grammar slice完了時にだけmacro taskをdoneへ更新し、次の詳細planへ切り替える

## 6. Stage 2: safe-write self-use

開始条件:

- formatter が idempotent
- comment、宣言順、block text を保持する regression test がある
- mutation が source span に対する局所 TextEdit を使う
- 変更後文書を再 parse・再検査する
- unified diff を preview できる
- atomic write がある
- expected digest による競合拒否がある
- `plans/grammar.pert` の round-trip golden test がある

追加で許可する操作:

- `dsl format --write`
- `task add|set|remove|finish --write`
- `milestone add|set|remove --write`
- `resource add|set|remove --write`

運用:

1. 必ず preview を先に取得する
2. diff が対象 task/milestone 以外へ広がっていないことを確認する
3. write 後に check/analyze/next を再実行する
4. `.pert` と対応する仕様・実装を同じ logical commit にまとめる

## 7. Stage 3: advance self-use

開始条件:

- done task を含む合流 fixture がある
- advance 前後の effective reached と ready set を比較する test がある
- 合流判定に必要な done task を保持する test がある
- 不要な過去 subgraph だけを削除する test がある
- rollback 可能な Git 運用が確認できる

追加で許可する操作:

- `dag advance --write`

advance 運用:

1. task を `done` にする
2. next/analyze で新しい reached closure を確認する
3. advance preview を確認する
4. 削除される task/milestone の一覧を確認する
5. write 後の ready set を確認する
6. Git commit する

## 8. Stage 4: 対象拡大

MVP macro planはStage 1から全体milestoneの確認に使用する。Grammar planで安定運用できた後、実装taskまで分解する詳細planを次の順に広げる。

1. graph semantics
2. PERT/CPM analyzer
3. mutation/advance
4. Mermaid conversion
5. perttool全体のMVP release plan
6. MVP後のMCP/LSP adapter

各 plan は現在・未来だけを持ち、完了部分は advance と Git history で管理する。

## 9. 障害時の扱い

### parser regression

- 先に grammar spec と fixture を確認する
- plan を parser bug に合わせて変更しない
- 直前の動作版で plan を check する
- fix 後に旧版と新版の結果差を記録する

### formatter/mutation regression

- write を停止する
- Git diff から意図しない変更を分離する
- source document を直前 commit から復元する
- regression fixture を追加してから再開する

### analysis regression

- next result を作業判断に使わない
- 手計算ではなく、既知の小さな golden graph と照合する
- expected、float、critical、ready のどの段階で差が出たか切り分ける

## 10. 自己利用の証跡

自己利用開始 commit では次を残す。

- bootstrap gate を満たした test 名
- `plans/grammar.pert`
- check/analyze/next の golden result
- CI command
- read-only で開始したこと

safe-write と advance を解禁する commit でも、それぞれの gate を満たした test と golden を残す。

Stage 1開始時の証跡:

- parser/check gate: `all normative examples parse and validate`、各invalid fixture diagnostic test、`resource requirements do not become precedence edges`
- analyze gate: precedence、capacity override、active allocation、resource witness、schedule critical pathを固定する`analysis.test.mjs`
- next gate: `parallel next selects a deterministic runnable subset`、classification/depth unit test、text/JSON CLI integration test
- self-use golden: grammar planとMVP planのcheck/analyze/next projection test
- Point self-use gate: grammar planの基準unit、velocity forecast unit、precedence/resource forecastをgoldenで分離して検査する
- field fixture gate: `all declaration fields parse from the grammar acceptance fixture`と各`grammar fixture ... reports only ...` testでfield/token境界を固定する
- CI entrypoint: `npm run check`から`npm run check:self-use`を実行し、両planを検査する
- write状態: Stage 1では全面禁止。Planの変更は手作業とGit diffで行う
