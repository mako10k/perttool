# DSL examples

- [minimal.pert](minimal.pert): the smallest linear DAG without resources
- [pert-estimate.pert](pert-estimate.pert): a linear DAG that verifies exact expected value and variance from a three-point estimate
- [point-velocity.pert](point-velocity.pert): a parallel DAG that computes PERT in Points and obtains day forecasts from project-wide velocity
- [parallel.pert](parallel.pert): a DAG with dependency-parallel tasks, capacity-2 developer slots, and a capacity-1 exclusive facility
- [advance-partial-before.pert](advance-partial-before.pert): the pre-advance DAG where a done branch and an active branch join at an unreached milestone
- [advance-partial-after.pert](advance-partial-after.pert): the canonical advance result that removes only historical edges while retaining the done tasks needed for the join
- [recommendation.md](recommendation.md): normative cases and test perspectives for AI workflow-control ranking, resource conflicts, structured explanations, and human overrides
- [agent-guidance.md](agent-guidance.md): normative cases for provider/surface taxonomy, support evidence, guidance composition, staleness, and the read-only boundary
- [mermaid-profile.md](mermaid-profile.md): normative examples of lossless `%% perttool:` semantic records, digests, projections, and negative cases
- [temporal-units.md](temporal-units.md): active Grammar 2/3 and Contract 4 boundary cases for calendar projection, deadlines, start authority, exact Decimal-or-fraction Point/time migration, and deterministic text/JSON
- [governance-source.md](governance-source.md): accepted target Grammar 4 principal, omission-default, declared/effective metadata, compatibility, source-preservation, and unit/recommendation separation cases
- [governance.md](governance.md): accepted target governance authority and write-path cases for defaults, preview, owner/delegate assertions, atomic batches, safe-write composition, and direct-edit guidance

`.pert` files in this directory are normative samples for grammar version 1, semantics version 1, and analysis version 1. Grammar 2 source fixtures and Grammar 3 machine acceptance cases live under `test/fixtures/temporal-units/` and are active through Contract 4. `governance-source.md` and `governance.md` contain accepted target Grammar 4/interface cases that remain non-runnable until the atomic governance cutover; their machine baseline lives under `test/fixtures/governance/`. `recommendation.md` contains normative cases for implemented Recommendation interface version 1, and `agent-guidance.md` contains normative cases for implemented Agent Guidance interface version 1. `mermaid-profile.md` is the Mermaid adapter wire contract and export golden; tests fix the byte output of `exportMermaid` and `dag render --to mermaid`.

In `pert-estimate.pert`, `DESIGN` has expected value `13/6d` and variance `1/4d^2`. The precedence makespan including `BUILD` is `31/6d`, and the representative critical-task sequence is `[DESIGN, BUILD]`.

In `point-velocity.pert`, the baseline precedence makespan is `10p` and the resource makespan at capacity 1 is `15p`. Forecasts using `velocity 20p/10d` are `5d` and `7.5d`, respectively. CLI JSON returns baseline values and forecasts in separate fields.

Expected initial-heuristic results for the expected durations in `parallel.pert`:

| DEVELOPERS | TEST_ENV | Makespan | Resource arcs | Schedule-critical tasks |
| ---: | ---: | ---: | --- | --- |
| 2 | 1 | 8d | `CLI -> DOCS`, `TEST -> PACKAGE` | `CLI, DOCS, TEST, PACKAGE` |
| 3 | 1 | 7d | `TEST -> PACKAGE` | `CORE, TEST, PACKAGE` |
| 2 | 2 | 7d | `CLI -> DOCS` | `CLI, DOCS, TEST` |
| 3 | 2 | 6d | none | `CORE, TEST` |

The precedence lower bound without resources is 6d. At default capacity, `CORE` and `CLI` start at time 0, while `DOCS` waits for a developer slot. After integration, `TEST` starts first by priority and `PACKAGE` waits for the exclusive test environment. Use this table as the golden expectation for capacity what-if analysis.

The result of running canonical advance once from `advance-partial-before.pert` is semantically equivalent to `advance-partial-after.pert`. `BRANCH_A` is removed because its target, `A_DONE`, has been reached. In contrast, done `A_JOIN_WORK` remains because it is a join condition for unreached `JOINED`.
