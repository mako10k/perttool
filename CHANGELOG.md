# Changelog

This project records its notable changes here. The format is based on [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/lang/ja/).

## [Unreleased]

### Changed

- Activated CLI Contract 3 as one breaking source-level cutover: `document
  check|format`, `guide`, and `batch apply` replace the Contract 2 `dsl` and
  `mutation` spellings; every CLI JSON envelope now identifies contract 3;
  command dispatch, validation, and text/JSON help share the active typed
  registry; and obsolete spellings fail with structured usage recovery.
- Promoted the accepted `perttool@0.1.0` beta to npm `latest` through an explicit post-release dist-tag operation. This changes the default install target without changing beta product maturity.
- Lowered the source and next-release runtime baseline from Node.js 24 to maintained Node.js 22, with CI coverage for Node.js 22 and 24.
- Reworked the root README as a user guide with `npx` and `npm exec` examples, and moved repository setup and verification to `docs/development.md`.
- Recorded the complete English-surface inventory, Unicode allowlist, CLI/LLM surface review, and the structured-help, project-init, and gate-mutation backlog.

### Added

- Public `help` command discovery, separate `guide` domain topics,
  preview-first `project init`, and direct source-preserving
  `gate add|set|remove` commands.

## [0.1.0] - 2026-07-23

First beta release. This suffix-free `0.x.x` series remains prerelease product maturity, permits intentional alpha incompatibility, and publishes through the npm `beta` dist-tag without moving `latest`.

### Added

- Read-only `agent help`, which exposes offline profiles for Codex, GitHub Copilot, Claude Code, Grok Build, and Antigravity from the same Core as index/quick/detail text/JSON
- `project show`, which retrieves complete project metadata including velocity as text/JSON; preview-first `project set` for localized updates; and `project.set` for atomic batches
- An explicit independent post-first-beta backlog for an LSP server, a VSIX with syntax highlighting/LSP client, and an MCP server

### Changed

- Defined the first beta as suffix-free `0.1.0` and subsequent `0.x.x` releases as beta, removing strict compatibility from alpha and additional soak time from the beta gate
- Added the read-only AI Agent Guidance Registry from Issue #2 to beta acceptance criteria and macro/detail plans
- Adopted English as the canonical repository language without i18n and added a phased, post-beta migration plan for legacy Japanese surfaces

## [0.1.0-alpha.2] - 2026-07-23

Second public development preview. Adds safe editing and advance operations, Mermaid round trips, and explainable task recommendations, and distributes the same artifact to GitHub Releases and npm's `alpha` tag.

### Added

- `dsl format`; atomic `--write` for task/milestone/resource/batch mutation; exclusive `--out`; and `--expect-digest`
- Semantic records, integrity digests, fail-closed import design contracts, and normative artifacts for `Perttool.MermaidProfile.v1`
- `exportMermaid` Core and lossless/plain profiles, analysis annotations, strict loss, and exclusive `--out` for `dag render --to mermaid`
- `importMermaid` Core and fail-closed profile restoration, plain loss reports, strict loss, and exclusive `--out` for `dag import --from mermaid`
- Pure `planAdvance` Core guaranteeing canonical keep/remove sets, partial joins, and idempotence, plus preview-first `dag advance` CLI
- Complete recommendation graph with exact typed facts, comparisons, decision traces, and canonical descriptions, plus the public `NextResultV3` Core type
- Recommendation shadow gate and golden tests that inspect the v3 contract, byte determinism, operational compatibility, and structured why-not across five self-use plans
- Read-only `validateOverride` Core returning feasible replacements, `PTOVR-101` through `PTOVR-106`, caller-asserted human reasons, normal-trace references, and deterministic `Perttool.OverrideDecision.v1`
- Shared instructions, help, and unknown-version safe-stop dry run that adopt complete, known `NextResult.v3` as the normal AI task-selection authority
- Package preflight that checks npm publish normalization, a maintainer script that fail-closed publishes the identical tarball, and fixed `alpha` dist-tag

### Changed

- Changed the default `dag next` JSON from `Perttool.NextResult.v2` to `Perttool.NextResult.v3` as a pre-release breaking change, publishing Core, CLI JSON/text, help, and package atomically
- Corrected `bin.perttool` to canonical `dist/cli.js` so npm does not remove the CLI entry point

## [0.1.0-alpha.1] - 2026-07-21

First public development preview. Intended to evaluate the DSL and CLI, read-only plan checking and analysis, and next-task selection. It is not a stable MVP and may include incompatible changes.

### Added

- Activity-on-Arrow DSL parser, semantic/graph validation, and multiple-error recovery
- PERT/CPM precedence analysis and critical-path enumeration using exact Rational values
- Deterministic `parallel-sgs` heuristic schedule handling renewable resource capacity
- Mechanical determination of `active`, `ready`, `runnable_now`, `blocked_now`, and `upcoming`
- Day/hour forecasts from point estimates and project-wide velocity
- Text/JSON CLI, structured help, stable diagnostic codes, and source spans
- CLI installation through `npm link` and GitHub Release tarballs

### Known limitations

- `dsl format`, task/milestone/resource mutation, and `dag advance` are unimplemented
- Mermaid import/export is unimplemented
- The resource schedule is a heuristic with `optimal=false`, not an exact optimum
- Not published to the npm registry; use the GitHub Release asset
- Requires Node.js 24 or later

[Unreleased]: https://github.com/mako10k/perttool/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mako10k/perttool/compare/v0.1.0-alpha.2...v0.1.0
[0.1.0-alpha.2]: https://github.com/mako10k/perttool/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/mako10k/perttool/releases/tag/v0.1.0-alpha.1
