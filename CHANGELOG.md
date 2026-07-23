# Changelog

このプロジェクトの主な変更を記録する。形式は[Keep a Changelog](https://keepachangelog.com/ja/1.1.0/)を参考にし、versionは[Semantic Versioning](https://semver.org/lang/ja/)に従う。

## [Unreleased]

### Added

- `dsl format`とtask/milestone/resource/batch mutationのatomic `--write`、exclusive `--out`、`--expect-digest`
- `Perttool.MermaidProfile.v1`のsemantic record、integrity digest、fail-closed import設計契約と規範artifact
- `exportMermaid` Coreと`dag render --to mermaid`のlossless/plain profile、解析annotation、strict loss、exclusive `--out`
- `importMermaid` Coreと`dag import --from mermaid`のfail-closed profile復元、plain loss report、strict loss、exclusive `--out`
- canonical keep/remove set、partial join、idempotenceを保証するpure `planAdvance` Coreとpreview-first `dag advance` CLI
- exact typed fact、comparison、decision trace、canonical descriptionを持つcomplete recommendation graphとpublic `NextResultV3` Core型
- 5つのself-use planでv3 contract、byte determinism、operational互換、structured why-notを検査するrecommendation shadow gateとgolden
- feasible replacement、`PTOVR-101`から`PTOVR-106`、caller-asserted human reason、normal trace reference、deterministic `Perttool.OverrideDecision.v1`を返すread-only `validateOverride` Core
- completeかつknownな`NextResult.v3`をnormal AI task selection authorityへ採用する共有指示、help、unknown-version safe stop dry-run
- npm publish normalizationを検査するpackage preflight、同一tarballをfail-closedでpublishするmaintainer script、`alpha` dist-tag固定

### Changed

- pre-release breaking changeとして`dag next`のdefault JSONを`Perttool.NextResult.v2`から`Perttool.NextResult.v3`へ変更し、Core、CLI JSON/text、help、packageをatomicに公開
- npmがCLI entrypointを除去しないよう`bin.perttool`をcanonicalな`dist/cli.js`へ修正

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
