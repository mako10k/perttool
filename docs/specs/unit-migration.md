# Point and Time-Unit Migration Semantics Specification

- Document status: Normative 2.0
- Unit migration ID: `perttool.unit-migration`
- Unit migration version: `2`
- Created: 2026-07-25
- Related requirements: [../requirements.md](../requirements.md)
- Grammar specification: [dsl-grammar.md](dsl-grammar.md)
- Analysis specification: [analysis.md](analysis.md)
- Mutation semantics: [mutation.md](mutation.md)
- Calendar semantics: [temporal-calendar.md](temporal-calendar.md)
- Public interface: [temporal-unit-interface.md](temporal-unit-interface.md)
- Related basic design: [../basic-design.md](../basic-design.md)

## 1. Purpose

This specification fixes the current exact source-migration contract between
a Point project and one explicitly velocity-linked time unit. It defines:

- the permitted `point -> day|hour` and `day|hour -> point` directions;
- the declared or explicitly replaced velocity used by the migration;
- the complete inventory of base-unit-bearing source fields;
- exact Rational conversion and canonical Decimal-or-fraction Duration
  serialization;
- deterministic source-grammar retention or upgrade to grammar version 3;
- atomic, source-preserving candidate behavior;
- no-op, repeated, and inverse migration behavior;
- the boundary between source migration and read-only velocity forecasts; and
- fail-closed causes for unsupported or non-reversible requests.

This specification does not choose public Core types, CLI option names, help
text, JSON schemas, or diagnostic codes, and it does not implement the
migration. Those are dependency-ordered interface and delivery tasks.

## 2. Normative position

Resolve conflicts of meaning or design in the following order.

1. Must requirements in [Requirements](../requirements.md)
2. This specification
3. Literal and field acceptance in the
   [DSL Grammar specification](dsl-grammar.md)
4. Common candidate and source-edit rules in the
   [Mutation Semantics specification](mutation.md)
5. Exact arithmetic in the [Analysis specification](analysis.md)
6. `docs/basic-design.md`, examples, tests, help, and implementation

The grammar determines whether the original document and a candidate document
are valid. This specification receives a valid source document and defines one
coordinated rewrite. It MUST NOT make an invalid source or candidate
successful by rounding, dropping a field, or treating an intermediate batch
state as authoritative.

The `velocity_forecast` projection in Analysis version 1 is read-only. Its
existence, display value, or JSON representation does not constitute a source
migration and MUST NOT be reused as migration input.

## 3. Identity and determinism

The current identity is:

```text
unit_migration_id       = perttool.unit-migration
unit_migration_version  = 2
```

Version 1 remains the accepted historical finite-Decimal-only contract for
grammar versions 1 and 2. Version 2 replaces its representability failure with
exact fraction Duration and an atomic grammar version 3 upgrade. It does not
change the permitted directions or velocity formulas.

The same valid source bytes, target unit, optional replacement velocity, and
version identity MUST produce the same semantic outcome, converted exact
values, candidate bytes, edits, and failure causes.

Migration does not read a wall clock, locale, Git state, calendar, time zone,
environment variable, prior analysis result, or rendered decimal. It consumes
only the validated source and explicit request.

An incompatible change to permitted directions, velocity selection,
conversion formulas, field inventory, source serialization, or
round-trip meaning requires a unit-migration version increase. A public
result schema or CLI contract is versioned independently.

## 4. Scope and non-goals

In scope:

- a valid project whose base unit is `point`, `day`, or `hour`;
- migration from `point` to exactly one velocity-linked time unit;
- migration from `day` or `hour` to `point`;
- a declared velocity or an explicit replacement velocity;
- every base-unit-bearing source value listed in Section 7;
- exact Rational conversion and canonical Decimal-or-fraction serialization;
- deterministic retention of grammar version 1 or 2 when every generated
  token is Decimal, or one atomic upgrade to grammar version 3 when a
  generated fraction is required;
- one atomic, revalidated, source-preserving candidate; and
- deterministic no-op, repetition, inverse, and failure behavior.

Out of scope:

- direct `day -> hour` or `hour -> day` migration;
- inferring 24 hours per day or any other day/hour ratio;
- calendar arithmetic, dates, date-times, offsets, business calendars, or
  resource calendars;
