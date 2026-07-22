# perttool

PERT 線図を、Git 管理しやすい文書として記述・検査・分析するためのタスク管理CLI。

`v0.1.0-alpha.1`は公開開発プレビューです。現在のcheckoutでは`dsl check`、`dsl format`、`dsl help`、`dag analyze`、`dag next`、source-preservingなtask/milestone/resource/batch mutation、atomic `--write`、exclusive `--out`、`--expect-digest`が実装済みです。`dag advance`とMermaid変換はまだ未実装です。Node.js 24以上が必要で、pre-release中は互換性のない変更が入る可能性があります。

- [要件定義](docs/requirements.md)
- [基本設計](docs/basic-design.md)
- [DSL 文法仕様](docs/specs/dsl-grammar.md)
- [Graph Semantics 仕様](docs/specs/graph-semantics.md)
- [Analysis 仕様](docs/specs/analysis.md)
- [Mutation Semantics 仕様](docs/specs/mutation.md)
- [Mermaid Profile 仕様](docs/specs/mermaid-profile.md)
- [Recommendation Semantics 仕様](docs/specs/recommendation.md)
- [Recommendation Ranking Policy 仕様](docs/specs/recommendation-ranking.md)
- [Recommendation Reason Taxonomy 仕様](docs/specs/recommendation-reasons.md)
- [Recommendation Structured Explanation 仕様](docs/specs/recommendation-explanation.md)
- [Recommendation Interface Contract 仕様](docs/specs/recommendation-interface.md)
- [Recommendation Human Override Contract 仕様](docs/specs/recommendation-override.md)
- [Recommendation 規範例](docs/examples/recommendation.md)
- [Mermaid Profile 規範例](docs/examples/mermaid-profile.md)
- [Recommendation 実装・自己利用migration](docs/process/recommendation-migration.md)
- [Recommendation 設計受け入れレビュー](docs/process/recommendation-design-review.md)
- [CLI Interface 仕様](docs/specs/interfaces.md)
- [Architecture Decision Records](docs/adr/0001-activity-on-arrow.md)
- [DSL サンプル](docs/examples/README.md)
- [自己利用計画](docs/process/self-use.md)
- [MVPマイルストーン計画](plans/mvp.pert)
- [現在の文法作業計画](plans/grammar.pert)
- [AI工程制御設計計画](plans/control-plane.pert)
- [操作系M1-M4実装計画](plans/operations.pert)
- [AI 開発ガイド](docs/process/ai-development.md)

基本方針は次のとおりです。

- Activity-on-Arrow とし、タスクを DAG のエッジ、マイルストーンをノードとして扱う
- 独自 DSL 文書をプロジェクト状態の正本とする
- PERT/CPM 計算と「次のタスク」の判定を機械的かつ決定的に行う
- 相対見積り`p`を基準に保持し、明示したproject-wide velocityで`d`または`h`の予測へexact換算する
- 共有resourceのcapacityから排他実行と並列実行可能数を扱う
- Mermaid との相互変換、CLI、構造化ヘルプ、AI向けJSON操作導線を同じ共通コア上に提供する
- MVPはCLIをprimary interfaceとし、MCP/LSP adapterはMVP後に追加する
- 現行文書は現在と未来を表し、過去は Git 履歴で追跡する
- parser・check・analyze・next が安定した時点で、文法作業の計画から自己利用を開始する

## Install

現在はnpm registryへpublishしていません。GitHub Releaseのtarballからuser-owned npm prefixへ導入します。

```sh
npm install --global https://github.com/mako10k/perttool/releases/download/v0.1.0-alpha.1/perttool-0.1.0-alpha.1.tgz
perttool --version
```

ローカルcheckoutを開発中のNode.jsユーザー環境へlinkする場合:

```sh
git clone https://github.com/mako10k/perttool.git
cd perttool
npm ci
npm link
perttool --version
```

