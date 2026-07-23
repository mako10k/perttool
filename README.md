# perttool

PERT 線図を、Git 管理しやすい文書として記述・検査・分析するためのタスク管理CLI。

`v0.1.0-alpha.2`は公開開発プレビューです。`dsl check`、`dsl format`、`dsl help`、`dag analyze`、`dag next`、`dag advance`、`dag render --to mermaid`、`dag import --from mermaid`、source-preservingなtask/milestone/resource/batch mutation、atomic `--write`、exclusive `--out`、`--expect-digest`を実装済みです。`dag next`はcompleteなrecommendation graphを持つ`Perttool.NextResult.v3`を返し、public Core型とCLI JSON/text/helpを同じ判断へ接続します。Node.js 24以上が必要で、pre-release中は互換性のない変更が入る可能性があります。

次のreleaseはsuffixなし`0.1.0`で、`0.x.x`系列をbetaと定義します。Alphaからbetaへのstrict compatibilityは保証せず、Issue #2のread-only AI Agent Guidance Registryをbeta gateへ含めます。現在公開済みのversionは引き続き`v0.1.0-alpha.2`であり、betaはまだpublishしていません。

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
- [NextResult.v3 consumer migration guide](docs/process/next-v3-consumer-migration.md)
- [Recommendation 設計受け入れレビュー](docs/process/recommendation-design-review.md)
- [MVP release readiness監査](docs/process/mvp-release-readiness.md)
- [Beta versioning ADR](docs/adr/0003-beta-versioning.md)
- [Beta release手順](docs/process/beta-release.md)
- [CLI Interface 仕様](docs/specs/interfaces.md)
- [Architecture Decision Records](docs/adr/0001-activity-on-arrow.md)
- [DSL サンプル](docs/examples/README.md)
- [自己利用計画](docs/process/self-use.md)
- [MVPからbetaへのmacro計画](plans/mvp.pert)
- [現在の文法作業計画](plans/grammar.pert)
- [AI工程制御設計計画](plans/control-plane.pert)
- [操作系M1-M4実装計画](plans/operations.pert)
- [Recommendation実装計画](plans/recommendation.pert)
- [AI Agent Guidance実装計画](plans/agent-guidance.pert)
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

公開開発プレビューはnpm registryの`alpha` dist-tagとGitHub prereleaseから導入できます。Maintainer向けの安全境界は[npm publication手順](docs/process/npm-publication.md)を参照してください。

```sh
npm install --global perttool@alpha
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
perttool dag advance docs/examples/advance-partial-before.pert --diff
perttool dag advance PLAN.pert --write --expect-digest "$EXPECTED_DIGEST"
perttool dag render docs/examples/parallel.pert --to mermaid --analysis both
perttool dag render docs/examples/parallel.pert --to mermaid --analysis resource --capacity TEST_ENV=2 --out parallel.mmd
perttool dag import parallel.mmd --from mermaid
perttool dag import parallel.mmd --from mermaid --strict-loss --out parallel.pert
perttool task set docs/examples/minimal.pert WORK --status active --diff
perttool task set PLAN.pert WORK --status active --write --expect-digest "$EXPECTED_DIGEST"
perttool resource set docs/examples/parallel.pert TEST_ENV --capacity 2 --format json
perttool mutation apply docs/examples/minimal.pert --request changes.json --diff
perttool mutation apply PLAN.pert --request changes.json --out UPDATED.pert
```

`dag analyze`はexact RationalによるPERT/CPMと、renewable resource capacityを守る決定的な`parallel-sgs` scheduleを別resultとして返します。`duration_unit point`では`velocity 20p/10d`のように宣言し、基準のPoint値とday/hourの`velocity_forecast`を分離して返します。Resource scheduleは実行可能なheuristicであり、最適解とは表示しません。

`dag next`は依存関係上の`ready`、既存schedulerが選ぶ`runnable_now`、工程authorityであるroot `recommendation`を分離します。JSONは全ready taskのtier、exact typed fact、comparison、decision trace、canonical descriptionをcomplete graphとして返し、textは4 tierの`complete=false` summaryとJSON導線を返します。開始できないready taskには不足resourceと占有task、upcoming taskには未充足依存の説明も従来どおり保持します。Consumerは[移行ガイド](docs/process/next-v3-consumer-migration.md)に従い、`schema_version`を最初に検査します。

既存5 planのshadowとMIG-07 safe-stop dry-runを経て、knownかつcompleteな`NextResult.v3`をperttool開発のnormal AI task selection authorityへ採用しました。現在はagent-guidance planを加えた6 planを検証対象とします。Macro recommendationからworkstreamを選んでdetailを再解析し、unknown version、incomplete trace、`PTREC-*`、deferred/discouraged selectionでは開始せず停止します。

Public libraryの`validateOverride`はcompleteな`NextResultV3`と明示的なhuman requestから、normal recommendationを変更せずdeterministicな`Perttool.OverrideDecision.v1`を生成します。これはread-only validationであり、task state、file、Git、networkを変更しません。Override applyとaudit writeのCLIは未実装です。

`dag advance`はeffective reachedより過去のtask/gate/milestoneだけを除去し、未到達joinに必要なdone taskとsatisfied gateを保持します。既定はcandidate previewで、削除entityとfrontier/readyの前後比較をtext/JSONへ含めます。`--write`、`--out`、`--expect-digest`は他のediting commandと同じsafe-write経路を使います。

`dag render --to mermaid`は既定でlosslessな`Perttool.MermaidProfile.v1`をstdoutへ生成します。`--analysis`でprecedence/resource解析値をprojectionへ注記でき、`--out`は既存targetを上書きしません。`--profile plain`はsemantic metadataを持たないため`PTCNV-206`を返し、`--strict-loss`でartifactを拒否できます。

`dag import --from mermaid`はperttool profileのcanonical JSON、record順、metadata/projection digest、semantic model、projection対応をfail-closedで検査し、canonical DSLをpreviewします。Plain Mermaidはstable generated IDとloss reportを返す限定best-effortで、`--strict-loss`はlossy candidateと`--out`を拒否します。

`dsl format`とMutation commandは既定では検査済みcandidateをpreviewし、`--diff`ではunified diffを返します。`dsl format --check`は変更が必要なときだけexit 1です。Preview確認後は`--write`でinitial digestを再照合してatomic replaceし、`--expect-digest`でcaller lockを追加できます。`--out`は既存targetを上書きせず新規documentを作成します。`--format json`ではcandidate、diff、UTF-16 TextEdit、digest、write結果を同じresultへ含めます。

現在は[MVPからbetaへのmacro計画](plans/mvp.pert)をroadmapとするStage 3のpreview-first自己利用を行っています。MVP public alphaは受け入れ済みで、Issue #2のread-only AI Agent Guidance Registryをbeta gateへ追加しました。Macroのrecommended work packageは`AGENT_GUIDANCE_IMPLEMENTATION`、[詳細plan](plans/agent-guidance.pert)のrecommended taskは`PROVIDER_BASELINE`です。詳細22pはrecommendation実績`22p/1d`を初期値として1d、beta release E2Eはalpha release実績から1dとし、betaまでのresource makespanは2dです。Issue #3のmulti-plan compositionはbeta blockerに含めません。

## Security and license

脆弱性は[Security Policy](SECURITY.md)に従って非公開で報告してください。本ソフトウェアは[MIT License](LICENSE)で公開します。変更履歴と既知の制約は[CHANGELOG](CHANGELOG.md)を参照してください。
