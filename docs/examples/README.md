# DSL examples

- [minimal.pert](minimal.pert): resourceを使わない最小の直線DAG
- [parallel.pert](parallel.pert): dependency上は並行可能なtask、capacity 2の担当枠、capacity 1の排他設備を含むDAG

これらは grammar version 1 の規範サンプルであり、parser実装後は同じ内容をfixture/golden testから検証する。

`parallel.pert` のexpected durationに対する初期heuristicの期待値:

| DEVELOPERS | TEST_ENV | Makespan |
| ---: | ---: | ---: |
| 2 | 1 | 8d |
| 3 | 1 | 7d |
| 2 | 2 | 7d |
| 3 | 2 | 6d |

resourceを無視したprecedence lower boundは6dである。既定capacityでは、時刻0に`CORE`と`CLI`を開始し、`DOCS`は担当枠待ちになる。統合後は`TEST`をpriorityで先に開始し、`PACKAGE`は排他試験環境待ちになる。この表をcapacity what-if分析のgolden expectationとして使用する。
