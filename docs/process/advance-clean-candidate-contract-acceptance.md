# Repository-clean Advance Candidate Contract Acceptance

- Document status: Accepted target 1.0
- Review date: 2026-07-31
- Backlog: `ADV-002`
- Plan: [`plans/advance-clean-candidate.pert`](../../plans/advance-clean-candidate.pert)
- Plan task: `ADV_CLEAN_CANDIDATE_CONTRACT`
- Mutation semantics: version 2 plus the Section 12.2 correction target
- History-safety model: 1
- CLI contract: 6
- Result identity: `Perttool.AdvanceResult.v1`
- Runtime status: not implemented
- Current conformance: accepted later under
  [`advance-clean-candidate-acceptance.md`](advance-clean-candidate-acceptance.md)
- Release status at this slice: blocked and not authorized
- Current release selection: pending and not authorized

## 1. Decision

Accept the narrow contract for making an eventful canonical advance produce
one repository-clean candidate. Requirements, Mutation Semantics, the
history-safety correspondence extension, Basic Design, the eight-case matrix,
and the independent delivery plan agree. There are no open contract findings
for `ADV_CLEAN_CANDIDATE_CONTRACT`.

This acceptance does not claim runtime conformance. The current deletion
planner still handles blank lines only for the declaration that was
originally last. The Core and end-to-end tasks must implement and verify the
selected target before release preparation can begin.

That statement records this contract slice. The later Core and end-to-end
acceptance implement and verify the selected target without revising it.

## 2. Observed cause

The accepted `ADV_HISTORY_ACCEPTANCE` advance removed a terminal completed
task plus its start and finish work events. The 1,737-byte preview and written
candidate ended with five orphaned blank lines, and `git diff --check` failed
with `new blank line at EOF`. A second whitespace edit produced the
1,732-byte committed plan, so the committed bytes were not the exact approved
candidate.

The semantic advance and history guard were correct. The source defect is in
the edit composition: separators retained around multiple individually
removed declarations concatenate after the last retained declaration. The
existing one-task, no-event completed-project test does not exercise that
path.

## 3. Selected semantics

1. Identify the maximal terminal removed-declaration suffix after the last
   retained declaration, ignoring trivia.
2. For a declaration in that suffix, own only the consecutive blank physical
   lines immediately before its ordinary owned comments or header. Stop at
   nonblank standalone trivia.
3. Coalesce those exact prefixes with the declaration removals so the one edit
   set creates no trailing blank physical line.
4. Include each prefix in the corresponding destructive declaration record
   and require byte-identical `HEAD` correspondence plus no stage-0 overlap.
5. Preserve standalone comments, retained/interior trivia, BOM, prevailing LF
   or CRLF, and all bytes outside the exact owned ranges.
6. Use the same candidate for preview, separate output, and in-place write.
   A formatter or manual cleanup edit is not part of the operation.

The target is not a document-wide trim and does not add a new mutation,
history-safety, CLI, result, schema, option, diagnostic, or package identity.

## 4. Machine-readable cases

The authority is
[`advance-clean-candidate-contract-v1.json`](../../test/fixtures/advance-clean-candidate-contract-v1.json).

| Case | Target boundary |
| --- | --- |
| `ACC-001` | Reproduce a final completed Grammar 5 task with committed start and finish events and produce no trailing blank physical line. |
| `ACC-002` | Apply only terminal-suffix separator ownership and non-overlapping coalesced edits, never a global trim. |
| `ACC-003` | Extend destructive records and exact `HEAD`/stage-0 proof over the same owned prefix. |
| `ACC-004` | Preserve standalone-comment boundaries and all retained or interior trivia. |
| `ACC-005` | Preserve LF, CRLF, UTF-8 BOM, absent-final-newline, and unrelated bytes. |
| `ACC-006` | Make preview, separate output, and in-place write byte-identical without formatter or manual cleanup. |
| `ACC-007` | Pass a real tracked write and `git diff --check` while leaving `HEAD`, index, and refs unchanged. |
| `ACC-008` | Trace Core, CLI, link, installed-package, and corrected ADV-001 acceptance without authorizing release. |

Each case depends only on an earlier case ID.

## 5. Compatibility and authority

The correction is internal to advance range ownership and provenance. It
retains Grammar 5, mutation semantics version 2, history-safety model 1, CLI
Contract 6, `Perttool.AdvanceResult.v1`, every existing schema, command and
option, governance evaluation, expected-digest checks, race refusal, and
atomic safe write.

Contract completion authorizes neither the next task nor `dag advance` on
this plan. Starting `ADV_CLEAN_CANDIDATE_CORE`, advancing the completed
contract declaration, selecting a release, pushing, publishing, or moving an
npm dist-tag each remains outside this candidate.

## 6. Verification target

The contract slice requires:

```sh
node --test test/advance-clean-candidate-contract.test.mjs
npm run check:self-use
npm run check
git diff --check
```

The focused test fixes the normative phrases, contiguous eight-case matrix,
public-identity compatibility boundary, and the completed plan's sole next
authority. The complete repository gate must also prove the new plan is
registered without weakening existing ADV-001 behavior.

No remote Git write, GitHub mutation, package publication, npm dist-tag
change, release selection, or plan advance is part of this acceptance.

## 7. Recorded verification

On 2026-07-31, the focused contract and self-use tests passed, followed by the
complete `npm run check` gate under Node.js v25.1.0:

- type checking and all 703 tests passed;
- the English baseline passed over 527 text files with 3 allowlisted lines;
- documentation checks passed over 131 Markdown files and 7 normative PERT
  examples;
- read-only check, analyze, and next passed for all 28 self-use plans;
- the temporary-link Contract 6 workflow passed; and
- the 500-file isolated package, installed file-first workflow, and beta
  publication dry run passed.

`git diff --check` also passed after the complete gate. The contract task is
done and retained in its pre-advance plan snapshot; complete NextResult v5
identified only `ADV_CLEAN_CANDIDATE_CORE` as ready, recommended, and
startable at that slice. The later complete workstream has no remaining task
authority.
