# perttool

`perttool` is a local command-line tool for keeping PERT/CPM plans in
reviewable text files. It validates plans, calculates precedence and
resource-constrained schedules, recommends the next task, and previews every
change before writing it.

The current release is `0.10.5`. It requires Node.js 22 or later and uses
Grammar 8 and CLI Contract 9.

## Install

Install the current release for your user-managed Node.js environment:

```sh
npm install --global perttool@latest
perttool --version
```

Run it without installing:

```sh
npx --yes --package=perttool@latest -- perttool --version
npx --yes --package=perttool@latest -- perttool document check PLAN.pert
```

Use an exact version such as `perttool@0.10.5` when reproducibility matters.
See [CHANGELOG.md](CHANGELOG.md) and the [release records](docs/process/) for
older releases and rollback pins.

## Create your first plan

You can author the current canonical structure directly:

```pert
project EXAMPLE:
  version 8
  title "Example plan"
  as_of 2026-08-21
  duration_unit point
  velocity 1p/1d
  finish DONE

milestone NOW:
  title "Current frontier"
  state reached

milestone DONE:
  title "Work completed"

task WORK NOW -> DONE:
  title "Do the work"
  duration 1p
  status planned
```

Save it as `PLAN.pert`, then validate and canonically format it:

```sh
perttool document check PLAN.pert
perttool document format PLAN.pert --diff
```

Alternatively, `project init` can create the smallest valid starter file:

```sh
perttool project init EXAMPLE \
  --title "Example plan" \
  --initial-milestone NOW \
  --initial-milestone-title "Current frontier" \
  --finish NOW \
  --out PLAN.pert
```

For an existing plan, preview a change, read the current source digest, and
repeat the reviewed command with `--write` and `--expect-digest`:

```sh
perttool task set PLAN.pert WORK --status active --diff
perttool project show PLAN.pert --format json

perttool task set PLAN.pert WORK \
  --status active \
  --write \
  --expect-digest 'sha256:...'
```

`--out` creates a new file exclusively. `--write` atomically replaces the
input only when the supplied digest still matches. Existing files are never
silently overwritten.

## Inspect and schedule a plan

```sh
perttool document check PLAN.pert
perttool project show PLAN.pert
perttool dag analyze PLAN.pert
perttool dag next PLAN.pert
```

Use JSON for scripts and agents:

```sh
perttool dag next PLAN.pert --format json
```

Only `temporal.authority.startable_recommended_task_ids` grants new-start
authority. Do not treat a raw recommendation or a ready task as equivalent to
permission to start it.

Task estimates use Point values by default. A plan can declare a velocity such
as `20p/10d` to add time forecasts. Point analysis still works when no velocity
is declared; only the time forecast is unavailable.

## Update work safely

Mutation commands preview by default:

```sh
perttool task set PLAN.pert WORK --status active --diff
perttool task finish PLAN.pert WORK --diff
perttool dag advance PLAN.pert --diff
```

After review, apply the exact candidate with optimistic locking:

```sh
perttool task set PLAN.pert WORK \
  --status active \
  --write \
  --expect-digest 'sha256:...'
```

`dag advance` also protects removed history with Git `HEAD` and index evidence.
Commit the plan before advancing it. If local changes overlap history that the
candidate would remove, the command fails without writing. The exceptional
`--force-history-loss` option bypasses only the initial history-loss block; it
does not bypass governance, digest, race, or atomic-write checks.

Use `batch apply` when several changes must become valid atomically:

```sh
perttool batch apply PLAN.pert --request changes.json --diff
```

## Record actual work

Lifecycle commands record explicit event times and can include active time and
effort:

```sh
perttool task start PLAN.pert WORK \
  --at 2026-08-21T09:00:00+09:00 --diff
perttool task suspend PLAN.pert WORK \
  --at 2026-08-21T11:00:00+09:00 --reason "review" --diff
perttool task resume PLAN.pert WORK \
  --at 2026-08-21T12:00:00+09:00 --diff
perttool task finish PLAN.pert WORK \
  --at 2026-08-21T15:00:00+09:00 \
  --active-time 5 --effort 6 --diff
```

`perttool` never substitutes the system clock for a missing event time.
Project history is read-only:

```sh
perttool project history PLAN.pert --task WORK --format json
perttool project observe-velocity PLAN.pert \
  --task WORK --evidence all --format json
perttool dag history PLAN.pert --view timeline --format json
```

Observed velocity is evidence only. Adopting it is a separate reviewed
`project set --velocity` change.

## Migrate an existing plan

Check the file first. Diagnostics include the applicable migration route:

