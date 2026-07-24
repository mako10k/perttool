# CLI Contract 3 migration

- Status: Accepted migration design; implementation pending
- Date: 2026-07-24
- From: CLI contract 2 in perttool `0.1.0`
- Target: [CLI Contract 3](../specs/cli-contract-3.md)
- Plan: [CLI surface reset](../../plans/cli-surface-reset.pert)

## 1. Boundary

Contract 3 is a breaking post-beta CLI reset. The target package version will
be selected by the release task; this document does not preselect a version or
authorize publication.

Contract 2 remains the active public interface until the
`CLI_002_CONTRACT_V3_CUTOVER` change. The accepted design does not make
Contract 3 commands available in `0.1.0`.

At cutover:

- the command and JSON operation namespace changes atomically;
- `cli_contract_version=3` appears in every JSON envelope;
- help, README, examples, package smoke tests, and CHANGELOG change together;
- obsolete Contract 2 spellings fail instead of becoming aliases;
- the package is not accepted until the installed-package workflow passes.

## 2. Consumer mapping

| Contract 2 | Contract 3 | Consumer action |
| --- | --- | --- |
| `perttool dsl check` | `perttool document check` | Rename command and expect `operation=document.check`. |
| `perttool dsl format` | `perttool document format` | Rename command and expect `operation=document.format`. |
| `perttool dsl help` | `perttool guide` | Use `guide` only for domain topics and expect `Perttool.GuideResult.v1`. |
| exact `<resource> <action> --help` | `perttool help [resource [action]]` | Use JSON help for discovery; `--help` remains a text alias. |
| `perttool mutation apply` | `perttool batch apply` | Rename command and expect `operation=batch.apply`. |
| none | `perttool project init` | Use explicit minimal initialization; do not hand-author bootstrap syntax. |
| none | `perttool gate add|set|remove` | Use typed gate maintenance or an atomic batch. |

`agent help`, project show/set, DAG actions, task actions, milestone actions, and
resource actions retain their resource/action names.

## 3. Implementation sequence

The dependency order is fixed by `plans/cli-surface-reset.pert`.

1. `CONTRACT_V3_DESIGN` accepts requirements, specification, design, migration,
   and acceptance cases. It changes no runtime command.
2. `CLI_001_COMMAND_REGISTRY` makes one descriptor registry authoritative while
   preserving the active Contract 2 public surface.
3. `HELP_001_COMMAND_DISCOVERY`, `HELP_002_DOMAIN_GUIDE_SPLIT`, and
   `HELP_003_USAGE_RECOVERY` implement and test Contract 3 projections. Public
   Contract 3 names remain unavailable until cutover; internal Core APIs and
   fixtures may be completed earlier. `HELP_001_COMMAND_DISCOVERY` completed
   the internal top-level/resource/action query and deterministic text/JSON
   projection without exporting it from the package root or CLI.
   `HELP_003_USAGE_RECOVERY` completed the internal registry-scoped argv
   validation, exact structured help targets, deterministic error projection,
   and non-invented suggestions under the same publication boundary.
   `HELP_002_DOMAIN_GUIDE_SPLIT` completed the internal
   `Perttool.GuideResult.v1` text/JSON projection over the existing topic
   graph, preserved topic IDs and diagnostic links as `guide_topic`, and added
   installed-package checks without activating the public `guide` command.
4. `MUT_001_PROJECT_INIT` and `MUT_002_GATE_MAINTENANCE` close typed
   maintenance gaps. Project initialization Core/result projection/exclusive
   output and gate Core/atomic-batch support are complete with internal
   descriptors; their direct commands remain inactive until cutover.
5. `CLI_002_CONTRACT_V3_CUTOVER` activates all breaking names and operations in
   one versioned change and removes Contract 2 acceptance.
6. `CLI_003_FILE_FIRST_ACCEPTANCE` verifies the installed package and accepts
   the complete workflow.

Do not mark an implementation prerequisite complete by changing only help or
documentation. Do not expose a renamed command from a separate partial
release.

## 4. Compatibility window

The compatibility window is documentation and prerelease review before the
Contract 3 package is accepted. Runtime dual emission is not provided.

- Before cutover, Contract 2 works and Contract 3 renames are not advertised.
- At and after cutover, Contract 3 works and the renamed Contract 2 spellings
  return exit 2 with a Contract 3 `help_target`.
- There is no `--cli-contract 2`, alias period, or automatic command rewrite.
- Consumers needing more migration time pin the last Contract 2 package.

This strict boundary prevents LLMs from learning two apparently canonical
spellings and prevents command-help completeness checks from tolerating hidden
aliases.

## 5. Verification and release evidence

The cutover change must demonstrate:

- all `CLI3-*` cases in the Contract 3 specification;
- registry/dispatch/help completeness and deterministic JSON;
- direct Core/CLI parity for help, initialization, and gate mutations;
- explicit failure of all four renamed Contract 2 routes;
- package README and `npx` examples using only Contract 3;
- local-link and isolated-tarball behavior;
- unchanged semantic results for check, format, analyze, next, advance, render,
  import, and existing entity mutation beyond their operation-name mapping.

Publication, npm dist-tag mutation, and GitHub release creation require their
normal separate authorization and release gates. Completing the local cutover
does not authorize any external write.

## 6. Failure, restart, and rollback

Before public cutover, a failing prerequisite leaves Contract 2 active and the
corresponding plan task incomplete. Record the blocker on that task and rerun
check/analyze/next; do not skip to cutover.

After a Contract 3 package is published, rollback means selecting and
installing the last Contract 2 package or publishing a separately reviewed
fix. Do not restore mixed aliases in a patch as an undocumented rollback.

A failed installed-package acceptance leaves
`CLI_003_FILE_FIRST_ACCEPTANCE` incomplete. Correct the implementation, rebuild
one verified tarball, and rerun the complete acceptance workflow.
