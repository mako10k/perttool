# Developing perttool

This document contains repository-maintainer guidance. The root
[README](../README.md) is the user guide.

## Prerequisites

- Node.js 22 or 24
- npm
- Git
- Python 3 and the pinned `requirements-static-analysis.txt` tools

Node.js 22 is the minimum supported runtime. CI verifies both the minimum and
the current active LTS line. The runtime has no third-party production
dependencies.

## Setup and verification

```sh
git clone https://github.com/mako10k/perttool.git
cd perttool
npm ci
python -m venv .venv
. .venv/bin/activate
python -m pip install --requirement requirements-static-analysis.txt
npm run check
git diff --check
```

Focused checks are available when iterating:

```sh
npm run typecheck
npm run check:duplication
npm run check:complexity
npm run check:static
npm test
npm run test:e2e
npm run check:docs
npm run check:link
npm run check:package
```

`check:static` composes TypeScript type checking, jscpd duplicate detection,
and Lizard function-complexity analysis. The pinned tools scan `src/`, private
adapter source/runtime directories, and `scripts/`; generated `dist/`,
dependencies, tests, fixtures, and documentation are outside this source-code
gate. `config/static-analysis-baseline.json` is a reviewed ratchet: new
complexity violations, worsening legacy functions, stale legacy entries, or
increased clone, duplicated-line, duplicated-token, or percentage totals fail.
Reducing a legacy violation requires removing its stale baseline entry in the
same reviewed change.

`check:link` uses a temporary user prefix and does not modify the real npm
global prefix. `check:package` creates a release tarball in a temporary
directory, verifies the package allowlist and publish normalization, installs it
into an isolated prefix, runs CLI and library smoke checks, and completes the
file-first initialize/read/change/analyze/select/advance/validate workflow
through that installed CLI alone.

## Link a checkout locally

For manual testing from another directory:

```sh
npm ci
npm link
perttool --version
```

The `prepare` lifecycle builds `dist/` before linking the binary into the
current npm prefix. Use a user-owned npm prefix. Remove the link from this
checkout with:

```sh
npm unlink --global perttool
```

## Sources of truth

Read these in order when meanings conflict:

1. [Product requirements](requirements.md)
2. [Normative specifications](specs/)
3. [Basic design](basic-design.md)
4. [Normative examples](examples/)
5. [Development and release processes](process/)
6. [Current and future plans](../plans/)

Key design documents:

- [Activity-on-Arrow ADR](adr/0001-activity-on-arrow.md)
- [Supported Node.js baseline ADR](adr/0005-node-22-runtime-baseline.md)
- [Beta versioning ADR](adr/0003-beta-versioning.md)
- [English repository baseline ADR](adr/0004-english-repository-baseline.md)
- [Previous CLI Contract 2 payload reference](specs/interfaces.md)
- [Active CLI Contract 3](specs/cli-contract-3.md)
- [CLI Contract 3 migration](process/cli-contract-3-migration.md)
- [CLI Contract 5 migration](process/cli-contract-5-migration.md)
- [CLI Contract 6 migration](process/cli-contract-6-migration.md)
- [Mutation semantics](specs/mutation.md)
- [Mermaid profile](specs/mermaid-profile.md)
- [Recommendation interface](specs/recommendation-interface.md)
- [AI development process](process/ai-development.md)
- [Self-use process](process/self-use.md)

Repository-specific contribution, validation, Git, remote-write, and task
selection rules are in [AGENTS.md](../AGENTS.md).

## Release work

Normal development does not publish packages or mutate npm dist-tags. Follow
the [beta release procedure](process/beta-release.md) and
[npm publication record and controls](process/npm-publication.md). Remote Git,
GitHub, and npm writes require the repository's explicit authorization and
credential-injection rules.
