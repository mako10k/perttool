# Project Actuals Public Contract Acceptance

## Decision

`ACTUALS_PUBLIC_CONTRACT` is accepted as the atomic source cutover to Grammar
5 and CLI Contract 6. The standard parser, validator, formatter, mutation
services, package root, CLI, command discovery, help, Guide, schemas,
diagnostics, examples, and installed-package workflow expose the accepted
project-actuals contract together.

Git commit `753efea` retains the exact completed 6p pre-advance snapshot.
Canonical advance then removed the completed task and preceding reached
frontier, retained reached `ACTUALS_PUBLIC_READY`, and preserved
`ACTUALS_ACCEPTANCE` as the only ready recommendation. Package publication,
release tagging, and npm dist-tag movement remain separate authorization
boundaries.

This acceptance is subordinate to ADR 0006, the Project Actuals and Git
History Contract, Grammar 5, Graph semantics 2, Mutation semantics 2, and the
fourteen PACT cases. It does not authorize Git mutation, automatic declared
velocity adoption, or recommendation override apply/audit under MIG-08.

## Accepted public contract

| Concern | Accepted behavior |
| --- | --- |
| Source | Grammar versions 1 through 5 are accepted by the standard parser, validator, formatter, check, and source-preserving mutation paths. Grammar 5 provides task-owned work events and the `suspended` state without changing Grammar 1 through 4 meanings. |
| Lifecycle | `task start`, `task suspend`, `task resume`, and eventful `task finish` atomically update state and append one deterministic event. Event time is explicit; active time and effort remain separate exact inputs. |
| Analysis and selection | `Perttool.AnalysisResult.v4` and `Perttool.NextResult.v5` expose suspended tasks separately, release their resources, and retain complete normal start authority. |
| History | `project history` reads first-parent Git history without mutation and returns deterministic `Perttool.ProjectHistoryResult.v1` JSON/text with declared, removed, and qualified legacy evidence. |
| Observation | `project observe-velocity` returns deterministic `Perttool.VelocityObservationResult.v1` candidates and provenance. It never changes `project.velocity`. |
| Mutation | `Perttool.MutationResult.v3` covers governed lifecycle and advance. Advance removes task-owned work events with their completed task while retaining history through Git. |
| Unit migration | `Perttool.UnitMigrationResult.v3` inventories and converts Grammar 5 `work_event.planned_value`; occurrence time, active time, effort, and other actual evidence remain unchanged. |
| Public library | The standard package root exports the lifecycle, history, observation, Contract 6 projection, and Grammar 5 types and services without target-prefixed public names. |
| CLI discovery | One 33-command Contract 6 registry drives dispatch, option parsing, text help, JSON help, structured usage recovery, and result-schema discovery. |
| Guide and examples | The nine-topic Contract 6 Guide includes `actuals`; the runnable Grammar 5 plan and migration guide cover lifecycle, history, observation, and compatibility. |
| Compatibility | Existing Grammar 1 through 4 documents retain their meanings. Status-only finish remains available only for those grammars. Published `perttool@0.4.0` remains the separately accepted Grammar 4 and CLI Contract 5 artifact until a future release is authorized. |
| Side effects | Lifecycle and ordinary source writes retain preview, governance, expected-digest, and safe-write gates. History and observation are read-only. No command commits Git or adopts velocity automatically. |

## Acceptance evidence

The completed pre-advance snapshot passed:

```sh
npm test
npm run check:docs
npm run check:package
npm run check
git diff --check
```

The test suite covers:

- Grammar 5 parsing, validation, formatting, source preservation, event
  ownership, and legacy grammar rejection boundaries;
- start, suspend, resume, finish-only, complete, retry, conflict, and
  governed safe-write behavior;
- suspended precedence/resource analysis and complete NextResult v5
  authority;
- real temporary Git histories, first-parent reduction, advance removal,
  incomplete/unavailable results, and source/HEAD races;
- exact elapsed-hour, active-date, effort-productivity, and qualified
  Git-recorded observations with no declared-velocity write;
- Grammar 5 unit migration of planned values without rewriting actual
  measurements;
- Contract 6 command/help/Guide projections and structured usage recovery;
  and
- isolated tarball installation, file-first operation, lifecycle/history/
  observation smoke, and npm publication dry-run.

## Retained boundaries

This slice does not:

- run `git add`, `git commit`, `git push`, or any other Git mutation from a
  perttool command;
- write an observed velocity into project metadata automatically;
- implement override apply or durable authorization audit under MIG-08;
- close Issue #4 or activate Issue #3 deliverables;
- publish a package or GitHub Release; or
- move npm `alpha`, `beta`, or `latest`.
