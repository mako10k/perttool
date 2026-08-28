# Issue #34 Planning Entity Inspection Acceptance

Document status: Accepted 1.0; owner-confirmed assurance outcome registered  
Acceptance date: 2026-08-26  
Implementation scope: local source and package candidate only

## 1. Candidate boundary

Issue #34 adds four read-only Contract 10 command paths:

- `event list`
- `event show <event>`
- `activity list`
- `activity show <activity>`

Event and Activity remain authoritative project-owned Temporary Draft
entities. `show` resolves either a local or qualified identity, returns the
authoritative source entity, and projects reverse-associated Work in global
Work order. Activity detail additionally projects its two endpoints and every
declared plan, requirement, timing, owner, tag, and source field. The human
surface omits source spans; the closed JSON result retains them.

The command catalog grows additively from the historically accepted 67 paths
to 71 current paths. Grammar 9, CLI Contract 10, the current 29-root schema
catalog, the 139 / 139 / 51 root, Node, and portable Core exports, package
version `0.10.5`, Planning Pool ownership, and all mutation authority remain
unchanged.

## 2. Evidence

- **E-ENTITY-001:** Live GitHub Issue #34 requires a read-only Event and
  Activity inspection surface, complete human and closed JSON detail, reverse
  Work associations, Activity endpoints, project ownership, local and
  qualified identities, shared associations, missing identities, source
  spans, and no mutation authority.
- **E-ENTITY-002:** `docs/specs/planning-pool.md` and
  `src/planning-pool/source-types.ts` retain one project-owned Event or
  Activity definition while Work owns reference associations only.
- **E-ENTITY-003:** `src/planning-pool/public-core.ts`, `src/cli.ts`, and the
  Contract 10 discovery and usage registry add exactly the four read-only
  operations and expose no write, diff, governance, or confirmation option.
- **E-ENTITY-004:** `src/planning-pool/human.ts` renders compact lists and
  complete semantic detail. `Perttool.PlanningPoolResult.v1` keeps a closed
  machine result with authoritative Event, Activity, reverse Work, endpoint,
  and source-span values.
- **E-ENTITY-005:** `test/issue-34-planning-entity-inspection.test.mjs`, its
  Grammar 9 fixture, and exact human goldens cover command effects, compact
  lists, local and qualified identity parity, shared associations, endpoints,
  complete optional fields, no per-Work copies, missing identity diagnostics,
  schema validation, source spans, and unchanged input bytes.
- **E-ENTITY-006:** Focused command, Guide, schema, historical-boundary, and
  Issue #34 gates pass. The English baseline, documentation checks,
  `git diff --check`, and the pinned jscpd and Lizard static ratchets also
  pass.
- **E-ENTITY-007:** The complete repository gate passed on 2026-08-26:
  1,324 tests, 1,294 English-baseline text files, 367 Markdown files, seven
  PERT examples, 45 self-use plans, the pinned 147-clone / 2,743-line jscpd
  ratchet, the 5,131-function / 168-legacy-entry Lizard ratchet, isolated
  LSP/MCP/VSIX checks, npm link, and the 1,019-file isolated
  `perttool@0.10.5` package all passed. The installed package read back the
  Event and Activity Guide boundary and both qualified `show` results with
  source spans, reverse Work associations, endpoints, and estimates.
- **E-ENTITY-008:** A read-only independent Subagent returned `ACCEPT` with no
  P0, P1, P2, or P3 finding. It independently checked the live Issue, project
  ownership and Work-reference boundary, four read-only descriptors, human
  and JSON detail, schema closure, identity and association cases, no-write
  behavior, current and historical catalog counts, installed-package
  assertions, and the exact assertion-free outcome candidate.
- **E-ENTITY-009:** After the complete gate, the task finish candidate was
  previewed and written once with actor `codex`, event
  `EV_POOL_ENTITY_INSPECTION_FINISH_001`, finish time
  `2026-08-26T19:18:47+09:00`, and exact active time and effort of
  `1523/3600h` and `1523/3600ph`. Original digest
  `sha256:24e2392d1c036cecdd765ec0a208784055a5829c2e9873eaad4aa5efe15d9c07`
  changed to
  `sha256:99a75dddec2aa87ce3383dcb6076f0f21b470c905ce592ce3e965919348b83a0`.
  Readback shows the matching start and finish pair and only the expected
  `outcome_missing` assurance cause.
