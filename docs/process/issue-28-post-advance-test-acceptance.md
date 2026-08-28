# Issue 28 Post-Advance Test Acceptance

- Document status: Accepted focused correction 1.0
- Review date: 2026-08-26
- Issue: [#28](https://github.com/mako10k/perttool/issues/28)
- Release disposition: Required input to the next Planning Pool minor gate

## 1. Decision

Accept the separation of historical pre-Advance lifecycle evidence from the
canonical residual Planning Pool plan. Tests that inspect removed Tasks,
intermediate Milestones, and their outcomes now read one exact immutable
pre-Advance fixture. Tests that inspect current authority read the residual
`plans/planning-pool.pert` and require only the retained accepted Final
Milestone and its owned acceptance evidence.

No removed declaration is restored to the current plan. Runtime behavior,
Grammar 9, CLI Contract 10, Advance selection, acceptance guards, assurance
guards, and persistence are unchanged by this correction.

## 2. Historical evidence boundary

[`planning-pool-pre-advance-accepted.pert`](../../test/fixtures/planning-pool-pre-advance-accepted.pert)
is the exact `plans/planning-pool.pert` blob from immutable commit
`1c3ce668c0e5f449baafebbba0420ee57abcc6a2`. It is 24,296 UTF-8 bytes with
digest
`sha256:4438758308fbe698d56b7167f92f9611505434714b5d33a98fd7abc8458218d9`.

The fixture retains the reached `PLANNING_POOL_SOURCE_READY` Milestone, the
completed reshape, projection, Window, observation, history, public-contract,
and final-acceptance Tasks, and their accepted assurance records. It is test
evidence only and is not a second active plan.

## 3. Canonical residual boundary

The current [`planning-pool.pert`](../../plans/planning-pool.pert) remains the
canonical post-Advance source. Direct readback establishes:

- Grammar 7 source validation passes with no diagnostic;
- the strict DAG has one retained Milestone, zero Tasks, and zero Gates;
- `PLANNING_POOL_ACCEPTED` is reached;
- criterion set `PLANNING_POOL_ACCEPTANCE_R1` and receipt
  `PLANNING_POOL_ACCEPTANCE_EVIDENCE` remain present;
- milestone acceptance is `accepted` with no blocking required criterion;
- plan assurance is complete with no task result or required action; and
- Next has no ready, recommended, or startable Task.

The tests assert both boundaries independently. A later successful canonical
Advance therefore cannot invalidate historical acceptance assertions merely
because it correctly contracts completed declarations.

## 4. Verification

The focused Planning Pool run passed all 11 tests:

```sh
TMPDIR=/tmp TMP=/tmp TEMP=/tmp node --test \
  test/planning-pool-contract.test.mjs \
  test/planning-pool-public-contract.test.mjs \
  test/planning-pool-acceptance.test.mjs
```

The complete supported repository test command also exited zero:

```sh
TMPDIR=/tmp TMP=/tmp TEMP=/tmp \
  node --test --test-reporter=dot test/*.test.mjs
```

The complete run includes the separately retained Issue #25 terminal-byte
fixture and tests. This change neither absorbs that correction into #28 nor
uses the historical Planning Pool fixture as an Advance terminal-byte oracle.

Static type, duplication, and complexity checks passed at 147 clones, 2,743
duplicated lines, 2.717%, 4,998 functions, and 168 accepted legacy complexity
entries. The English baseline passed across 1,255 text files with three exact
allowlisted lines, documentation checks passed across 358 Markdown files and
seven PERT examples, and `git diff --check` exited zero.

## 5. Boundary

This acceptance does not modify the canonical residual Planning Pool plan,
advance any plan, close an Issue, select a release version, create a release
candidate, commit, push, publish, or move an npm dist-tag. Release-wide and
installed-package acceptance remain later PERT tasks.
