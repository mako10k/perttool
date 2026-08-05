# Adapter Shared Library Boundary Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `SHARED_LIBRARY_BOUNDARY`
- Normative contract: [../specs/shared-library.md](../specs/shared-library.md)
- Parent architecture: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Machine cases: [../../test/fixtures/adapter-shared-library-cases-v1.json](../../test/fixtures/adapter-shared-library-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted outcome

The source package exposes additive `./core` and `./node` export-map entries.
Core has exactly forty runtime names and a 32-module static runtime closure
with no Node builtin, external package, Application module, CLI module, I/O,
history, schema-loader, or adapter dependency. Its active Grammar 6 parse,
validate, and format functions are reference-identical to the existing root
exports.

The Node subpath exposes exactly the established 121 root runtime names and
every value is reference-identical. The root remains authoritative; it still
has 121 names, 44 commands, 20 schemas, and zero production dependencies.
No command, result, schema, payload, package version, or published artifact
changed.

The completed plan source digest is
`sha256:33a44d94d85ea3134e61033cfea22cc3fad159c7c2fdaf7273ccf48604f1d04c`.

## 2. Pure source boundary

`src/core/source.ts` is the unique portable facade for active Grammar 6
parsing, semantic validation, and source-preserving formatting. The existing
Contract 7 source Application module re-exports those same functions and owns
only its Node-backed digest and format-preview composition.

Stored lifecycle reduction and validation moved without semantic change from
the mixed Node-backed lifecycle module to `src/actuals/reduction.ts`. Existing
imports remain compatible through re-exports. Work-event identifier generation
and normalization retain their existing Node SHA-256 implementation in
`src/actuals/lifecycle.ts`; hashing-port separation remains unimplemented.

## 3. Export and package evidence

| Surface | Accepted runtime result |
| --- | --- |
| `perttool` | unchanged 121-name compatibility authority |
| `perttool/core` | exact forty-name platform-neutral catalog |
| `perttool/node` | exact 121-name root facade with value identity |
| `perttool/schemas/*` | unchanged bundled artifact path |

The isolated package gate packed 637 files, verified both JavaScript
entrypoints and declaration files, installed the tarball under a disposable
prefix, and imported `perttool`, `perttool/core`, and `perttool/node` directly
through the installed export map. The isolated Core parsed, validated, and
formatted the normative minimal plan and returned the active Guide without a
repository-relative import.

## 4. Machine cases

| Case | Accepted evidence |
| --- | --- |
| `SLB-001` | manifest maps exact additive Core and Node targets |
| `SLB-002` | Core exposes the closed forty-name ordered catalog |
| `SLB-003` | the 32-module runtime closure has no forbidden import or outer layer |
| `SLB-004` | parse, validate, and format are root/Core reference-identical |
| `SLB-005` | all 121 Node values are root reference-identical |
| `SLB-006` | Help and Guide run in Core; schema execution remains Node-owned |
| `SLB-007` | fresh packed installation resolves and executes both subpaths |
| `SLB-008` | root, command, schema, dependency, and release baselines remain fixed |

## 5. Verification

The focused source, lifecycle, formatter, dependency, manifest, historical
compatibility, documentation, English-baseline, and isolated-package gates
passed. The complete repository gate then passed after recording the completed
task and synchronizing its self-use projection.

```sh
npm run build
node --test test/adapter-core-dependency.test.mjs test/adapter-shared-library.test.mjs test/project-actuals-lifecycle.test.mjs test/project-actuals-source-core.test.mjs test/formatter.test.mjs
node --test test/release-0.5.1-design.test.mjs test/release-0.5.2-design.test.mjs test/scheduling-units-m2-acceptance.test.mjs test/scheduling-units-m2r-acceptance.test.mjs test/scheduling-units-m3-acceptance.test.mjs test/scheduling-units-m4-acceptance.test.mjs
npm run check:package
npm run check:docs
npm run check:english
npm run check
git diff --check
```

## 6. Retained boundaries

- Node filesystem, Git, hashing, artifact, persistence, and cancellation ports
  remain owned by `NODE_PORT_BOUNDARY`.
- The current Node-backed Contract 7 Application result producers are not
  misrepresented as portable Core services.
- CLI parity, document sessions, LSP, VSIX/DAG, and MCP remain unimplemented.
- Editor and MCP mutation, release selection, publication, global install,
  remote writes, Issue mutation, and plan advance remain separate decisions.
