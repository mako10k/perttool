# E2Eシナリオテスト

- 文書状態: Active 1.3
- 作成日: 2026-07-21
- 対象surface: `dsl help`、`dsl check`、`dsl format`、mutation、`dag analyze`、`dag next`

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
| E2E-006 | AIがPoint見積りとVelocity予測を利用する | help → check → analyze → next | PERT値をpで保持し、20p/10dのvelocity forecastをdayで別fieldに返す。Resource makespan 15pは7.5dになる |
| E2E-007 | 複数の構文errorをAIが修正する | check → analyze → next、diagnostic上限 | 独立errorをsource順で回収し、invalid blockの子行と後続semantic/graph diagnosticを抑制し、上限超過を明示する |
| E2E-008 | mutation previewを次のcommandへ渡す | task set preview → check | 再検査済みcandidateがvalidで、原本fileを変更しない |
| E2E-009 | 中間状態を作らずpathを置換する | atomic batch preview → analyze | connected milestone追加とtask置換を1 candidateで検査し、そのまま解析できる |
| E2E-010 | formatter previewを検査する | format preview → check → format --check | golden candidateがvalidかつidempotentで、原本fileを変更しない |
| E2E-011 | 検査済みcandidateを安全に保存して再解析する | grammar temporary copy format --write → check → analyze → next、mutation --write → check → analyze → next | grammar planのround-tripが原文へ一致し、write後のformatter/mutation documentを全read-only commandが受理する |

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

E2E-004はadvance未実装のため、利用者がGit管理下の文書を手作業で更新した前後を再計算する。Formatterとmutationはpreviewに加えて、一時directory内のcopyだけを`--write`して検査する。正本planはE2Eから変更しない。Advance、Mermaid、MCPはこのE2E sliceの対象外とする。