- using `project.as_of`, `deadline`, or `not_before` as a conversion input;
- changing resource quantities, task priority, or any identifier;
- converting derived analysis, schedule, recommendation, or display values;
- probabilistic, approximate, rounded, or lossy conversion;
- independently applying a sequence of temporarily invalid mutations;
- automatically changing task structure, state, or PERT estimate kind; and
- filesystem writes, optimistic locking, and public command spelling.

## 5. Semantic request

The semantic request has exactly these inputs.

```text
UnitMigrationRequest:
  target_unit          day | hour | point
  replacement_velocity optional exact Velocity literal
```

`source_unit` is the validated `project.duration_unit`. A replacement velocity
is caller-authored input, not an inferred value. It has the grammar form
`Pp/Td` or `Pp/Th`, and both `P` and `T` are positive exact Rationals.

The effective migration velocity is selected as follows.

1. If `replacement_velocity` is present, use its exact semantic value.
2. Otherwise use the project's declared velocity.
3. If neither exists, fail with `missing_velocity`.

If a replacement is semantically equal to the declared velocity, including
the same period unit, treat the velocity as retained and preserve its source
bytes. Otherwise the candidate uses the replacement velocity and records the
disposition `replaced` or `inserted`.

A replacement velocity is part of the same atomic migration. It MUST NOT be
applied if any converted field or the final candidate fails.

## 6. Permitted direction and velocity relationship

Let the effective velocity be:

```text
V = P point / T U
```

where `P > 0`, `T > 0`, and `U` is `day` or `hour`.

The only changing-unit cases are:

| Source unit | Target unit | Required relationship |
| --- | --- | --- |
| `point` | `day` | `U = day` |
| `point` | `hour` | `U = hour` |
| `day` | `point` | `U = day` |
| `hour` | `point` | `U = hour` |

Rules:

- A Point source may use its declared velocity or an explicit replacement
  whose period unit equals the requested time target.
- A time source may use its declared velocity or an explicit replacement
  whose period unit equals the source time unit.
- A time source without a velocity requires an explicit replacement with a
  matching source period unit.
- A Point source requesting a time unit different from the effective velocity
  period fails with `velocity_period_mismatch`.
- A time source requesting `point` with a velocity period different from the
  source fails with `velocity_period_mismatch`.
- Direct `day <-> hour` requests fail with `unsupported_direction`, even when
  a velocity or a calendar profile exists.

An explicit Point-to-time replacement may select a different time period from
the original Point velocity. That is an intentional replacement of the
Point/time relationship, not an inferred day/hour conversion. The result is
qualified as `velocity_replaced`; it does not claim preservation of the
original calendar forecast.

## 7. Complete source-field inventory

Unit migration version 2 rewrites exactly the following source values.

| Source location | Migration behavior |
| --- | --- |
| `project.duration_unit` | Replace with the target unit keyword |
| `project.velocity` | Retain, replace, or insert the effective velocity |
| `project.critical_epsilon` | Convert when declared; omitted zero remains omitted |
| `project.target_duration` | Convert when declared |
| every task `duration` | Convert regardless of task status |
| every task `estimate.optimistic` | Convert |
| every task `estimate.most_likely` | Convert |
| every task `estimate.pessimistic` | Convert |

The following values are not base-unit-bearing migration inputs and remain
unchanged:

- project ID, title, description, `as_of`, and finish; project version remains
  unchanged except for the exact-fraction upgrade defined in Section 9;
- milestone and task `deadline`;
- task `not_before`;
- milestone state and task status;
- resource capacity and task resource requirements;
- task priority, owner, tags, block reason, and source;
- task/gate endpoints and gate reasons; and
- every comment, blank line, and unrelated source token.

The initial temporal scope contains only absolute dates and date-times, so it
adds no duration-bearing source field to this inventory. Absolute temporal
values MUST NOT be rewritten merely because the project base unit changes.

Grammar version 2 adds only absolute temporal fields, and grammar version 3
changes only Duration literal syntax, so the inventory remains complete for
grammar versions 1, 2, and 3. If a later grammar version adds a source field
whose meaning is expressed in the project base unit, unit migration version 2
fails with
`unsupported_duration_field` until a new migration version inventories that
field. It MUST NOT silently leave a base-unit-bearing field unchanged.

