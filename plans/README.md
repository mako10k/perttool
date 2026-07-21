# Development plans

この directory は、`perttool` 自身の現在・未来の作業計画を `.pert` で管理するために使用する。

計画は粒度ごとに分離する。

- [mvp.pert](mvp.pert): MVP全体のmacro milestone、work package、resource日程
- [grammar.pert](grammar.pert): 現在のgrammar sliceを実装taskまで分解した詳細計画

両方ともread-only self-use gateを満たしており、`dsl check`、`dag analyze`、`dag next`の入力として使用する。`grammar.pert`はPointを基準値、velocity換算したdayを日程予測として自己利用する。Macro計画の`GRAMMAR_WORK_PACKAGE`は詳細計画のresource forecastをroll-upした値であり、日々のtask選択は`grammar.pert`を正とする。段階的なwrite解禁条件は[自己利用計画](../docs/process/self-use.md)を参照する。

規範仕様は `plans/` ではなく `docs/specs/` に置く。`plans/` は作業状態、Git history は過去を担当する。Macro milestoneは`mvp.pert`、現在sliceの実装状態は対応する詳細planへ記録し、同じtaskを両方で個別管理しない。Stage 1では手作業で編集し、perttoolによるwriteは行わない。
