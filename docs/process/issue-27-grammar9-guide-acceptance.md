# Issue #27 Grammar 9 Guide Acceptance

Document status: Accepted 1.1  
Acceptance date: 2026-08-26  
Implementation scope: local source and package candidate only

## 1. Accepted boundary

Issue #27 is complete in the current local source. CLI Contract 10 now layers
an active syntax Guide over the retained Contract 9 Guide and describes the
complete Grammar 1 through 9 declaration surface. The active Guide adds the
Grammar 8 calendar and temporal declarations and the Grammar 9 `work`,
project-owned `event` and `activity`, `window`, and singleton `work_order`
declarations. It also states the current project-version, Duration, temporal,
and task-owned `work_event` ranges.

The `syntax` and `planning-pool` topics link to each other. The syntax topic
also links to `temporal-schedule`, and the temporal syntax distinguishes the
Grammar 2 through 7 `not_before` spelling from the Grammar 8 and 9 `when`
schedule syntax. Historical Contract 7 through 9 Guide implementations and
their additive meanings remain unchanged.

## 2. Evidence

- **E-GUIDE9-001:** Issue #27 and
  `plans/planning-pool-release-readiness.pert` require the active syntax and
  project Guide to cover Grammar 8 calendars, Grammar 9 Planning Pool
  declarations, exact version ranges, reciprocal topic navigation, and
  Contract 10 tests and goldens.
- **E-GUIDE9-002:** `src/help/contract10-guide.ts` applies the current syntax
  projection only at the Contract 10 layer and delegates every historical
  layer to its existing implementation.
- **E-GUIDE9-003:** `test/guide.test.mjs` checks every active topic and level,
  exact legacy and Grammar 8 and 9 declarations and ranges, temporal
  spellings, active actuals compatibility wording, and the reciprocal links.
  The Contract 10 index, quick syntax, and detailed temporal projections are
  frozen under `test/golden/help/`.
- **E-GUIDE9-004:** The complete repository gate passed on 2026-08-26 with
  zero test failure, cancellation, skip, or todo. It included the TypeScript,
  duplicate-code, complexity, English-baseline, documentation, self-use,
  isolated LSP and MCP, supported VS Code host, temporary-link, and public
  package workflows.
- **E-GUIDE9-005:** `bash scripts/check-package.sh` accepted the generated
  1,019-file `perttool@0.10.5` tarball, dry-run publication route, isolated
  installation, and installed Contract 10 Guide readback containing the exact
  legacy and current temporal syntax and active actuals and editing wording.
- **E-GUIDE9-006:** `git diff --check` passed.

## 3. Claims and reasoning

- **C-GUIDE9-001 `high`, accepted:** The active syntax Guide no longer stops
  at Grammar 7 and now describes every declaration family added by Grammars 8
  and 9. References: E-GUIDE9-001, E-GUIDE9-002, E-GUIDE9-003.
- **C-GUIDE9-002 `high`, accepted:** The active Guide separates legacy and
  current temporal spellings instead of implying that `not_before` remains
  valid in Grammar 8 or 9. References: E-GUIDE9-002, E-GUIDE9-003.
- **C-GUIDE9-003 `high`, accepted:** Source tests, frozen projections, the
  complete repository gate, and installed-package readback agree on one
  Contract 10 Guide while historical Guide layers remain additive.
  References: E-GUIDE9-002, E-GUIDE9-003, E-GUIDE9-004, E-GUIDE9-005.

## 4. Actions

- **A-GUIDE9-001 `implementation permitted`, executed:** add the Contract 10
  syntax overlay for the complete Grammar 8 and 9 declaration and version
  surface. References: C-GUIDE9-001, C-GUIDE9-002.
- **A-GUIDE9-002 `implementation permitted`, executed:** add reciprocal
  syntax, temporal-schedule, and planning-pool navigation. Reference:
  C-GUIDE9-001.
- **A-GUIDE9-003 `implementation permitted`, executed:** add active Contract
  10 goldens, focused assertions, acceptance-evidence identity updates, and
  installed-package verification. Reference: C-GUIDE9-003.

## 5. Independent review disposition

The first assertion-free outcome candidate was independently reviewed before
owner confirmation. That review rejected the candidate because the Contract
10 overlay had narrowed the valid Grammar 2 through 7 `not_before` value from
`DATE|OFFSET_DATE_TIME` to `OFFSET_DATE_TIME`. It also found stale Grammar 7
ranges in the active actuals topic and a stale Contract 9 label in the active
editing topic. The focused and complete gates had not detected those facts.

Candidate 1.1 restores the normative legacy temporal value, updates only the
active Contract 10 actuals and editing projections, adds one exact temporal
detail golden, strengthens the source assertions, and extends installed-
package readback. The rejected outcome digest is not reusable. This record
was then reviewed by a different read-only Subagent. The independent
re-review returned `ACCEPT_WITH_NOTES` with no open P0, P1, or P2 finding and
independently reproduced the revised outcome digest, accepted basis,
governance denial before owner confirmation, and complete assurance recovery.
Its P3 notes retain the mixed dirty-tree provenance boundary and distinguish
the parent's complete package gate from the reviewer's focused independent
replays.

## 6. Retained boundaries

This acceptance does not authorize or perform a commit, push, Issue mutation,
release selection, tag, GitHub Release, npm publication or dist-tag movement,
Planning Pool plan advance, or a successor-task start. The current PERT task
may be finished locally after this record and the final source readback agree;
its assurance outcome remains a separate candidate-bound confirmation.
