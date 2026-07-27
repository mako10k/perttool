# perttool

`perttool` is a local CLI for keeping PERT/CPM plans in reviewable text files.
It validates an Activity-on-Arrow plan, calculates precedence and
resource-constrained schedules, recommends the next task, and applies
source-preserving changes through preview-first commands.

The repository source now implements Grammar 4 and CLI Contract 5. The latest
published package remains Contract 4 `0.3.0`; release version selection and
publication for Contract 5 are separate work. Beta releases may contain
breaking CLI or schema changes. Version `0.3.0` requires Node.js 22 or later.
Contract 3 remains available by pinning `0.2.0`.

## Run without installing

Use `npx` for an occasional invocation and select Contract 4 explicitly:

```sh
npx --yes --package=perttool@0.3.0 -- perttool --version
npx --yes --package=perttool@0.3.0 -- perttool document check PLAN.pert
npx --yes --package=perttool@0.3.0 -- perttool dag next PLAN.pert --format json
npx --yes --package=perttool@0.3.0 -- perttool project migrate-unit PLAN.pert --to-unit day --diff
```

The equivalent explicit `npm exec` form is:

```sh
npm exec --yes --package=perttool@0.3.0 -- perttool --version
npm exec --yes --package=perttool@0.3.0 -- perttool document check PLAN.pert
npm exec --yes --package=perttool@0.3.0 -- perttool dag analyze PLAN.pert
npm exec --yes --package=perttool@0.3.0 -- perttool project migrate-unit PLAN.pert --to-unit day --diff
```

`npx` and `npm exec` may download the selected package version into the npm
cache. Pinning `0.2.0` selects Contract 3 and therefore does not accept the
temporal and migration surface in this README.

## Install

Install the CLI globally when it is used regularly:

```sh
npm install --global perttool
perttool --version
```

npm `latest` and `beta` both resolve to Contract 4 `0.3.0`. Use
`perttool@0.3.0` for an exact pin or `perttool@beta` to follow the beta
channel. Contract 3 remains available as `perttool@0.2.0`.

## Plan files

A `.pert` file is the source of truth and is intended to remain directly
readable. This temporal plan has one one-day task:

```text
project EXAMPLE:
  version 2
  title "Example plan"
  as_of 2026-07-26
  duration_unit day
  finish DONE

milestone NOW:
  title "Current frontier"
  state reached

milestone DONE:
  title "Done"
  deadline 2026-07-28

task WORK NOW -> DONE:
  title "Do the work"
  duration 1d
  not_before 2026-07-26
  deadline 2026-07-27
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
forecast. Grammar version 3 also accepts an exact Fraction such as `1/3d`;
versions 1 and 2 continue to accept Decimal duration tokens.

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
  --not-before 2026-07-26 \
  --deadline 2026-07-27 \
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

### Owner-aware governance

The published `0.3.0` package still uses Grammar 1/2/3 and CLI Contract 4. It
does not accept governance fields, `--actor`, or `--accepted-by-owner`, and it
does not enforce owner-aware writes. The repository source and locally built
or packed artifacts activate those surfaces together as Grammar 4 and CLI
Contract 5. Do not infer that local acceptance published a new package.

Under Contract 5, previews may omit actor and owner confirmation. A persistent
goal or DAG change requires an actor. An effective owner or delegate has direct
authority; another actor supplies repeatable `--accepted-by-owner` caller
assertions for every affected effective owner. The digest-bound pre-change
document determines owners and delegates, and an atomic batch must satisfy
every affected scope. The assertions are not authentication, verified
identity, signatures, or a durable approval audit.

For example, preview and then persist a DAG change as its effective owner:

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

Generated Contract 5 projects carry this maintenance warning:

```pert
# Existing .pert plans should normally be maintained through perttool commands; direct DSL editing bypasses goal/DAG owner-confirmation checks.
```

The warning is guidance, not technical prevention. A text editor, shell
command, or other program can bypass the tool-mediated check; Git and human
review remain external controls.

Use the dedicated migration route for exact whole-document conversion between
Point and time units. Preview before writing; the result inventories every
converted field and reports grammar upgrades and reversibility:

```sh
perttool project migrate-unit PLAN.pert --to-unit day --diff
perttool project migrate-unit PLAN.pert \
  --to-unit day \
  --write \
  --expect-digest 'sha256:...'

# A time-to-Point conversion requires an explicit relationship when needed.
perttool project migrate-unit PLAN.pert \
  --to-unit point \
  --replacement-velocity 20p/10d \
  --diff
```

Migration is not a `batch apply` member. Re-read and reanalyze the written
candidate before making a separate mutation.

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
| Migrate project units exactly | `perttool project migrate-unit <file> ...` |
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

Use `--format json` for machine consumers. Repository-source Contract 5
consumers must check `cli_contract_version == 5`; consumers pinned to the
published `0.3.0` package must continue to require Contract 4. In both cases,
check the result-specific `schema_version` before reading the rest of a result.
A complete, known, non-truncated `Perttool.NextResult.v4` with temporal policy
`recommendation_v1_plus_release_gate` is required. Start only task IDs in
`temporal.authority.startable_recommended_task_ids`; do not infer start
authority from the raw recommended set, the text summary, or `ready` alone.

Mutation JSON returns the candidate text, unified diff, UTF-16 text edits,
source digest, updated digest, diagnostics, and write result in one envelope.
Unknown schema versions, incomplete recommendation traces, `PTREC-*`
diagnostics, and future or unavailable temporal eligibility must fail closed.

## Documentation

- [Temporal and Unit Interface Contract (CLI Contract 4)](docs/specs/temporal-unit-interface.md)
- [Owner-Aware Governance Interface Contract (CLI Contract 5)](docs/specs/governance-interface.md)
- [Issue #4 governance implementation acceptance](docs/process/governance-acceptance.md)
- [CLI Contract 3 compatibility baseline](docs/specs/cli-contract-3.md)
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
