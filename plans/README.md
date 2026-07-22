# Development plans

この directory は、`perttool` 自身の現在・未来の作業計画を `.pert` で管理するために使用する。

計画は粒度ごとに分離する。

- [mvp.pert](mvp.pert): MVP全体のmacro milestone、work package、resource日程
- [grammar.pert](grammar.pert): 現在のgrammar sliceを実装taskまで分解した詳細計画
- [control-plane.pert](control-plane.pert): [Issue #1](https://github.com/mako10k/perttool/issues/1)のAI工程制御設計を完了条件まで分解した詳細計画
- [operations.pert](operations.pert): formatter preview、mutation preview、safe write、advanceを実ファイル境界とnarrow testへ分解したM1-M4詳細計画

4計画ともself-use gateを満たしており、`dsl check`、`dag analyze`、`dag next`の入力として使用する。Stage 3ではediting commandと`dag advance`をpreview-first、expected digest、write後再解析の手順で正本へ適用できる。詳細planはPointを基準値、velocity換算したdayを日程予測として自己利用する。Macro計画のwork packageは対応する詳細planのresource forecastをroll-upし、日々のtask選択では先に`mvp.pert`でworkstreamを選び、その後に対応する詳細planを参照する。段階的なwrite解禁条件は[自己利用計画](../docs/process/self-use.md)を参照する。

2026-07-22時点でMermaid round-tripまで完了し、macroの残るprecedence/resource makespanはともに2d、resource delayは0dである。`RELEASE_E2E`が唯一のready、`runnable_now`、precedence/schedule critical work packageである。

Velocityは初期見積りを固定し続けず、task完了commitのPointとAsia/Tokyoのactive date数からplanごとに再calibrationする。2026-07-22時点の実測値はgrammarが`3p/1d`、control-plane設計が`16p/1d`、操作系がformatter/mutation preview 12p、safe write 6p、advance 6pの合計24pによる`24p/1d`である。いずれも1 active dayだけの暫定標本であり、次の同種task完了時にplan単位で再calibrationする。算定根拠、暫定性、macroの6 decimal day roundは[自己利用計画](../docs/process/self-use.md)を正とする。

規範仕様は `plans/` ではなく `docs/specs/` に置く。`plans/` は作業状態、Git history は過去を担当する。Macro milestoneは`mvp.pert`、現在sliceの設計・実装状態は対応する詳細planへ記録し、同じtaskを両方で個別管理しない。Stage 3のediting/advance write手順は[自己利用計画](../docs/process/self-use.md)を正とする。

[Issue #2](https://github.com/mako10k/perttool/issues/2)のAI Agent Guidance Registryは、Issue #1のrecommendation契約を各coding agentへ適用するための独立featureである。M1のfile ownership確認で設定した`M3_SAFE_WRITE_READY`の開始下限には到達したが、recommendationとIssue #2はmacro work package、duration、resourceを追加するまで着手順を推測しない。[Issue #3](https://github.com/mako10k/perttool/issues/3)のbacklog階層・multi-plan compositionはMVP操作系へ機能依存を追加しない独立した将来backlogとして保持する。
