# ADR 0003: `0.x.x` beta versioning and Issue #2 scope

- Status: Accepted
- Date: 2026-07-23
- Amended: 2026-07-23 (`v0.1.0` explicit `latest` promotion);
  2026-07-24 (`v0.2.0` Contract 3 release target);
  2026-07-25 (`v0.2.0` explicit `latest` promotion and `v0.3.0` Contract 4
  release target);
  2026-07-26 (`v0.3.0` explicit `latest` promotion);
  2026-07-27 (`v0.4.0` Contract 5 release target);
  2026-07-28 (`v0.4.0` beta publication, acceptance, and explicit `latest`
  promotion);
  2026-07-29 (`v0.5.0` Grammar 5 and Contract 6 release target);
  2026-07-30 (`v0.5.1` compatible Contract 6 patch release target and
  publication; `v0.5.2` compatible JSON Schema patch release target and
  publication; retirement of the obsolete npm `alpha` dist-tag);
  2026-07-31 (`v0.6.0` advance history safety release target);
  2026-08-04 (`v0.7.0` conditional plan assurance release target);
  2026-08-05 (`v0.7.1` Help and Guide consistency patch target);
  2026-08-07 (`v0.8.0` adapter platform and historical DAG beta target)
- Supersedes: ADR 0002's decision to consider `v0.1.0` a stable candidate

## Context

`v0.1.0-alpha.2` completed the MVP acceptance criteria, recommendation authority, distribution of one artifact through GitHub and npm, and installation from the registry. The next publication stage requires read-only guidance that applies AI Project Control Plane decisions to each coding agent.

Operating long-lived SemVer prerelease suffixes would duplicate the product maturity defined by perttool in npm and GitHub notation. Because breaking changes are allowed before 1.0, each version does not need to retain a `-beta` suffix.

## Decision

