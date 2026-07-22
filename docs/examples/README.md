# DSL examples

- [minimal.pert](minimal.pert): resourceを使わない最小の直線DAG
- [pert-estimate.pert](pert-estimate.pert): 三点見積りのexact expected/varianceを確認する直線DAG
- [point-velocity.pert](point-velocity.pert): Pointを基準にPERT計算し、project-wide velocityでday予測を得る並行DAG
- [parallel.pert](parallel.pert): dependency上は並行可能なtask、capacity 2の担当枠、capacity 1の排他設備を含むDAG
- [advance-partial-before.pert](advance-partial-before.pert): done branchとactive branchが未到達milestoneへ合流するadvance前のDAG
- [advance-partial-after.pert](advance-partial-after.pert): 過去edgeだけを削除し、合流に必要なdone taskを保持したcanonical advance結果
- [recommendation.md](recommendation.md): AI工程制御のranking、resource conflict、構造化説明、human overrideの規範caseとtest観点
- [mermaid-profile.md](mermaid-profile.md): lossless `%% perttool:` semantic record、digest、projection、negative caseの規範例

`.pert` fileはgrammar version 1、semantics version 1、analysis version 1の規範サンプルである。`recommendation.md`は未実装のRecommendation interface version 1へ向けた規範caseである。`mermaid-profile.md`はMermaid adapterのwire contractとexport goldenであり、`exportMermaid`と`dag render --to mermaid`のbyte出力をtestで固定する。Importのnegative caseは後続sliceで展開する。

`pert-estimate.pert`では`DESIGN`のexpectedは`13/6d`、varianceは`1/4d^2`である。`BUILD`を含むprecedence makespanは`31/6d`、代表critical task列は`[DESIGN, BUILD]`になる。

`point-velocity.pert`では基準値のprecedence makespanは`10p`、capacity 1でのresource makespanは`15p`である。`velocity 20p/10d`によるforecastはそれぞれ`5d`、`7.5d`となる。基準値とforecastはCLI JSONで別fieldとして返す。

`parallel.pert` のexpected durationに対する初期heuristicの期待値:

| DEVELOPERS | TEST_ENV | Makespan | Resource arcs | Schedule-critical tasks |
| ---: | ---: | ---: | --- | --- |
| 2 | 1 | 8d | `CLI -> DOCS`, `TEST -> PACKAGE` | `CLI, DOCS, TEST, PACKAGE` |
| 3 | 1 | 7d | `TEST -> PACKAGE` | `CORE, TEST, PACKAGE` |
| 2 | 2 | 7d | `CLI -> DOCS` | `CLI, DOCS, TEST` |
| 3 | 2 | 6d | none | `CORE, TEST` |

resourceを無視したprecedence lower boundは6dである。既定capacityでは、時刻0に`CORE`と`CLI`を開始し、`DOCS`は担当枠待ちになる。統合後は`TEST`をpriorityで先に開始し、`PACKAGE`は排他試験環境待ちになる。この表をcapacity what-if分析のgolden expectationとして使用する。

`advance-partial-before.pert`からcanonical advanceを1回実行した結果は、`advance-partial-after.pert`と意味的に一致する。`BRANCH_A`はtargetの`A_DONE`が到達済みなので除去される。一方、done状態の`A_JOIN_WORK`は未到達`JOINED`の合流条件なので保持される。
