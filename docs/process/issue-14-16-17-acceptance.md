# Issues #14, #16, and #17 Correction Acceptance

- Document status: Accepted 1.0
- Acceptance date: 2026-08-14
- Task: `RELEASE_093_CORRECTIONS`
- Target release: `0.9.3`
- Contract:
  [`contract8-emergency-corrections.md`](../specs/contract8-emergency-corrections.md)

## 1. Issue #14

The Contract 8 inspection wrapper now validates the complete Grammar 7 source,
inspects the offset-preserving Grammar 6 basis, and rebinds the result to the
exact original source digest and grammar version. The CLI facade and public
root keep the existing `Perttool.PlanAssuranceResult.v1` identity.

Focused acceptance covers file and stdin operands, task filtering,
`contract`, `computed-basis`, and `exported` hashes, equality with the same task
facts from `dag next`, invalid `PTMAC-*` failure, unchanged Grammar 6 behavior,
no source write, and the installed-package workflow.

## 2. Issues #16 and #17

The milestone-acceptance layer now owns its composition repair. It deduplicates
exact non-deletion edits and coalesces only overlapping pure deletions before
the unchanged shared `TextEdit` normalizer. It also splits Contract 7 deletion
ranges around criterion sets and receipts owned by a retained state-changed
milestone. Evidence contracts only with a removed milestone declaration, so a
later advance can still prove the retained milestone's accepted outcome.

The closed matrix covers both receipt-between-events and receipt-after-events
topologies, final newline present and absent, one and two separator blank
lines, and retained downstream event present and absent. Real CLI preview,
separate output, and clean tracked in-place write are byte-identical for both
topologies. Candidate validation returns source diagnostics instead of an
uncaught internal error.

The shared edit normalizer still rejects all overlaps presented to it. Issue
#9, Issue #11, repository-clean candidate, acceptance, assurance, governance,
history-loss, linked-worktree, BOM/CRLF, and race gates remain enforced.

## 3. Consumer replay and public identity

After the correction, unchanged read-only replays of image-platform commits
`627514d` and `651ab2b` both returned successful candidates with passed
milestone-acceptance and plan-assurance guards and no diagnostics. The current
Issue #14 source returned successful Grammar 7 `show` and `hash` projections.

Node.js 22 focused acceptance passed 35 tests. The built package still exposes
53 commands, 23 root schemas, 129 root and Node runtime exports, 45 Core
runtime exports, and reference identity between the root and Node facades
apart from the three established Contract 8 lifts.

Issues #16 and #17 were independently read back with `bug` and `priority:P0`
labels. Issue closure, release publication, npm dist-tag mutation, and plan
advance remain later release gates.
