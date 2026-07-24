# npm publication procedure

- This document is the alpha-release procedure and publication record for `v0.1.0-alpha.2`. From the first suffix-free `0.1.0` beta onward, [the beta release procedure](beta-release.md) is authoritative.
- Document status: Published 1.1
- Created: 2026-07-23
- Target registry: `https://registry.npmjs.org/`
- Distribution tag: `alpha`
- Release gate: [MVP release readiness audit](mvp-release-readiness.md)
- Current runtime baseline: [ADR 0005](../adr/0005-node-22-runtime-baseline.md)

## 1. Current state

At publication-preparation time, `perttool` had not been published to the npm registry. On 2026-07-23, it was verified that `npm view perttool` returned `E404` and that `npm whoami`, with `NPM_TOKEN` injected by `secdat`, succeeded for the maintainer account.

The checkout during publication preparation was `0.1.0-alpha.1`, but it contained changes after the Git tag and GitHub Release of the same name, so that version was not published. After recommendation acceptance, `RELEASE_E2E` was the only ready and recommended work package, and `0.1.0-alpha.2` was selected as the release version.

The first human override on 2026-07-23 advanced only publication preparation; it did not change the process status or external publication authority at that time. After MIG-07 was complete, the user explicitly authorized Git push and npm publication under `secdat exec`. That authorization does not omit this document's gates for the same tarball, release commit/tag, GitHub asset, registry-unpublished version, and process-scoped TOKEN.

On the same day, `v0.1.0-alpha.2` was published to a GitHub prerelease and npm, including an isolated installation from the registry. Section 7 records the published artifact and verification values.

## 2. Safety boundaries

- The tarball sent to npm must be the same one used for the package check and GitHub Release asset.
- Always publish a prerelease with the `alpha` dist-tag, and for an existing package preserve `latest` before and after publication.
- If the registry creates the required `latest` at the same version on the first package publication, record it as a release-record exception without assuming it can be removed. User-facing instructions must explicitly use `@alpha`.
- Match the version in `package.json`, CLI `--version`, annotated Git tag, `origin/main`, and the tarball manifest.
- `bin.perttool` in the package manifest must remain `dist/cli.js` after npm publish normalization.
- Do not write TOKEN to an argument, tracked `.npmrc`, or log.
- Publish exactly once after explicit human approval.
- If the response is unclear, confirm durable state with `npm view perttool@VERSION`; do not retry before confirmation.

## 3. Repository preflight

The authentication-free dry run can run against the current directory or an already generated tarball.

```sh
bash scripts/publish-npm.sh --dry-run
bash scripts/publish-npm.sh --dry-run /absolute/path/to/perttool-VERSION.tgz
```

`npm run check:package` builds the tarball and verifies its contents, isolated installation, CLI/library smoke paths, and publish normalization. The dry-run alone uses npm `--force` so the check remains repeatable after the exact version has been published; actual publication never uses `--force`. Manifest auto-correction still fails the check.

## 4. Release artifact

After meeting the restart conditions for `RELEASE_E2E`, update the version, CHANGELOG, and README in the release commit. Once `npm run check` and `git diff --check` succeed, push the clean release commit to `origin/main` and create an annotated tag at the same commit.

Generate the tarball exactly once in a temporary directory outside the worktree. The following variable names are examples; do not repurpose system variables.

```sh
PERTTOOL_RELEASE_DIR=$(mktemp -d)
npm pack --pack-destination "$PERTTOOL_RELEASE_DIR"
PERTTOOL_RELEASE_TARBALL="$PERTTOOL_RELEASE_DIR/perttool-VERSION.tgz"
sha256sum "$PERTTOOL_RELEASE_TARBALL"
bash scripts/check-package.sh "$PERTTOOL_RELEASE_TARBALL"
```

Attach the tarball and `SHA256SUMS` to the GitHub prerelease for the same tag and verify an isolated installation from the published asset. For GitHub operations and Git push, use `secdat exec gh ...` and `secdat exec git ...` as required by repository policy.