`prepare` lifecycleが`dist/`をbuildしてから、`perttool` binaryを現在のnpm global prefixへsymlinkします。System領域へsudoでinstallせず、NVMなどuser-ownedのnpm prefixを使用してください。解除はcheckoutで`npm unlink --global perttool`を実行します。

## Development

Setupとrepository check:

```sh
npm ci
npm run check
```

実CLI processを使うE2Eシナリオだけを実行する場合:

```sh
npm run test:e2e
```

## CLI examples

```sh
perttool --help
perttool dsl check docs/examples/parallel.pert
perttool dsl check PLAN.pert --max-diagnostics 20 --format json
perttool dsl format PLAN.pert --check
perttool dsl format PLAN.pert --diff
perttool dsl format PLAN.pert --write --expect-digest "$EXPECTED_DIGEST"
perttool dsl help syntax estimate --level detail --format json
perttool dsl help syntax velocity --level detail --format json
perttool dag analyze docs/examples/point-velocity.pert --format json
perttool dag analyze docs/examples/parallel.pert
perttool dag analyze docs/examples/parallel.pert --capacity DEVELOPERS=3 --capacity TEST_ENV=2 --format json
perttool dag next docs/examples/parallel.pert
perttool dag next docs/examples/parallel.pert --capacity DEVELOPERS=3 --format json
perttool task set docs/examples/minimal.pert WORK --status active --diff
perttool task set PLAN.pert WORK --status active --write --expect-digest "$EXPECTED_DIGEST"
perttool resource set docs/examples/parallel.pert TEST_ENV --capacity 2 --format json
perttool mutation apply docs/examples/minimal.pert --request changes.json --diff
perttool mutation apply PLAN.pert --request changes.json --out UPDATED.pert
```

`dag analyze`はexact RationalによるPERT/CPMと、renewable resource capacityを守る決定的な`parallel-sgs` scheduleを別resultとして返します。`duration_unit point`では`velocity 20p/10d`のように宣言し、基準のPoint値とday/hourの`velocity_forecast`を分離して返します。Resource scheduleは実行可能なheuristicであり、最適解とは表示しません。

`dag next`は依存関係上の`ready`と、active taskの占有を差し引いて同時開始できる`runnable_now`を分離します。開始できないready taskには不足resourceと占有task、upcoming taskには未充足依存の説明を返します。

`dsl format`とMutation commandは既定では検査済みcandidateをpreviewし、`--diff`ではunified diffを返します。`dsl format --check`は変更が必要なときだけexit 1です。Preview確認後は`--write`でinitial digestを再照合してatomic replaceし、`--expect-digest`でcaller lockを追加できます。`--out`は既存targetを上書きせず新規documentを作成します。`--format json`ではcandidate、diff、UTF-16 TextEdit、digest、write結果を同じresultへ含めます。

現在は[MVPマイルストーン計画](plans/mvp.pert)をmacro roadmap、[文法作業計画](plans/grammar.pert)、[AI工程制御設計計画](plans/control-plane.pert)、[操作系M1-M4実装計画](plans/operations.pert)を詳細planとするStage 2のpreview-first safe-write自己利用を行っています。Safe writeまで完了し、操作系の実測値は`18p/1d`、残るadvanceは6p、forecastは`1/3d`です。Macroのmakespanは12dで、次のmacro CPかつ`runnable_now`は`MERMAID_PROFILE`です。操作系の`ADVANCE_PLANNER`はreadyですが、macro `ADVANCE`は`REVIEWERS`競合で待機します。RecommendationとIssue #2のAI Agent Guidance RegistryはM3後に詳細化可能ですが、macro planへ追加するまでは着手順を推測しません。Issue #3のmulti-plan compositionはMVP後の将来構想です。

## Security and license

脆弱性は[Security Policy](SECURITY.md)に従って非公開で報告してください。本ソフトウェアは[MIT License](LICENSE)で公開します。変更履歴と既知の制約は[CHANGELOG](CHANGELOG.md)を参照してください。
