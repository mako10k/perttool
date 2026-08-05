# Adapter Core Dependency Cleanup Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `CORE_DEPENDENCY_CLEANUP`
- Architecture contract: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Machine cases: [../../test/fixtures/adapter-core-dependency-cases-v1.json](../../test/fixtures/adapter-core-dependency-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted outcome

The exact twelve-file, nineteen-import reverse-dependency input is removed.
Reusable syntax checking, base analysis, mutation planning, target mutation
planning, and temporal input projection now live in their neutral semantic,
analysis, or mutation owners. Existing `src/application/` module paths remain
one-line re-export facades, so established internal and package artifacts do
not acquire a second implementation.

Plan-assurance Mermaid conversion no longer imports the Contract 7
Application analyzer. Its lower module declares an injected function port,
and the Application facade and CLI composition root provide the existing
analyzer. Recommendation override validation owns a narrow structural source
projection rather than importing two complete Application result modules.

The only source files outside `src/application/` that import Application are
the exact composition/facade entries `src/cli.ts` and `src/index.ts`. All
other source files have zero imports into `src/application/`.

The completed plan source digest is
`sha256:69f14c31ab56cb8df4f7d03ef05baf90b1a25e20868488b6da9163d4624d33f4`.

## 2. Relocation and inversion record

| Previous module path | Accepted owner or inversion |
| --- | --- |
| `src/application/check.ts` | implementation in `src/semantic/check.ts`; compatibility re-export retained |
| `src/application/analyze.ts` | implementation in `src/analysis/service.ts`; compatibility re-export retained |
| `src/application/mutate.ts` | implementation in `src/mutation/planner.ts`; compatibility re-export retained |
| `src/application/target-mutate.ts` | implementation in `src/mutation/target-planner.ts`; compatibility re-export retained |
| `src/application/target-temporal-input.ts` | implementation in `src/analysis/target-temporal-input.ts`; compatibility re-export retained |
| assurance Mermaid to Contract 7 analysis | `PlanAssuranceMermaidAnalyzer` inward function port supplied by composition |
| recommendation override to NextResult implementations | consumer-owned `OverrideValidationSource` projection |

The repository now contains 149 TypeScript source files: five retained
Application facades plus the five relocated implementations replace the
former five mixed-owner files. This is an additive source-layout change, not
a public export addition.

## 3. Executable boundary

`test/adapter-core-dependency.test.mjs` resolves static ESM imports and exports,
including literal dynamic imports, from every TypeScript source file. It fixes
the exact Application consumers, validates each facade byte for byte, verifies
every neutral owner, and checks the public package closure.

The machine cases are:

| Case | Accepted result |
| --- | --- |
| `CDC-001` | the historical twelve-file, nineteen-import input remains exact |
| `CDC-002` | each reusable implementation has one neutral owner |
| `CDC-003` | only CLI and package-root composition consume Application externally |
| `CDC-004` | lower consumers use injected or consumer-owned ports |
| `CDC-005` | established Application paths are exact compatibility facades |
| `CDC-006` | 121 root exports, 44 commands, 20 schemas, and zero production dependencies remain |
| `CDC-007` | Grammar 1 through 6 and result behavior pass the complete regression gate |
| `CDC-008` | build and acceptance cause no publication or external mutation |

## 4. Compatibility evidence

- The root package still exposes 121 runtime names.
- CLI Contract 7 still exposes 44 commands and 20 root schemas.
- `package.json` retains zero production dependencies.
- Facade and neutral check/analyze exports are function-identical.
- Existing temporal, mutation, formatter, conversion, safe-write, assurance,
  recommendation-override, CLI, and installed-package consumers retain their
  accepted behavior.
- Grammar 1 through 6, governance, plan assurance, history safety, and
  source-preserving safe writes are unchanged.

## 5. Verification

The focused gate is:

```sh
npm run build
node --test test/adapter-platform-contract.test.mjs test/adapter-core-dependency.test.mjs
node --test test/advance.test.mjs test/formatter.test.mjs test/mermaid-export.test.mjs test/mermaid-import.test.mjs test/mermaid-profile-contract.test.mjs test/plan-assurance-compatibility.test.mjs test/plan-assurance-mutation-core.test.mjs test/recommendation-override.test.mjs test/temporal-input-projection.test.mjs test/temporal-deadline-evaluation.test.mjs test/temporal-precedence-schedule.test.mjs test/temporal-resource-schedule.test.mjs test/governance-safe-write-target.test.mjs
npm run check:docs
npm run check:english
npm run check:self-use
git diff --check
```

The repository-wide `npm run check` is the final shared gate before the
completed task snapshot is committed.

## 6. Retained boundaries

- No CLI command, result schema, root export name, package dependency, or
  runtime meaning is added or removed.
- The additive `./core` and `./node` package subpaths remain owned by
  `SHARED_LIBRARY_BOUNDARY`; they are not activated here.
- Node Host separation remains owned by `NODE_PORT_BOUNDARY`.
- LSP, VSIX/DAG, and MCP protocols and implementations remain unstarted.
- Release selection, publication, remote writes, Issue mutation, and plan
  advance remain separate decisions.
