# Document Migration Path

Status: Issue #22 compatibility correction accepted locally on 2026-08-20.

## Requirement

When a command requires a newer document grammar, the CLI must expose a
complete route to that grammar. Automatic migration is optional. A manual
route is sufficient only when CLI output shows the correct complete target
form, the provenance of values the user must supply, and the command that
revalidates the edited document.

For the current Contract 9 boundary, `dag advance` requires the Grammar 7
milestone-acceptance model. Therefore `document migrate` accepts both of the
following targets:

- `--target-grammar 7` invokes the existing repository-bound milestone-
  acceptance migration. It requires a committed stage-0 source and emits the
  exact migration baseline used by later history and advance checks.
- `--target-grammar 8` retains the source-preserving Grammar 7 to Grammar 8
  temporal migration.

The two targets retain their distinct result identities. Contract 9 discovery
lists `Perttool.MilestoneAcceptanceMigrationResult.v1` and
`Perttool.UnitMigrationResult.v4`; each execution returns the applicable one
with `cli_contract_version` 9. Other target values fail during command
validation.

## Workflow

For a Grammar 1 through 6 repository document:

```console
perttool document migrate plan.pert --target-grammar 7 --format json
perttool document migrate plan.pert --target-grammar 7 --write --expect-digest sha256:<source-digest>
perttool document check plan.pert
perttool dag advance plan.pert --diff
```

For a Grammar 7 document that needs temporal scheduling:

```console
perttool document migrate plan.pert --target-grammar 8 --format json
```

The correction does not change either migration model, milestone acceptance,
history proof, governance, safe-write behavior, advance force semantics, or
unrelated commands.
