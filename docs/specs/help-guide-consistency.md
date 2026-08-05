# Help and Guide Consistency

- Status: Accepted correction contract 1.0
- Review date: 2026-08-05
- Workstream: `GUIDE-CONSISTENCY-001`
- Active source grammar: Grammar 6, with Grammar 1 through 5 compatibility
- Active CLI contract: CLI Contract 7
- Accepted input package: `perttool@0.7.0`
- Selected release package: `perttool@0.7.1`
- Result identities: unchanged

## 1. Purpose

The command Help registry and domain Guide are public interfaces for both
people and automated consumers. They MUST describe the active implementation,
provide invocations accepted by the active argument parser, and point every
diagnostic to a resolvable Guide topic. Passing type, unit, documentation, and
package gates is necessary but is not evidence that the prose meaning or
examples remain current.

This correction addresses the complete repository review performed on
2026-08-05. It covers current guidance and the labels that distinguish current
behavior from historical snapshots. It does not change Grammar 6, CLI
Contract 7, any result identity, command semantics, governance authority,
plan-assurance authority, or a published package.

## 2. Observed consistency failures

1. The active Guide projected `Perttool.NextResult.v6` through a version-lift
   adapter while retaining the older
   `recommendation_v1_plus_release_gate` policy instead of
   `recommendation_v1_plus_release_gate_plus_plan_assurance_v1`.
2. The same adapter lifted selected version names through string replacement,
   leaving incomplete Grammar-version histories and older analysis result
   identities in otherwise active Contract 7 guidance.
3. All eight plan-assurance mutation command descriptors contained an example,
   but their examples omitted required operands or options and failed active
   CLI argument validation.
4. Runtime diagnostics referenced `project.history`,
   `project.observe-velocity`, and `project.migrate-unit`, which were not Guide
   topic IDs.
5. The README's unqualified installation guidance and selected current-state
   statements in requirements, normative examples, interface specifications,
   and the plan index retained pre-acceptance `0.7.0` wording.
6. Stable Mermaid loss diagnostic `PTCNV-210` was implemented without the
   corresponding normative diagnostic-table entry or direct regression test.
7. Every related Guide target resolved, but many conceptually peer
   relationships were represented in only one direction, including no inbound
   related link to `plan-assurance`.

## 3. Required corrections

### 3.1 Active Guide projection

The active Guide MUST project Grammar 6 and CLI Contract 7 meaning directly.
It MUST state `Perttool.AnalysisResult.v5`, `Perttool.NextResult.v6`, and
authority policy
`recommendation_v1_plus_release_gate_plus_plan_assurance_v1` together. Syntax,
actuals, temporal analysis, safe editing, and plan assurance MUST describe the
additive version history without relabeling a Grammar 5 feature as Grammar 6.

Compatibility helpers MAY remain for tests and historical package boundaries,
but the active Guide MUST NOT depend on unrestricted prose substitution to
derive semantic version or authority statements.

### 3.2 Command examples

Every registered command example MUST pass the active command parser through
usage validation without reading a project or performing a write. Examples
for required operands and options MUST contain concrete valid placeholders.
The eight plan-assurance mutation examples MUST cover their exact operation:

- `plan-assurance seal` includes `--reason`;
- `plan-assurance reseal` includes `--task` and `--reason`;
- `plan-dependency add` includes relation, predecessor, successor, and
  `--mode`;
- `plan-dependency set|remove` include the relation ID;
- `task-outcome add` includes outcome ID, task ID, `--status`, and `--reason`;
  and
- `task-outcome set|remove` include the outcome ID.

### 3.3 Diagnostic navigation

Every literal runtime `helpTopic` MUST resolve through the active Guide.
Project history and velocity diagnostics MUST link to `actuals`; unit-migration
diagnostics MUST link to `editing.unit-migration`. The regression gate MUST
discover literal links across all tracked TypeScript sources rather than a
hand-selected file list.

Stable public diagnostics MUST be recorded in the applicable normative
diagnostic table and have a direct trigger test. `PTCNV-210` is the stable
profile-2 assurance-loss diagnostic. `PTCLI-070` remains the generic internal
error boundary and is not a domain recovery code.

### 3.4 Current and historical documentation

At correction acceptance, installation guidance MUST identify
`beta=latest=0.7.0` and an unqualified `perttool` installation as `0.7.0`.
Release preparation for the selected `0.7.1` patch MUST switch exact examples
to `0.7.1`, state that beta publication leaves `latest=0.7.0`, and retain
`0.7.0` as the rollback pin. The earlier publication-time fact that `latest`
remained `0.6.0` belongs in the immutable `0.7.0` release record and MUST NOT
be presented as a later current registry state.

Requirements, normative examples, interface specifications, and plan indexes
MUST distinguish these labels:

- **active/current**: behavior in the repository and unqualified current
  package;
- **target at this slice**: a contract state before public activation; and
- **historical pin**: behavior retained by an exact earlier package version.

Historical contract payloads and acceptance evidence MUST remain intact.
Corrections replace only drifting claims about what is current; they do not
rewrite earlier decisions as if later behavior existed at that time.

### 3.5 Related-topic symmetry

Every related topic ID MUST resolve. A conceptually peer relationship MUST be
reciprocal unless the source node is a deliberate index or workflow pointer.
The active `plan-assurance` topic MUST be reachable from at least `syntax`,
`analysis`, `next`, and `editing`, and it MUST link back to those topics.
Tests MUST fix this bounded reciprocity rule without requiring every
hierarchical index edge to be reciprocal.

## 4. Acceptance cases

| ID | Acceptance condition |
| --- | --- |
| `HGC-001` | Active Guide detail contains the exact Grammar 6, Contract 7, AnalysisResult v5, NextResult v6, and combined assurance policy identities with correct additive history. |
| `HGC-002` | Every one of the 44 registered command examples passes active argument parsing; the eight assurance mutation examples include every required operand and option. |
| `HGC-003` | Every literal TypeScript `helpTopic` resolves through `getGuide`, including history, velocity observation, and unit migration. |
| `HGC-004` | README and current-state normative surfaces agree with the accepted `0.7.0` correction baseline and selected `0.7.1` release state while preserving publication-time facts in release records. |
| `HGC-005` | `PTCNV-210` is specified and directly tested; the generic `PTCLI-070` boundary remains explicit but separate from domain recovery guidance. |
| `HGC-006` | The bounded peer-topic reciprocity rule passes and `plan-assurance` has the required inbound and outbound navigation. |
| `HGC-007` | Focused tests, Node.js 22 `npm run check`, `git diff --check`, temporary-link, and isolated-package checks pass with no external mutation. |

## 5. Compatibility and non-goals

This work changes guidance, examples, diagnostic navigation metadata, tests,
and current-state documentation. It does not add a command, option, result
field, schema identity, locale, translation catalog, runtime network lookup,
or automatic registry-state discovery. It does not modify historical package
bytes, publish a release, move an npm dist-tag, mutate a GitHub Issue, advance
an existing completed plan, or authorize any remote write.
