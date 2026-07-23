# ADR 0004: English repository baseline without i18n

- Status: Accepted
- Date: 2026-07-23

## Context

The primary consumers of `perttool` are expected to be LLM-based coding agents. A single canonical language makes repository guidance, public help, diagnostics, specifications, plans, and test expectations easier for those agents to discover and compare deterministically.

The repository already mixes English machine contracts with Japanese prose. Translating every existing surface in one release change would reopen unrelated accepted contracts and a large set of byte-level golden fixtures. The first suffix-free beta also has a previously accepted release scope and is the current critical-path task.

## Decision

- English is the canonical language for repository-maintained artifacts.
- New or substantively modified repository prose uses English.
- Public bundled help and diagnostic messages migrate to English in explicit, reviewable slices.
- Stable command names, DSL keywords, JSON fields, enum values, diagnostic codes, reason codes, and schema identifiers remain the machine authority. Natural-language messages do not become a machine contract.
- Runtime locale selection, `--locale`, translation catalogs, gettext-style infrastructure, and environment-dependent localization are not implemented.
- User-authored `.pert` content and Unicode fixture data are preserved and are not automatically translated.
- The language used to communicate with a human is independent from the repository baseline. Agents may answer a Japanese-speaking user in Japanese while keeping tracked artifacts in English.
- Existing Japanese repository content is migration debt tracked by `plans/english-baseline.pert`.
- The migration starts after the first beta release. It does not change the accepted `BETA_RELEASE_E2E` scope or extend `plans/mvp.pert` beyond its beta finish.

## Consequences

- A touched file is not required to be translated wholesale when that would make the change incoherent. Newly added or substantively rewritten prose must be English, while untouched legacy Japanese remains visible migration debt.
- Translation changes must preserve normative meaning, stable machine identifiers, schema shape, source-preserving behavior, and Unicode round-trip coverage.
- The migration requires an explicit inventory, focused runtime/help/documentation slices, a Unicode allowlist, and a final repository-level acceptance check.
- If localization becomes a product requirement later, it requires a separate requirement and architecture decision rather than being inferred from this migration.
