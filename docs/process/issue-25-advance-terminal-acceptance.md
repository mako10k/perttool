# Issue 25 Advance Terminal Acceptance

- Document status: Accepted focused correction 1.0
- Review date: 2026-08-26
- Issue: [#25](https://github.com/mako10k/perttool/issues/25)
- Release disposition: Required input to the next Planning Pool minor gate

## 1. Decision

Accept the narrow terminal-separator correction in the milestone-acceptance
Advance composition. When a retained final milestone criterion set and receipt
precede a maximal terminal sequence of removable Task and acceptance
declarations, every deletion in that sequence owns only its available blank
separator prefix. The first terminal deletion may consume the newly orphaned
separator after the retained receipt; later deletions start no earlier than the
preceding deletion ends.

This applies the existing ADV-002 ownership rule after milestone-acceptance
edits are composed. It does not globally trim the document, modify a retained
declaration, change the keep/remove set, weaken TextEdit normalization, or add
a force path.

## 2. Reproduction and root cause

The exact Issue source at commit
`1c3ce668c0e5f449baafebbba0420ee57abcc6a2` has source digest
`sha256:4438758308fbe698d56b7167f92f9611505434714b5d33a98fd7abc8458218d9`.
The previous Contract 10 candidate had digest
`sha256:ab190c5d03193f227d14955222103473d2f09e55f78b068e50405dd79f7547e2`
and ended in `LF LF`.

The base Advance deletion planner already applied ADV-002 to strict DAG,
assurance, and actual declarations. The milestone-acceptance composition then
preserved the final receipt and appended deletion edits for criterion sets and
receipts owned by removed milestones. Those edits were overlap-coalesced, but
the maximal terminal sequence did not reacquire separator ownership after the
preservation split. The retained receipt's separator therefore survived as a
blank physical line.

The corrected exact replay produces digest
`sha256:a8190fdf1c4f003c256286c8bb44a43c2c252ff617f0f96a64f28a2bd6faa553`
and ends in exactly one `LF`. Acceptance and assurance guards both remain
`passed`, and diagnostics remain empty.

## 3. Fixture and acceptance

[`issue-25-retained-final-acceptance.pert`](../../test/fixtures/issue-25-retained-final-acceptance.pert)
fixes the smaller regression topology. Its source digest is
`sha256:78dc3cc2a2e96b629b8a65e5ff03dddfda1000182d484ce5dc34d15ff7c72e69`.
The corrected candidate digest is
`sha256:df9a59549337642645d31770c351c18abb238e31137330515c23a163ef5abd1f`.

The focused gate proves:

- the retained Final milestone, criterion set, and receipt keep their content;
- the removable terminal Task and intermediate acceptance records disappear;
- the candidate ends in one line terminator and not a blank physical line;
- repeated Advance is byte-identical and has no edits;
- preview, separate output, and in-place write share one candidate and digest;
- milestone acceptance remains `passed`, assurance remains explicitly
  `not_applicable` for the small fixture, and in-place history safety remains
  `passed`; and
- `git diff --check -- plan.pert` exits zero for the written candidate.

The existing Issue #19, ADV-002 Core, destructive-range, and source-variant
tests remain passing. The exact Planning Pool replay separately proves the
assurance-passed composition.

Verification completed with:

```sh
npm run build
npm run check:static
node --test test/advance-clean-candidate-core.test.mjs \
  test/issue-19-advance-criterion-retention.test.mjs
```

The focused run passed all 10 tests. Static type, duplication, and complexity
gates passed.

The complete `npm test` command was also run but is not claimed as passing.
Current post-Advance `plans/planning-pool.pert` causes the already tracked
Issue #28 tests to reference removed declarations. Three isolated safe-write
mode assertions also fail because this environment's `os.tmpdir()` resolves to
the DrvFS path under `/mnt/c`, where a direct create-and-chmod probe reads back
mode `0777`. These failures reproduce outside the Issue #25 change and remain
explicit inputs to the later integration gate.

## 4. Boundary

This acceptance does not modify the already advanced
`plans/planning-pool.pert`, close an Issue, select a release version, create a
release candidate, push, publish, move an npm dist-tag, or advance the new
release-readiness plan. Complete repository and installed-package acceptance
remain later PERT tasks.