## 8. Exact conversion

All source Decimal or Fraction Duration tokens and Decimal velocity quantities
are parsed into reduced exact Rationals before conversion. No binary floating
point or display string is a semantic input.

For a source value `x`:

```text
point -> U:
  converted(x) = x * T / P

U -> point:
  converted(x) = x * P / T
```

Every converted value uses the same effective velocity. Reduce each result to
a canonical Rational after multiplication and division.

The scale factor is positive. Therefore migration preserves:

- zero and positivity constraints;
- `optimistic <= most_likely <= pessimistic`;
- whether `pessimistic > 0`; and
- ordering among exact duration values.

Migration does not convert a derived PERT expected value or variance. After a
successful candidate is reparsed, Analysis version 1 derives them from the
converted source estimates in the target unit. Variance consequently uses the
square of the target base unit.

## 9. Canonical exact Duration serialization

Grammar versions 1 and 2 accept finite base-10 Decimal Duration tokens.
Grammar version 3 additionally accepts exact fraction Duration. For every
converted Rational `n/d`, reduced with `d > 0`, the serializer MUST:

1. reduce the Rational and normalize zero to `0/1`;
2. test whether `d = 2^a * 5^b` for non-negative integers `a` and `b`;
3. when the test succeeds, scale to the smallest exact power-of-ten
   denominator and emit the shortest ordinary Decimal without an exponent;
4. otherwise emit the reduced `numerator/denominator` form;
5. append the target suffix `p`, `d`, or `h`; and
6. never round, truncate, clamp, or use a displayed decimal.

Examples:

| Exact value | Canonical Duration |
| --- | --- |
| `0/1` day | `0d` |
| `1/2` day | `0.5d` |
| `5/2` hour | `2.5h` |
| `10/1` point | `10p` |
| `1/3` day | `1/3d` |
| `4/6` day | `2/3d` |

Factorization selects spelling, not success. Every exact Rational is
representable by grammar version 3. No precision option, display precision,
decimal cache, or renderer may change this decision.

After serializing every converted field, select the candidate grammar:

- retain source grammar version 1 or 2 when every generated token is Decimal;
- upgrade source grammar version 1 or 2 to explicit version 3 when any
  generated token is a Fraction; and
- retain source grammar version 3 regardless of generated token spelling.

An omitted source `version` means version 1. An upgrade inserts `version 3` in
canonical project-field order; an explicit version 1 or 2 is replaced
locally. Grammar selection, unit, velocity, and every converted Duration are
one atomic candidate. Migration version 2 has no
`nonrepresentable_decimal` failure.

`grammar_disposition` is `retained` when source and target grammar versions
are equal and `upgraded_for_exact_fraction` when version 1 or 2 becomes
version 3.

## 10. Velocity disposition

The successful candidate always retains the effective velocity.

| Source condition | Candidate behavior | Disposition |
| --- | --- | --- |
| Declared velocity used unchanged | Preserve its source bytes | `retained` |
| Equal replacement supplied | Preserve the declared source bytes | `retained` |
| Different replacement supplied | Replace only the velocity value | `replaced` |
| Time source has no declared velocity and replacement is supplied | Insert the velocity in canonical project-field order | `inserted` |

Retaining velocity on a time project is intentional. Grammar version 1 permits
it when its period unit matches the project unit, and it makes an exact inverse
migration possible without an external lookup.

Migration does not normalize a retained velocity token. A replacement or
inserted velocity is serialized canonically from its exact `P`, `T`, and
period unit.

## 11. Candidate and source preservation

A changing-unit migration is one coordinated transformation, not a series of
authoritative intermediate documents.

Processing is:

1. validate the original document;
2. validate the semantic request and select the effective velocity;
3. inventory every version-2 base-unit-bearing source field;
4. calculate all exact converted values;
5. canonically serialize every exact value and select the candidate grammar;
6. create non-overlapping UTF-16 `TextEdit` values;
7. apply edits to one in-memory candidate;
8. parse and semantically validate only the final candidate; and
9. publish the candidate, exact conversion records, digest, and diff only
   after final validation succeeds.

Edits change only:

