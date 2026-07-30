# Contract 6 JSON Schema Source Acceptance

- Document status: Accepted 1.0
- Accepted: 2026-07-30
- Scope: Git 2.54 CI compatibility and machine-readable Contract 6 result
  schemas
- Normative contract: [JSON Schema Artifact Contract](../specs/json-schema.md)
- Related issue: [Issue #5](https://github.com/mako10k/perttool/issues/5)
- Publication status: not authorized
- Issue closure status: not authorized

## 1. Accepted boundary

The current source contains one closed catalog for all seventeen active
Contract 6 command-result identities and public library-only
`Perttool.OverrideDecision.v1`. Nineteen bundled files provide eighteen root
result artifacts plus `Perttool.Common.v1` reusable definitions. The
artifacts use Draft 2020-12, stable `$id` values, local relative references,
closed root objects, and exact result and CLI contract identities.

The read-only `schema` command lists or resolves the catalog without a project
file. The package root exposes catalog and lookup APIs. The npm package file
list and wildcard export include the artifacts. Published `perttool@0.5.0`
remains unchanged and does not contain this source-level addition.

## 2. CI finding and correction

The failing GitHub Actions jobs used Git 2.54.0. For a UTC commit,
`git show -s --format=%P%x00%cI` now emits the strict ISO UTC designator `Z`.
The history probe accepted only an explicit signed offset, classified the
otherwise valid commit metadata as `malformed_git_output`, and surfaced
`PTIO-502` from `project history`.

The parser now accepts both strict forms:

```text
YYYY-MM-DDTHH:mm:ssZ
YYYY-MM-DDTHH:mm:ss+HH:mm
YYYY-MM-DDTHH:mm:ss-HH:mm
```

Parent object-format validation, first-parent traversal, source binding,
read-only behavior, and every other history boundary remain unchanged.

## 3. Acceptance trace

| Issue #5 criterion | Accepted evidence |
| --- | --- |
| Closed inventory | Registry/catalog equality test covers 17 command results; the only supported library-only result is OverrideDecision |
| Must results | Check v3, Analysis v4, Next v5, Export v1, and Import v1 have root artifacts |
| Exact descriptor resolution | Every advertised identity maps to one catalog entry and one bundled file; no extra root result artifact is allowed |
| Actual-result validation | Strict Ajv Draft 2020-12 validation covers success, warning, invalid, unavailable, usage-error, truncated, mutation, migration, help, guidance, history, observation, schema, and override projections |
| Cross-surface consistency | Tests bind descriptor IDs, root `schema_version`, `cli_contract_version`, artifact `$id`, catalog paths, CLI lookup, and package-root lookup |
| Isolated package | Package inspection requires representative artifacts, installs the tarball, invokes `schema`, and compares CLI and public API resolution |
| Guidance | Requirements, specification, design, README, migration guidance, backlog, CHANGELOG, and agent entrypoints describe the same source/release boundary |

Nested `Perttool.GovernanceDecision.v1` is the shared
`Perttool.Common.v1#/$defs/governanceDecision` definition. Actuals records
remain nested in their owning Check, Mutation, History, and Observation root
artifacts. Neither is presented as an independent result envelope.

## 4. Verification

The following checks passed from this source:

```sh
npm test
npm run check:english
npm run check:docs
npm run check:self-use
npm run check:link
npm run check:package
git diff --check
```

The history regression also passed with the locally built Git 2.54.0 first on
`PATH` and `TZ=UTC` for both the Git-probe and public Contract 6 history test
files. The aggregate `npm run check` passed on the repository baseline
Node.js 22.22.3. The package check produced a 491-file local dry-run tarball
containing all nineteen schema files, installed it into an isolated prefix,
and performed no publication.

`npm run check` remains the aggregate acceptance command. CI on Node.js 22 and
24 cannot be re-run until a future authorized Git publication; no push,
release, dist-tag mutation, or Issue mutation is part of this acceptance.
