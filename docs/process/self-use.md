# perttool 自己利用計画

- 文書状態: Draft 0.5
- 作成日: 2026-07-21
- 関連設計: [../basic-design.md](../basic-design.md)

## 1. 目的

`perttool` が最低限の read-only 機能を備えた段階から、`perttool` 自身の開発管理に使用する。

最初の対象は DSL 文法の設計・実装作業とする。ただし、未完成の parser や formatter を正本へ無条件に適用する循環は避ける。

## 2. 正本の分離

| Artifact | 役割 | 正本 |
| --- | --- | --- |
| `docs/specs/dsl-grammar.md` | DSL の規範文法、EBNF、例、error policy | Markdown 文書 |
| `plans/grammar.pert` | 文法作業の現在・未来 DAG | `.pert` 文書 |
| `tests/fixtures/grammar/` | parser が受理・拒否すべき具体例 | fixture/golden |
| Git history | 過去の計画、仕様、実装 | commit history |

`plans/grammar.pert` に EBNF そのものを埋め込んで規範仕様の代用にしない。

## 3. Stage 0: bootstrap

TypeScript CLI bootstrap、`dsl check`、`dag analyze`、`dag next`は揃った。bootstrap gateの検証と自己利用開始commitを完了するまではStage 0として扱う。

- requirements と basic design は Markdown で管理する
- grammar plan はまだ `.pert` で作成しない
- grammarの完全仕様とparser fixtureを拡充する
- tool がない状態で、自己利用済みとみなさない

Exit criteria:

- `docs/specs/dsl-grammar.md` が実装可能な粒度に達する
- minimal valid/invalid fixture がレビューできる

## 4. Stage 1: read-only self-use

開始条件:

- `perttool dsl check <file>` が動く
- project、resource、milestone、task、gate を parse できる
- duplicate ID、undefined endpoint、self-loop、cycle、finish unreachable を検出できる
- `perttool dag analyze <file>` が expected、float、resource scheduleを計算できる
- `perttool dag next <file>` が active/ready/runnable_now/blocked_now/upcoming を返す
- text と JSON の fixture test が通る

開始操作:

1. 手作業で `plans/grammar.pert` を作る
2. `perttool dsl check plans/grammar.pert` を実行する
3. `perttool dag analyze plans/grammar.pert` を実行する
4. `perttool dag next plans/grammar.pert` を実行する
5. 3 command を CI の required check に追加する
6. grammar 作業を始めるときに next result を確認する

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

grammar plan で安定運用できた後、次の順に自己利用対象を広げる。

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
