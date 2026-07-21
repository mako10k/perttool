# E2Eシナリオテスト

- 文書状態: Active 1.0
- 作成日: 2026-07-21
- 対象surface: `dsl help`、`dsl check`、`dag analyze`、`dag next`

## 1. 目的

利用者が作成した`.pert`文書を実際のCLI processへ渡し、文書検査、PERT/CPM分析、resource制約分析、次task判定までが一連の操作として成立することを確認する。

Core APIを直接呼ぶunit testとは分離し、`dist/cli.js`をsubprocessとして起動してexit code、stdout、stderr、JSON envelopeを検査する。

## 2. シナリオ

| ID | 利用場面 | 操作 | 主要な受け入れ条件 |
| --- | --- | --- | --- |
| E2E-001 | 初めて計画を作り、人数変更を比較する | help → check → analyze → next → capacity override | dependency上のreadyを維持したまま、capacity 1では1task、capacity 2では2taskがrunnableになる。Resource makespanは8dから5dへ変わる |
| E2E-002 | 実行中taskが排他resourceを占有している | check → analyze → next | active taskを別分類で返し、resource不要taskだけをrunnableにし、待機taskへactive occupantを示す |
| E2E-003 | 外部承認でblocked taskがある | check → analyze → next → warnings-as-errors | blocked_nowとupcomingを区別し、分析が外部block解消を条件とすることをwarningで明示する |
| E2E-004 | task完了を文書へ反映して再計算する | before/afterをcheck → analyze → next | done taskを候補から除外し、下流taskをreadyにし、残durationを5dから3dへ更新する。到達済み部分にはadvance案内を返す |
| E2E-005 | 不正なresource参照を安全に拒否する | check → analyze → next | 全commandがexit 1と同じstable diagnosticを返し、成功resultを出さない |

Fixtureは`test/fixtures/e2e/`へ置き、過去状態を正本計画へ混ぜず、before/afterを独立した入力として比較する。

## 3. 実行方法

E2Eだけを実行する。

```sh
npm run test:e2e
```

全repository checkでは同じE2Eが通常test suiteの一部として再実行される。

```sh
npm run check
```

## 4. MVP境界

MVPのwrite commandは未実装なので、E2E-004は利用者がGit管理下の文書を手作業で更新した前後を再計算する。Formatter、mutation、advance、Mermaid、MCPはこのE2E sliceの対象外とする。
