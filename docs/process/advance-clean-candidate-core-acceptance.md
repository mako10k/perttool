# Repository-clean Advance Candidate Core Acceptance

- Document status: Accepted internal 1.0
- Review date: 2026-07-31
- Baseline HEAD: `15f3608d16855c7fa053bc52c8d60f5e0bb2ef28`
- Backlog: `ADV-002`
- Plan: [`plans/advance-clean-candidate.pert`](../../plans/advance-clean-candidate.pert)
- Plan task: `ADV_CLEAN_CANDIDATE_CORE`
- Mutation semantics: version 2 plus Section 12.2
- History-safety model: 1
- CLI contract: unchanged Contract 6
- Result identity: unchanged `Perttool.AdvanceResult.v1`
- Runtime status: Core implemented; end-to-end accepted later under
  [`advance-clean-candidate-acceptance.md`](advance-clean-candidate-acceptance.md)
- Release status at this slice: blocked and not authorized
- Current release selection: pending and not authorized

## 1. Decision

Accept the internal candidate and destructive-provenance implementation for
ADV-002. One shared range planner now derives the exact declaration deletions
used by canonical advance and by history-safety records. The assessor validates
those current ranges and maps only their exact owned prefix and suffix into
`HEAD` before the existing raw-byte and stage-0 checks.

This record remains the bounded Core acceptance rather than final product
acceptance. The later real tracked CLI write, `git diff --check`,
temporary-link behavior, and isolated installed-package behavior are recorded
in the final acceptance document.

## 2. Implementation boundary

[`src/mutation/advance-deletion.ts`](../../src/mutation/advance-deletion.ts)
owns the narrow range algorithm:

1. collect declarations selected by one canonical advance;
2. identify the maximal selected suffix after the last retained declaration;
3. extend only those suffix deletions backward over consecutive blank physical
   lines before the ordinary owned comments or declaration header;
4. extend the final selected declaration to end of source only when all
   following source is blank; and
5. leave every non-terminal declaration deletion on the existing ordinary
   source-preserving range.

[`src/mutation/advance.ts`](../../src/mutation/advance.ts) consumes those edits
directly. [`src/history/advance-history.ts`](../../src/history/advance-history.ts)
uses the same planned ranges for `AdvanceDestructiveRecordV1`. During proof,
it validates the current record against the shared planner, then maps the
current owned prefix into the complete consecutive blank-line prefix in
`HEAD`. It does not recompute a broader `HEAD` suffix based on declarations
that are retained only in the current source.

The final-declaration suffix is matched exactly to end of `HEAD`. Prefix or
suffix mismatch is `destructive_overlap`; a stage-0 removal inside the owned
prefix also overlaps. Existing model-1 insertion-at-range-boundary semantics
remain unchanged.

## 3. Observed regression correction

The exact plan at baseline commit `15f3608` reproduced the accepted finding:

| Fact | Before Core | After Core |
| --- | ---: | ---: |
| Source bytes | 3,475 | 3,475 |
| Candidate bytes | 2,543 | 2,542 |
| Newly orphaned trailing blank physical lines | 1 | 0 |
| Removed tasks | `ADV_CLEAN_CANDIDATE_CONTRACT` | unchanged |
| Removed work events | contract start and finish | unchanged |

The corrected deletion edits for the two consecutive terminal work events are
adjacent at UTF-16 offset 3,256. The second edit ends at source offset 3,475,
so one application produces the repository-clean candidate without calling
the formatter or applying a second edit.

## 4. Case trace

The target matrix remains
[`advance-clean-candidate-contract-v1.json`](../../test/fixtures/advance-clean-candidate-contract-v1.json).

| Case | Core evidence | State |
| --- | --- | --- |
| `ACC-001` | Final Grammar 5 task plus start/finish events advances with no trailing blank physical line. | Passed |
| `ACC-002` | Multiple terminal separators become adjacent, non-overlapping deletion edits; repeated advance is empty. | Passed |
| `ACC-003` | Candidate edits and destructive records have identical ranges; current-prefix mismatch and stage-0 removal block. | Passed |
| `ACC-004` | A standalone terminal comment remains and bounds prefix ownership. | Passed |
| `ACC-005` | LF, CRLF, UTF-8 BOM, and absent-final-newline inputs preserve unrelated bytes and remain clean. | Passed |
| `ACC-006` | Pure preview produces one candidate without formatter or manual cleanup; later final acceptance proves output and write identity. | Passed |
| `ACC-007` | Real tracked CLI write and `git diff --check`, recorded by final acceptance. | Passed later |
| `ACC-008` | Link, installed package, and amended ADV-001 acceptance. | Passed later |

## 5. Compatibility and non-goals

The implementation adds no root export, command, option, diagnostic, result
field, schema artifact, grammar version, mutation-semantics version, or
history-safety model. The helper remains internal. Governance, warnings,
expected-digest locking, source and repository race checks, atomic replacement,
and post-write validation are unchanged.

This slice does not globally trim source, normalize retained interior trivia,
invoke the formatter, execute the plan's `dag advance`, select a release,
push, publish, move a dist-tag, or modify a GitHub Issue.

## 6. Focused verification

The focused gate is:

```sh
npm run build
node --test \
  test/advance-clean-candidate-core.test.mjs \
  test/advance.test.mjs \
  test/advance-history-probe.test.mjs \
  test/project-actuals-finish.test.mjs
```

All 31 focused tests passed. Complete repository verification and its exact
counts were then recorded from:

```sh
npm run check
```

The complete gate passed with 708 tests, 530 English-baseline text files and
3 allowlisted lines, 132 Markdown files, 7 PERT examples, and all 28 self-use
plans. The temporary-link workflow passed for `perttool@0.5.5`. The isolated
package workflow produced a 504-file dry-run tarball, passed the explicit
`beta` publication-policy check without publishing, and passed the installed
Contract 6 file-first acceptance. `git diff --check` also passed.
