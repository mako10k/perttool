# Development plans

この directory は、`perttool` 自身の現在・未来の作業計画を `.pert` で管理するために使用する。

計画は粒度ごとに分離する。

- [mvp.pert](mvp.pert): MVPからbetaまでのmacro milestone、work package、resource日程
- [grammar.pert](grammar.pert): 現在のgrammar sliceを実装taskまで分解した詳細計画
- [control-plane.pert](control-plane.pert): [Issue #1](https://github.com/mako10k/perttool/issues/1)のAI工程制御設計を完了条件まで分解した詳細計画
- [operations.pert](operations.pert): formatter preview、mutation preview、safe write、advanceを実ファイル境界とnarrow testへ分解したM1-M4詳細計画
- [recommendation.pert](recommendation.pert): MIG-01からMIG-07のrecommendation実装、shadow、normal authority adoptionを分解した詳細計画
- [agent-guidance.pert](agent-guidance.pert): [Issue #2](https://github.com/mako10k/perttool/issues/2)のprovider baseline、common contract、Core、`agent help`、beta受け入れを分解した詳細計画
- [english-baseline.pert](english-baseline.pert): phased migration of repository-maintained prose, bundled help, diagnostics, current plans, and golden fixtures to the English baseline
- [cli-surface-reset.pert](cli-surface-reset.pert): independent post-beta plan that maps the human/LLM CLI review and its eight backlog items into design, implementation, breaking migration, and file-first acceptance
- [release-0.2.0.pert](release-0.2.0.pert): independent Contract 3 beta release plan covering the version decision, local preparation, candidate gate, authorized distribution, and durable acceptance

All nine plans pass the self-use gate and are used as inputs to `document check`, `dag analyze`, and `dag next`. Stage 3 permits preview-first editing and `dag advance` with an expected digest and post-write reanalysis. Detailed plans use Points as the analysis unit and velocity-converted days as forecasts. Select the macro workstream from `mvp.pert` before selecting a task from its detail plan. `cli-surface-reset.pert` and `release-0.2.0.pert` are explicitly requested independent post-beta plans and are not rolled up into the completed macro.

2026-07-23にRecommendation detailの`FIXTURE_BASELINE` 2p、`RANKING_CORE` 4p、`EXPLANATION_CORE` 5p、`NEXT_V3_PUBLICATION` 4p、`SELF_USE_SHADOW` 2p、`OVERRIDE_VALIDATION` 3p、`AUTHORITY_ADOPTION` 2pを完了し、累計1 active dayからrecommendation固有の暫定実測Velocityを`22p/1d`へ更新した。Detailの残りは0pである。Macro `RECOMMENDATION_IMPLEMENTATION`と`RELEASE_E2E`も完了し、MVP public alphaを受け入れた。

同日に人間overrideで前倒ししたnpm publication preflightを、normal recommendationで選ばれた`RELEASE_E2E`から実行した。`v0.1.0-alpha.2`のversion/tag、GitHub asset、npm publish、registry installを同一tarballで検証し、MVP macroを完了した。

Issue #2 was included in the first beta and accepted after all five `agent-guidance.pert` tasks, totaling 22p, completed in one active day. The measured workstream velocity is `22p/1d`, and the detail plan has no remaining work. The operations velocity, including the explicitly advanced 5p `PROJECT_METADATA_CLI` task, is `29p/2d`.

The suffix-free `v0.1.0` beta was published and [accepted](../docs/process/beta-release-acceptance.md) on 2026-07-23, then explicitly promoted so npm `beta` and `latest` both resolve to `0.1.0`. The macro plan is advanced to the reached `M8_BETA_RELEASED` frontier and has no remaining or recommended task. Issue #3, the LSP server, VSIX, and MCP server remain independent post-beta backlogs.

ADR 0004 adopts English as the canonical repository language without i18n. `SURFACE_INVENTORY` completed on 2026-07-24 and was advanced after its inventory and Unicode allowlist were recorded. The `english-baseline.pert` detail plan now contains seven remaining tasks totaling 40p. Its precedence makespan is 27p, resource makespan is 30p, first-sample velocity is `2p/1d`, and resource forecast is `15d`. `NORMATIVE_DOCS` is the current recommended task.

All nine `cli-surface-reset.pert` tasks, totaling 49p from `CONTRACT_V3_DESIGN` through `CLI_003_FILE_FIRST_ACCEPTANCE`, completed and advanced on 2026-07-24. The active source Contract 3 surface uses one typed registry for dispatch and help, separates domain guidance, provides structured usage recovery, exposes project initialization and direct gate maintenance, adds the contract version to every JSON envelope, rejects renamed Contract 2 spellings, and passes the complete isolated installed-package file-first workflow. The detail plan has no remaining or recommended task, and its cumulative plan-specific velocity is `49p/1d`. The published `0.1.0` package remains Contract 2 until a separately authorized release.

The `release-0.2.0.pert` gate selects suffix-free beta `0.2.0` for the first Contract 3 package. `RELEASE_020_GATE_DESIGN`, `RELEASE_020_PREPARATION`, and `RELEASE_020_CANDIDATE` completed and advanced through 2026-07-25. Package, lockfile, CLI, CHANGELOG, README, and release checks are aligned at `0.2.0`; the complete local gate passed; public identities were unused; and npm `beta=latest=0.1.0` was recorded. The user authorized the named Git force-update, annotated tag, GitHub prerelease, and npm `beta` batch while excluding `latest`. Two tasks and 8p remain; precedence and heuristic resource makespans are both 8p with no resource delay. The cumulative plan-specific velocity is `9p/2d`, and complete Next v3 recommends `RELEASE_020_DISTRIBUTION`.

Velocityは初期見積りを固定し続けず、task完了commitのPointとAsia/Tokyoのactive date数からplanごとに再calibrationする。2026-07-22から23の実測値はgrammarが`3p/1d`、control-plane設計が`16p/1d`、操作系が`29p/2d`、recommendationが`22p/1d`、agent guidanceが`22p/1d`である。操作系以外はまだ1 active dayだけの暫定値であり、算定根拠とmacroの6 decimal day roundは[自己利用計画](../docs/process/self-use.md)を正とする。

規範仕様は `plans/` ではなく `docs/specs/` に置く。`plans/` は作業状態、Git history は過去を担当する。Macro milestoneは`mvp.pert`、現在sliceの設計・実装状態は対応する詳細planへ記録し、同じtaskを両方で個別管理しない。Stage 3のediting/advance write手順は[自己利用計画](../docs/process/self-use.md)を正とする。

[Issue #2](https://github.com/mako10k/perttool/issues/2)のAI Agent Guidance Registryは、Issue #1のrecommendation契約を各coding agentへ適用するbeta gateである。Read-only v1の範囲は`agent-guidance.pert`を正とし、audit、scaffold、hook実行、enforcementは含めない。[Issue #3](https://github.com/mako10k/perttool/issues/3)のbacklog階層・multi-plan compositionはbetaへ機能依存を追加しない独立した将来backlogとして保持する。