- the project `version` value span, or a canonical version-field insertion,
  when an exact Fraction requires grammar version 3;
- the `duration_unit` value span;
- the velocity value span, or a canonical velocity field insertion, when
  required; and
- the complete value span of every declared Duration in Section 7.

Preserve the UTF-8 BOM, predominant line ending, declaration and field order,
comments, blank lines, text, identifiers, and unrelated lexical forms.
Because every migrated Duration changes suffix, serialize each migrated token
canonically even when its numeric value does not change.

The candidate reuses the common digest, unified-diff, edit ordering,
revalidation, and later safe-write rules from Mutation semantics. No
candidate, edits, or diff are exposed for an invalid original, invalid request,
or invalid final candidate.

An ordinary atomic batch can manually set the same fields, but it does not
thereby claim the inventory, exactness, velocity-disposition, or round-trip
guarantees of `perttool.unit-migration` version 2.

## 12. Temporal and analysis preservation

With a retained velocity, successful migration preserves the exact effective
time represented by every migrated Point or time value:

```text
point x --V--> time x*T/P
time x  --V--> point x*P/T
```

Therefore, after reanalysis:

- precedence and resource values are expressed in the new base unit;
- converting those values through the retained velocity yields the same exact
  linked-unit values as before migration;
- PERT ordering and graph structure are unchanged; and
- supported calendar projections derived from `as_of` remain the same exact
  calendar values.

These are semantic equivalences, not byte equivalence between Analysis result
schemas.

When a replacement velocity differs from a Point source's declared velocity,
the new time values intentionally use the replacement relationship. The
operation records `velocity_replaced` and MUST NOT claim that prior
velocity-forecast or calendar-projection values were preserved.

Absolute dates and date-times are retained in every case. This specification
does not use the 86400-second day projection scalar or the 3600-second hour
projection scalar to perform source migration.

## 13. No-op, repetition, and inverse migration

### 13.1 Same-unit no-op

When `target_unit == source_unit` and no replacement velocity is supplied, the
request is a successful no-op:

```text
ok             = true
changed        = false
updated source = original source
edits          = empty
diff           = empty
```

It does not require velocity merely to confirm the current unit.

A same-unit request with `replacement_velocity` fails with
`same_unit_velocity_change`. Changing only velocity is project metadata
maintenance, not unit migration.

### 13.2 Repeated request

After a successful changing-unit migration, repeating the same target without
a replacement is the same-unit no-op above. It MUST NOT rescale values again.

### 13.3 Exact inverse

Suppose a changing-unit migration succeeds and no other source edit occurs.
An inverse migration with the same effective velocity MUST restore:

- every base-unit-bearing source value to the exact original Rational;
- the original base unit;
- the same semantic velocity; and
- the same non-timing document semantic values, subject to the explicit
  grammar and velocity metadata qualifications below.

The inverse is guaranteed source-representable because the restored original
Duration values were valid under the source grammar and grammar version 3 can
represent every exact Rational.

Lexical byte identity is not guaranteed. Migrated Duration tokens are
canonical, so an original spelling such as `1.00p` may return as `1p`.
Comments, blank lines, declaration order, and unrelated source bytes remain
preserved.

If the first migration replaced or inserted velocity, the inverse restores
exact duration values under that effective velocity but retains the new
velocity. If the first migration upgraded grammar version 1 or 2 to version 3,
the inverse likewise retains version 3 rather than guessing that a downgrade
is desired. Either condition reports `values_exact_metadata_changed` rather
than claiming whole-document semantic identity with the original source.

## 14. Semantic outcome

The [Temporal and Unit Interface Contract](temporal-unit-interface.md) selects
the public type and field names. Its projection MUST preserve these semantic
facts.

```text
UnitMigrationOutcome:
  unit_migration_id
  unit_migration_version
  source_grammar_version
  target_grammar_version
  grammar_disposition
  source_unit
  target_unit
  effective_velocity
  velocity_disposition
  changed
  converted_fields[]
  reversibility
  qualifications[]
  unavailable_causes[]
```

Each converted-field record identifies the project or task field and retains:

- original exact numerator, denominator, and unit;
- converted exact numerator, denominator, and unit; and
- the final canonical source token.

`reversibility` is one of:

