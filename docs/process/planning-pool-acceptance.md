# Planning Pool End-to-End Acceptance

- Document status: Accepted 1.0
- Decision date: 2026-08-25
- Task: `PLANNING_POOL_ACCEPTANCE`
- Contract: `PLAN-POOL-001`
- Parent implementation commit: `a8859edd5d3b2d5a83da929e2dc3596f094744d9`
- Accepted Public Contract outcome commit:
  `ec35e4baae9787aaf36fa2d6520c6780f94645aa`
- Accepted task basis:
  `sha256:31462d42b58f47aaa34caca46db8ea5acdcd91c565606a8c9899adf6a7b522bc`

## 1. Decision

`PLANNING_POOL_ACCEPTANCE` is accepted. Grammar 9 and CLI Contract 10 expose
one Work-centered planning pool without creating a second executable graph or
another owner for Task actuals, Milestone outcomes, governance, plan assurance,
or historical truth. Active Window state and removable Work traces remain
current only while useful; bounded Git evidence owns contracted history.

The accepted public boundary remains 67 commands, 26 active root schemas, 139
root and Node runtime exports, and 51 portable Core exports. The published
`0.10.5` package remains the Grammar 8 and CLI Contract 9 baseline until a
separate release is selected and authorized.

## 2. Evidence chain

- **E-POOL-ACCEPT-001:** Complete `Perttool.NextResult.v7` for source digest
  `sha256:0dc0957a4b3de545d90a9c32c0f5287e2d0e39328e0fecd6dce8474efa60278b`
  made only `PLANNING_POOL_ACCEPTANCE` ready, runnable, recommended, and
  startable with complete assurance and no required action or mismatch.
- **E-POOL-ACCEPT-002:**
  `test/fixtures/planning-pool-acceptance-v1.json` fixes contiguous
  `PPA-001` through `PPA-009` and maps `PPC-001` through `PPC-040` exactly once
  to the accepted source, reshape, projection, Window, observation, history,
  and public-contract evidence.
- **E-POOL-ACCEPT-003:** The complete repository regression gate passed 1,300
  tests under a Linux POSIX temporary root, including the 74 focused Planning
  Pool and VSIX acceptance tests.
- **E-POOL-ACCEPT-004:** All 26 root result schemas compiled under strict Draft
  2020-12 and accepted real Planning Pool, migration, and advance results. The
  public registry, Help, Guide, root, Node, Core, temporary-link, and isolated
  package replays retained their exact Contract 10 identities.
- **E-POOL-ACCEPT-005:** With ambient `DISPLAY=:0` and Wayland available, the
  Linux VSIX gate ran its VS Code 1.101.0 trusted and untrusted host workflows
  in a fresh Xvfb display, then verified replacement and uninstall readback.
  The gate unsets Wayland and never shares the operator's visible display.
- **E-POOL-ACCEPT-006:** Static, English, documentation, 45-plan self-use,
  isolated LSP, isolated MCP, VSIX, temporary-link, and 1,004-file package
  gates passed without a release, publication, remote write, Issue mutation,
  editor or MCP mutation, or plan advance.

- **C-POOL-ACCEPT-001 `high`, accepted:** The accepted implementation satisfies
  every normative Planning Pool case and preserves the strict-DAG and existing
  authority boundaries across direct, installed, and historical surfaces.
  References: E-POOL-ACCEPT-001 through E-POOL-ACCEPT-006.
- **A-POOL-ACCEPT-001**, implementation permitted, executed: record this
  end-to-end acceptance and complete only `PLANNING_POOL_ACCEPTANCE` in its
  exact pre-advance plan. Reference: C-POOL-ACCEPT-001.

## 3. Normative trace

The machine trace is dependency-ordered by acceptance area:

| Trace | Contract cases | Primary evidence |
| --- | --- | --- |
| `PPA-001` | `PPC-001` through `PPC-010` | source identity, incomplete AoA, order, dependency, reshape reference accounting, history ambiguity |
| `PPA-002` | `PPC-011` through `PPC-020` | split, merge, creation, discard, normalization, preflight, opaque token, rebinding, user-response boundary |
| `PPA-003` | `PPC-021` through `PPC-027` | projection, shared ownership transfer, residual assistance, archival, history-safe advance cleanup |
| `PPA-004` | `PPC-028` through `PPC-030` | shared Task and Milestone attribution and evidence-bearing split rejection |
| `PPA-005` | `PPC-031` and `PPC-032` | narrow deferral and protected-evidence rejection |
| `PPA-006` | `PPC-033` through `PPC-037` | Window membership, timebox, objective, close, carry-over, and independent observation axes |
| `PPA-007` | `PPC-038` | immutable first-parent reconstruction, gaps, races, ambiguity, and limits |
| `PPA-008` | `PPC-039` | explicit migration and strict-DAG compatibility |
| `PPA-009` | `PPC-040` | atomic Grammar 9 and Contract 10 public activation and retained non-activation boundaries |

The trace proves structural and machine-contract coverage. It does not claim
that a machine can judge natural-language semantic wisdom; reshape still makes
that LLM and user review boundary explicit.

## 4. Cross-surface result

- Incomplete Work and Temporary Draft AoA are valid without execution state.
- Reshape accounts for every semantic row by labeled origin and Work or discard
  destination, returns normalized before and after audits, and requires the
  exact one-time opaque token and preflight hash for apply.
- Projection transfers same-identity meaning once to strict Milestone and Task
  owners; shared Work associations remain links without duplicating authority.
- Window membership, objective, time bounds, overlap, close, and carry-over stay
  advisory and explicit. Closing contracts current source and leaves history to
  Git rather than storing closed Windows.
- Current and historical observations deduplicate fully qualified identities,
  retain independent evidence axes, and report missing continuity as unknown or
  unavailable.
- Grammar migration, unit migration, canonical advance, Task actuals, velocity,
  Milestone acceptance, governance, and plan assurance retain their existing
  strict meanings.

## 5. Verification

The accepted candidate passed:

- the complete 1,300-test repository regression gate;
- 74 focused Planning Pool and VSIX acceptance tests;
- TypeScript checks for the package, LSP, VSIX, and MCP workspaces;
- pinned jscpd 5.0.15 at 147 clones, 2,743 duplicated lines, and 2.718%,
  below the unchanged 148-clone and 2,746-line ratchet;
- pinned Lizard 1.23.0 across 4,994 functions with no new violation and the
  unchanged 168-entry legacy baseline;
- strict English-baseline checks across 1,249 text files with three exact
  allowlisted lines, 355 Markdown files, and seven PERT examples;
- read-only self-use across 45 plans;
- isolated LSP and MCP package acceptance;
- the VS Code 1.101.0 host gate, always isolated in Xvfb on Linux;
- the temporary npm-link installed workflow; and
- the 1,004-file isolated public-package workflow.

The complete gate used `TMPDIR=/tmp`, `TMP=/tmp`, and `TEMP=/tmp`. The VSIX
gate additionally used the existing disposable VS Code cache and verified that
trusted and untrusted profiles, extension directories, workspaces, and the
Xvfb display were not retained.

## 6. Deferred boundaries

This acceptance performs no release selection, Git push, GitHub mutation, npm
publication or dist-tag movement, Issue mutation, public VSIX publication,
editor mutation, MCP mutation, milestone-acceptance registration, or canonical
plan advance. The completed task and its conformant assurance outcome remain
separate candidate-bound operations, and the reached final milestone remains
unaccepted until separately evidenced.
