# Advance History CLI Acceptance

- Document status: Accepted 1.0
- Review date: 2026-07-31
- Plan: [`plans/advance-history-safety.pert`](../../plans/advance-history-safety.pert)
- Plan task: `ADV_HISTORY_CLI`
- History-safety model: 1
- CLI contract: 6
- Result identity: `Perttool.AdvanceResult.v1`
- Release activation: none

## 1. Decision

Accept the CLI composition slice for ADV-001. Current source now applies the
accepted read-only baseline capture and pure destructive-range assessment to a
changed destructive in-place `dag advance --write` after candidate,
governance, and existing-warning authorization.

The composition:

- adds the exact `--force-history-loss` option only to `dag advance`;
- changes only that command's success identity to
  `Perttool.AdvanceResult.v1`;
- adds one complete closed Draft 2020-12 root artifact;
- returns human-readable modification time, byte sizes, diff counts, semantic
  entity IDs, and supplemental digests;
- rechecks a captured complete source, `HEAD`, and stage-0-index baseline
  before the existing safe write; and
- performs no Git mutation.

This decision does not select a release version or accept the final package
and installed-workflow matrix. Those remain in `ADV_HISTORY_ACCEPTANCE`.

## 2. Accepted behavior

| ID | Accepted CLI behavior |
| --- | --- |
| `AHCLI-001` | Preview and separate output return `history_guard.status=not_applicable` without requiring a repository. |
| `AHCLI-002` | A clean tracked destructive advance passes and leaves `HEAD`, the index, and refs unchanged. |
| `AHCLI-003` | Dirty current or staged content wholly retained by the candidate passes, including invalid staged syntax outside destructive ranges. |
| `AHCLI-004` | Unstaged or staged destructive overlap returns PTADV-101, retains the candidate, and does not write. |
| `AHCLI-005` | Unavailable proof fails closed; governance denial and prior warning denial occur before Git inspection. |
| `AHCLI-006` | `--force-history-loss` bypasses only the initial history block, emits PTADV-103, records stable entity IDs, and remains subject to warnings-as-errors and safe write. |
| `AHCLI-007` | A post-assessment source, `HEAD`, or stage-0-index change becomes PTADV-102 and the CLI maps that race boundary to exit 5. |
| `AHCLI-008` | The exact option rejects preview, diff, separate output, and stdin combinations through the ordinary structured usage boundary. |
| `AHCLI-009` | Direct, lifecycle, and batch mutations retain `Perttool.MutationResult.v3`; the advance descriptor, package root, catalog, full schema, outline schema, and strict real-result validation agree on `Perttool.AdvanceResult.v1`. |
| `AHCLI-010` | Text output leads with status, target, modification time, byte and line counts, entity IDs, and force state; digests remain supplemental. |

## 3. Existing controls retained

The force option does not replace or weaken:

- pre-change owner and delegate evaluation;
- `--warnings-as-errors`;
- `--expect-digest`;
- source/path/symlink identity;
- captured complete `HEAD` and stage-0-index rechecks;
- candidate validation;
- atomic replacement; or
- post-write digest and semantic verification.

When no repository baseline exists, an explicit force bypasses that
unavailable history proof, while the existing source identity, digest,
atomic-write, and post-write checks still run.

## 4. Verification

The focused command, schema, help, governance, advance, and existing E2E run
passed 116 tests. The complete source test run passed 694 tests:

```sh
npm run build
node --test \
  test/advance-history-cli.test.mjs \
  test/advance-history-contract.test.mjs \
  test/advance-history-probe.test.mjs \
  test/help.test.mjs \
  test/guide.test.mjs \
  test/cli.test.mjs \
  test/e2e.test.mjs \
  test/command-discovery.test.mjs \
  test/json-schema.test.mjs \
  test/project-actuals-public-contract.test.mjs \
  test/release-0.5.1-design.test.mjs \
  test/release-0.5.2-design.test.mjs \
  test/release-0.5.3-design.test.mjs \
  test/release-0.5.4-design.test.mjs \
  test/release-0.5.5-design.test.mjs
npm test
```

The complete source gate then passed:

- 694 tests;
- English-baseline validation over 521 text files;
- documentation validation over 129 Markdown files and 7 normative PERT
  examples;
- read-only check, analyze, and next over all 27 self-use plans;
- the temporary-link workflow, including installed advance preview; and
- the 500-file isolated package workflow, beta publication dry run, and
  committed-snapshot installed advance write.

No remote Git write, GitHub mutation, Git ref or index mutation, package
publication, npm dist-tag change, release, or Issue mutation is part of this
acceptance.

## 5. Remaining acceptance boundary

`ADV_HISTORY_ACCEPTANCE` remains the only complete NextResult v5
recommendation. It owns the final cross-surface matrix for linked worktrees,
rename and ambiguity, BOM and CRLF, deterministic race exits, Guide and README
consumption, temporary linking, package contents, and isolated installed
behavior. It must not silently add release or publication work.