- **E-ENTITY-010:** The exact assertion-free conformant outcome preview has
  candidate digest
  `sha256:e6811692d0a7ea3d4d710517070558a99da8a9e910cc7dc13d3a0645e380c6ca`,
  accepted and computed basis
  `sha256:a174c87c56e9fc5726304e4bf8d3efe51bc7008433da4c35488a83ffdb169190`,
  affected scope `plan_assurance`, required owner `user`, and
  `write_authorized: false`. Its projected after-state has complete assurance
  with no unavailable task, mismatch, replan, active attention, or required
  action.
- **E-ENTITY-011:** The user separately confirmed that exact candidate. It was
  written once with actor `codex`, candidate-bound owner assertion `user`,
  original digest
  `sha256:99a75dddec2aa87ce3383dcb6076f0f21b470c905ce592ce3e965919348b83a0`,
  and final digest
  `sha256:e6811692d0a7ea3d4d710517070558a99da8a9e910cc7dc13d3a0645e380c6ca`.
  Readback reports `POOL_ENTITY_INSPECTION` as verified and conformant with
  accepted, computed, and exported basis
  `sha256:a174c87c56e9fc5726304e4bf8d3efe51bc7008433da4c35488a83ffdb169190`
  and no unavailable task, mismatch, replan, active attention, or required
  action.

## 3. Claims and reasoning

- **C-ENTITY-001 `high`, candidate:** A user or agent can inspect each current
  project-owned Event and Activity without reading source code or constructing
  a reshape. References: E-ENTITY-001 through E-ENTITY-005.
- **C-ENTITY-002 `high`, candidate:** Reverse Work projection makes shared
  associations navigable while retaining one authoritative Event or Activity
  owner and no per-Work semantic copies. References: E-ENTITY-001,
  E-ENTITY-002, E-ENTITY-004, E-ENTITY-005.
- **C-ENTITY-003 `high`, candidate:** The additive read surface does not grant
  planning mutation, reshape, governance, persistence, release, or execution
  authority. References: E-ENTITY-001, E-ENTITY-003, E-ENTITY-005.

## 4. Actions

- **A-ENTITY-001 `implementation permitted`, executed:** add the four
  read-only current-entity commands and authoritative result projection.
  References: C-ENTITY-001, C-ENTITY-002.
- **A-ENTITY-002 `implementation permitted`, executed:** add human detail,
  closed schema coverage, focused regression cases, Guide, README, release
  notes, and installed-package assertions. References: C-ENTITY-001 through
  C-ENTITY-003.
- **A-ENTITY-003 `implementation prohibited`, not executed:** do not create
  per-Work Event or Activity copies or add mutation, governance, persistence,
  release, or execution authority. References: C-ENTITY-002, C-ENTITY-003.

## 5. Independent review disposition

The independent review ran 45 bounded tests, the static, English,
documentation, and 1,019-file installed-package gates, direct Help and invalid-
option checks, strict Ajv closure probes, and `git diff --check`. It reproduced
source digest
`sha256:99a75dddec2aa87ce3383dcb6076f0f21b470c905ce592ce3e965919348b83a0`,
candidate digest
`sha256:e6811692d0a7ea3d4d710517070558a99da8a9e910cc7dc13d3a0645e380c6ca`,
accepted, computed, and exported basis
`sha256:a174c87c56e9fc5726304e4bf8d3efe51bc7008433da4c35488a83ffdb169190`,
scope `plan_assurance`, required owner `user`, and assertion-free
`write_authorized: false`. The projected after-state has zero unavailable
task, mismatch, replan, active-attention requirement, or required action.

The review returned `ACCEPT` with no P0, P1, P2, or P3 finding. It performed
no repository, PERT, Git, GitHub, or npm mutation and did not repeat the
parent's complete 1,324-test repository gate.

## 6. Retained boundaries

This acceptance does not authorize or perform a commit, push, Issue mutation,
release selection, tag, GitHub Release, npm publication or dist-tag movement,
Planning Pool plan advance, or a successor-task start. Finishing the current
PERT task, independently reviewed assurance outcome, owner confirmation, and
exact outcome write are complete. All retained external and successor-task
boundaries remain separate.
