# CLI Contract 3 migration

- Status: Source cutover and installed-package acceptance complete
- Date: 2026-07-24
- From: CLI contract 2 in perttool `0.1.0`
- Target: [CLI Contract 3](../specs/cli-contract-3.md)
- Plan: [CLI surface reset](../../plans/cli-surface-reset.pert)
- Release: [`v0.2.0` procedure](0.2.0-release.md)

## 1. Boundary

Contract 3 is a breaking post-beta CLI reset. The release decision selects
suffix-free `0.2.0` as its first package version. Version selection does not
authorize publication.

`CLI_002_CONTRACT_V3_CUTOVER` remains the accepted source history for `0.2.0`.
Published `0.1.0` remains Contract 2, published `0.2.0` remains Contract 3,
and the current source has advanced atomically to Contract 4 for the
separately gated `0.3.0` release.

The cutover:

- the command and JSON operation namespace changes atomically;
- `cli_contract_version=3` appears in every JSON envelope;
- help, README, examples, package smoke tests, and CHANGELOG change together;
- obsolete Contract 2 spellings fail instead of becoming aliases;
- installed-package acceptance is local release evidence, not publication.

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
5. `CLI_002_CONTRACT_V3_CUTOVER` activated all breaking names and operations in
   one versioned source change and removed Contract 2 acceptance.
6. `CLI_003_FILE_FIRST_ACCEPTANCE` verified the installed package and accepted
   the complete workflow.

Do not mark an implementation prerequisite complete by changing only help or
documentation. Do not expose a renamed command from a separate partial
release.

## 4. Compatibility window

The compatibility window is documentation and prerelease review before a
Contract 3 release is published. Runtime dual emission is not provided.

- Published `0.1.0` remains the Contract 2 artifact.
- Explicitly pinned `0.2.0` uses Contract 3, and the renamed Contract 2 spellings
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

Publication, npm dist-tag mutation, and GitHub release creation require the
separate `v0.2.0` authorization and release gates. Completing the local
cutover, installed-package acceptance, and version selection does not authorize
any external write.

## 6. Failure, restart, and rollback

Before the completed source cutover, a failing prerequisite would have left
Contract 2 active and the corresponding plan task incomplete. That restart
rule remains historical evidence; do not restore a mixed surface if later
acceptance fails.

After a Contract 3 package is published, rollback means selecting and
installing the last Contract 2 package or publishing a separately reviewed
fix. Do not restore mixed aliases in a patch as an undocumented rollback.

Before the completed installed-package acceptance, a failure left
`CLI_003_FILE_FIRST_ACCEPTANCE` incomplete. That restart rule remains the rule
for future release-candidate regressions: correct the implementation, rebuild
one verified tarball, and rerun the complete acceptance workflow.
