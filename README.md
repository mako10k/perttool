# perttool

`perttool` is a local CLI for keeping PERT/CPM plans in reviewable text files.
It validates an Activity-on-Arrow plan, calculates precedence and
resource-constrained schedules, recommends the next task, and applies
source-preserving changes through preview-first commands.

The first beta is `0.1.0`. Beta releases may contain breaking CLI or schema
changes. The current source baseline is Node.js 22 or later. The already
published `0.1.0` artifact still uses CLI Contract 2 and declares Node.js 24.
This README describes the Contract 3 source that will be included in the next
package release; the lower runtime baseline also takes effect in that release.

## Run without installing

Use `npx` for an occasional invocation:

```sh
npx --yes perttool --version
npx --yes perttool document check PLAN.pert
npx --yes perttool dag next PLAN.pert --format json
```

The equivalent explicit `npm exec` form is:

```sh
npm exec --yes --package=perttool -- perttool --version
npm exec --yes --package=perttool -- perttool document check PLAN.pert
npm exec --yes --package=perttool -- perttool dag analyze PLAN.pert
```

`npx` and `npm exec` may download the selected package version into the npm
cache. Pin the future Contract 3 release version when reproducible automation
is more important than following the default npm tag. Pinning `0.1.0` selects
the prior Contract 2 interface and therefore does not accept the commands in
this README.

## Install

Install the CLI globally when it is used regularly:

```sh
npm install --global perttool
perttool --version
```

Both npm `latest` and `beta` currently resolve to the prior `0.1.0` artifact.
Until the next version is published, use Node.js 24 and the documentation
bundled with `0.1.0` for those registry tags.

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
perttool document check PLAN.pert
perttool project show PLAN.pert
perttool dag analyze PLAN.pert
perttool dag next PLAN.pert --format json
```

Task duration can use deterministic `day`, `hour`, or relative `point` units.
Point plans declare a project-wide velocity such as `20p/10d`. Analysis keeps
the exact point result and reports the time conversion separately as a velocity
forecast.

## Maintain a plan through the CLI

Read the file for its complete human-facing state. Use CLI maintenance commands
so that each candidate is parsed and semantically checked before it can be
written. To bootstrap a plan without hand-authoring syntax, preview the
smallest valid document and then create a new file exclusively:

```sh
perttool project init EXAMPLE \
  --title "Example plan" \
  --duration-unit day \
  --initial-milestone NOW \
  --initial-milestone-title "Current frontier" \
  --finish NOW

perttool project init EXAMPLE \
  --title "Example plan" \
  --duration-unit day \
  --initial-milestone NOW \
  --initial-milestone-title "Current frontier" \
  --finish NOW \
  --out PLAN.pert
```

For an existing plan:

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
file. Gate maintenance uses the same controls:

```sh
perttool gate add PLAN.pert APPROVAL NOW DONE \
  --reason "Approval required" \
  --diff
```

Use `batch apply` when several changes must become valid atomically:

```sh
perttool batch apply PLAN.pert --request changes.json --diff
perttool batch apply PLAN.pert \
  --request changes.json \
  --write \
  --expect-digest 'sha256:...'
```

## Command map

| Goal | Command |
| --- | --- |
| Discover commands | `perttool help [resource [action]]` |
| Read domain guidance | `perttool guide [topic [subtopic]]` |
| Validate a document | `perttool document check <file>` |
| Canonically format it | `perttool document format <file>` |
| Initialize a project | `perttool project init ...` |
| Read project metadata | `perttool project show <file>` |
| Change project metadata | `perttool project set <file> ...` |
| Analyze schedules | `perttool dag analyze <file>` |
| Select next work | `perttool dag next <file>` |
| Remove completed history | `perttool dag advance <file>` |
| Export or import Mermaid | `perttool dag render`, `perttool dag import` |
| Maintain tasks | `perttool task add|set|remove|finish` |
| Maintain gates | `perttool gate add|set|remove` |
| Maintain milestones | `perttool milestone add|set|remove` |
| Maintain resources | `perttool resource add|set|remove` |
| Apply an atomic batch | `perttool batch apply` |
| Read coding-agent guidance | `perttool agent help` |

Run `perttool --help` for the text command catalog. `help` is the complete
command contract for humans and machine consumers, while `guide` explains
domain concepts. Both run without a document:

```sh
perttool task set --help
perttool help dag next --format json
perttool guide editing --level detail --format json
```

## LLM and automation use

Use `--format json` for machine consumers. Check both
`cli_contract_version == 3` and the result-specific `schema_version` before
reading the rest of a result. A complete, known `Perttool.NextResult.v3`
recommendation graph is the task-selection authority; do not infer authority
from the text summary or from `ready` alone.

Mutation JSON returns the candidate text, unified diff, UTF-16 text edits,
source digest, updated digest, diagnostics, and write result in one envelope.
Unknown schema versions, incomplete recommendation traces, and `PTREC-*`
diagnostics must fail closed.

## Documentation

- [CLI Contract 3](docs/specs/cli-contract-3.md)
- [Migration from CLI Contract 2](docs/process/cli-contract-3-migration.md)
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
