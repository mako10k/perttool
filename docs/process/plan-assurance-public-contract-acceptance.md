# Plan Assurance Public Contract Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-04
- Workstream: `ASSURE-001`
- Task: `ASSURE_PUBLIC_CONTRACT`
- Source grammar: Grammar 6
- CLI contract: Contract 7
- Release effect: none

## 1. Scope

This record accepts the atomic source-level activation of conditional plan
assurance. It covers the standard parser and formatter, public package root,
44-command registry and usage validation, CLI, Guide/help, 20-root Draft
2020-12 catalog, safe writes, assurance-aware analysis and start authority,
advance composition, Mermaid semantic profile 2, temporary link, and isolated
installed-package behavior.

The activation retains Grammar 1 through 5 source meaning. It does not mutate
the published `perttool@0.6.0` package, select a later package version, publish
to npm or GitHub, move a dist-tag, advance the assurance plan, close an Issue,
or perform any remote write.

## 2. Public boundary

The accepted boundary is one coordinated set:

- Grammar 6 with opt-in plan-assurance model 1 and hash model 1;
- all 34 retained commands plus ten assurance commands;
- `Perttool.CheckResult.v4`, `Perttool.ProjectResult.v4`,
  `Perttool.AnalysisResult.v5`, `Perttool.NextResult.v6`,
  `Perttool.MutationResult.v4`, `Perttool.AdvanceResult.v2`, and
  `Perttool.PlanAssuranceResult.v1`;
- nested `Perttool.GovernanceDecision.v2`;
- authority policy
  `recommendation_v1_plus_release_gate_plus_plan_assurance_v1`;
- nineteen command-result schema roots plus public library-only
  `Perttool.OverrideDecision.v1`; and
- package-root adapters that expose assurance behavior without exporting the
  lower-level target capability or hash/evaluator internals.

No mixed public state is accepted: a Contract 7 envelope cannot advertise an
old closed root identity, and the active catalog does not retain superseded
Contract 6 roots.

## 3. Behavioral evidence

The focused public-contract test proves that an assertion-free initial-seal
preview upgrades a retained source to Grammar 6, returns MutationResult v4 and
GovernanceDecision v2, and produces a complete verified baseline. NextResult
v6 keeps the raw recommendation and grants start authority only through the
combined temporal and assurance policy. A later task-plan edit leaves the
accepted seal untouched, changes the task to `review_required`, and removes it
from the startable set.

The same test verifies the public package root, absence of lower-level hash and
evaluator exports, the 44/20 discovery boundary, semantic Mermaid profile 2
with analysis-bound reproduction, CLI show projection, and the exact
pinpoint-hash text invariant: one lowercase canonical digest plus LF with an
empty diagnostic stream on success. The isolated package workflow repeats the
seal, show, hash, and Next authority sequence from the packed installation.

Compatibility tests retain Grammar 1 through 5 parsing and ordinary commands.
Retained-grammar governed mutations use Grammar 6 candidate validation but
perform the final authority decision only through GovernanceDecision v2. Old
package pins remain the route for consumers that require the closed Contract 6
JSON identities.

## 4. Verification

The acceptance gate consists of:

```sh
npm run typecheck
npm test
npm run check:english
npm run check:docs
npm run check:link
npm run check:package
npm run check
git diff --check
```

Focused verification additionally runs the plan-assurance public contract,
interface, source, mutation, authority, compatibility, hash-inspection,
advance, Mermaid, registry, Guide, schema, CLI, recommendation, override, and
historical compatibility tests.

The complete gate passed on 2026-08-04 with the following observed results:

- TypeScript build and type checking completed without diagnostics.
- `npm test` passed all 784 tests with zero failures, skips, or cancellations.
- the English baseline checked 595 text files and exactly three allowlisted
  lines;
- documentation checks covered 151 Markdown files and seven normative PERT
  examples;
- read-only self-use check, analyze, and next passed for all 30 plans;
- the temporary-link workflow passed with `perttool 0.6.0`; and
- the isolated package check passed a 601-file, 656.1 kB tarball, including
  Contract 7 file-first and plan-assurance seal/show/hash/next workflows.

The package dry-run retained the `beta` target only. It did not publish the
candidate or mutate a registry. `git diff --check` passed separately.

The task lifecycle was then closed with one deterministic finish event at
`2026-08-04T15:51:00+09:00`. A fresh complete NextResult v6 recommends and
authorizes only `ASSURE_ACCEPTANCE`.

## 5. Remaining boundary

`ASSURE_ACCEPTANCE` remains a separate final workstream task. The current task
does not authorize `dag advance` on `plans/plan-assurance.pert`, release
selection, a release plan, Git push, GitHub mutation, npm publication,
dist-tag movement, or Issue mutation.
