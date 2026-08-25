# Planning Pool History Core Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-25
- Accepted candidate parent: `9d46455f03a683fd335db611dace50470a94ab35`
- Plan: [`plans/planning-pool.pert`](../../plans/planning-pool.pert)
- Plan task: `PLANNING_POOL_HISTORY_CORE`
- Accepted basis: `sha256:93c58fb4251a94b8ddca57d629f374848fd309e32bb901087052b9fc4b8fd712`
- Normative contract: [Work-centered Planning Pool and Window Contract](../specs/planning-pool.md)
- Private capability: `perttool.planning-history-core@1`
- Active public runtime: unchanged package `0.10.5`, Grammar 8, and CLI Contract 9

## 1. Decision

Accept the private pure Planning Pool History Core. It consumes the accepted
immutable `Perttool.HistoricalGitEvidence.v1` first-parent evidence and the
accepted current Planning Pool Observation Core. It does not invoke Git or
create a second repository-evidence owner.

The Core reconstructs bounded Work, Window, typed association and projection,
Task and Milestone, actual, acceptance, canonical-advance, membership, and
observable Window-close lineage. Current `.pert` bytes and their digest remain
the only authority for current facts. Historical identity matches without
continuous source-valid association or projection evidence never establish
Work attribution.

Missing, shallow, invalid, unavailable, raced, over-limit, ambiguous, or
context-incomplete evidence remains explicit and axis-local. The Core neither
restores source nor infers forced history loss from missing evidence. It
creates a new occurrence after an identity disappears and later reappears.

Public Grammar 9 and CLI Contract 10 activation, History outcome acceptance,
milestone evidence, safe persistence, canonical plan advance, release, remote
writes, and Issue mutation remain separate.

## 2. Evidence chain

### C-POOL-HISTORY-001 `high`, accepted

Claim: bounded planning lineage can be reconstructed without weakening current
source authority or duplicating the accepted immutable Git-evidence owner.

Evidence:

- `E-POOL-HISTORY-001`: planning-pool contract section 8 makes current source
  authoritative, requires same-path first-parent immutable evidence, forbids
  identity-only attribution, and fixes explicit incomplete and unavailable
  states plus four hard limits.
- `E-POOL-HISTORY-002`: `PPHC-001` and `PPHC-002` retain the private identity
  and verify repository, path, endpoint, commit, parent, blob, raw-source
  digest, object-format, and complete read-snapshot bindings supplied by the
  existing historical Git probe.
- `E-POOL-HISTORY-003`: `PPHC-003` through `PPHC-008` retain current authority,
  reconstruct Work and typed relation semantic epochs, observe Window
  contraction without inventing a close request, and recognize only a strict
  semantic candidate produced by the accepted canonical-advance planner.
- `E-POOL-HISTORY-004`: `PPHC-009` through `PPHC-014` stop continuity at
  validity, context, shallow, identity-reuse, unavailable, race, binding, and
  hard-limit boundaries rather than completing or truncating a lineage.
- `E-POOL-HISTORY-005`: `PPHC-015` and `PPHC-016` prove deterministic no-write
  evaluation and retain all active public identities. A focused real Git
  composition test supplies exact evidence through `probeHistoricalGitEvidence`
  and observes it without another Git command owner.

Action:

- `A-POOL-HISTORY-001`, implementation permitted, executed: add the private
  closed History result types, exact immutable-evidence verification,
  snapshot observation, occurrence and semantic-epoch reconstruction,
  canonical-advance proof, Window-close observation, explicit gaps, and the
  sixteen dependency-ordered cases.
- `A-POOL-HISTORY-002`, implementation permitted, executed: decompose
  evidence binding, snapshot processing, relation transition, Window-close,
  and final-result preparation into bounded pure helpers so the accepted
  duplicate and complexity ratchets remain unchanged.

## 3. Accepted history model

The private operation is `observe_history` under reserved result identity
`Perttool.PlanningPoolResult.v1`. It verifies the exact current request and
source digest independently from historical evidence, and reports current
observation or current selection absence with
`overridesHistoricalFacts: true`.

Every usable Grammar 9 snapshot is parsed and evaluated through the accepted
Observation Core with source-bound global execution context. A missing
historical execution context leaves source facts observable but marks the
affected history incomplete. Valid earlier grammars record planning absence;
invalid, missing, and digest-inconsistent inputs are explicit continuity gaps.

