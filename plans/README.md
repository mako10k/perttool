# Development plans

この directory は、`perttool` 自身の現在・未来の作業計画を `.pert` で管理するために使用する。

最初の計画は[grammar.pert](grammar.pert)である。Read-only self-use gateを満たしているため、`dsl check`、`dag analyze`、`dag next`の入力として使用する。段階的なwrite解禁条件は[自己利用計画](../docs/process/self-use.md)を参照する。

規範仕様は `plans/` ではなく `docs/specs/` に置く。`plans/` は作業状態、Git history は過去を担当する。Stage 1では手作業で編集し、perttoolによるwriteは行わない。
