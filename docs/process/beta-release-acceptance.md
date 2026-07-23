# `v0.1.0` Beta Release Acceptance Record

- Status: Accepted 1.0
- Accepted on: 2026-07-23
- Release commit: `4ba630f39a727f40d10518e5ab9155f9fbc9a8f6`
- Annotated tag: `v0.1.0`
- GitHub prerelease: <https://github.com/mako10k/perttool/releases/tag/v0.1.0>
- Release procedure: [Beta transition and release procedure](beta-release.md)
- Macro plan: [../../plans/mvp.pert](../../plans/mvp.pert)

## 1. Decision

Accept `v0.1.0` as the first suffix-free `0.x.x` beta release. The release includes the read-only AI Agent Guidance Registry v1 accepted for Issue #2. It is available from the npm `beta` dist-tag and as a GitHub prerelease.

This acceptance closes `BETA_RELEASE_E2E` and reaches `M8_BETA_RELEASED`. It does not promote the package to npm `latest`, promise strict compatibility with alpha releases, or accept the post-beta Issue #3, LSP server, VSIX, MCP server, runtime i18n, or English-surface migration backlogs.

## 2. Source and artifact identity

The clean release commit was pushed to `origin/main`, and the annotated `v0.1.0` tag resolves to the same commit. One tarball was generated outside the worktree and used for package validation, the GitHub release asset, and npm publication.

| Evidence | Accepted value |
| --- | --- |
| Release commit and peeled tag target | `4ba630f39a727f40d10518e5ab9155f9fbc9a8f6` |
| Package | `perttool@0.1.0` |
| Local, GitHub, and registry tarball SHA-256 | `a077b54d7b9a0f0c054ee1ce667a6784821af825954f350ce4f76bf43b11831c` |
| npm integrity | `sha512-R11YY9R+0KYp1WlriPUoMSUsO+DOd8T0RPg/J6IxwB3g40BB7yy3DD49SkgfeHdDQZa6dd0fSmMRNxMb5gpX8Q==` |
| npm SHA-1 | `baae3c8f727b8b38b686a379ab6dd299d42db078` |

The public GitHub asset was downloaded and installed in an isolated prefix. The registry tarball was downloaded independently, and its SHA-256 matched both the local release tarball and the GitHub asset.

## 3. Distribution state

The npm dist-tags after publication were:

| Dist-tag | Version |
| --- | --- |
| `beta` | `0.1.0` |
| `alpha` | `0.1.0-alpha.2` |
| `latest` | `0.1.0-alpha.2` |

The release script published exactly once through the repository-required `secdat` route. The existing `latest` value did not change.

The GitHub release is public, non-draft, and marked as a prerelease. It contains the release tarball and `SHA256SUMS`.

## 4. Verification

The release commit passed the repository-wide checks:

```sh
npm ci
npm run check
git diff --check
```

The full check ran 245 tests, validated 41 Markdown documents and all seven self-use plans, verified the isolated local-link workflow, and built, inspected, installed, and smoke-tested the release package.

The downloaded GitHub asset and `perttool@beta` registry installation passed:

- `perttool --version`
- `perttool --help`
- `perttool agent help`
- `perttool project show`
- `perttool dsl check`
- `perttool dag next`
- public Core import and recommendation completion

The registry installation reported `perttool 0.1.0`.

## 5. Plan transition

The macro task was completed and advanced with the Stage 3 preview-first workflow. `plans/mvp.pert` now contains only the reached `M8_BETA_RELEASED` frontier and returns an empty, complete recommendation with no diagnostics.

The external beta gate on `SURFACE_INVENTORY` was then removed with a preview, expected source digest, safe write, and fresh `check`, `analyze`, and `next` evaluation. `plans/english-baseline.pert` now recommends `SURFACE_INVENTORY`; its provisional velocity remains `29p/2d` until workstream-specific completion samples are available.

This acceptance record is a post-release repository change. It is intentionally later than the immutable release tag and is not part of the `v0.1.0` tarball.
