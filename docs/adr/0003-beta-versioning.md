# ADR 0003: `0.x.x` beta versioning and Issue #2 scope

- Status: Accepted
- Date: 2026-07-23
- Amended: 2026-07-23 (`v0.1.0` explicit `latest` promotion)
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

On 2026-07-23, after `v0.1.0` beta acceptance, the user explicitly promoted `perttool@0.1.0` to npm `latest`. The `beta` tag continues to point to the same version, and `alpha` remains on `0.1.0-alpha.2`.

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
