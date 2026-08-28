# Issue #33 Final Goal Boundary Guidance Acceptance

Document status: Accepted 1.0; owner-confirmed assurance outcome registered  
Acceptance date: 2026-08-26  
Implementation scope: local source and package candidate only

## 1. Candidate boundary

Issue #33 changes human guidance only. The active Contract 10 Planning Pool
Guide, README, Unreleased release notes, and nontechnical workflow example now
state all of these facts:

- remaining Work is advisory planning retention and does not block
  `project.finish`;
- Work and Window observations do not prove Final Milestone Goal obligation
  coverage, goal completion, or Window objective achievement;
- projection changes execution scope only through an explicit governed strict-
  DAG candidate that is separately reviewed and persisted;
- Final Milestone acceptance may coexist with retained Work without declaring
  that Work unnecessary, cancelled, satisfied, or part of strict execution;
- GitHub Issue #24 separately owns future Goal Obligation, Goal Coverage, and
  Goal Seal semantics.

The candidate adds no Goal field, obligation, coverage disposition, seal,
inference, diagnostic, command, schema, result, governance scope, or mutation
authority.

## 2. Evidence

- **E-GOALGUIDE-001:** GitHub Issue #33 requires six documentation-only
  conditions and explicitly excludes implementation of Issue #24.
- **E-GOALGUIDE-002:** `src/help/contract10-guide.ts` adds the
  `final-goal-boundary` and `retained-work-example` sections and links the
  Planning Pool topic to `milestone-acceptance` without changing its syntax.
- **E-GOALGUIDE-003:** `README.md`, the Unreleased section of `CHANGELOG.md`,
  and `docs/examples/planning-pool-intents.md` state the same completion,
  observation, projection, Issue #24, and retained-Work meanings.
- **E-GOALGUIDE-004:**
  `test/issue-33-goal-boundary-guidance.test.mjs` checks every Issue condition,
  the exact unchanged Planning Pool declaration surface, and cross-document
  agreement. The complete Planning Pool detail text is frozen in
  `test/golden/help/contract10-guide-planning-pool-detail.expected.txt`.
- **E-GOALGUIDE-005:** `scripts/check-package.sh` reads the same boundary,
  example, Issue #24 meanings, and reciprocal milestone-acceptance link from
  an isolated installed package.
- **E-GOALGUIDE-006:** The focused 21-test gate, English baseline,
  documentation checks, and `git diff --check` passed on 2026-08-26.
- **E-GOALGUIDE-007:** The complete repository gate passed on 2026-08-26:
  1,320 tests, 1,289 English-baseline text files, 366 Markdown files, seven
  PERT examples, 45 self-use plans, isolated LSP/MCP/VSIX checks, npm link,
  and the 1,019-file isolated `perttool@0.10.5` package all passed.
- **E-GOALGUIDE-008:** A read-only independent Subagent returned `ACCEPT` with
  no P0, P1, P2, or P3 finding after reviewing the six Issue conditions,
  normative Planning Pool boundaries, scoped implementation, tests, installed-
  package assertions, and the exact assertion-free outcome candidate.
- **E-GOALGUIDE-009:** The independent review reproduced source digest
  `sha256:566d39c3f920b6ab263ad37caf95331e3dcd6e0305cac606f83fd90ac74a8d90`,
  candidate digest
  `sha256:82fa14a96d5f718fa33471adb16238c7a061c479bf60451262ae053d126939de`,
  accepted basis
  `sha256:aa45477a3e11ad4173bc4618e0d1bd446cacbc1d6958645144a00e686a85e46f`,
  `plan_assurance` scope, required owner `user`, and assertion-free
  `write_authorized: false`. The candidate restores complete assurance with no
  unavailable task, mismatch, replan, active attention, or required action.
- **E-GOALGUIDE-010:** The user separately confirmed that exact candidate. It
  was written once with actor `codex`, candidate-bound owner assertion `user`,
  original digest
  `sha256:566d39c3f920b6ab263ad37caf95331e3dcd6e0305cac606f83fd90ac74a8d90`,
  and final digest
  `sha256:82fa14a96d5f718fa33471adb16238c7a061c479bf60451262ae053d126939de`.
  Readback reports complete assurance with no unavailable task, mismatch,
  replan, active attention, or required action.

## 3. Claims and reasoning

- **C-GOALGUIDE-001 `high`, accepted:** A nontechnical user can distinguish
  advisory Planning Pool retention from strict-DAG completion and Final Goal
  coverage. References: E-GOALGUIDE-001 through E-GOALGUIDE-004.
- **C-GOALGUIDE-002 `high`, accepted:** The example preserves uncertainty:
  retained Work is neither automatically required execution scope nor
  automatically unnecessary, cancelled, or satisfied. References:
  E-GOALGUIDE-002 through E-GOALGUIDE-004.
- **C-GOALGUIDE-003 `high`, accepted:** This slice documents the missing
  assurance boundary without pretending to implement Goal Coverage or Goal
  Seal. References: E-GOALGUIDE-001, E-GOALGUIDE-002, E-GOALGUIDE-004,
  E-GOALGUIDE-005.

## 4. Actions

- **A-GOALGUIDE-001 `implementation permitted`, executed:** add the active
  Guide boundary and nontechnical example. References: C-GOALGUIDE-001,
  C-GOALGUIDE-002.
- **A-GOALGUIDE-002 `implementation permitted`, executed:** align README,
  release notes, workflow guidance, golden, focused tests, and isolated-
  package readback. References: C-GOALGUIDE-001 through C-GOALGUIDE-003.
- **A-GOALGUIDE-003 `implementation prohibited`, not executed:** do not add
  Goal Obligation, Goal Coverage, Goal Seal, inference, governance, or mutation
  semantics under Issue #33. Reference: C-GOALGUIDE-003.

## 5. Independent review disposition

The independent review reproduced the live Issue boundary, a Grammar 9 plan
with retained Work and reached strict finish, all focused Issue/Guide/public-
contract checks, English and documentation gates, and the exact outcome
preview. It found no remediation requirement. The review did not rerun the
complete repository gate because E-GOALGUIDE-007 already records the parent
gate; it performed no repository, PERT, Git, GitHub, or package mutation.

## 6. Retained boundaries

This acceptance does not authorize or perform a commit, push, Issue mutation,
Issue #24 implementation, release selection, tag, GitHub Release, npm
publication or dist-tag movement, Planning Pool plan advance, or a successor-
task start. The current PERT task was finished locally after the complete gate
and final source readback agreed. Its exact assurance outcome was separately
owner-confirmed and registered once after independent review.
