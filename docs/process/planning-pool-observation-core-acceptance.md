# Planning Pool Observation Core Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-25
- Accepted candidate parent: `0cdb71f6440f3afc60a3af311d3e0d6620726a08`
- Plan: [`plans/planning-pool.pert`](../../plans/planning-pool.pert)
- Plan task: `PLANNING_POOL_OBSERVATION_CORE`
- Normative contract: [Work-centered Planning Pool and Window Contract](../specs/planning-pool.md)
- Private capability: `perttool.planning-observation-core@1`
- Active public runtime: unchanged package `0.10.5`, Grammar 8, and CLI Contract 9

## 1. Decision

Accept the private portable Planning Pool Observation Core. It reports Work
refinement, strict-Task execution, Milestone outcome, organization,
archiveability, Window time and overlap, and explicit close disposition as
independent current-source observations. It does not add a Work completion
state or a Window objective-achievement state.

The Core reduces authoritative Task lifecycle and actual facts from the
validated strict document, and reuses the existing Milestone reach, criterion,
receipt, and acceptance evaluator. A shared Task or Milestone appears with the
same complete authoritative facts in every linked Work detail and is marked
non-exclusive. Unique aggregates use fully qualified identity sets, so each
shared fact contributes once.

Window selection filters the global Work order. Persisted and request-only ad
hoc Windows retain membership occurrences separately from unique aggregates.
The exact objective is returned without an achieved Boolean. Position uses an
explicit compatible observation value, then `project.as_of`, and never reads a
wall clock. Dependency coverage and source-bound global `dag next` facts remain
separate.

Public Grammar 9 and CLI Contract 10 activation, historical reconstruction,
safe persistence, release, remote writes, Issue mutation, and plan advance
remain separate.

## 2. Evidence chain

### C-POOL-OBSERVATION-001 `high`, accepted

Claim: current Work and Window reporting can derive independent observations
from the existing semantic owners without duplicating lifecycle or acceptance
meaning into Work.

Evidence:

- `E-POOL-OBSERVATION-001`: `PPOC-003` through `PPOC-007` keep residual
  description, planning elements, Task lifecycle and actuals, and Milestone
  reach and acceptance on separate axes while projecting shared authoritative
  facts as non-exclusive.
- `E-POOL-OBSERVATION-002`: `PPOC-008` through `PPOC-010` preserve global Work
  order, distinct membership occurrences, selected execution coverage, and
  fully qualified unique Task, Milestone, work-event, completion, and
  acceptance aggregates.
- `E-POOL-OBSERVATION-003`: `PPOC-011` and `PPOC-012` derive half-open Window
  position and overlap from explicit values or `project.as_of`, return the exact
  objective, and expose no wall-clock or objective-achievement state.
- `E-POOL-OBSERVATION-004`: `PPOC-013` and `PPOC-014` keep dependency cycles,
  trace usefulness, current-source archiveability, and request-explicit close
  dispositions independent from execution or outcome state.
- `E-POOL-OBSERVATION-005`: `PPOC-001`, `PPOC-002`, and `PPOC-015` bind the
  request and supplied global execution context to the same source digest,
  validate qualified Task identities, retain incomplete or unavailable global
  evidence explicitly, and fail closed for invalid strict evidence.
- `E-POOL-OBSERVATION-006`: `PPOC-016` retains the exact public package,
  Grammar, CLI, command, schema, and facade identities and identifies history
  as not requested.

Action:

- `A-POOL-OBSERVATION-001`, implementation permitted, executed: add the
  private closed observation request, current-source observation evaluator,
  independent axes, identity-union aggregates, membership occurrences,
  Window position and overlap, explicit close disposition, and the sixteen
  dependency-ordered cases.
- `A-POOL-OBSERVATION-002`, implementation permitted, executed: decompose
  selection normalization, temporal comparison, and result preparation into
  bounded pure helpers so the accepted duplicate and complexity ratchets
  remain unchanged.

## 3. Accepted observation model

`Perttool.PlanningObservationRequest.v1` is closed and source-digest bound. It
selects the complete pool, an explicit Work set, one persisted Window, or one
request-only ad hoc Window. It carries an optional explicit observation value
and optional explicit current close dispositions. It does not request or
synthesize history.

The private composition supplies existing `dag next` recommendation and start
facts with the same source digest and an explicit complete, incomplete, or
unavailable evidence state. The Core verifies the digest, project namespace,
known strict Task identities, and startable-subset relation. It does not own or
reimplement recommendation or start authority.

