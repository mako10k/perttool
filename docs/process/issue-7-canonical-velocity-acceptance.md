# Issue #7 Canonical Velocity Acceptance

Date: 2026-08-21

## Accepted result

Issue #7 is corrected locally without automatic declared-velocity adoption.
One shared exact source utility parses integer, finite-Decimal, and fraction
point and period components. Generated velocity projections serialize the
positive reduced rate as `np/dh` or `np/dd`.

The reported `7200/827 point_per_hour` case now emits
`7200p/827h`. That token parses to the same Rational rate and is accepted by
the preview-first `project set --velocity` path. Existing valid source tokens
remain source-preserved unless an explicit formatter or projection owns their
display.

## Evidence

- `docs/process/issue-7-canonical-velocity-rca.think` passes `llmthink dsl
  audit` with no fatal, error, warning, info, or hint finding.
- Focused utility, observation, parser, formatter, mutation, CLI, Mermaid,
  editor, migration, and adapter tests pass.
- The complete Node.js 22 `npm run check` gate passes 1,222 tests, static
  duplication and complexity ratchets, 44 self-use plans, English and
  documentation checks, isolated LSP and MCP packages, the supported VS Code
  1.101.0 host workflow, temporary linking, and the 876-file isolated package
  workflow.
- Package dry-run and installed-package checks retain `perttool 0.10.2`, CLI
  Contract 9, and the existing public command, schema, and export identities.

## Preserved boundaries

Grammar-invalid signs, zero denominators, missing suffixes, and ambiguous
separators still fail closed. Lexically valid zero quantities still reach the
existing semantic `PTSEM-111` velocity constraint. The parser widening does
not round, infer, or mutate a declared velocity.

Release selection, version changes, remote writes, publication, npm dist-tag
movement, Issue #7 mutation, and plan advance remain separately authorized.
