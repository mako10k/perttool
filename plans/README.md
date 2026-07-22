# Development plans

この directory は、`perttool` 自身の現在・未来の作業計画を `.pert` で管理するために使用する。

計画は粒度ごとに分離する。

- [mvp.pert](mvp.pert): MVP全体のmacro milestone、work package、resource日程
- [grammar.pert](grammar.pert): 現在のgrammar sliceを実装taskまで分解した詳細計画
- [control-plane.pert](control-plane.pert): [Issue #1](https://github.com/mako10k/perttool/issues/1)のAI工程制御設計を完了条件まで分解した詳細計画
- [operations.pert](operations.pert): formatter preview、mutation preview、safe write、advanceを実ファイル境界とnarrow testへ分解したM1-M4詳細計画

4計画ともread-only self-use gateを満たしており、`dsl check`、`dag analyze`、`dag next`の入力として使用する。詳細planはPointを基準値、velocity換算したdayを日程予測として自己利用する。Macro計画のwork packageは対応する詳細planのresource forecastをroll-upし、日々のtask選択では先に`mvp.pert`でworkstreamを選び、その後に対応する詳細planを参照する。段階的なwrite解禁条件は[自己利用計画](../docs/process/self-use.md)を参照する。

Velocityは初期見積りを固定し続けず、task完了commitのPointとAsia/Tokyoのactive date数からplanごとに再calibrationする。2026-07-22時点の実測値はgrammarが`3p/1d`、control-plane設計が`16p/1d`である。操作系は完了標本がないため、近い実装作業であるgrammarの`3p/1d`を初期値として暫定継承し、最初の操作系task完了後に独立再calibrationする。算定根拠と暫定性は[自己利用計画](../docs/process/self-use.md)を正とする。

規範仕様は `plans/` ではなく `docs/specs/` に置く。`plans/` は作業状態、Git history は過去を担当する。Macro milestoneは`mvp.pert`、現在sliceの設計・実装状態は対応する詳細planへ記録し、同じtaskを両方で個別管理しない。Stage 1では手作業で編集し、perttoolによるwriteは行わない。

[Issue #2](https://github.com/mako10k/perttool/issues/2)のAI Agent Guidance Registryは、Issue #1のrecommendation契約を各coding agentへ適用するための独立featureである。M1のfile ownership確認ではrecommendationとIssue #2が操作系と`src/cli.ts`、`src/index.ts`、reviewerを共有するため、`M3_SAFE_WRITE_READY`より前には並行実装しない。[Issue #3](https://github.com/mako10k/perttool/issues/3)のbacklog階層・multi-plan compositionはMVP操作系へ機能依存を追加しない独立した将来backlogとして保持する。
