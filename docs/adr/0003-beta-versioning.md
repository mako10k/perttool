# ADR 0003: `0.x.x` beta versioning and Issue #2 scope

- Status: Accepted
- Date: 2026-07-23
- Amended: 2026-07-23 (`v0.1.0` explicit `latest` promotion);
  2026-07-24 (`v0.2.0` Contract 3 release target);
  2026-07-25 (`v0.2.0` explicit `latest` promotion and `v0.3.0` Contract 4
  release target);
  2026-07-26 (`v0.3.0` explicit `latest` promotion);
  2026-07-27 (`v0.4.0` Contract 5 release target);
  2026-07-28 (`v0.4.0` beta publication and acceptance)
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
accepted over two active days; the pre-advance plan has zero makespans and no
recommendation. The user then explicitly selected `perttool@0.4.0` for a
separate post-acceptance npm `latest` promotion. Issue #4 closure remains a
separate decision.

## Beta gate

1. Accept Issue #2's normative contract, five-provider baseline, Core, text and JSON projections, CLI, package, and security boundaries.
2. Where an existing command has local compatibility requirements, satisfy that Issue acceptance. Project-wide alpha compatibility is not required.
3. Align `package.json`, the CLI version, tag, GitHub asset, and npm version on the same suffix-free `0.x.x`.
4. Distribute the same tarball through GitHub and npm, and verify the `beta` dist-tag, registry integrity, and isolated installation.
5. The publish operation leaves `latest` unchanged. Any later promotion is a separately authorized post-acceptance action and is not part of the beta publication gate.

## Consequences

- Stable compatibility cannot be inferred from `0.x.x` alone. Users must review the CHANGELOG and schema versions.
- Replace the publication script's hard-coded `alpha` with parameterized channel validation in the beta release task.
- Do not change the current `0.1.0-alpha.2` package; update it to `0.1.0` only in the release commit after Issue #2 acceptance.
- Control the beta transition through Issue #2 and the release gate in the project model, without waiting for external feedback.
- An unqualified npm install follows the explicitly promoted `latest` tag. Product maturity remains beta until a separate `1.0.0` stable decision.
