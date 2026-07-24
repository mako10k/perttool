# perttool

`perttool` is a local CLI for keeping PERT/CPM plans in reviewable text files.
It validates an Activity-on-Arrow plan, calculates precedence and
resource-constrained schedules, recommends the next task, and applies
source-preserving changes through preview-first commands.

The first beta is `0.1.0`. Beta releases may contain breaking CLI or schema
changes. The current source baseline is Node.js 22 or later. The already
published `0.1.0` artifact still declares Node.js 24; the lower baseline takes
effect in the next package release.

## Run without installing

Use `npx` for an occasional invocation:

```sh
npx --yes perttool@latest --version
npx --yes perttool@latest dsl check PLAN.pert
npx --yes perttool@latest dag next PLAN.pert --format json
```

The equivalent explicit `npm exec` form is:

```sh
npm exec --yes --package=perttool@latest -- perttool --version
npm exec --yes --package=perttool@latest -- perttool dag analyze PLAN.pert
```

`npx` and `npm exec` may download the selected package version into the npm
cache. Pin a version such as `perttool@0.1.0` when reproducible automation is
more important than following `latest`.

## Install

Install the CLI globally when it is used regularly:

```sh
npm install --global perttool
perttool --version
```

Both npm `latest` and `beta` currently resolve to `0.1.0`. Until the next
version is published, use Node.js 24 for those registry tags.

## Plan files

A `.pert` file is the source of truth and is intended to remain directly
readable. This minimal plan has one one-day task:

```text
project EXAMPLE:
  version 1
  title "Example plan"
  duration_unit day
  finish DONE

milestone NOW:
  title "Current frontier"
  state reached

milestone DONE:
  title "Done"

task WORK NOW -> DONE:
  title "Do the work"
  duration 1d
```

Save it as `PLAN.pert`, then inspect it with:

```sh
perttool dsl check PLAN.pert
perttool project show PLAN.pert
perttool dag analyze PLAN.pert
perttool dag next PLAN.pert --format json
```

Task duration can use deterministic `day`, `hour`, or relative `point` units.
Point plans declare a project-wide velocity such as `20p/10d`. Analysis keeps
the exact point result and reports the time conversion separately as a velocity
forecast.

## Maintain a plan through the CLI

Read the file for its complete human-facing state. Use CLI mutation commands for
routine maintenance so that each candidate is parsed and semantically checked
before it can be written.

```sh
# Preview a source-preserving change.
perttool task set PLAN.pert WORK --status active --diff

# Obtain the current digest for optimistic locking.
perttool project show PLAN.pert --format json

# Apply the reviewed change atomically.
perttool task set PLAN.pert WORK \
  --status active \
  --write \
  --expect-digest 'sha256:...'

# Finish a task, inspect the new frontier, then remove completed history.
perttool task finish PLAN.pert WORK --diff
perttool dag next PLAN.pert --format json
perttool dag advance PLAN.pert --diff
```

All formatter and mutation commands preview by default. `--write` replaces the
input through the safe-write path, while `--out` exclusively creates a new
file. Use `mutation apply` when several changes must become valid atomically:

```sh
perttool mutation apply PLAN.pert --request changes.json --diff
perttool mutation apply PLAN.pert \
  --request changes.json \
  --write \
  --expect-digest 'sha256:...'
```

The current beta accepts gate add/set/remove requests inside `mutation apply`.
Direct gate commands and the `project init` command activate together with the
rest of Contract 3; the implemented initialization Core is not a public CLI
command in Contract 2. The remaining cutover work is tracked in the
[product backlog](docs/backlog.md).

## Command map

| Goal | Command |
| --- | --- |
| Validate a document | `perttool dsl check <file>` |
| Canonically format it | `perttool dsl format <file>` |
| Read project metadata | `perttool project show <file>` |
| Change project metadata | `perttool project set <file> ...` |
| Analyze schedules | `perttool dag analyze <file>` |
| Select next work | `perttool dag next <file>` |
| Remove completed history | `perttool dag advance <file>` |
| Export or import Mermaid | `perttool dag render`, `perttool dag import` |
| Maintain tasks | `perttool task add|set|remove|finish` |
| Maintain milestones | `perttool milestone add|set|remove` |
| Maintain resources | `perttool resource add|set|remove` |
| Apply an atomic batch | `perttool mutation apply` |
| Read DSL guidance | `perttool dsl help` |
| Read coding-agent guidance | `perttool agent help` |

Run `perttool --help` for the complete current syntax. Command-specific help is
available without a document, for example:

```sh
perttool task set --help
perttool dag next --help
perttool dsl help editing --level detail --format json
```

## LLM and automation use

Use `--format json` for machine consumers. Check `schema_version` before reading
the rest of a result. A complete, known `Perttool.NextResult.v3` recommendation
graph is the task-selection authority; do not infer authority from the text
summary or from `ready` alone.

Mutation JSON returns the candidate text, unified diff, UTF-16 text edits,
source digest, updated digest, diagnostics, and write result in one envelope.
Unknown schema versions, incomplete recommendation traces, and `PTREC-*`
diagnostics must fail closed.

## Documentation

- [CLI interface](docs/specs/interfaces.md)
- [DSL grammar](docs/specs/dsl-grammar.md)
- [Graph semantics](docs/specs/graph-semantics.md)
- [Analysis semantics](docs/specs/analysis.md)
- [Mutation semantics](docs/specs/mutation.md)
- [Recommendation semantics](docs/specs/recommendation.md)
- [Examples](docs/examples/README.md)
- [Developer guide](docs/development.md)
- [Product backlog](docs/backlog.md)

## Security and license

Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).
perttool is released under the [MIT License](LICENSE). See
[CHANGELOG.md](CHANGELOG.md) for release changes and known limitations.
