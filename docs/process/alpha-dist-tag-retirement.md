# npm `alpha` Dist-Tag Retirement

- Document status: Accepted 1.0
- Accepted on: 2026-07-30
- npm package: `perttool`
- Authorized scope: remove only the obsolete `alpha` dist-tag
- Authenticated npm identity: `mako10k`
- Policy: [ADR 0003](../adr/0003-beta-versioning.md)

## 1. Decision and boundary

Retire the npm `alpha` distribution channel. The maintained prerelease
publication flow uses the suffix-free `0.x.x` beta series and npm `beta`;
separate human authorization may later promote an accepted version to
`latest`. The `alpha` tag had remained on the historical
`0.1.0-alpha.2` preview and did not participate in that flow.

This operation removes only the mutable dist-tag. It does not unpublish or
deprecate a package version, publish a package, move `beta` or `latest`,
change a Git reference or GitHub Release, promote `latest`, or close an
Issue.

## 2. Preflight

The checkout was clean at
`20556f7300fd1cab56e5c219f89d61d6eca7a0b9`. The protected `secdat` route
injected `NPM_TOKEN` only into the npm process. `npm whoami` returned
`mako10k`.

Fresh registry reads established:

- Before: `alpha=0.1.0-alpha.2`
- Unchanged target: `beta=0.5.2`
- Unchanged target: `latest=0.5.1`
- Historical package: `perttool@0.1.0-alpha.2`

The repository policy, documentation checks, English-baseline check, shell
syntax check, diff check, and publication-normalization dry run passed before
the external mutation.

## 3. Authorized mutation

Exactly one authenticated dist-tag mutation was attempted through `secdat`:

```sh
npm dist-tag rm perttool alpha
```

npm reported:

```text
-alpha: perttool@0.1.0-alpha.2
```

No retry was required.

## 4. Durable readback

A fresh npm CLI read and a direct read of the npm registry dist-tag endpoint
both returned exactly:

- After: `beta=0.5.2`, `latest=0.5.1`
- `alpha`: absent

A separate fresh version lookup confirmed that
`perttool@0.1.0-alpha.2` remains available by exact pin. The package version
was not removed.

## 5. Recovery and future policy

The dist-tag deletion is recoverable because the historical package version
remains published. Recreating `alpha` would be a new external registry
mutation and is not authorized by this retirement. It requires a new
release-policy decision, an explicitly selected target version, separate
user authorization, and the normal protected route. No compensating
dist-tag write was performed.
