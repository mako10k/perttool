# Temporal Schedule Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-18
- Workstream: `TEMPORAL-SCHEDULE-001`
- Task: `TEMPORAL_ACCEPTANCE`
- Source grammar: Grammar 8
- CLI contract: Contract 9
- Release effect: none

## 1. Accepted scope

This record accepts calendar-aware temporal scheduling across the Core,
Application, CLI, root and Node facades, LSP, VSIX, MCP, Help, Guide, schemas,
temporary-link, isolated-package, installed-CLI, and repository self-use
boundaries. It closes the parent implementation assembled through
`plans/temporal-public-contract.pert` and accepted in
`docs/process/contract9-public-integration-acceptance.md`.

The accepted behavior covers generic and finite resources, weekly and
exceptional capacity, pinned zone data and daylight-saving transitions,
multiple-resource availability, event-bound combinations, forward and
required schedules, signed slack and infeasibility, current and forecast
POSTDUE alerts, target-scoped projections, completed and unavailable states,
blocks, suspensions, truncation, warning policy, and start-authority
composition.

## 2. Compatibility and authority

Grammar 8 and CLI Contract 9 are active atomically. Grammar 1 through 7 reads
retain their established meaning, and the active schema catalog contains only
the Contract 9 replacement roots. Temporal facts affect recommendation and
start authority only through the declared Contract 9 policy; unavailable or
truncated evidence fails closed rather than creating authority.

Migration, governance, plan assurance, milestone acceptance, history safety,
and safe persistence remain independently enforced. The accepted package
workflow does not bypass the protected Grammar 6 to 7 migration or infer
plan-assurance model-2 evidence.

## 3. Verification

The implementation-complete gate passed all 1,212 tests, type and static
checks, English and documentation checks, all 43 self-use plans, isolated LSP
and MCP workflows, the supported-host VSIX gate, temporary and npm links, and
the isolated installed-package workflow. Static evidence recorded 3.069%
duplication and 4,069 functions with the unchanged 170-entry legacy complexity
baseline. The package workflow passed its npm dry run and both Contract 9
installed-package acceptance paths.

After the parent and detail lifecycle writes, read-only self-use was repeated
for all 43 plans and the 37 focused Contract 9 integration, calendar scheduler,
temporal contract, and source-core cases passed with zero failures. `git diff
--check` also passed. Two redundant complete-gate invocations were terminated
after their concurrently launched LSP tests stopped making progress; they are
not counted as acceptance evidence and did not mutate the repository.

## 4. Remaining boundary

The task lifecycle was closed once at `2026-08-18T13:13:45+09:00`. The
expected-digest write changed the plan digest from
`sha256:0cfe9a5900dca29158d1ce60dec6719ef54aa408371ce91f486c25a1e2ab1c25`
to
`sha256:b0e341513a1b19b84a35c1d4bf1702d817eac7a0f52fd7a9e1fcbea27595164a`.
Readback reports no active, ready, recommended, startable, or assurance-action
task.

This acceptance does not select a release or version, create or accept a
release candidate, commit or push Git state, create a tag or GitHub Release,
publish npm or VSIX artifacts, move a dist-tag, mutate an Issue, or advance a
plan. Those remain separately authorized operations.