## 5. TOKEN injection and publication

In the maintainer domain, use `NPM_TOKEN` as the secret name. Do not display its value; inject it only into the publication process.

For non-interactive publication, prepare an npm granular access token with read/write access and Bypass 2FA. A successful `npm whoami` proves authentication only; it does not prove publication permission or Bypass 2FA. Verify permissions and expiry immediately before release according to the [official npm access-token documentation](https://docs.npmjs.com/about-access-tokens/) and [2FA publication requirements](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/).

Authentication check:

```sh
printf '%s\n' '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' |
secdat --dir /home/katsumata-m exec \
  --inject secret:only=NPM_TOKEN \
  --inject route:prefer=secret \
  --inject final:require=NPM_TOKEN \
  -- npm whoami --userconfig=/dev/stdin
```

Publish the same tarball:

```sh
secdat --dir /home/katsumata-m exec \
  --inject secret:only=NPM_TOKEN \
  --inject route:prefer=secret \
  --inject final:require=NPM_TOKEN \
  -- bash scripts/publish-npm.sh --publish "$PERTTOOL_RELEASE_TARBALL"
```

`--publish` checks the following fail-closed.

1. The tarball is explicit.
2. The worktree is clean.
3. The tarball and checkout name/version match.
4. The local tag, remote annotated tag, and `origin/main` match HEAD.
5. `NPM_TOKEN` exists and `npm whoami` succeeds.
6. The same version does not exist in the registry.
7. It bounded-polls propagation-time `E404` after publication and can retrieve the same version from the registry.
8. `alpha` points to the published version and any existing `latest` is unchanged before and after publication.

## 6. Post-publication verification

Confirm the version and dist-tag with `npm view`, then install from the registry into a user-owned temporary prefix.

```sh
npm view perttool@VERSION name version dist
npm view perttool dist-tags
PERTTOOL_VERIFY_PREFIX=$(mktemp -d)
npm install --global --prefix "$PERTTOOL_VERIFY_PREFIX" perttool@VERSION
"$PERTTOOL_VERIFY_PREFIX/bin/perttool" --version
"$PERTTOOL_VERIFY_PREFIX/bin/perttool" dsl check docs/examples/minimal.pert
```

Record verification results, registry integrity, the GitHub asset SHA-256, and release URL in the release record before completing `RELEASE_E2E`.

## 7. `v0.1.0-alpha.2` release record

- Release commit/tag: `dd4fc3efc01945544a2dad7e1838fdd4d06d7275` / `v0.1.0-alpha.2`
- GitHub prerelease: <https://github.com/mako10k/perttool/releases/tag/v0.1.0-alpha.2>
- Shared GitHub/registry tarball SHA-256: `aadb757a5d7bb82eed677158ce5c4b0672c5695a6dde97bec6f10c438711be8a`
- npm version/dist-tag: `perttool@0.1.0-alpha.2` / `alpha`
- npm integrity: `sha512-jLwW2MDQbibQK8skb3qrIU7x5Ek+ZjDhesI8yPbb5SsKJqkX8tNqxhAoBukFgx8X1Kyv/9LuxgrwbPXTIGyBnA==`
- npm SHA-1: `d1bc681e68384d29b3130ba9a21c99e44605d51d`
- Verification: SHA-256 match between the published GitHub asset and registry tarball; isolated installation of `perttool@alpha`; `perttool 0.1.0-alpha.2`; `dsl check docs/examples/minimal.pert`

The publication itself returned a success response, but the immediate registry lookup returned propagation-time `E404`. Without republishing, durable state was queried and the version and integrity were verified. Based on this observation, the publication script bounded-polls only `E404`.

On the first package publication, the registry created `latest=0.1.0-alpha.2` in addition to the explicit `alpha`. Because `npm dist-tag rm perttool latest` was rejected by the registry with `E400`, no destructive unpublish was performed; this remains a first-package-metadata exception. Future prereleases guard that pre-existing `latest` matches before and after publication, and README installation examples explicitly use `perttool@alpha`.
