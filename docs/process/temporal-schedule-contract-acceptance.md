# Calendar-Aware Temporal Scheduling Contract Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-17
- Baseline HEAD: `de6445d2b614e7cb6c36c7c894e90e7364cfba7a`
- Plan: [../../plans/temporal-schedule.pert](../../plans/temporal-schedule.pert)
- Plan task: `TEMPORAL_SCHEDULE_CONTRACT`
- Contract: [../specs/temporal-schedule.md](../specs/temporal-schedule.md)
- Machine cases:
  [../../test/fixtures/temporal-schedule-contract-v1.json](../../test/fixtures/temporal-schedule-contract-v1.json)
- llmthink review:
  [temporal-schedule-contract-review.think](temporal-schedule-contract-review.think)
- Target runtime: Grammar 8 and CLI Contract 9
- Active runtime: `perttool@0.9.4`, Grammar 7, CLI Contract 8
- Runtime status: not implemented
- Repository gate: scoped pass with one unchanged pre-existing shadow-golden mismatch

## 1. Accepted decision

Accept the integrated calendar-aware temporal scheduling contract before any
runtime implementation. The contract fixes one small Grammar 8 DSL for all
three selected backlog inputs:

- `CALENDAR-001`: generic calendar-backed renewable-resource availability and
  exact working-time scheduling;
- `CONSTRAINT-001`: task-start, task-finish, and milestone-reach earliest and
  latest bounds plus one goal-anchored required schedule; and
- `POSTDUE-001`: warning-only POSTDUE and POSTDUE_FORECAST projections with
  actionable project or target-scoped driver paths.

The accepted order remains calendar source, calendar-aware scheduler, event
bounds, required schedule, focused alert contract and Core, command
projections, atomic public activation, and installed acceptance. This record
does not authorize a POSTDUE-only or calendar-only public compatibility slice.

## 2. Complexity and supersession decision

The review rejected an additive design in which separate Grammar 8 fragments
would accumulate in the old calendar, deadline, and interface specifications.
Instead:

- `docs/specs/temporal-schedule.md` is the sole Grammar 8 temporal authority;
- the old temporal documents remain the exact Grammar 1 through 7 legacy
  baseline;
- Grammar 8 without the new profile fields retains the continuous profile;
- the user DSL adds only one `calendar` declaration, four project fields,
  four generic resource fields, and repeated `when` lines; and
- resource types, task calendar hierarchies, RRULE, named constraint catalogs,
  external synchronization, and exact optimization remain non-goals.

This scoped supersession preserves current results without forcing a future
reader to assemble the new temporal meaning from overlapping documents.

## 3. Resolved contract decisions

| ID | Accepted decision |
| --- | --- |
| `TSCR-001` | Pin one project IANA zone to source-selected tzdata 2026c, SHA-256 `e4a178a...02be4`, with explicit offset agreement and a closed 1970 through 2100 instant range. |
| `TSCR-002` | Expand weekly local half-open windows by instant membership; missing DST labels contribute no instant and both repeated-label instants are included. Split cross-midnight source into two civil-day windows. |
| `TSCR-003` | Select project calendar by default and let a resource calendar replace that default for the resource. Model task-specific windows with a dedicated required resource. |
| `TSCR-004` | Derive effective capacity from validity, then one non-overlapping exact-instant replacement, then calendar membership; values remain generic integers from zero through nominal capacity. |
| `TSCR-005` | Keep tasks logically non-preemptive but calendar-interruptible. End a work segment and release all requirements in a deterministic gap, permit gap reuse, then reacquire atomically with interrupted-task resume priority. |
| `TSCR-006` | Migrate `not_before` exactly to `when start earliest`; retain `deadline` as a separate advisory target and do not keep two Grammar 8 spellings. |
| `TSCR-007` | Treat same-event earliest-after-latest as invalid, equality as an exact event, and propagated contradiction as typed network infeasibility with signed slack. |
| `TSCR-008` | Anchor the required schedule to the earlier comparable project-finish latest bound or deadline, retain the target role, and perform exact precedence-only calendar subtraction without resource-leveling or optimality claims. |
| `TSCR-009` | Reuse one target evaluator for deadline and latest-bound comparison. Current POSTDUE suppresses only its matching forecast; precedence-infeasible proof outranks a merely late `optimal=false` resource heuristic. |
| `TSCR-010` | Bind project-finish alerts to the applicable existing representative critical path and intermediate alerts to target-scoped drivers; otherwise preserve explicit not-computed/unavailable state and exact analysis argv. |
| `TSCR-011` | Put task `when` in TaskPlanContract v2 while project calendars, resource availability, and milestone bounds remain ambient scheduling inputs. New temporal fields are ordinary governance maintenance but retain all assurance and safe-write gates. |
| `TSCR-012` | Reserve replacement Project, Check, Analysis, Next, Mutation, PlanAssurance, and UnitMigration results, three calendar commands, and one later atomic Contract 9 activation. Keep Advance v3 only if complete implementation evidence proves its shape sufficient. |

## 4. Machine-case trace

