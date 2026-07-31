# Advance History Safety Acceptance

- Document status: Accepted 1.1
- Review date: 2026-07-31
- Amendment date: 2026-07-31 (`ADV-002`)
- Plan: [`plans/advance-history-safety.pert`](../../plans/advance-history-safety.pert)
- Plan task: `ADV_HISTORY_ACCEPTANCE`
- History-safety model: 1
- CLI contract: 6
- Result identity: `Perttool.AdvanceResult.v1`
- Release activation: none

## 1. Decision

Accept ADV-001 in the current source. The repository, CLI, help, Guide,
schema, temporary-link, package, and isolated installed workflows implement
the complete model-1 contract without adding Git mutation.

This acceptance closes the source workstream only. It does not select a
release version, publish a package, move an npm dist-tag, push Git state, or
change a GitHub Issue.

Commit `aa401e4` records the exact completed final-task pre-advance snapshot.
After separate owner approval, commit `7b07bb8` advances the plan to its sole
reached `ADV_HISTORY_ACCEPTED` frontier with no task or work-event declaration.

## 2. Contract trace

The machine-readable cases remain authoritative in
[`test/fixtures/advance-history-contract-v1.json`](../../test/fixtures/advance-history-contract-v1.json).

| Case | Accepted evidence |
| --- | --- |
| `AHS-001` | CLI preview returns `not_applicable/preview` without repository inspection. |
| `AHS-002` | Separate output returns `not_applicable/separate_output`, creates the candidate once, and preserves the source. |
| `AHS-003` | A repeated in-place advance is a no-op without repository inspection or replacement. |
| `AHS-004` | A clean tracked source passes and writes while `HEAD`, the index entry, and refs remain unchanged. |
| `AHS-005` | An unstaged destructive task range returns `destructive_overlap` and `PTADV-101`. |
| `AHS-006` | A staged destructive task range returns `destructive_overlap` even when the worktree is restored. |
| `AHS-007` | Retained worktree changes and invalid staged syntax outside destructive ranges pass. |
| `AHS-008` | An owned leading-comment change overlaps its task record and blocks at the CLI. |
| `AHS-009` | Valid uncommitted task-owned start and finish events return `correspondence_missing` and remain unwritten. |
| `AHS-010` | No repository, no `HEAD`, and an untracked target each fail closed with the stable cause. |
| `AHS-011` | An unmerged stage-0 index fails closed; internal symlink and contradictory-path probes retain `ambiguous_path`. |
| `AHS-012` | A linked-worktree write passes with the repository-relative path and leaves its worktree-local `HEAD` and index unchanged. |
| `AHS-013` | An uncommitted `git mv` target fails closed without similarity inference. |
| `AHS-014` | A combined UTF-8 BOM and CRLF source passes raw-byte proof and preserves both in the written candidate. |
| `AHS-015` | Force records `forced/forced_by_option` and `PTADV-103`; governance, option closure, warnings-as-errors, and safe write remain authoritative. |
| `AHS-016` | A deterministic source race in the real CLI path returns `PTADV-102`, exit 5, and no candidate write. |
| `AHS-017` | Deterministic `HEAD` and stage-0-index races in the real CLI path return `PTADV-102`, exit 5, and no candidate write. |
| `AHS-018` | Text, JSON, help, Guide, the closed schema, package root, temporary link, tarball contents, and isolated installed write agree. |

The executable evidence is concentrated in:

- `test/advance-history-probe.test.mjs` for the pure raw-byte decision and
  fail-closed Git adapter;
- `test/advance-history-cli.test.mjs` for real CLI candidates, writes,
  unavailable states, linked worktrees, encoding, force, and races;
- `test/json-schema.test.mjs`, `test/help.test.mjs`, and
  `test/advance-history-contract.test.mjs` for the public contract; and
- `scripts/check-npm-link.sh`, `scripts/check-package.sh`, and
  `scripts/check-package-file-first.mjs` for temporary-link and installed
  behavior.

## 3. Dogfooding finding

The first expanded temporary-link gate found that the editing Guide described
race rejection but did not name `PTADV-102`. The accepted source now states
the source/`HEAD`/stage-0-index race, diagnostic, exit 5, and non-write
outcome in both the Guide and README. The strengthened link and package checks
consume that exact statement.

No runtime safety bypass or result-shape defect was found.

### 3.1 ADV-002 repository-clean candidate amendment

The first real post-acceptance advance of an eventful plan exposed a separate
candidate-composition gap. The approved and written 1,737-byte candidate left
five orphaned blank lines and failed `git diff --check`; a second manual edit
produced the 1,732-byte committed plan. `HEAD`, index, refs, history-guard
decision, semantic advance, and safe-write identity were correct, so this was
not an ADV-001 recoverability bypass. It was an uncovered interaction between
ordinary source-preserving ranges for multiple consecutive removed
declarations.

ADV-002 now assigns only the newly orphaned blank separator prefixes in the
maximal terminal removed-declaration suffix to the canonical advance. The
candidate and `AdvanceDestructiveRecordV1` use identical ranges, and the
history assessor proves the same exact prefix against `HEAD` and stage 0.
The accepted regression is recorded in
[`advance-clean-candidate-acceptance.md`](advance-clean-candidate-acceptance.md).

## 4. Original verification

The focused advance-history CLI run passed all ten test groups, including
real source, `HEAD`, and index race processes. The complete source gate passed:

- 699 tests;
- English-baseline validation over 522 text files;
- documentation validation over 130 Markdown files and 7 normative PERT
  examples;
- read-only check, analyze, and next over all 27 self-use plans;
- the temporary-link workflow with installed help, Guide, schema, and
  advance preview; and
- the 500-file isolated package workflow with installed text/JSON advance,
  passing history guard, unchanged `HEAD` and index, package-root schema API,
  and beta publication dry run.

The Git commands in the acceptance tests only prepare and observe disposable
repositories. The history guard itself performs no stage, commit, checkout,
reset, ref update, push, or other Git mutation.

### 4.1 ADV-002 amendment verification

The shared disposable-repository acceptance executor starts from a 567-byte
eventful Grammar 5 source and produces one 206-byte candidate with a `+4/-28`
diff. Preview, separate output, and in-place write are byte-identical. The
history guard reports `passed/baseline_matches`; `git diff --check` returns 0;
and `HEAD`, the stage-0 index entry, and refs remain unchanged. The same
executor passes through the source CLI test, temporary link, and isolated
installed-package workflow. LF, CRLF, UTF-8 BOM, absent-final-newline,
standalone-comment, exact-prefix mismatch, and stage-0 overlap remain covered
by the focused Core matrix.

## 5. Compatibility and remaining boundaries

Current source retains Grammar 1 through 5, CLI Contract 6, all existing
command spellings, and every non-advance result identity.
`Perttool.MutationResult.v3` remains the result for direct, lifecycle, and
batch mutations. Only `dag advance` advertises
`Perttool.AdvanceResult.v1`.

Published `0.5.5` remains unchanged and does not contain ADV-001. Release
selection, version bump, publication, npm `beta` or `latest` movement, and
Issue mutation require separate decisions.
