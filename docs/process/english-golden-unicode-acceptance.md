# English golden and Unicode audit acceptance

Status: Accepted on 2026-07-29. The exact completed pre-advance snapshot is
source digest
`sha256:9aa145806e7aeee32e7ad97ed45ec1df9a9d954100f3e96bcea8196f1be90e25`.

## Scope

`GOLDEN_UNICODE_AUDIT` closes the repository-maintained fixture and language
enforcement slice of ADR 0004. It:

- migrates the remaining natural-language prose in six E2E and four invalid
  `.pert` fixtures;
- removes redundant Japanese text from an inline formatter test while
  retaining non-ASCII escaped/decoded coverage;
- retains the dedicated Japanese and emoji formatter round-trip fixture and
  golden;
- adds an exact machine-readable Japanese-script allowlist and a fail-closed
  repository scanner; and
- adds the scanner to the local and Node.js 22/24 CI repository gate.

Runtime locale negotiation, translation catalogs, user-content translation,
and a broader Unicode policy are outside this slice.

## Executable allowlist

`test/fixtures/english-baseline/japanese-script-allowlist.v1.json` uses schema
`Perttool.EnglishBaselineJapaneseScriptAllowlist.v1`. Each entry binds an exact
repository-relative path and decoded line to a positive occurrence count and a
non-empty preservation reason. It has no wildcard, directory, or file-wide
exception.

`scripts/check-english-baseline.mjs` obtains tracked and non-ignored untracked
paths from Git, skips binary files, and scans text with the canonical inventory
range. It rejects:

- a Japanese-script line without an exact allowlist entry;
- an occurrence beyond the allowed count;
- a stale entry that is not observed exactly;
- an unsafe, duplicate, or unsorted entry; and
- an unknown allowlist schema.

The accepted repository has exactly three allowed lines: the scanner expression
in `english-surface-inventory.md` and the title and blocked-reason lines in the
decoded formatter round-trip golden. Escaped source tokens and emoji do not
require Japanese-script exceptions.

## Preserved fixture contracts

Only quoted natural-language values changed in the ten `.pert` fixtures.
Every replacement has the same UTF-16 length as its source value. The dedicated
test fixes a pre-migration layout digest after masking quoted content, so line,
column, and offset-sensitive fixture structure cannot drift.

A second pre-migration digest projects every declaration kind, ID, endpoint,
non-prose field, nested structured value, and declaration order while excluding
only `title`, `description`, `reason`, and `blocked_reason`. All ten translated
fixtures retain those exact structural digests. Existing parser, diagnostic,
CLI, E2E, formatter, and self-use tests independently preserve stable
diagnostic codes, result schemas, and behavior.

The inline formatter case now uses escaped and decoded `é` plus an ASCII tag.
The dedicated round-trip fixture remains the sole Japanese-script source
preservation case and still verifies escaped input, decoded golden bytes,
Japanese fields, and emoji UTF-16 handling.

## Verification

The focused and complete gates passed on Node.js 22:

```sh
npm run check:english
node --test test/english-baseline-language.test.mjs
npm run test:e2e
npm run check:docs
npm run check
git diff --check
```

The language check scanned 436 text files and observed exactly the three
allowlisted lines. The dedicated three tests, all 16 E2E tests, all 641
repository tests, 95 Markdown documents, seven normative PERT examples, all 20
self-use plan projections, the temporary link workflow, and the isolated
release-package workflow passed. The package check performed only its documented
publish dry-run; no package or dist-tag was mutated.

## PERT state

The preview-first expected-digest atomic batch changed only velocity from
`36p/2d` to `39p/2d` and set `GOLDEN_UNICODE_AUDIT` to `done`. The completed
pre-advance plan digest is
`sha256:9aa145806e7aeee32e7ad97ed45ec1df9a9d954100f3e96bcea8196f1be90e25`.

One task and 3p remain. Precedence and the `parallel-sgs` version 1 heuristic
resource makespans are both 3p with no resource delay; both velocity forecasts
are exactly `2/13d`. Complete, non-truncated `Perttool.NextResult.v5` recommends
and permits starting only `ENGLISH_ACCEPTANCE`.

## Explicit non-goals

This slice does not:

- perform the final cross-surface trace assigned to `ENGLISH_ACCEPTANCE`;
- translate user-authored content or remove the intentional Unicode fixtures;
- add runtime i18n, locale negotiation, translation catalogs, or a locale
  option;
- implement or select backlog `ACT-002` REOPEN;
- publish a release, move an npm dist-tag, push Git, or close a GitHub issue.
