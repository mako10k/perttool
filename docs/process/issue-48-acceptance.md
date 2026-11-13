# Issue #48 implementation acceptance

## Authority and review boundary

The owner directed continued implementation of the remaining 18p within a
12–24 engineer-hour budget on 2026-11-13, starting with the public contract.
The original source is the user continuation instruction dated 2026-11-13
in this task conversation, immediately preceding the public-contract phase.
The preceding sentence is an English interpretation of that instruction.
The accepted functional priorities are maximum startable task count and the
allocatable resource units of an overflowing equal-ranked boundary group.

This record is implementation self-review. It covers local source, public
contracts, the normal consumer entrypoints and disposable installed-package
verification. Package metadata retains 0.12.3 as the development baseline.
Release version selection and operational publication have separate scope.

## Delivered behavior

Normal selectNextTasks, CLI Contract 12, MCP Next wire v2, editor DAG focus
and Planning Pool execution context use the same exact selection. NextResult
v10 carries recommendation model 2, selected and deferred tasks, exact
capacity evidence, boundary-group membership and per-resource allocatable,
selected and remaining units. Active tasks consume capacity before selection.
Temporal and assurance eligibility are applied before optimization.

The engineering tie-break maximizes the selected-count vector of existing
semantic rank groups after total task count, followed by stable task IDs.
Group budgets are conditional on selections outside that group. The decision
commitment includes the complete normalized selection input. These choices
are recorded in ADR 0011 and public contract revision 1.1.

Next supports existing --capacity RESOURCE=N at zero and positive values.
Individually oversized tasks remain deferred while fitting tasks can start.
When a complete forecast cannot be computed under the applied capacities,
schedule_critical and schedule_alerts are null. Source validity, active
allocation, governance and assurance checks retain their established owners.
The implementation introduces no search cutoff, heuristic fallback or new
product permission prerequisite.

## Acceptance trace

| Requirement or consumer | Direct verification |
| --- | --- |
| Count-first selection | Capacity 2 selects two one-unit tasks ahead of one two-unit task. The exact core matches an independent exhaustive oracle. |
| Overflowing semantic tie | The three-task tied group receives two allocatable units after active and outside-group allocation, selects two and reports zero remaining units. |
| Supported inputs | Zero capacities, free tasks, multiple resources, active allocations, impossible tasks, temporal exclusions and assurance withholding have focused coverage. |
| Source-bound decisions | Raw-byte identity, normalized capacity ordering, complete input commitments and stale override rejection have focused coverage. |
| Public contracts | Seven public-contract tests verify registered schemas, fixed examples, closed success requirements, description records and exact MCP schema projection. |
| Current consumers | Fifteen adoption tests exercise API, actual CLI file/stdin, MCP, editor focus, Planning Pool and override dispatch. |
| Historical consumers | Explicit v9 and model-1 tests retain their real version-specific selectors and schemas. NextResult v9 and OverrideDecision v1 schema bytes match HEAD. |
| Public package | Temporary isolated installation of the 1,190-file package passed package-root, schema, installed contract and guard checks. |
| Private adapters | Isolated LSP and MCP package checks passed. VSIX checks passed under VS Code 1.101.0, including trusted/untrusted use, replacement and uninstall readback. |
| Existing plans | All 50 existing self-use plans passed read-only check, analysis and Next verification. |
| Public type surface | Standalone emitted-declaration consumers compile current v10/v2 and retained v9/v1 override calls. Runtime exports are 155 root, 155 Node and 51 Core. |
| Static quality | Type checks and existing ratchets pass. Duplication is 148 clones, 2,733 lines and 2.524 percent. Complexity checks cover 5,665 functions and 168 existing baseline entries. |

The active command and schema catalogs contain 75 commands and 33 entries.
Grammar 1 through 10 remains readable. The normal contract identities are
NextResult v10 and OverrideDecision v2. Version-specific compatibility
identities remain available.

## Verification qualification

An intermediate editor-repair stdio test exceeded its existing five-second
response timeout and left a disposable child process alive. Its producing
cause remains unconfirmed. The test now registers child-process cleanup.
Focused retries and subsequent complete supported-host runs passed. This
record makes no claim that the transient timeout mechanism was repaired.

The temporary-link gate detected missing existing Guide sections during
adoption. The classification and upcoming-explanation sections were restored,
and the repeated gate passed. No baseline ratchet was relaxed.

## Completion evidence

Final sequential runs set both the parent executable and child-process PATH
to the selected supported host. Node.js 22.22.3 passed all 1,497 tests in
155.85 seconds. Node.js 24.19.0 passed all 1,497 tests in 214.91 seconds.
Both runs had zero failures, cancellations and skips.

MAX_COUNT_ACCEPTANCE finished through a digest-guarded CLI write at
2026-11-13T16:41:52+09:00. All four plan tasks and 19p are complete, including
the 18p authorized for this continuation. Check, analysis and complete v10
Next readback succeeded. Precedence and resource makespans are zero. There
are no active, ready, recommended or startable tasks. Four PTDAG-208
warnings identify closure-reached milestones whose completed
declarations remain available in the pre-advance plan.

The final plan source digest is
`sha256:4c33e352f47fb5864cd4aa0cd49a598d34a8c4ac0dc7d6ae0918ebef4de86198`.
Recorded start/finish events describe elapsed intervals. No engineer-effort
or observed-velocity measurement is inferred from those timestamps.
The public-contract and final acceptance manifests record path/digest claims.
