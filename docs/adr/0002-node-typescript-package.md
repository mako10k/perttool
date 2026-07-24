# ADR 0002: Distribute a TypeScript ESM CLI on Node.js 24

- Status: Superseded for the minimum runtime by [ADR 0005](0005-node-22-runtime-baseline.md)
- Date: 2026-07-21
- Decision owners: perttool maintainers
- Related design: [Basic Design](../basic-design.md)
- Related interface: [CLI Interface](../specs/interfaces.md)

## Context

The MVP uses a local CLI as its primary interface and exposes the same Core API to the library, tests, and future adapters. The runtime, module format, package manager, dependency policy, and test entry point must be fixed before implementation begins.

As of 2026-07-21, Node.js 24 is LTS and Node.js 25 in the development environment is EOL. Use the LTS release as the baseline without depending on Current-release-only features.

## Decision

- The runtime baseline is Node.js `>=24`.
- The package manager is npm and the lockfile is `package-lock.json`.
- One npm package provides both the `perttool` binary and library API.
- The package and module format is ESM (`type: module`).
- The lockfile pins the TypeScript compiler to the 7.0 series, with `module` and `moduleResolution` set to `NodeNext`.
- Tests use the Node.js built-in test runner.
- The MVP scaffold has no runtime dependencies and uses only Node.js standard APIs.
- The package remains `private: true` until a publication decision. After publication, the package tarball contains only the runtime `dist/` files and user documentation.
- Do not add the MCP SDK, transports, or server packages to the MVP dependencies.

## Consequences

- CI runs `npm ci` and the repository checks on Node.js 24.
- Source imports include `.js` extensions in accordance with Node ESM rules.
- Build artifacts are written to `dist/` and are not tracked by Git.
- TypeScript types, CLI JSON, and JSON Schema change together as one logical change.
- Runtimes older than Node.js 24 are outside MVP support.
- `npm run check:package` validates package contents, CLI executable permissions, the version, and minimum documentation.

## Public alpha decision

On 2026-07-21, the maintainers decided to publish the GitHub repository under the MIT License and distribute `v0.1.0-alpha.1` as a GitHub prerelease. It is an evaluation release of the read-only CLI, not an MVP stable release.

- Do not publish it to the npm registry at this stage.
- Attach a tarball produced by `npm pack` to the GitHub Release.
- Remove `private` from the package metadata, while requiring a separate explicit operation and authentication to publish.
- At the time, stable `v0.1.0` was to be considered after the MVP gate covering the formatter, mutation, Mermaid, and release E2E was complete. [ADR 0003](0003-beta-versioning.md) supersedes that decision and treats suffix-free `0.x.x` versions as beta releases.

## npm prerelease publication decision

On 2026-07-23, the maintainers decided to publish the next prerelease to the npm registry after the remaining MVP gates were complete. Advancing preparation does not mark `RELEASE_E2E` or recommendation tasks complete.

- The next candidate version is `0.1.0-alpha.2`; do not publish the current checkout as the existing GitHub Release version `0.1.0-alpha.1`.
- Explicitly publish prereleases under the `alpha` dist-tag without changing `latest`.
- Use the same tarball for package checks, the GitHub Release asset, and npm publication.
- Fix public access, the npmjs registry, and the `alpha` tag in `package.json` `publishConfig`.
- Verify with a dry run that npm will not normalize the manifest automatically during publication.
- Do not put the token in a tracked file or argument. Inject it as `NPM_TOKEN` from the maintainer's `secdat` only into the publication process.
- Perform the actual publication only after confirming a clean release commit, remote main and an annotated tag at that commit, the GitHub Release asset, and an unpublished version.
- Setting stable `latest` and migrating to trusted publishing are separate decisions.

This section records the public-alpha release decision. For versions and dist-tags from the first beta onward, [ADR 0003](0003-beta-versioning.md) and the [beta release procedure](../process/beta-release.md) are authoritative. Do not reuse alpha publication records for a new release.

The normalization dry-run may use npm `--force` only to bypass the duplicate-version rejection after publication. This does not authorize a write: actual publication never uses `--force` and retains the unpublished-version, clean commit, remote tag, and explicit approval gates.

The [npm publication procedure](../process/npm-publication.md) is authoritative for the detailed alpha preflight, publication, and post-publication verification.

## Dependency policy

Adding a runtime dependency requires:

1. An explanation of why the Node.js standard API or a small local implementation cannot replace it.
2. A review of its license, maintenance, and supply-chain risk.
3. A review of its effect on CLI startup and bundle or installation size.
4. A lockfile update and tests.

Reconsider a parser generator or CLI framework only when a future need arises; do not introduce one at the scaffold stage.

## Validation

```sh
npm ci
npm run check
```

CI and local development use the same `npm run check` entry point.
