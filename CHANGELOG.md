# Changelog

このプロジェクトの主な変更を記録する。形式は[Keep a Changelog](https://keepachangelog.com/ja/1.1.0/)を参考にし、versionは[Semantic Versioning](https://semver.org/lang/ja/)に従う。

## [Unreleased]

### Added

- `dsl format`とtask/milestone/resource/batch mutationのatomic `--write`、exclusive `--out`、`--expect-digest`
- `Perttool.MermaidProfile.v1`のsemantic record、integrity digest、fail-closed import設計契約と規範artifact

## [0.1.0-alpha.1] - 2026-07-21

最初の公開開発プレビュー。DSLとCLIの評価、read-onlyな計画検査・分析・次task選択を目的とする。stable MVPではなく、互換性のない変更が入る可能性がある。

### Added

- Activity-on-Arrow DSLのparser、semantic/graph validation、複数error recovery
- exact Rationalを使うPERT/CPM precedence分析とcritical path列挙
- renewable resource capacityを扱う決定的`parallel-sgs` heuristic schedule
- `active`、`ready`、`runnable_now`、`blocked_now`、`upcoming`の機械的判定
- Point見積りとproject-wide velocityによるday/hour forecast
- text/JSON CLI、構造化help、stable diagnostic codeとsource span
- `npm link`およびGitHub Release tarballによるCLI導入

### Known limitations

- `dsl format`、task/milestone/resource mutation、`dag advance`は未実装
- Mermaid import/exportは未実装
- Resource scheduleは`optimal=false`のheuristicであり、厳密最適解ではない
- npm registryには未公開。GitHub Release assetを使用する
- Node.js 24以上が必要

[0.1.0-alpha.1]: https://github.com/mako10k/perttool/releases/tag/v0.1.0-alpha.1
