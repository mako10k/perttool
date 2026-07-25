# SU-M2R Exact Rational Duration Contract Acceptance

- Status: Accepted
- Accepted: 2026-07-25
- Plan task: `RATIONAL_DURATION_CONTRACT`
- Interface: `perttool.temporal-unit-interface@2`
- Grammar target: `3`
- Unit migration: `perttool.unit-migration@2`
- Example baseline: `Perttool.TemporalUnitExampleBaseline.v2`

## Scope

This review accepts the normative contract for exact Fraction Duration before
parser, formatter, mutation, migration, or public Contract 4 implementation.
It does not activate grammar version 2 or 3, change CLI Contract 3, export a
target Core API, adopt NextResult v4 authority, or authorize publication.

## Accepted identities

| Concern | Accepted identity |
| --- | --- |
| Active DSL | Grammar 1, unchanged |
| Accepted temporal target | Grammar 2, unchanged |
| Exact-Duration target | Grammar 3 |
| Temporal/unit interface | `perttool.temporal-unit-interface@2` |
| Unit-migration semantics | `perttool.unit-migration@2` |
| Unit-migration result | `Perttool.UnitMigrationResult.v2` |
| Future CLI cutover | CLI Contract 4, unchanged and inactive |
| Other target results | CheckResult v2, ProjectResult v2, AnalysisResult v3, NextResult v4 |

CheckResult, ProjectResult, AnalysisResult, and NextResult identities remain
unchanged because exact Rational values and the grammar-version integer fit
their accepted shapes and meanings. UnitMigrationResult increases to version
2 because source/target grammar and grammar disposition are new required
result data. The interface itself increases to version 2 because its grammar
and migration contracts changed.

## Accepted syntax and serialization

- Grammar 3 inherits every Grammar 2 temporal field and validation rule.
- Duration accepts either the existing finite Decimal or an exact Fraction.
- Fraction numerator and denominator are unsigned base-10 integers without
  whitespace, signs, exponents, decimal points, or additional slashes.
- The denominator is greater than zero; malformed forms report `PTDSL-007`
  before Rational arithmetic.
- Velocity remains Decimal-only.
- Semantic values are reduced exact Rationals.
- Canonical output uses the shortest exact Decimal when the denominator has
  only prime factors 2 and 5, and a reduced Fraction otherwise.
- Explicit formatting canonicalizes Duration. Source-preserving operations
  retain unrelated valid tokens.

## Accepted migration boundary

Migration version 2 preserves the version 1 direction, velocity, inventory,
and exact formulas. It replaces `nonrepresentable_decimal` with exact
Fraction output:

1. Convert every inventoried Duration as an exact Rational.
2. Canonically serialize every converted value.
3. Retain source Grammar 1 or 2 when every token is Decimal.
4. Atomically upgrade the candidate to Grammar 3 when any token is a Fraction.
5. Retain Grammar 3 for a Grammar 3 source and never downgrade automatically.

`Perttool.UnitMigrationResult.v2` reports
`source_grammar_version`, `target_grammar_version`, and
`grammar_disposition`. A grammar upgrade or velocity metadata change
qualifies reversibility as `values_exact_metadata_changed`. An inverse still
restores exact source Duration values, but a prior grammar upgrade remains
explicit metadata.

`PTMIG-408` remains reserved for migration version 1
`nonrepresentable_decimal` and is never reused by version 2.

## Traceability

| Concern | Normative evidence |
| --- | --- |
| Product requirement and compatibility | `docs/requirements.md` 7.7 |
| Fraction syntax and formatter rule | `docs/specs/dsl-grammar.md` 20.2 |
| Exact conversion, grammar selection, inverse | `docs/specs/unit-migration.md` 8-17 |
| Public types, diagnostics, activation | `docs/specs/temporal-unit-interface.md` |
| Mutation/batch boundary | `docs/specs/mutation.md` 9.4 and 11 |
| Application structure and milestone ordering | `docs/basic-design.md` 6.6-6.7 |
| Concrete observations | `docs/examples/temporal-units.md` TUE-015, TUE-019, TUE-020 |
| Machine observations | `test/fixtures/temporal-units/cases.json` |

The interface observations are contiguous `TUI-001` through `TUI-020`; the
machine examples are contiguous `TUE-001` through `TUE-020`.

## Verification gate

Acceptance requires all of the following over the same working tree:

```sh
node --test \
  test/unit-migration-contract.test.mjs \
  test/temporal-unit-interface-contract.test.mjs \
  test/temporal-unit-examples.test.mjs \
  test/scheduling-units-m2r-plan.test.mjs
bash scripts/check-docs.sh
bash scripts/check-self-use.sh
npm run check
git diff --check
```

The later source-model, serializer, formatter, mutation, version-boundary,
and final acceptance tasks remain required. This contract review alone does
not claim that Grammar 3 is implemented or runnable.
