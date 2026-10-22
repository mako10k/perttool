# Issue 44: remaining estimates and first-start baselines

## Scope and governing contract

This local correction is based on `d2fd28a3f8e6321e7056d139a990e91e7fc721ce`
and Issue 44. Requirements 7.4 defines an in-progress estimate as remaining
work at the current snapshot. Project Actuals 4.1 defines `planned_value` as
the exact expected value at first start. These meanings coexist: 5/8/13p
produces a 25/3p start baseline, while a later 1/2/4p estimate represents
13/6p remaining work. No requirement, grammar version, CLI contract version,
result schema, or lifecycle request shape changes.

The historical source-core acceptance's permanent equality check contradicted
that requirement. Its original record is retained with an explicit correction
notice. The grammar and actuals specifications now distinguish creation from
snapshot validation and retry matching.

## Mechanism and correction

Before correction, the semantic validator compared every persisted start
baseline with the current expected task value. The lifecycle planner also
recomputed that value when matching a same-ID start retry. A residual update
therefore failed source revalidation, and a retry could conflict after such
an update. The audited analysis is
[issue-44-remaining-estimate-rca.think](issue-44-remaining-estimate-rca.think).
`llmthink dsl audit` passed with zero fatal, error, or warning findings;
remaining hints concern shared reasoning references and long lines. The
pending item states the historical evidence limit below, not an unimplemented
repair obligation.

The validator retains shape, required and forbidden fields, ownership, exact
quantity syntax and base-unit checks. It no longer compares historical start
values with current remaining estimates. The lifecycle planner computes a
baseline only for a new start. Retry matching compares request-owned fields;
it retains the stored event and still requires the existing target state.
Current estimate mutation, safe-write digest binding, lifecycle reduction,
measurements, history payload comparison, and strict adjacent-snapshot unit
conversion remain owned by their existing components.

A standalone snapshot cannot prove that a baseline was generated correctly
at first start or detect an earlier same-ID payload edit. Current-estimate
equality cannot supply that proof. Initial generation is tested through the
lifecycle path; history still rejects changed same-ID payloads except for a
fully proved exact unit conversion. First-seen evidence is not independent
historical attestation.

## Verification scope and review boundary

The review subject is this Issue 44 local correction under Requirements 7.4
and Project Actuals 4.1. INSIDE obligations are exact initial generation,
supported residual updates and digest-bound persistence, unchanged event
bytes, schedules, retry behavior, lifecycle completion, original-baseline
observation, malformed-event refusal, same-ID conflicts, and strict historical
unit-conversion defenses. A 25/3p start with 13/6p current remaining work is
valid; changing that start's payload under its existing ID still conflicts
across history.

OUTSIDE boundaries are consumer writes, unrelated PTHIS-102 identity warnings,
Issue 42 historical recovery, Grammar migration, release selection, remote
push or merge, publication, and global installation. No BOUNDARY_DISPUTE was
found: the requested first-start and residual meanings are already specified.

The added CLI regressions exercise three-point and rational initial values,
remaining estimate and duration changes, byte-preserving digest-bound writes,
precedence/resource schedules, retry, suspension/resumption/finish, baseline
history and throughput, and same-ID payload conflicts. Existing actuals,
malformed-source, lifecycle, history and exact-conversion tests remain active.

## Original consumer preview

The [preview receipt](issue-44-kn-preview.json) records the exact command,
source and candidate hashes, diagnostic summary, and diff. The default
100-diagnostic limit returns only PTDAG-208 warnings with truncation; this
preview is not a claim of complete diagnostic enumeration. The input is the original
kn project at evidence HEAD `79ef7ef6f42e1c0fb6029a38c83fdfdda6eb55e9`;
`frontend.pert` matches consumer `19d5949` byte-for-byte. The corrected preview
returns exit 0 and `ok=true`, retaining all 303 work-event blocks byte-for-byte,
including the original 25/3p start baseline. The consumer file remains
unchanged. No project-root override or substitute history was used.

This is validation of the previously rejected candidate, not a fresh estimate
of today's remaining kn work and not authority to apply that candidate.

## Verification results

- Node.js 22.22.3: root and all private-adapter builds passed.
- Actuals-focused suite: 71/71 passed. The two additional residual-versus-baseline
  unit-conversion cases passed 2/2 using a test-name filter.
- `npm run check:static`: all-workspace typechecks, duplication and complexity
  ratchets passed.
- `npm run check:english`: passed (1,415 text files at the initial check).
- `npm run check:docs`: passed (421 Markdown files and seven normative examples).
- `npm run check:link`: passed in a temporary prefix; no global install.
- `git diff --check`: passed.

The broad Node.js 22 run (`node --test test/*.test.mjs`) completed 1,432
tests: 1,431 passed and one schema integration test failed on a missing named
module export during CLI startup. The temporary-link check concurrently ran
`npm prepare`/build against the same `dist` directory. The completed dist and
unchanged source both export that name. Concurrent generation is a plausible
interference, not a proven historical cause. After build/link finished, the
single failed test passed with:

```sh
node --test --test-name-pattern='actual success, invalid, unavailable, and usage results validate' test/json-schema.test.mjs
```

No full-suite rerun or production workaround was used. The two new
residual-conversion tests were added after the broad run began and verified
separately. Run build and temporary-link generation serially before tests
that import `dist` to prevent test inputs changing during execution.

Standalone packaged LSP/MCP/VSIX host gates, package distribution and Node.js
24 have not been rerun for this correction; protocol, distribution, manifest
and public-surface inventories are unchanged.

Final review: INSIDE obligations have the implementation and regression
evidence above; no unresolved implementation finding was identified.
OUTSIDE actions remain excluded, and there is no BOUNDARY_DISPUTE. This is a
local correction, not release or consumer-application acceptance.
