# perttool

PERT 線図を、Git 管理しやすい文書として記述・検査・分析するためのタスク管理ツール（構想段階）。

現在は基本設計フェーズです。正本は次の文書です。

- [要件定義](docs/requirements.md)
- [基本設計](docs/basic-design.md)
- [DSL 文法仕様](docs/specs/dsl-grammar.md)
- [Graph Semantics 仕様](docs/specs/graph-semantics.md)
- [Analysis 仕様](docs/specs/analysis.md)
- [DSL サンプル](docs/examples/README.md)
- [自己利用計画](docs/process/self-use.md)
- [AI 開発ガイド](docs/process/ai-development.md)

基本方針は次のとおりです。

- Activity-on-Arrow とし、タスクを DAG のエッジ、マイルストーンをノードとして扱う
- 独自 DSL 文書をプロジェクト状態の正本とする
- PERT/CPM 計算と「次のタスク」の判定を機械的かつ決定的に行う
- 共有resourceのcapacityから排他実行と並列実行可能数を扱う
- Mermaid との相互変換、CLI、構造化ヘルプ、AI/MCP 操作導線を同じ共通コア上に提供する
- 現行文書は現在と未来を表し、過去は Git 履歴で追跡する
- parser・check・analyze・next が安定した時点で、文法作業の計画から自己利用を開始する

現在のrepository checkは次で実行できます。

```sh
bash scripts/check-docs.sh
```