```sh
perttool document check PLAN.pert
```

Preview a complete migration to the current Grammar 8 form:

```sh
perttool document migrate PLAN.pert --target-grammar 8 --diff
```

Then apply the reviewed candidate:

```sh
perttool document migrate PLAN.pert \
  --target-grammar 8 \
  --write \
  --expect-digest 'sha256:...'
```

For deprecated `day` or `hour` plans, migrate duration values to Points
separately:

```sh
perttool project migrate-unit PLAN.pert --to-unit point --diff
perttool project migrate-unit PLAN.pert \
  --to-unit point \
  --replacement-velocity 20p/10d \
  --write \
  --expect-digest 'sha256:...'
```

Automatic migration is not required. You may edit a copy manually, then run
`perttool document format` and `perttool document check` to obtain and verify
the canonical target form. Detailed compatibility guidance is in the
[`0.9.4` to `0.10.0` migration guide](docs/process/0.9.4-to-0.10.0-migration.md)
and the built-in migration Guide:

```sh
perttool guide editing unit-migration --level detail
```

## Plan assurance

Plan assurance is optional. Initial sealing records reviewed task contracts
and planning bases atomically:

```sh
perttool plan-assurance seal PLAN.pert \
  --reason "Initial reviewed planning baseline" --diff
perttool plan-assurance show PLAN.pert --format json
```

After changing reviewed work, inspect the affected closure and reseal only the
selected tasks:

```sh
perttool plan-assurance reseal PLAN.pert \
  --task WORK \
  --reason "Accepted the updated plan" \
  --diff
```

In `0.10.5`, selected reseal also covers a newly added unsealed task when plan
assurance is already enabled. A plan with assurance entirely disabled still
uses the atomic `seal` command. Completed tasks require explicit
`task-outcome` records; status and Git history do not imply conformance.

## Ownership and review

A plan may declare goal and DAG owners. Preview first without owner assertions.
If the result reports that governance applies, repeat the exact candidate with
`--actor` and any required `--accepted-by-owner` values:

```sh
perttool gate add PLAN.pert APPROVAL NOW DONE \
  --reason "Approval required" \
  --diff

perttool gate add PLAN.pert APPROVAL NOW DONE \
  --reason "Approval required" \
  --actor user \
  --write \
  --expect-digest 'sha256:...'
```

Owner confirmations are caller assertions, not authentication or durable
approval records. Treat each value as a single-candidate, scope-bound
assertion. It
applies only to the exact candidate being reviewed and must not be reused
automatically.

Generated plans include this reminder:

```pert
# Existing .pert plans should normally be maintained through perttool commands; direct DSL editing bypasses goal/DAG owner-confirmation checks.
```

This warning is guidance, not technical prevention; Git and human review remain
external controls.

## Find commands and guidance

The CLI is the complete current command reference:

```sh
perttool --help
perttool task set --help
perttool help dag next
perttool guide workflows --level detail
perttool schema --format json
```

Common commands:

| Goal | Command |
| --- | --- |
| Validate or format | `document check`, `document format` |
| Create or inspect a project | `project init`, `project show` |
| Analyze or select work | `dag analyze`, `dag next` |
| Maintain the graph | `task`, `gate`, `milestone`, `resource` |
| Record lifecycle events | `task start`, `suspend`, `resume`, `finish` |
| Inspect history | `project history`, `dag history` |
| Maintain assurance | `plan-assurance`, `plan-dependency`, `task-outcome` |
| Migrate documents | `document migrate`, `project migrate-unit` |
| Discover machine contracts | `help --format json`, `schema` |

## Library use

The package exposes a platform-neutral `perttool/core` subpath and a Node.js
`perttool/node` subpath. JSON Schema artifacts are available through
`perttool/schemas/<schema-id>.schema.json`.

See the [Shared Library Boundary](docs/specs/shared-library.md),
[Document Session Core](docs/specs/document-session.md), and
[JSON Schema contract](docs/specs/json-schema.md) for API details. Automation
must check each result's `schema_version` and `cli_contract_version`; it must
not infer compatibility from `tool_version` alone.

## More documentation

- [Examples](docs/examples/README.md)
- [Current changelog and older versions](CHANGELOG.md)
- [Migration guides and release records](docs/process/)
- [Normative specifications](docs/specs/)
- [Developer guide](docs/development.md)
- [Product backlog](docs/backlog.md)
- [Security policy](SECURITY.md)

Repository setup, testing, architecture, contribution, and release procedures
belong in the developer and process documents rather than this user guide.

perttool is released under the [MIT License](LICENSE).