- `v0.1.0-alpha.2` is the final alpha.
- The first beta candidate is suffix-free `0.1.0`.
- Define `0.x.x` as perttool's beta series and do not use `-alpha` or `-beta` suffixes.
- The stable series begins with a future `1.0.0`. npm `latest` does not declare stability; it identifies the explicitly recommended default installation version.
- Do not require strict compatibility from alpha to the first beta. Necessary breaking changes are allowed.
- A breaking change updates the affected schema version, specifications, migration guidance, CHANGELOG, and tests in the same logical change.
- Treat alpha dogfooding, local linking, and GitHub/npm artifact installation as a sufficient usage period for the beta transition; do not require an additional soak period.
- Include the read-only AI Agent Guidance Registry v1 from [Issue #2](https://github.com/mako10k/perttool/issues/2) in beta scope.
- Do not include the backlog hierarchy and multi-plan composition from Issue #3, the LSP server, VSIX, MCP server, or guidance audit, scaffolding, and enforcement in the beta entry gate.
- Publish to npm under the `beta` dist-tag without changing the existing `latest` tag in that publication operation. After release acceptance, only a separately authorized dist-tag operation explicitly approved by a human may promote the accepted beta to `latest`.
- Maintain only the npm `beta` and `latest` distribution channels. Do not
  publish through or retain an `alpha` dist-tag. Historical alpha versions
  remain installable by exact version pin; reintroducing an alpha channel
  requires a new release-policy decision and separately authorized dist-tag
  creation.
- Publish a suffix-free `0.x.x` GitHub Release as a prerelease to match product maturity.
- Select suffix-free `0.2.0` for the first package that publishes the accepted
  breaking CLI Contract 3 surface. `0.1.1` would understate the compatibility
  change, while `1.0.0` remains reserved for a future stable-series decision.
- Select suffix-free `0.3.0` for the first package that publishes accepted
  Grammar 3, temporal/deadline results, exact unit migration, NextResult v4
  normal authority, and the breaking CLI Contract 4 surface. `0.2.1` would
  understate the public grammar, command, schema, and authority changes.
- Select suffix-free `0.4.0` for the first package that publishes accepted
  Grammar 4, owner-aware goal and DAG mutation governance, and the breaking
  CLI Contract 5 surface. `0.3.1` would understate the grammar, JSON schema,
  command-option, and persistent-write authority changes.
- Select suffix-free `0.5.0` for the first package that publishes accepted
  Grammar 5 work events and suspended state, governed lifecycle mutations,
  read-only project history and velocity observation, and the breaking CLI
  Contract 6 surface. `0.4.1` would understate the grammar, command, result
  schema, and lifecycle compatibility boundary.
- Select suffix-free `0.5.1` for the backward-compatible Contract 6 patch
  that adds read-only JSON Schema discovery and bundled result artifacts and
  accepts Git 2.54's strict `Z` UTC commit-time form. Existing Grammar 5
  meanings, command descriptors, result identities, payload meanings, and
  package-root exports are retained; a new minor or Contract 7 would
  overstate this additive and corrective boundary.
- Select suffix-free `0.5.2` for the backward-compatible Contract 6 patch
  that completes underspecified nested result schemas and adds explicit
  `full` and reference-based `outline` schema views. Existing Grammar 5,
  runtime result identities and payload meanings, default schema lookup
  mode and query projection, commands, and package-root values are retained;
  a new minor, Contract 7, or result-identity cutover would overstate this
  corrective and opt-in boundary.
- Select suffix-free `0.6.0` for the first package that publishes the accepted
  ADV-001 repository-aware `dag advance --write` guard and the ADV-002
  repository-clean candidate correction. `dag advance` changes from the
  closed published `Perttool.MutationResult.v3` identity to
  `Perttool.AdvanceResult.v1`, adds the required nullable `history_guard`, and
  adds exact `--force-history-loss` recovery. `0.5.6` would understate that
  result-identity and write-safety boundary. Grammar 5, CLI Contract 6 command
  names, existing option defaults, and every non-advance result identity
  remain unchanged, so Contract 7 or Grammar 6 would overstate it.
- Select suffix-free `0.7.0` for the first package that publishes the accepted
  Grammar 6 and CLI Contract 7 conditional plan-assurance boundary. The
  command registry, result identities, governance interface, recommendation
  start-authority policy, advance semantics, schema catalog, and package root
  change together. `0.6.1` would understate this breaking public boundary,
  while `1.0.0` remains reserved for a future stable-series decision.
- Select suffix-free `0.7.1` for the backward-compatible Contract 7 patch that
  publishes the accepted `GUIDE-CONSISTENCY-001` corrections to Guide meaning,
  Help examples, diagnostic navigation, conversion-diagnostic coverage, and
  current-versus-historical documentation labels. Grammar 6, CLI Contract 7,
  command and option identities, result and schema identities, payload
  structure, package-root exports, and authority remain unchanged. Leaving the
  correction unreleased would strand runtime guidance fixes in source, while
  `0.8.0` would overstate this corrective boundary.
- Select suffix-free `0.8.0` for the additive Contract 7 package that publishes
  the accepted `perttool/core` and `perttool/node` subpaths, read-only
  `dag history`, `Perttool.HistoricalGraphResult.v1`, the twenty-first root
  schema, the 122-name root and Node facade, and the declaration-identity
  correction. `0.7.2` would understate the new command, schema, and public
  subpath boundary. Grammar 6, CLI Contract 7, existing meanings, and
  start-authority semantics remain unchanged, so a new Grammar or Contract
  version would overstate it. Private LSP, VSIX, and MCP packages remain
  excluded from the public npm artifact.

On 2026-07-23, after `v0.1.0` beta acceptance, the user explicitly promoted `perttool@0.1.0` to npm `latest`. The `beta` tag continues to point to the same version, and `alpha` remains on `0.1.0-alpha.2`.

On 2026-07-24, after source and isolated-package acceptance of CLI Contract 3,
the user selected `0.2.0` as the next release target. The
[`v0.2.0` release procedure](../process/0.2.0-release.md) governs preparation,
authorization, distribution, and acceptance. This selection does not itself
change package identity or authorize an external write.

On 2026-07-25, after `v0.2.0` beta acceptance, the user explicitly promoted
`perttool@0.2.0` to npm `latest`. Registry reads and an isolated
`perttool@latest` installation confirmed that `beta` and `latest` both resolve
to Contract 3 `0.2.0`; `alpha` remains on `0.1.0-alpha.2`. Product maturity
remains beta.

On 2026-07-25, the user selected the next meaningful release as `0.3.0` and
authorized work through its named publication task. The
[`v0.3.0` release procedure](../process/0.3.0-release.md) keeps scheduling and
unit implementation in its milestone/detail plans, verifies the accepted
Contract 4 input in the release plan, and separates source preparation,
candidate acceptance, publication, and durable acceptance. That authorization
does not include npm `latest` promotion.

On 2026-07-26, after `v0.3.0` beta publication and release acceptance, the
user explicitly promoted `perttool@0.3.0` to npm `latest`. Registry reads and
an unqualified global installation confirmed that `beta` and `latest` both
resolve to Contract 4 `0.3.0`; `alpha` remains on `0.1.0-alpha.2`. Product
maturity remains beta.

On 2026-07-27, after repository-source and locally packed Contract 5
acceptance, the user selected the next task as design of the `0.4.0` release
gate. The [`v0.4.0` release procedure](../process/0.4.0-release.md) verifies
the completed governance acceptance before source preparation and retains
publication as a separately authorized task. This gate-design authorization
does not authorize Git push, tag creation, GitHub or npm publication, npm
`latest` promotion, or Issue #4 closure. A subsequent instruction authorized
only the Contract 5 readiness gate and retained the same external-write
exclusions.

On 2026-07-28, the user instructed perttool to perform the next release task.
That authorizes local `RELEASE_040_PREPARATION`, including version-bearing
source, migration guidance, tests, and package validation. It does not
authorize Git push, tag creation, GitHub or npm publication, npm `latest`
promotion, or Issue #4 closure.

Later on 2026-07-28, after the assistant stated that the next bounded scope
was candidate acceptance without PUBLISH, the user instructed perttool to
continue toward the release. That authorizes local
`RELEASE_040_CANDIDATE`, including read-only external availability and
credential-route checks plus one retained tarball. It does not authorize Git
push, tag creation, GitHub or npm publication, npm `latest` promotion, or
Issue #4 closure.

After the PUBLISH boundary was stated again, the user instructed perttool to
proceed. That separately authorized the named `0.4.0` Git, GitHub prerelease,
and npm `beta` publication batch. The release commit and peeled tag agree,
and the candidate, GitHub, and npm tarballs are byte-identical. npm now
reports `beta=0.4.0` and unchanged `latest=0.3.0`. Release acceptance, npm
`latest` promotion, and Issue #4 closure remain separate decisions.

Later on 2026-07-28, durable acceptance reverified both public tarballs and
their installed Contract 5 workflows. All six release tasks and 19p are
accepted over two active days and advanced to reached
`RELEASE_040_ACCEPTED`; the plan has zero makespans and no recommendation.
The user then explicitly selected `perttool@0.4.0` for a
separate post-acceptance npm `latest` promotion. The one-time dist-tag
mutation succeeded; fresh registry reads and an unqualified isolated
installation confirmed `beta=latest=0.4.0`, CLI Contract 5, and Grammar 4.
Product maturity remains beta, and Issue #4 closure remains a separate
decision.

On 2026-07-29, after Project Actuals and the independent English repository
baseline reached acceptance, the user selected and authorized the complete
named `0.5.0` release flow and an exact post-release local installation. The
[`v0.5.0` release procedure](../process/0.5.0-release.md) keeps those
accepted workstreams separate, then sequences release-gate design, Contract 6
readiness, source preparation, candidate acceptance, Git/GitHub/npm `beta`
publication, durable acceptance, and the requested local installation.
That authorization does not include npm `latest` promotion or Issue #4
closure.

On 2026-07-30, after source acceptance of the Issue #5 JSON Schema artifacts
and the Git 2.54 CI correction, the user requested a self-review and
authorized the complete named `0.5.1` release if no blocking finding
remained. The [`v0.5.1` release
procedure](../process/0.5.1-release.md) sequences compatibility review,
source preparation, candidate acceptance, Git/GitHub/npm `beta`
publication, and durable acceptance. It does not authorize npm `latest`
promotion or Issue #5 closure.

The named PUBLISH gate then passed. Release commit and peeled `v0.5.1` target
`31d162a` agree; candidate, GitHub, and npm tarballs are byte-identical at
SHA-256 `93f3e01a...1339`; npm reports `beta=0.5.1` with unchanged
`latest=0.4.0`; and both public-package workflows pass. Durable acceptance
then independently reverified Git, GitHub, npm, both public artifacts, the
additive compatibility boundary, and installed workflows. The user then
separately authorized one post-acceptance `latest` mutation; fresh registry
reads and an unqualified isolated install confirmed `beta=latest=0.5.1`,
CLI Contract 6, Grammar 5, and schema discovery. Issue #5 closure remains a
separate decision.

Later on 2026-07-30, after finding that the published schemas still contained
underspecified nested object placeholders, the user required complete child
records, requested reference-based compact display, selected `0.5.2`, and
authorized the complete named release. The
[`v0.5.2` release procedure](../process/0.5.2-release.md) keeps compatibility
review, preparation, candidate acceptance, publication, and durable
acceptance sequential. It does not authorize npm `latest` promotion.

The named `v0.5.2` PUBLISH gate then passed. Release commit and peeled
`v0.5.2` target `501d4b1` agree; candidate, GitHub, and npm tarballs are
byte-identical at SHA-256 `e8512f0d...54bbce`; npm reports `beta=0.5.2`
with unchanged `latest=0.5.1`; and both public-package workflows pass.
Durable acceptance then independently reverified Git, GitHub, npm, all three
artifact copies, exact `0.5.1` compatibility, and both public-package
workflows. npm `latest` promotion and Issue #5 closure remain separate
decisions.

Later on 2026-07-30, the user retired the obsolete npm `alpha` distribution
channel because it was not part of the maintained beta-to-`latest` flow and
had remained pinned to `0.1.0-alpha.2`. The separately authorized operation
removed only the `alpha` dist-tag. It did not unpublish the historical
version, move `beta=0.5.2` or `latest=0.5.1`, publish a package, alter a
GitHub Release, promote `latest`, or close Issue #5.

## Beta gate

1. Accept Issue #2's normative contract, five-provider baseline, Core, text and JSON projections, CLI, package, and security boundaries.
2. Where an existing command has local compatibility requirements, satisfy that Issue acceptance. Project-wide alpha compatibility is not required.
3. Align `package.json`, the CLI version, tag, GitHub asset, and npm version on the same suffix-free `0.x.x`.
4. Distribute the same tarball through GitHub and npm, and verify the `beta` dist-tag, registry integrity, and isolated installation.
5. The publish operation leaves `latest` unchanged. Any later promotion is a separately authorized post-acceptance action and is not part of the beta publication gate.

## Consequences

- Stable compatibility cannot be inferred from `0.x.x` alone. Users must review the CHANGELOG and schema versions.
- The publication script accepts only the maintained `beta` channel.
- Do not change the current `0.1.0-alpha.2` package; update it to `0.1.0` only in the release commit after Issue #2 acceptance.
- Keep historical alpha package versions available by exact pin without an
  active alpha distribution tag.
- Control the beta transition through Issue #2 and the release gate in the project model, without waiting for external feedback.
- An unqualified npm install follows the explicitly promoted `latest` tag. Product maturity remains beta until a separate `1.0.0` stable decision.