| Case range | Accepted boundary |
| --- | --- |
| `TSC-001` through `TSC-008` | legacy compatibility, closed DSL, pinned zone data, window/exception rules, calendar selection, generic capacity, and invalid source |
| `TSC-009` through `TSC-013` | exact hour/day/Point work, multi-resource intersection, gap allocation, active conflict, no-window proof, search limit, and zone range |
| `TSC-014` through `TSC-017` | `not_before` migration, task and milestone earliest bounds, latest bounds, exact events, duplicates, and local contradiction |
| `TSC-018` through `TSC-022` | goal anchor, intermediate propagation, network infeasibility, proof strength, and lifecycle/actual-time boundaries |
| `TSC-023` through `TSC-029` | current and forecast alerts, suppression, target identity, both driver kinds, exact argv, shared projection, truncation, and success exit |
| `TSC-030` through `TSC-032` | temporal start gate, unchanged recommendation, assurance/governance/migration, non-activation, and atomic public/package boundary |

Every case depends only on earlier case IDs. The fixture fixes the complete
source, identity, diagnostic, hard-limit, result, command, and runtime
non-activation inventories rather than inferring them from prose.

## 5. Compatibility and non-activation evidence

Direct runtime inspection established this unchanged active snapshot:

| Surface | Active result |
| --- | --- |
| package | `perttool@0.9.4` |
| grammar / CLI contract | 7 / 8 |
| command / root schema catalogs | 53 / 23 |
| root / Node / Core runtime exports | 129 / 129 / 45 |
| calendar command | absent |
| Grammar 8 target result schemas | absent |

The contract task changes no TypeScript runtime, schema artifact, Help or Guide
catalog, package manifest, dependency, adapter capability, public export,
release identity, or installed artifact. The target command count of 56 and
replacement schema identities remain reserved for the later atomic public
task.

## 6. Artifact identity

| Artifact | UTF-8 bytes | SHA-256 |
| --- | ---: | --- |
| `docs/specs/temporal-schedule.md` | 42,736 | `a5a58be51aa7a4a5efc954bbeaea62b52682152750cf3fa7e3860f5e6941ccbf` |
| `test/fixtures/temporal-schedule-contract-v1.json` | 17,345 | `321b8b13f8ccd6c09034f1ff6411733c98f2cb167c7959529920143a7a25b07d` |
| `test/temporal-schedule-contract.test.mjs` | 9,629 | `d712f5d197903bd285d166a8af2d381b762a5492b7ccedb816b8ae2b2baf004c` |
| `docs/process/temporal-schedule-contract-review.think` | 6,557 | `d6ee06b6788d50bd92a3180f5807328900b1eab350a658ad4d085a3b146c192c` |
| completed `plans/temporal-schedule.pert` | 14,014 | `47a9b6d548b540dbc6ab0c1fef330025973e29915de90997a6c7bf29d4105893` |

The task-status preview was bound to original source digest
`sha256:a1ff84359f5d74a576ab372b9cdab66cf1545b01a3a62eeabbdf7885525b2ea6`.
It added only `status done`, affected no governance scope, required no owner
confirmation, and was written once with the exact expected digest.

## 7. llmthink and consistency evidence

The committed llmthink review traces seven evidence inputs through eleven
decisions. Its DSL audit returned `fatal=0`, `error=0`, and `warning=0`.
Heuristic hints identify shared evidence and long quoted text for human review;
they do not report an unsupported reference, missing prerequisite,
contradiction, or unresolved pending decision.

The focused contract tests prove the one-DSL inventory, zone-data identity,
algorithm identities, generic availability and gap rules, constraints,
required schedule, alerts, drivers, hard limits, diagnostics, case ordering,
and exact active non-activation snapshot.

## 8. Executed gates and frontier

Acceptance executed:

```sh
npm run build
node --test test/temporal-schedule-contract.test.mjs
llmthink dsl audit docs/process/temporal-schedule-contract-review.think --pretty --limit 100
npm run check
npm run check:english
npm run check:docs
npm run check:self-use
npm run check:lsp-package
npm run check:mcp-package
npm run check:vsix-shell
npm run check:link
npm run check:package
git diff --check
```

The focused contract test passed 7/7. The static gate passed, and the complete
test invocation passed 1,105 of 1,106 tests. Its only failure is the unchanged
pre-existing recommendation shadow mismatch for `plans/editor-mutations.pert`:
the current source selects `EDITOR_RECOVERABLE_CONTRACT` at digest
`sha256:bb9fd570...04d3b4`, while the existing golden still selects
`EDITOR_REPAIR_ACCEPTANCE` at digest `sha256:fac511d0...87af00`. Neither that
plan nor `test/golden/self-use/recommendation-shadow.expected.json` differs
from baseline HEAD, so this contract acceptance does not rewrite unrelated
editor evidence.

Because the normal aggregate command stops at that known mismatch, the
remaining documentation, English, 43-plan read-only self-use, private LSP and
MCP package, supported VS Code 1.101.0 host and VSIX, temporary-link, and
725-file isolated public-package gates were invoked separately and passed.
`git diff --check` also passed. The completed plan has only the expected
non-blocking `PTDAG-208` for reached
`TEMPORAL_CONTRACT_ACCEPTED`. Fresh complete `Perttool.NextResult.v7`
recommends and makes startable only `CALENDAR_SOURCE_CORE`.

No `dag advance`, calendar runtime implementation, next-task start, release
selection, package or VSIX installation, Git remote write, publication,
dist-tag change, GitHub or Issue mutation, or external calendar operation is
part of this acceptance.
