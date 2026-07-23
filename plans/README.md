# Development plans

この directory は、`perttool` 自身の現在・未来の作業計画を `.pert` で管理するために使用する。

計画は粒度ごとに分離する。

- [mvp.pert](mvp.pert): MVPからbetaまでのmacro milestone、work package、resource日程
- [grammar.pert](grammar.pert): 現在のgrammar sliceを実装taskまで分解した詳細計画
- [control-plane.pert](control-plane.pert): [Issue #1](https://github.com/mako10k/perttool/issues/1)のAI工程制御設計を完了条件まで分解した詳細計画
- [operations.pert](operations.pert): formatter preview、mutation preview、safe write、advanceを実ファイル境界とnarrow testへ分解したM1-M4詳細計画
- [recommendation.pert](recommendation.pert): MIG-01からMIG-07のrecommendation実装、shadow、normal authority adoptionを分解した詳細計画
- [agent-guidance.pert](agent-guidance.pert): [Issue #2](https://github.com/mako10k/perttool/issues/2)のprovider baseline、common contract、Core、`agent help`、beta受け入れを分解した詳細計画

6計画ともself-use gateを満たしており、`dsl check`、`dag analyze`、`dag next`の入力として使用する。Stage 3ではediting commandと`dag advance`をpreview-first、expected digest、write後再解析の手順で正本へ適用できる。詳細planはPointを基準値、velocity換算したdayを日程予測として自己利用する。Macro計画のwork packageは対応する詳細planのresource forecastをroll-upし、日々のtask選択では先に`mvp.pert`でworkstreamを選び、その後に対応する詳細planを参照する。段階的なwrite解禁条件は[自己利用計画](../docs/process/self-use.md)を参照する。

2026-07-23にRecommendation detailの`FIXTURE_BASELINE` 2p、`RANKING_CORE` 4p、`EXPLANATION_CORE` 5p、`NEXT_V3_PUBLICATION` 4p、`SELF_USE_SHADOW` 2p、`OVERRIDE_VALIDATION` 3p、`AUTHORITY_ADOPTION` 2pを完了し、累計1 active dayからrecommendation固有の暫定実測Velocityを`22p/1d`へ更新した。Detailの残りは0pである。Macro `RECOMMENDATION_IMPLEMENTATION`と`RELEASE_E2E`も完了し、MVP public alphaを受け入れた。

同日に人間overrideで前倒ししたnpm publication preflightを、normal recommendationで選ばれた`RELEASE_E2E`から実行した。`v0.1.0-alpha.2`のversion/tag、GitHub asset、npm publish、registry installを同一tarballで検証し、MVP macroを完了した。

Issue #2を最初のbetaへ含め、`agent-guidance.pert`の5 task全22pとmacro `AGENT_GUIDANCE_IMPLEMENTATION`、`BETA_RELEASE_E2E` 1dを追加した。2026-07-23に全5 taskを1 active dayで完了し、[受け入れ記録](../docs/process/agent-guidance-acceptance.md)を固定して実測Velocityを`22p/1d`へ補正した。Detail planはadvance済みで残作業0pである。同日、利用者の明示指示で操作系`PROJECT_METADATA_CLI` 5pを先行完了し、操作系累計29p/2 active day、実測Velocity`29p/2d`へ補正した。MacroもM7のreached frontierまでadvanceし、唯一のready、`runnable_now`、recommended taskは`BETA_RELEASE_E2E`、precedence/resource makespanは1dである。Issue #3、LSP server、VSIX、MCP serverはbeta blockerに含めない。

Velocityは初期見積りを固定し続けず、task完了commitのPointとAsia/Tokyoのactive date数からplanごとに再calibrationする。2026-07-22から23の実測値はgrammarが`3p/1d`、control-plane設計が`16p/1d`、操作系が`29p/2d`、recommendationが`22p/1d`、agent guidanceが`22p/1d`である。操作系以外はまだ1 active dayだけの暫定値であり、算定根拠とmacroの6 decimal day roundは[自己利用計画](../docs/process/self-use.md)を正とする。

規範仕様は `plans/` ではなく `docs/specs/` に置く。`plans/` は作業状態、Git history は過去を担当する。Macro milestoneは`mvp.pert`、現在sliceの設計・実装状態は対応する詳細planへ記録し、同じtaskを両方で個別管理しない。Stage 3のediting/advance write手順は[自己利用計画](../docs/process/self-use.md)を正とする。

[Issue #2](https://github.com/mako10k/perttool/issues/2)のAI Agent Guidance Registryは、Issue #1のrecommendation契約を各coding agentへ適用するbeta gateである。Read-only v1の範囲は`agent-guidance.pert`を正とし、audit、scaffold、hook実行、enforcementは含めない。[Issue #3](https://github.com/mako10k/perttool/issues/3)のbacklog階層・multi-plan compositionはbetaへ機能依存を追加しない独立した将来backlogとして保持する。
