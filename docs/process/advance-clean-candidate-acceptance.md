# Repository-clean Advance Candidate Acceptance

- Document status: Accepted 1.0
- Review date: 2026-07-31
- Baseline HEAD: `ef5dc237ad079581973ca46665817422e032523b`
- Backlog: `ADV-002`
- Plan: [`plans/advance-clean-candidate.pert`](../../plans/advance-clean-candidate.pert)
- Plan task: `ADV_CLEAN_CANDIDATE_ACCEPTANCE`
- Mutation semantics: version 2 plus Section 12.2
- History-safety model: 1
- CLI contract: unchanged Contract 6
- Result identity: unchanged `Perttool.AdvanceResult.v1`
- Release activation: none

## 1. Decision

Accept ADV-002 in the current source. The Core, tracked CLI, temporary-link,
and isolated installed-package evidence demonstrates one byte-identical
repository-clean candidate without a formatter or manual whitespace edit.

This acceptance does not select a release, bump a version, advance the plan,
push Git state, publish a package, move a dist-tag, or modify a GitHub Issue.

## 2. Exact tracked-write evidence

[`check-advance-clean-candidate.mjs`](../../scripts/check-advance-clean-candidate.mjs)
creates one disposable Git repository and commits an eventful Grammar 5 plan.
It then runs assertion-free preview, separate output, and expected-digest
in-place write through the supplied CLI.

| Fact | Observed value |
| --- | ---: |
| Source bytes | 567 |
| Candidate bytes | 206 |
| Diff | `+4/-28` |
| Removed task | `WORK` |
| Removed work events | `WE-finish`, `WE-start` |
| Trailing blank physical lines | 0 |
| History guard | `passed/baseline_matches` |
| `git diff --check` | exit 0 |

The preview, separate-output file, result `updated_text`, and in-place file are
byte-identical. Repeated advance is a no-op. `HEAD`, the stage-0 index entry,
and refs are unchanged. The output ends with the retained reached milestone
and one line terminator, not a trailing blank physical line.

## 3. Eight-case trace

The machine authority remains
[`advance-clean-candidate-contract-v1.json`](../../test/fixtures/advance-clean-candidate-contract-v1.json).

| Case | Accepted evidence |
| --- | --- |
| `ACC-001` | Eventful terminal task and two owned work events produce no trailing blank physical line. |
| `ACC-002` | Only the maximal terminal removed-declaration suffix owns its consecutive blank separator prefixes; edits remain ordered, non-overlapping, and idempotent. |
| `ACC-003` | Candidate edits and destructive records use identical ranges; exact current-to-`HEAD` mismatch and stage-0 overlap block. |
| `ACC-004` | A standalone comment bounds ownership and retained trivia remains byte-preserved. |
| `ACC-005` | LF, CRLF, UTF-8 BOM, and absent-final-newline inputs preserve bytes outside owned ranges. |
| `ACC-006` | Preview, separate output, and in-place write are byte-identical without formatter or manual cleanup. |
| `ACC-007` | A real tracked write passes history proof and `git diff --check` without changing `HEAD`, index, or refs. |
| `ACC-008` | Source CLI, temporary link, isolated installed package, and the amended ADV-001 record agree without a public identity change. |

## 4. Cross-surface evidence

- `test/advance-clean-candidate-core.test.mjs` covers the pure planner,
  destructive provenance, encoding and comment boundaries, idempotence, and
  fail-closed prefix changes.
- `test/advance-clean-candidate-cli.test.mjs` runs the disposable tracked-write
  executor through the built source CLI.
- `scripts/check-npm-link.sh` runs that same executor through the temporary
  linked CLI.
- `scripts/check-package.sh` runs that same executor through the isolated
  installed tarball CLI after the beta publication-policy dry run.
- `docs/process/advance-history-acceptance.md` records why the original gap
  was outside the ADV-001 safety decision and how ADV-002 closes its missing
  candidate-composition coverage.

## 5. Compatibility and authority

The correction adds no root export, command, option, diagnostic, result field,
schema artifact, grammar version, mutation-semantics version, or
history-safety model. Governance, warnings, expected-digest locking,
repository races, atomic replacement, post-write validation, and
`--force-history-loss` remain unchanged.

The accepted behavior is not a global trim and does not normalize retained
interior trivia. Published `0.5.5` remains unchanged. Plan advance, release
selection, remote Git writes, GitHub changes, npm publication, and dist-tag
movement remain separate authorization boundaries.

## 6. Verification

The focused source, CLI, link, and installed-package gates passed:

```sh
npm run build
node --test \
  test/advance-clean-candidate-core.test.mjs \
  test/advance-clean-candidate-cli.test.mjs \
  test/advance-history-cli.test.mjs
npm run check:link
npm run check:package
```

The first exact-value assertion used placeholder byte and diff counts and
failed while every behavioral assertion in the executor passed. The expected
projection was corrected to the observed `567`, `206`, and `+4/-28` values;
the repeated focused run then passed. No product code changed in response to
that test-only expectation mismatch.

The first complete repository run reached 709 of 710 tests. Its only failure
was the existing ADV-001 acceptance test retaining the historical
`Accepted 1.0` document version after the ADV-002 amendment changed that
record to `Accepted 1.1`. The assertion was updated to require both version
1.1 and the named amendment; no product code changed in response.

The repeated complete gate then passed under Node.js v25.1.0:

- type checking and all 710 tests passed;
- the English baseline passed over 534 text files with 3 allowlisted lines;
- documentation checks passed over 133 Markdown files and 7 PERT examples;
- read-only check, analyze, and next passed for all 28 self-use plans;
- the temporary-link workflow passed the shared tracked-write executor; and
- the 504-file, 543.0 kB isolated tarball passed the explicit `beta`
  publication-policy dry run, installed file-first acceptance, and the same
  tracked-write executor.

The completed plan has zero precedence and heuristic resource makespans.
Complete, non-truncated NextResult v5 has no ready, recommended, or startable
task. `git diff --check` passed after this final record update.
