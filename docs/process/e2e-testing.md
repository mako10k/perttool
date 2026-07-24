# E2E Scenario Tests

- Document status: Active 1.5
- Created: 2026-07-21
- Covered surfaces: `dsl help`, `dsl check`, `dsl format`, mutation, `dag analyze`, `dag next`, `dag advance`, `dag render`, and `dag import`

## 1. Purpose

Pass user-authored `.pert` documents to the actual CLI process and confirm that document checking, PERT/CPM analysis, resource-constrained analysis, next-task determination, advance, and Mermaid round trips work as one operational sequence.

Keep these tests separate from unit tests that call the Core API directly; start `dist/cli.js` as a subprocess and inspect the exit code, stdout, stderr, and JSON envelope.

## 2. Scenarios

| ID | Use case | Operation | Primary acceptance criteria |
| --- | --- | --- | --- |
| E2E-001 | Create a first plan and compare staffing changes | help → check → analyze → next → capacity override | While preserving dependency readiness, one task is runnable at capacity 1 and two tasks are runnable at capacity 2. Resource makespan changes from 8d to 5d. |
| E2E-002 | An active task occupies an exclusive resource | check → analyze → next | Return active tasks as a separate classification, make only resource-free tasks runnable, and show the active occupant for waiting tasks. |
| E2E-003 | An external approval blocks a task | check → analyze → next → warnings-as-errors | Distinguish blocked_now from upcoming and state in a warning that analysis depends on resolution of the external block. |
| E2E-004 | Reflect task completion in a document and recalculate | check → analyze → next for before/after | Exclude done tasks from candidates, make downstream tasks ready, and update remaining duration from 5d to 3d. Return advance guidance for the completed portion. |
| E2E-005 | Safely reject an invalid resource reference | check → analyze → next | Every command returns exit 1 and the same stable diagnostic, without a successful result. |
| E2E-006 | AI uses point estimates and velocity forecasts | help → check → analyze → next | Preserve PERT values in p and return a 20p/10d velocity forecast in days in a separate field. A 15p resource makespan becomes 7.5d. |
| E2E-007 | AI corrects multiple syntax errors | check → analyze → next, diagnostic limit | Collect independent errors in source order, suppress child lines of invalid blocks and subsequent semantic/graph diagnostics, and state when the limit is exceeded. |
| E2E-008 | Pass a mutation preview to the next command | task set preview → check | The revalidated candidate is valid and does not change the original file. |
| E2E-009 | Replace a path without creating an intermediate state | atomic batch preview → analyze | Check a connected milestone addition and task replacement as one candidate, which can be analyzed directly. |
| E2E-010 | Inspect a formatter preview | format preview → check → format --check | The golden candidate is valid and idempotent and does not change the original file. |
| E2E-011 | Safely save and reanalyze a checked candidate | grammar temporary copy format --write → check → analyze → next, mutation --write → check → analyze → next | The grammar plan round trip matches the original text, and all read-only commands accept formatter/mutation documents after write. |
| E2E-012 | Review DSL semantics and analysis conditions in Mermaid | help → render preview → render --out → strict plain | Profile metadata and headers separately retain DSL semantic values and capacity overrides, and apply exclusive out and strict loss. |
| E2E-013 | Advance while preserving a partial join | preview → check/analyze/next → write to temporary copy → rerun | Remove only past tasks, preserve frontier/ready, and make the second run a no-op. |
| E2E-014 | Round-trip a Mermaid profile with semantic equivalence | analyzed render → profile import → check/analyze → re-render, plain strict import | Regenerate the profile byte-identically, reject alterations, and separate plain loss from candidate/write. |

Place fixtures in `test/fixtures/e2e/`; do not mix past states into normative plans, and compare before/after as independent inputs.

## 3. Running the tests

Run only E2E tests.

```sh
npm run test:e2e
```

The full repository check reruns the same E2E tests as part of the normal test suite.

```sh
npm run check
```

## 4. MVP boundary

E2E-004 fixes the analysis difference before and after task completion. E2E-013 checks advance preview for a partial-join fixture, `--write` to a copy in a temporary directory, and rerun no-op behavior. In addition to previews, formatter and mutation use `--write` only on temporary copies, and Mermaid render/import use `--out` only in temporary directories. E2E does not change normative plans. MCP is outside this E2E slice.