- `exact`: inverse migration with the retained effective velocity restores
  source semantic values and migration retained grammar and velocity metadata;
- `values_exact_metadata_changed`: duration values invert exactly, but
  replacement/inserted velocity or a retained grammar upgrade prevents a claim
  that original metadata is restored; or
- `not_applicable`: same-unit no-op or failed request.

The outcome does not substitute for the candidate text, unified diff, or
ordinary validation diagnostics.

## 15. Fail-closed causes

The following semantic causes are stable in unit migration version 2. The
interface contract maps them to public diagnostics.

| Cause | Meaning |
| --- | --- |
| `invalid_original` | The source document did not pass ordinary validation |
| `invalid_replacement_velocity` | The supplied velocity is syntactically or semantically invalid |
| `missing_velocity` | No declared or replacement velocity links the units |
| `unsupported_direction` | The request is not Point-to-time, time-to-Point, or a permitted no-op |
| `velocity_period_mismatch` | The effective velocity period does not match the required time unit |
| `same_unit_velocity_change` | A same-unit request attempted to change velocity |
| `unsupported_duration_field` | The source grammar contains a base-unit-bearing field unknown to migration version 2 |
| `invalid_candidate` | The complete rewritten source failed ordinary validation |

`nonrepresentable_decimal` belongs only to migration version 1. Migration
version 2 never emits it because grammar version 3 represents every exact
converted Rational as a Decimal or Fraction.

Failures are deterministic and preserve all applicable ordinary parser,
semantic, and candidate diagnostics. They expose no partial candidate, edits,
diff, or partially replaced velocity.

## 16. Compatibility and interface boundaries

Unit migration version 2:

- operates on the inventoried base-unit fields of grammar versions 1, 2, and
  3;
- uses grammar version 3 Fraction syntax but adds no new field, keyword, or
  implicit mixed-unit rule;
- does not change Analysis version 1 or its `velocity_forecast` qualifier;
- does not change calendar or deadline algorithm identities;
- does not change Mutation semantics version 1 requests;
- does not add a command to CLI Contract 3; and
- does not authorize a package release.

The accepted dependency-ordered interface contract fixes:

- Core request and result type names;
- CLI command path and option spellings;
- text and JSON projections;
- stable diagnostic codes and recovery help;
- command discovery, guide, and README examples;
- interaction with `batch apply`; and
- preview, `--write`, `--out`, and expected-digest behavior.

Runtime implementation MUST use the accepted versioned interface and
acceptance cases. It MUST NOT treat the existing project/task batch surface as
the public migration operation.

## 17. Acceptance for this contract

The migration observations are fixed by
[TUE-012 through TUE-017](../examples/temporal-units.md#5-unit-migration-cases)
and the shared machine-readable baseline.

The semantic contract is accepted only when tests establish all of the
following.

1. The identity is `perttool.unit-migration` version 2.
2. Only Point-to-linked-time and matching-time-to-Point directions succeed.
3. No day/hour relationship is inferred from velocity or calendar constants.
4. Declared, equal-replacement, different-replacement, and inserted velocity
   dispositions are deterministic.
5. The field inventory includes project epsilon/target and every task
   deterministic or three-point estimate value.
6. Absolute temporal values, resources, priorities, states, and graph
   structure remain unchanged.
7. Conversion uses exact Rational formulas and positive scaling.
8. A reduced denominator containing only prime factors 2 and 5 produces the
   shortest exact Decimal; every other denominator produces a reduced
   Fraction, without rounding.
9. Grammar version 1 or 2 is retained for all-Decimal output; any generated
   Fraction atomically upgrades the candidate to grammar version 3.
10. The candidate is one source-preserving, atomically revalidated rewrite.
11. Same-unit and repeated requests are no-ops and do not rescale.
12. An inverse with the same effective velocity restores exact source values,
    with lexical, replacement-velocity, and grammar-upgrade qualifications
    stated explicitly.
13. Grammar version 2 and 3 absolute temporal tokens are preserved
    byte-for-byte, while existing analysis, calendar, deadline, mutation, and
    CLI versions remain unchanged.
14. Zero denominators and malformed Fraction tokens fail ordinary grammar
    validation before migration and expose no candidate.
