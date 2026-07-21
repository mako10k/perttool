# perttool

PERT 線図を、Git 管理しやすい文書として記述・検査・分析するためのタスク管理CLI（実装bootstrap段階）。

現在はNode.js 24以上のTypeScript CLIとして実装中です。`dsl check`、`dsl help`、`dag analyze`が実装済みで、`dag next`、formatter、mutation、Mermaid変換はまだ未実装です。正本は次の文書です。

- [要件定義](docs/requirements.md)
- [基本設計](docs/basic-design.md)
- [DSL 文法仕様](docs/specs/dsl-grammar.md)
- [Graph Semantics 仕様](docs/specs/graph-semantics.md)
- [Analysis 仕様](docs/specs/analysis.md)
- [CLI Interface 仕様](docs/specs/interfaces.md)
- [Architecture Decision Records](docs/adr/0001-activity-on-arrow.md)
- [DSL サンプル](docs/examples/README.md)
- [自己利用計画](docs/process/self-use.md)
- [AI 開発ガイド](docs/process/ai-development.md)

基本方針は次のとおりです。

- Activity-on-Arrow とし、タスクを DAG のエッジ、マイルストーンをノードとして扱う
- 独自 DSL 文書をプロジェクト状態の正本とする
- PERT/CPM 計算と「次のタスク」の判定を機械的かつ決定的に行う
- 共有resourceのcapacityから排他実行と並列実行可能数を扱う
- Mermaid との相互変換、CLI、構造化ヘルプ、AI向けJSON操作導線を同じ共通コア上に提供する
- MVPはCLIをprimary interfaceとし、MCP/LSP adapterはMVP後に追加する
- 現行文書は現在と未来を表し、過去は Git 履歴で追跡する
- parser・check・analyze・next が安定した時点で、文法作業の計画から自己利用を開始する

Setupとrepository check:

```sh
npm ci
npm run check
```

現在のCLI bootstrap:

```sh
npm run build
node dist/cli.js --help
node dist/cli.js dsl check docs/examples/parallel.pert
node dist/cli.js dsl help syntax estimate --level detail --format json
node dist/cli.js dag analyze docs/examples/parallel.pert
node dist/cli.js dag analyze docs/examples/parallel.pert --capacity DEVELOPERS=3 --capacity TEST_ENV=2 --format json
```

`dag analyze`はexact RationalによるPERT/CPMと、renewable resource capacityを守る決定的な`parallel-sgs` scheduleを別resultとして返します。Resource scheduleは実行可能なheuristicであり、最適解とは表示しません。
