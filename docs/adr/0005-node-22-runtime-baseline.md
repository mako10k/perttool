# ADR 0005: Support maintained Node.js releases from Node.js 22

- Status: Accepted
- Date: 2026-07-24
- Supersedes: [ADR 0002](0002-node-typescript-package.md) for the minimum runtime
- Related design: [Basic design](../basic-design.md)
- Related review: [CLI surface review](../process/cli-surface-review.md)

## Context

ADR 0002 selected Node.js 24 for the first implementation. The CLI has no
production dependencies and the source does not use a Node.js 24-only API.
Users should not need the newest active LTS line merely to parse and maintain a
local text document.

Node.js 20 is close to the requested compatibility level, and the current
perttool test suite runs on Node.js 20.20.2. However, Node.js 20 is already
end-of-life in 2026. The Node.js project recommends production applications use
an Active LTS or Maintenance LTS release. Node.js 22 remains a maintained LTS
line. See the official [Node.js release table](https://nodejs.org/en/about/previous-releases).

## Decision

- The supported runtime baseline is Node.js `>=22`.
- Node.js 22 is the minimum-version CI job.
- Node.js 24 is the current active-LTS CI job.
- TypeScript emits ES2024 and uses Node.js 22 type declarations. Node.js 22
  provides the ES2024 string well-formedness API used by the recommendation
  validator.
- The package continues to use npm, ESM, the Node.js built-in test runner, and
  zero production dependencies.
- Node.js 20 may continue to work, but it is not a supported or security-tested
  runtime after EOL.
- Raising the minimum requires a Node.js API, security, or maintenance reason
  recorded in a later ADR.

## Consequences

- `package.json` declares `engines.node` as `>=22`.
- CI runs the same repository check on Node.js 22 and 24.
- Runtime code and tests must not depend on a Node.js 24-only API while Node.js
  22 remains supported.
- A passing Node.js 20 test is compatibility evidence only and must not be
  advertised as current support.
- Release acceptance continues to test an isolated install from the exact
  package tarball.
