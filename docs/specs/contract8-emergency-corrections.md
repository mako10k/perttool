# Contract 8 emergency correction contract

- Status: Accepted correction target
- Date: 2026-08-14
- Scope: GitHub Issues #14, #16, and #17
- Release target: compatible patch `0.9.3`

## Purpose

This contract restores behavior already required by Grammar 7 and CLI
Contract 8. It does not add a command, grammar construct, result identity,
schema, authority policy, or force boundary.

The correction has three inseparable public outcomes:

1. read-only plan-assurance inspection accepts a valid Grammar 7 source;
2. advance composition treats overlapping pure deletion edits as one exact
   deletion union; and
3. milestone-acceptance evidence contracts with removed milestone
   declarations and remains byte-valid with retained milestones changed to
   `state reached`.

## Grammar 7 plan-assurance inspection

`plan-assurance show` and `plan-assurance hash` must first parse the complete
Grammar 7 source through the milestone-acceptance source capability. For a
valid source they inspect the offset-preserving Grammar 6 basis used by the
other Contract 8 projections. The returned inspection remains
`Perttool.PlanAssuranceResult.v1`, but its `grammar_version` is `7` and its
`source_digest` is computed from the exact original Grammar 7 bytes.

Task filtering and the `contract`, `computed-basis`, and `exported` selectors
retain their current evaluator order and meanings. The filtered assurance
facts must equal the corresponding task facts in `dag next` for the same
source. Grammar 6 continues through its existing path. Invalid Grammar 7
acceptance records are reported as `PTMAC-*` diagnostics and cannot be hidden
by inspecting only the Grammar 6 basis.

Both commands remain read-only for file and stdin operands. They do not write
the source, inspect or mutate Git, use the network, or create an authority
decision.

## Advance edit composition

A `TextEdit` overlap is unambiguous only when every overlapping edit is a pure
deletion with an empty replacement. The Grammar 7 acceptance composition
layer may coalesce those ranges to their exact byte union before invoking the
shared normalizer. Shared edit normalization remains unchanged and continues
to reject every overlap presented to it, including:

- deletion overlap with an insertion or replacement;
- overlapping non-empty replacements; and
- multiple insertions at the same offset.

Coalescing changes neither the selected bytes nor the final candidate. It
allows the terminal-separator ownership selected by ADV-002 and a
milestone-acceptance record span to describe the same newline or declaration
without applying that deletion twice.

## Acceptance-record contraction

Every current `milestone_criterion_set` owned by a removed milestone and every
`milestone_acceptance_receipt` owned by those sets is removed from the same
candidate. A retained milestone changed to `state reached` keeps its criterion
set and receipts. If a Contract 7 deletion range crosses those Grammar 7
records, the composition layer splits that pure deletion around their exact
source spans. This preserves the accepted evidence needed when the retained
milestone is removed by a later advance and prevents an orphan receipt.

The acceptance guard still evaluates the exact pre-advance source before
canonical composition. Criterion satisfaction or waiver is not inferred, and
no force option bypasses it. Plan-assurance receipt synthesis and history-loss
proof remain later independent guards over the resulting candidate.

If the composed candidate is invalid, the operation returns the available
source diagnostics and a non-persistable result. It must not replace those
diagnostics with an uncaught internal-invariant error.

## Compatibility and exclusions

The correction retains:

- Grammar 7 and CLI Contract 8;
- all 53 commands, 23 root schemas, 129 root and Node runtime exports, and 45
  Core runtime exports;
- every active result and authority identity;
- Grammar 1 through 6 read compatibility;
- source-preserving preview, separate-output, and safe in-place write rules;
  and
- the Issue #9 and #11 terminal advance corrections.

It does not authorize direct changes to consumer plans, history loss, an npm
`latest` promotion, public VSIX publication, release-plan advance, or unrelated
feature work.

## Required evidence

Repository acceptance must include:

- file and stdin Grammar 7 `show` and all three `hash` selectors, plus an
  invalid-source failure and installed-package execution;
- receipt-between-events and receipt-after-events advance fixtures, with
  final-newline present and absent, one and two separator blank lines, and a
  retained downstream event variant;
- preview, `--out`, and clean tracked `--write` byte identity for both advance
  topologies;
- direct replay of the two reported image-platform revisions without modifying
  that repository; and
- the complete Node.js 22 repository, package, documentation, static-analysis,
  and release-artifact gates before publication.
