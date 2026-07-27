# Issue #4 Governance Implementation Acceptance

- Document status: Accepted
- Acceptance date: 2026-07-27
- Issue: [Issue #4](https://github.com/mako10k/perttool/issues/4), open at acceptance
- Plan: [../../plans/governance.pert](../../plans/governance.pert)
- Design acceptance:
  [governance-design-acceptance.md](governance-design-acceptance.md)
- Pre-activation base: `6d7dc8a`
- Accepted repository-source boundary: Grammar 4 and CLI Contract 5
- Published package boundary: `0.3.0`, Grammar 1/2/3 and CLI Contract 4

## 1. Decision

The Issue #4 owner-aware governance implementation is accepted for the
repository source and the package produced from that source. Grammar 4,
ProjectResult v3, MutationResult v2 with GovernanceDecision v1, the Contract 5
registry/help/usage/Guide surface, governed direct/batch/advance planning, and
authorization-before-safe-write enforcement activate as one public change.

This decision does not select a release version, create or move a Git tag,
write to GitHub, publish to npm, or move an npm dist-tag. The already published
`0.3.0` artifact remains Contract 4 until a separately authorized release
workstream distributes a new artifact.

## 2. Accepted behavior

The public parser, validator, formatter, project metadata, analysis,
recommendation, exact unit migration, mutation, and CLI paths accept Grammar 4.
Older Grammar 1/2/3 plans retain the effective default owner `user`, empty
delegate lists, and source compatibility.

Every CLI JSON envelope reports `cli_contract_version=5`. Project metadata
uses `Perttool.ProjectResult.v3`; mutation and advance use
`Perttool.MutationResult.v2` and include
`Perttool.GovernanceDecision.v1`. The standard package-root names expose the
accepted behavior; target-prefixed implementation helpers remain private.

Governed previews return the complete candidate and authority decision without
requiring actor assertions. Persistent goal or DAG changes require an actor
and either direct effective owner/delegate authority or one matching
caller-asserted `--accepted-by-owner` value for every affected effective
owner. Direct, batch, and advance paths classify the actual validated change
and evaluate only the digest-bound pre-change snapshot. Unauthorized,
malformed, and stale operations fail closed before or within the retained
safe-write gates.

Ordinary maintenance remains not applicable to governance and retains the
existing preview-first and safe-write behavior. Project initialization and
current new-document import emit the exact direct-edit warning. Exact unit
migration preserves Grammar 4 governance declarations. The lossless perttool
Mermaid profile rejects Grammar 4 with `PTCNV-102` rather than silently
discarding governance metadata.

## 3. Acceptance trace

| Acceptance | Result | Principal evidence |
| --- | --- | --- |
| `GOV-AC-001` | Accepted | Grammar 1/2/3 effective defaults and Grammar 4 metadata tests |
| `GOV-AC-002` | Accepted | Governed preview retains a valid candidate and complete decision |
| `GOV-AC-003` | Accepted | Unauthorized persistence retains the candidate, emits one `PTGOV-101`, and performs no write |
| `GOV-AC-004` | Accepted | Matching owner confirmation permits the same candidate |
| `GOV-AC-005` | Accepted | Scope-specific delegate tests deny implicit cross-scope authority |
| `GOV-AC-006` | Accepted | Owner/delegate changes use the pre-change snapshot and cannot self-authorize |
| `GOV-AC-007` | Accepted | Mixed-scope batches use one operation-level decision |
| `GOV-AC-008` | Accepted | Ordinary mutation and read-only paths remain governance-not-applicable |
| `GOV-AC-009` | Accepted | Registry, text/JSON help, Guide, README, process guidance, and generated warning agree |
| `GOV-AC-010` | Accepted | Core, CLI, batch, safe-write, link, package, and isolated installed workflows pass |

All interface invariants `GOV-IF-001` through `GOV-IF-015`, source cases
`GOV-SRC-001` through `GOV-SRC-006`, and authority/write cases `GOV-001`
through `GOV-015` remain traced through the design acceptance, normative
examples, focused tests, and installed-package workflow.

## 4. Verification

The acceptance run used Node.js 22 or later from the repository root and
passed:

```sh
npm run typecheck
npm test
npm run check:docs
npm run check:self-use
npm run check:link
npm run check:package
git diff --check
```

`npm run check:package` built the current source into a temporary tarball,
installed it into an isolated prefix, and exercised the complete Contract 5
file-first workflow. That workflow verifies public root exports, command and
Guide discovery, generated warnings, Grammar 4 project metadata and upgrade,
preview without authority, denied persistence, authorized persistence, atomic
mixed-scope batch decisions, stale-digest safety, and Grammar 4 unit-migration
preservation.

## 5. Explicit non-goals

Acceptance does not claim:

- authentication, verified identity, signatures, or secret-backed principals;
- durable approval or governance audit records;
- technical prevention of direct DSL editing;
- recommendation override apply or its MIG-08 audit path;
- Git hooks, branch protection, commit integration, or issue synchronization;
- MCP, LSP, VSIX, or other adapter activation;
- release version selection, tagging, GitHub Release creation, npm
  publication, or dist-tag movement; or
- conversion of Grammar 4 governance metadata through the lossless Mermaid
  profile.

The generated warning remains guidance: a text editor, shell command, or other
program can bypass the tool-mediated owner-confirmation check. Git and human
review remain separate controls.
