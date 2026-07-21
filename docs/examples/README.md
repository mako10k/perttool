# DSL examples

- [minimal.pert](minimal.pert): resourceを使わない最小の直線DAG
- [parallel.pert](parallel.pert): dependency上は並行可能なtask、capacity 2の担当枠、capacity 1の排他設備を含むDAG
- [advance-partial-before.pert](advance-partial-before.pert): done branchとactive branchが未到達milestoneへ合流するadvance前のDAG
- [advance-partial-after.pert](advance-partial-after.pert): 過去edgeだけを削除し、合流に必要なdone taskを保持したcanonical advance結果

これらはgrammar version 1とsemantics version 1の規範サンプルであり、parser/analyzer実装後は同じ内容をfixture/golden testから検証する。

`parallel.pert` のexpected durationに対する初期heuristicの期待値:

| DEVELOPERS | TEST_ENV | Makespan |
| ---: | ---: | ---: |
| 2 | 1 | 8d |
| 3 | 1 | 7d |
| 2 | 2 | 7d |
| 3 | 2 | 6d |

resourceを無視したprecedence lower boundは6dである。既定capacityでは、時刻0に`CORE`と`CLI`を開始し、`DOCS`は担当枠待ちになる。統合後は`TEST`をpriorityで先に開始し、`PACKAGE`は排他試験環境待ちになる。この表をcapacity what-if分析のgolden expectationとして使用する。

`advance-partial-before.pert`からcanonical advanceを1回実行した結果は、`advance-partial-after.pert`と意味的に一致する。`BRANCH_A`はtargetの`A_DONE`が到達済みなので除去される。一方、done状態の`A_JOIN_WORK`は未到達`JOINED`の合流条件なので保持される。