Work, Window, and typed relation occurrences use deterministic identities and
ordered semantic epochs. Typed relations cover Event and Activity
associations, Task and Milestone projections, Work dependencies, and Window
membership. Task and Milestone facts remain authoritative DAG facts rather
than copied Work state. Removal and later reappearance create different
occurrences, and a gap prevents cross-gap attribution.

A Window close is observable only for an exact adjacent contraction in which
the Work facts remain unchanged and carry-over additions are visible. The
result never claims that an unrecorded disposition request exists. A strict
canonical advance is recognized only when the accepted advance planner's
complete semantic candidate equals the following strict snapshot; exact
fully qualified removed Task and Milestone identities are reported.

The hard limits are 2,048 first-parent commits, 8 MiB per raw snapshot,
128 MiB aggregate raw bytes, and 100,000 derived records. Exceeded limits fail
with `PTPOOL-115`; unavailable or incomplete evidence uses `PTPOOL-114`, and
stale or inconsistent source binding fails with `PTPOOL-111`.

## 4. Accepted cases

The dependency-ordered matrix is
[`planning-pool-history-core-v1.json`](../../test/fixtures/planning-pool-history-core-v1.json).

| Cases | Accepted boundary |
| --- | --- |
| `PPHC-001`–`PPHC-004` | private identity, exact immutable bindings, current authority, and accepted snapshot observation |
| `PPHC-005`–`PPHC-008` | Work and relation epochs, observable Window close, and strict canonical advance |
| `PPHC-009`–`PPHC-012` | validity and shallow gaps, identity reuse, and missing execution context |
| `PPHC-013`–`PPHC-016` | fail-closed unavailable and limit boundaries, deterministic no-write behavior, and unchanged public runtime |

The fixture SHA-256 is
`835a62bdac1190ab152a2930c629b0fc6dcb80e6a34f5a2a5189d09e6be7a3e8`.
The focused test SHA-256 is
`d1a80fc7058a527986a407df3f6f4213fa16d12f90d492ef1658974208ac1f67`.
The implementation SHA-256 values are
`1fca33de6b6f2287998c802388355ab2725c80e049ee2e61a02cb42814a86b85`
for `history.ts` and
`4bd10cf01f2f0f11acae89756a4e92dfea6c5d9fa8d410d5843e22c2dce3e4e7`
for `history-types.ts`.

## 5. Verification

The accepted candidate passed:

- all eight focused History test groups covering `PPHC-001` through
  `PPHC-016`, including one real temporary Git repository composition;
- the History, historical Git evidence, Observation, Window, projection,
  reshape, source, contract, and Core dependency focused gate, 75 tests in
  total;
- the complete 1,294-test repository regression gate under Node.js 25.1.0;
- TypeScript checks for the package, LSP, VSIX, and MCP workspaces;
- pinned jscpd 5.0.15 at 2.799% duplicate lines and Lizard 1.23.0 with no new
  complexity violation or baseline change;
- English-baseline, documentation, and read-only self-use checks;
- isolated LSP, MCP, VSIX, temporary-link, and public-package workflows; and
- one 949-file, 3.2 MB package dry run plus isolated Contract 9 and
  plan-assurance installation checks; and
- the unchanged active public runtime of 56 commands, 23 root schemas,
  129 root exports, 129 Node exports, and 45 Core exports.

The desktop process initially supplied a Windows-mounted `TMP`. The first
supported VS Code host run aborted inside V8 before extension tests while its
profile and cache resolved below that mount. The unchanged gate passed its
trusted and untrusted install, host, replacement, and uninstall cases with
Linux `TMPDIR=/tmp`, matching the complete repository gate. No product source,
fixture, or host test was changed for that environmental rerun.

## 6. Deferred boundaries

This acceptance does not activate a public planning command, result schema,
Help, Guide, adapter, or package-root surface. It does not invoke Git, mutate
source or repository state, restore historical declarations, infer forced
history loss, make Work history strict-DAG authority, authorize `dag next`,
register the task outcome, create reached-milestone evidence, advance the
plan, release a package, write a remote, or mutate an Issue.

The implementation task may be marked complete in its exact pre-advance plan.
Its conformant outcome, reached-milestone criterion and receipt, and canonical
advance each remain separately governed operations.