Each selected Work reports:

- refinement facts for residual description, Event and Activity association,
  projection links, and dependencies outside the selected boundary;
- execution facts for Activity obligations, unprojected Activities, strict
  Task status, actual coverage, work events, completion, and attribution;
- outcome facts for Milestone reach, acceptance, criteria, receipts, evidence
  completeness, and attribution;
- organization facts for global rank, incoming and outgoing dependencies,
  cycles, Window membership, trace usefulness, and exact current-source
  archiveability; and
- only an explicitly supplied close disposition, otherwise `not_applicable`.

Selected execution is uncovered when no Activity obligation is identified,
complete only when projected obligations exist, no Activity remains
unprojected, and every corresponding strict Task is done, and partial
otherwise. It remains an observation, not a Work state.

The request is limited to 8 MiB and derived entity records to 100,000. Invalid
source, stale bindings, unknown identities, inconsistent lifecycle evidence,
invalid acceptance evidence, and exceeded limits expose no partial successful
result.

## 4. Accepted cases

The dependency-ordered matrix is
[`planning-pool-observation-core-v1.json`](../../test/fixtures/planning-pool-observation-core-v1.json).

| Cases | Accepted boundary |
| --- | --- |
| `PPOC-001`–`PPOC-003` | private closed identity, exact current bindings, and independent refinement |
| `PPOC-004`–`PPOC-007` | authoritative Task and Milestone facts with non-exclusive shared attribution |
| `PPOC-008`–`PPOC-010` | order, membership occurrences, identity unions, and selected execution |
| `PPOC-011`–`PPOC-014` | deterministic time, overlap, exact objective, dependency organization, archiveability, and close disposition |
| `PPOC-015`–`PPOC-016` | fail-closed evidence and limits, unchanged public runtime, and deferred history |

The fixture SHA-256 is
`bec4732f4ca56e0ea3ca9b2a9f7a9d07f8388f5b814a80bb496cc1c42126bb4c`.
The focused test SHA-256 is
`be0cae15e33023376ce051d1abf41162895bad70cef1db4c2796923fa28b0ae4`.
The implementation SHA-256 values are
`fda2b49b0da7a4497692f88ffa787bc552dac8fdd6d90e34681a535cbbe62f97`
for `observation.ts` and
`9a7905745495a9038b4801863722db0e18cd98f1edc7b9c5e69c0bce9ed89b74`
for `observation-types.ts`.

## 5. Verification

The accepted candidate passed:

- all eight focused test groups covering `PPOC-001` through `PPOC-016`;
- the Observation, Window, projection, reshape, source, contract, and Core
  dependency focused gate, 59 tests in total;
- the complete 1,286-test repository regression gate under Node.js 25.1.0;
- TypeScript checks for the package, LSP, VSIX, and MCP workspaces;
- pinned jscpd 5.0.15 at 2.838% duplicate lines and Lizard 1.23.0 with no new
  complexity violation or baseline change;
- English-baseline checks over 1,223 text files and documentation checks over
  352 Markdown files and seven PERT examples;
- read-only self-use checks over 45 plans;
- isolated LSP, MCP, VSIX, temporary-link, and public-package workflows; and
- one 941-file, 3.2 MB package dry run plus isolated Contract 9 and
  plan-assurance installation checks.

The desktop process initially supplied a Windows-mounted `os.tmpdir()`. The
first complete run passed 1,282 tests and failed three existing POSIX file-mode
assertions plus one existing exclusive-create race. A direct filesystem probe
showed that create and `chmod` both reported mode `0777` on that mounted
temporary directory. The same four tests passed individually and the complete
1,286-test gate passed with Linux `/tmp`; no safe-write source or test was
changed.

The active public runtime remains 56 commands, 23 root schemas, 129 root
exports, 129 Node exports, and 45 Core exports.

## 6. Deferred boundaries

This acceptance does not activate a public planning command, result, schema,
or adapter surface. It does not reconstruct Git history, attribute an ID by
best-effort matching, persist an observation or close report, create Work
completion or Window achievement state, mutate source, authorize `dag next`,
release a package, write a remote, mutate an Issue, or advance the plan.

The implementation task may be marked complete in its exact pre-advance plan.
Its conformant outcome, reached-milestone criterion and receipt, and canonical
advance each remain separately governed operations.
