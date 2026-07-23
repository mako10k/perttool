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

All seven plans pass the self-use gate and are used as inputs to `dsl check`, `dag analyze`, and `dag next`. Stage 3 permits preview-first editing and `dag advance` with an expected digest and post-write reanalysis. Detailed plans use Points as the analysis unit and velocity-converted days as forecasts. Select the macro workstream from `mvp.pert` before selecting a task from its detail plan.

2026-07-23にRecommendation detailの`FIXTURE_BASELINE` 2p、`RANKING_CORE` 4p、`EXPLANATION_CORE` 5p、`NEXT_V3_PUBLICATION` 4p、`SELF_USE_SHADOW` 2p、`OVERRIDE_VALIDATION` 3p、`AUTHORITY_ADOPTION` 2pを完了し、累計1 active dayからrecommendation固有の暫定実測Velocityを`22p/1d`へ更新した。Detailの残りは0pである。Macro `RECOMMENDATION_IMPLEMENTATION`と`RELEASE_E2E`も完了し、MVP public alphaを受け入れた。

同日に人間overrideで前倒ししたnpm publication preflightを、normal recommendationで選ばれた`RELEASE_E2E`から実行した。`v0.1.0-alpha.2`のversion/tag、GitHub asset、npm publish、registry installを同一tarballで検証し、MVP macroを完了した。

Issue #2 was included in the first beta and accepted after all five `agent-guidance.pert` tasks, totaling 22p, completed in one active day. The measured workstream velocity is `22p/1d`, and the detail plan has no remaining work. The operations velocity, including the explicitly advanced 5p `PROJECT_METADATA_CLI` task, is `29p/2d`.

The suffix-free `v0.1.0` beta was published and [accepted](../docs/process/beta-release-acceptance.md) on 2026-07-23. The macro plan is advanced to the reached `M8_BETA_RELEASED` frontier and has no remaining or recommended task. Issue #3, the LSP server, VSIX, and MCP server remain independent post-beta backlogs.

ADR 0004 adopts English as the canonical repository language without i18n. The `english-baseline.pert` detail plan contains eight migration tasks totaling 42p. Its precedence makespan is 29p, resource makespan is 32p, and provisional resource forecast is `64/29d`. The beta gate is reached, so `SURFACE_INVENTORY` is now ready, runnable, and recommended.

Velocityは初期見積りを固定し続けず、task完了commitのPointとAsia/Tokyoのactive date数からplanごとに再calibrationする。2026-07-22から23の実測値はgrammarが`3p/1d`、control-plane設計が`16p/1d`、操作系が`29p/2d`、recommendationが`22p/1d`、agent guidanceが`22p/1d`である。操作系以外はまだ1 active dayだけの暫定値であり、算定根拠とmacroの6 decimal day roundは[自己利用計画](../docs/process/self-use.md)を正とする。

規範仕様は `plans/` ではなく `docs/specs/` に置く。`plans/` は作業状態、Git history は過去を担当する。Macro milestoneは`mvp.pert`、現在sliceの設計・実装状態は対応する詳細planへ記録し、同じtaskを両方で個別管理しない。Stage 3のediting/advance write手順は[自己利用計画](../docs/process/self-use.md)を正とする。

[Issue #2](https://github.com/mako10k/perttool/issues/2)のAI Agent Guidance Registryは、Issue #1のrecommendation契約を各coding agentへ適用するbeta gateである。Read-only v1の範囲は`agent-guidance.pert`を正とし、audit、scaffold、hook実行、enforcementは含めない。[Issue #3](https://github.com/mako10k/perttool/issues/3)のbacklog階層・multi-plan compositionはbetaへ機能依存を追加しない独立した将来backlogとして保持する。
