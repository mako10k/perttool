# AI Agent Guidance Registry Specification

- Document status: Normative 1.0
- Agent Guidance interface version: 1
- Target schema: `Perttool.AgentGuidanceResult.v1`
- Profile schema: `Perttool.AgentGuidanceProfile.v1`
- Created: 2026-07-23
- Related requirements: [../requirements.md](../requirements.md)
- Current CLI interface: [interfaces.md](interfaces.md)
- Provider baseline: [../process/agent-guidance-provider-baseline.md](../process/agent-guidance-provider-baseline.md)
- Normative example: [../examples/agent-guidance.md](../examples/agent-guidance.md)
- Related issue: [Issue #2](https://github.com/mako10k/perttool/issues/2)

## 1. Purpose

This specification fixes a read-only guidance registry for applying perttool project-control policy to AI coding agents. It enables an AI or a human to mechanically obtain, from one `agent help` result, the placement, applicable scope, support status, risks, supporting sources, and staleness of shared policy available for a provider.

This specification answers the following questions.

- Which providers and common surfaces are recognized?
- In which order are project control, common-surface, and provider-specific guidance composed?
- What may be placed in which artifact, and which risks must be checked?
- Why does a support status have its value?
- How are unknown, preview, deprecated, and stale provider materials handled fail-closed?
- How do Core, JSON, and text expose the same offline snapshot?

This specification does not automatically configure provider features. Version 1 returns help only; it does not change files, hooks, the network, providers, or project state.

## 2. Normative position

Resolve conflicts of meaning or design in the following order.

1. Must requirements in `docs/requirements.md`
2. The Recommendation specification set for project authority and next-work decisions
3. This specification
4. Common CLI, stream, diagnostics, and exit codes in the [CLI Interface specification](interfaces.md)
5. Provider profiles and the provider baseline
6. Basic design, examples, tests, help, and implementation

Provider profiles MUST NOT redefine task ranking, recommendation reasons, or human overrides. Regardless of provider, the project model and `dag next` determine what should be performed. The guidance registry describes the placement and safety boundaries through which that determination is conveyed to each provider.

## 3. Scope

In scope:

- Codex, GitHub Copilot, Claude Code, Grok Build, Antigravity
- instruction, workflow, delegated agent, enforcement, prompt, connector
- stable IDs, aliases, support statuses, artifacts, scopes, guidance, risks
- versioned offline provider profiles and staleness
- the pure Core query and `Perttool.AgentGuidanceResult.v1`
- `agent help` index, provider, surface, quick, and detail projections
- deterministic text/JSON projections
- unknown lookups, invalid profiles, and invariant failures
- compatibility boundaries for future audit, scaffold, and enforcement

Out of scope:

- discovery, reading, creation, or modification of provider files
- execution of hooks, skills, workflows, agents, prompts, or connectors
- runtime web refresh or connection to provider APIs
- repository conformance audit
- provider-configuration scaffolding or application
- substituting for `dag next` or duplicating project-specific task priority
- quality evaluation of provider features or ranking among providers
- MCP, Issue #3 multi-plan composition, or autonomous planning

## 4. Version identity

The Version 1 combination is as follows.

```text
result_schema_version           = Perttool.AgentGuidanceResult.v1
guidance_interface_version      = 1
profile_schema_version          = Perttool.AgentGuidanceProfile.v1
profile_data_version            = 1
guidance_taxonomy_version       = 1
risk_taxonomy_version           = 1
description_registry_version    = 1
description_locale              = en
staleness_policy_version        = 1
```

Each version is an independent compatibility boundary.

| Version | Changes to |
| --- | --- |
| result schema | public JSON shape, required fields, and field semantics |
| guidance interface | Core query/result semantics, ordering, and projection |
| profile schema | offline profile-file shape and validation |
| profile data | provider mappings, aliases, artifacts, sources, and dates |
| guidance taxonomy | meanings of guidance IDs and directives |
| risk taxonomy | meanings of risk IDs, kinds, and mitigation relationships |
| description registry | canonical description templates and wording |
| staleness policy | date comparison, status, and warning conditions |

Strict compatibility across all pre-releases is not required. However, a breaking change to an adopted `Perttool.AgentGuidanceResult.v1` requires incrementing the result schema. A provider-mapping-only change requires incrementing the profile data version; a change to the meaning of an existing ID requires incrementing the corresponding taxonomy version; and a canonical-wording-only change requires incrementing the description registry version.

Do not include the current time, generation time, or random IDs in runtime results.

## 5. Stable taxonomy

### 5.1 Provider IDs and aliases

The canonical provider order is fixed as follows.

```text
codex
github-copilot
claude-code
grok-build
antigravity
```

Version 1 has only the following alias.

```text
grok -> grok-build
```

Use aliases only for input normalization; results always return the canonical provider ID. Do not perform case folding, whitespace removal, prefix matching, fuzzy matching, or non-normative aliasing. `Grok`, `grok_build`, and `copilot` are unknown providers.

### 5.2 Surface ID

The canonical surface order is fixed as follows.

```text
instruction
workflow
delegated_agent
enforcement
prompt
connector
```

| Surface | Common meaning |
| --- | --- |
| `instruction` | project/user instructions effective across sessions or tasks |
| `workflow` | an explicitly reusable procedure, skill, or command package |
| `delegated_agent` | an agent definition to which a parent agent delegates a role or subtask |
| `enforcement` | a hook/policy that may respond to events and allow, reject, inspect, or execute commands |
| `prompt` | a prompt template or command explicitly invoked by a human |
| `connector` | a connection exposing external context or tools to an agent |

Do not return provider terminology in place of surface IDs. When one provider artifact serves multiple surfaces, each surface record may reference the same path, but each surface retains independent guidance and risks.

### 5.3 Support status

The support-status vocabulary is fixed as follows.

```text
native
compatible
preview
deprecated
unsupported
unknown
```

Status does not represent provider superiority, project recommendation rank, or maturity of the provider release as a whole.

| Status | Required condition |
| --- | --- |
| `native` | Current official sources describe a provider-specific surface or artifact. |
| `compatible` | The surface is not provider-specific, and official sources explicitly state compatible use of another provider's format. |
| `preview` | Official sources explicitly mark the target surface or artifact as preview, beta, experimental, or equivalent. |
| `deprecated` | Official sources explicitly mark the target surface or artifact as deprecated. |
| `unsupported` | Official sources explicitly state that the target surface or artifact is unavailable. |
| `unknown` | Official sources alone cannot establish any of the above. |

Do not produce `unsupported` merely because an artifact path is empty, maturity is unstated, documentation cannot be found, or another provider supports it. Separate an unknown artifact path as `artifact_resolution=unknown`, and an unstated release maturity as a note in status evidence.

When multiple conditions are explicitly stated for the same target, use the following precedence.

```text
explicitly unavailable -> unsupported
deprecated             -> deprecated
preview/beta           -> preview
compatibility only     -> compatible
provider-native        -> native
otherwise              -> unknown
```

For example, if a compatible artifact is also preview, its public `support_status` is `preview`, while retaining the compatibility fact, `compatibility_not_native` risk, and source references. Do not pack all orthogonal facts into one status.

When a provider/surface has multiple artifacts, each artifact has its own `support_status`. Select the surface summary status using the following rules.

1. Select exactly one artifact or capability for which the profile sets `primary=true`.
2. Project the primary status to the surface summary.
3. If there is no primary, make the surface summary `unknown`.
4. Do not override the summary with a secondary artifact's status.

Therefore, a surface with a native primary and compatible secondary is `native`, while the compatible path remains in the artifact record.

### 5.4 Status evidence

Every support status has the following structured evidence.

```text
SupportStatusEvidence:
  evidence_kind
    "official_native_documentation" |
    "official_compatibility_documentation" |
    "official_preview_notice" |
    "official_deprecation_notice" |
    "official_unsupported_notice" |
    "insufficient_official_evidence"
  source_ids          string[]
  facts               string[]
  description         GuidanceDescription | null
```

`source_ids` reference one or more official sources for the same provider. For `unknown`, they reference one or more sources that were searched or checked, and record in `facts` why no conclusion can be reached. `facts` are stable English owned by the profile, not runtime-generated summaries. Profiles require a description; public quick projection sets `description=null`, while detail projection makes it non-null.

The legal mapping between status and `evidence_kind` is one-to-one.

| Status | Evidence kind |
| --- | --- |
| `native` | `official_native_documentation` |
| `compatible` | `official_compatibility_documentation` |
| `preview` | `official_preview_notice` |
| `deprecated` | `official_deprecation_notice` |
| `unsupported` | `official_unsupported_notice` |
| `unknown` | `insufficient_official_evidence` |

The provider baseline's `maturity_evidence.status` is fact input at research time and is not mechanically copied to public support status. `public_preview` and `deprecated` can be candidates for their corresponding official notices, but `documented`, `surface_specific`, and `not_stated` alone do not determine `native`, `compatible`, `unsupported`, or `unknown`. When creating a profile, apply per-artifact/capability official facts, primary selection, and compatibility relationships in the 5.3 precedence order, then fix the 5.4 structured evidence.

### 5.5 Artifact resolution and scope

Artifact placement returns the following independently of support status.

```text
artifact_resolution = known | not_applicable | unknown
```

- `known`: an official source identifies the path or placement unit
- `not_applicable`: a session/runtime capability with no file artifact
- `unknown`: the capability is observable, but durable artifact placement cannot be established

The scope vocabulary is fixed as follows.

```text
repository directory workspace user organization enterprise managed
session conversation local admin system plugin compatibility
```

Order scope arrays as above. Retain provider terminology in `provider_terms`; do not convert it to common scopes without evidence.

### 5.6 Guidance ID

Version 1 guidance is fixed as follows. `directive` is one of `must`, `should`, or `may`.

| Guidance ID | Origin | Directive | Meaning |
| --- | --- | --- | --- |
| `project_plan_is_authority` | project control | must | Treat the project model as the authority for priority. |
| `consult_dag_next_before_start` | project control | must | Check `dag next` before starting new work. |
| `recompute_after_state_change` | project control | must | Reanalyze the entire project after a state advance. |
| `require_explicit_human_override` | project control | must | Treat work outside the recommendation as an explicit human decision. |
| `keep_provider_priority_identical` | project control | must | Do not change priority rules by provider. |
| `use_narrowest_durable_surface` | common surface | should | Choose the narrowest durable surface that satisfies the required scope. |
| `preserve_scope_and_precedence` | common surface | must | Preserve provider scope and precedence. |
| `review_executable_customization` | common surface | must | Review customizations that may execute code or tools. |
| `treat_unknown_as_unavailable` | common surface | must | Do not infer that unknown is available. |
| `review_stale_profile_before_adoption` | common surface | should | Recheck a review-due profile before new adoption. |

When adding provider-specific guidance, also use stable IDs in the form `provider.<provider_id>.<name>` and do not create a separate ID with the same meaning as project-control guidance.

The table above is the Version 1 common guidance registry. When a provider profile adds a provider-specific ID, register that ID in both profile data and the guidance taxonomy, and increment both versions. Do not add an unregistered ID only to profile data.

### 5.7 Risk ID

Version 1 risks are fixed as follows.

| Risk ID | Kind |
| --- | --- |
| `instruction_precedence_changes_effective_policy` | scope |
| `instruction_truncation_hides_policy` | scope |
| `workflow_executes_commands` | execution |
| `delegation_loses_parent_context` | delegation |
| `parallel_writes_conflict` | delegation |
| `hook_executes_code` | execution |
| `hook_can_block_or_mutate_flow` | execution |
| `prompt_not_persistent` | scope |
| `connector_accesses_external_data` | external_access |
| `connector_can_execute_external_action` | external_access |
| `provider_surface_availability_varies` | compatibility |
| `profile_may_be_stale` | staleness |
| `artifact_path_unknown` | compatibility |
| `compatibility_not_native` | compatibility |

Risks have neither severity scores nor provider rankings. Each risk record has one or more `mitigation_guidance_ids` and includes the referenced guidance in the result closure.

### 5.8 Canonical description

Guidance, risks, and status evidence have the following descriptions.

```text
GuidanceDescription:
  key         string
  parameters  [{name: string, value: string}]
  text        string
```

`key` and parameters are the machine-readable authority; `text` is a derived value deterministically generated from description registry version 1 and locale `en`. The same key and parameters MUST NOT generate different text. Consumers must not use `text` alone for decisions; they use stable IDs, directives, status, evidence, and risk relationships.

## 6. Project guidance composition

### 6.1 Composition order

The application order is fixed as follows.

```text
project_control
common_surface
provider
```

This is not a last-wins override order. Later layers may make earlier layers concrete, but MUST NOT negate, weaken, or reorder them.

Project-control guidance applies to every provider and surface. Common-surface guidance is determined by surface ID, and provider guidance only supplements placement, scope, and risks of official provider behavior.

### 6.2 Conflict

The following are profile invariant failures.

- Provider guidance makes something other than the project model the priority authority.
- It permits task selection without checking `dag next` as a normal path.
- It makes human overrides implicit.
- It changes Recommendation ranking or reasons by provider.
- Provider guidance weakens a `must` in common guidance to `should` or `may`.

Do not output a conflict as a provider-specific difference; reject the entire profile with `PTAGT-302`.

### 6.3 Project-specific facts

Version 1 does not read `.pert` documents and does not copy the current recommended tasks, critical path, float, or resource conflicts into the result. Guidance returns `consult_dag_next_before_start` and delegates project-specific answers to `dag next`.

## 7. Offline profile

### 7.1 Profile identity

The bundled profile is `Perttool.AgentGuidanceProfile.v1` and has at least the following.

```text
schema_version
profile_data_version
guidance_taxonomy_version
risk_taxonomy_version
description_registry_version
description_locale
staleness_policy_version
snapshot_as_of
provider_order
surface_order
aliases
providers
guidance_registry
risk_registry
sources
```

The profile digest is the SHA-256 of canonical JSON bytes encoded as UTF-8 with a trailing newline, in the form `sha256:<64 lowercase hex digits>`. Object keys use the profile serializer's schema order, registry arrays use this specification's canonical order, and differently ordered bytes re-sorted at runtime are not the digest input.

### 7.2 Source

Source records have the following fields.

```text
source_id
provider_id
title
url
verified_at
```

Version 1 profiles rely only on official provider sources. Do not use blogs, search results, AI-generated summaries, or repository inferences as substitutes for official sources. Do not fetch URLs at runtime.

### 7.3 Staleness

Calculate staleness only from dates fixed in the profile, not from the wall clock.

```text
Staleness:
  status       verified | review_due | unknown
  verified_at  YYYY-MM-DD | null
  review_after YYYY-MM-DD | null
  basis_date   YYYY-MM-DD
```

`basis_date` matches the profile root's `snapshot_as_of`.

- `verified`: `verified_at` and `review_after` exist, and `snapshot_as_of <= review_after`
- `review_due`: both dates exist, and `snapshot_as_of > review_after`
- `unknown`: either date cannot be fixed from official evidence

Do not hard-code review intervals in Core; the profile owner explicitly sets `review_after` in consideration of source volatility. Do not change status from the runtime invocation date. Text always displays dates and does not say "currently valid."

`review_due` returns a `PTAGT-202` warning, and `unknown` staleness returns a `PTAGT-203` warning. Both lookups themselves succeed, but they must be revalidated before adopting a new artifact.

## 8. Core API

### 8.1 Query

The pure Core has the following conceptual interface.

```text
getAgentGuidance(profile, query) -> AgentGuidanceResult

AgentGuidanceQuery:
  provider_id  string | null
  surface_id   string | null
  level        index | quick | detail
```

Core does not access files, the environment, the network, a clock, locale catalogs, or provider APIs. Perform alias normalization, validation, reference closure, ordering, and projection once in Core; CLI renderers MUST NOT decide them again.

`surface_id` cannot be specified without `provider_id`.

### 8.2 Projection level

| Level | Projection |
| --- | --- |
| `index` | provider IDs, display names, aliases, and available surface IDs |
| `quick` | surface statuses, artifact paths/scopes, guidance/risk IDs, and staleness |
| `detail` | quick plus canonical descriptions, provider terms, status evidence, and source titles/URLs |

The default level with no operands is `index`; it is `quick` when a provider or surface is specified. Accept an explicit level for every query shape. A level changes only the amount of information, not the IDs, statuses, or ordering of the same entities.

### 8.3 Completeness

The result includes in the root registry only the guidance, risks, and sources referenced by the query projection. Recursively include mitigation guidance referenced by risks and sources referenced by status evidence; dangling references are not permitted.

Because `index` returns no surface detail, the guidance, risk, and source registries may be empty arrays. For `quick`, retain source IDs on surfaces and return a source-registry projection containing only IDs and provider IDs. `detail` includes source URLs.

Apply positional filters before level projection. An `index` query with a surface returns one provider and the specified single `available_surface_ids` entry, with `surfaces=[]`. An `index` query with only a provider returns all surface IDs for that provider; an unfiltered `index` query returns all surface IDs for all providers.

## 9. Public result schema

### 9.1 Root

The JSON root field order and required fields are fixed as follows.

```text
schema_version
guidance_interface_version
profile_schema_version
profile_data_version
guidance_taxonomy_version
risk_taxonomy_version
description_registry_version
description_locale
staleness_policy_version
tool_version
operation
ok
profile_digest
snapshot_as_of
query
providers
guidance_records
risk_records
sources
capabilities
diagnostics
```

Fixed values:

```text
schema_version = Perttool.AgentGuidanceResult.v1
operation      = agent.help
```

`profile_digest` is the canonical digest of the bundled profile. Like the existing `dsl help`, `agent help` is not a document operation and therefore has no `document_id`, `source`, `source_digest`, or `diagnostics_truncated`. Even an unknown lookup returns a complete envelope with version identity, profile identity, query, empty result arrays, and a diagnostic.

### 9.2 Query projection

```text
query:
  input_provider_id      string | null
  canonical_provider_id  string | null
  surface_id             string | null
  level                  index | quick | detail
  alias_applied           boolean
```

For an unknown provider, return `canonical_provider_id=null`; for a known alias, return the canonical ID and `alias_applied=true`.

### 9.3 Provider

```text
ProviderGuidance:
  provider_id
  display_name
  aliases
  available_surface_ids
  surfaces
```

`aliases` use canonical alias order, and `available_surface_ids` use surface order. A provider query returns one provider, a whole-registry query uses provider order, and an unknown query returns an empty array.

### 9.4 Surface

```text
SurfaceGuidance:
  surface_id
  support_status
  primary_artifact_id
  artifact_resolution
  provider_terms
  scopes
  artifacts
  guidance_ids
  risk_ids
  status_evidence
  staleness
```

`primary_artifact_id` may be `null` for a capability without a file artifact or with unknown placement. `guidance_ids` use composition order and taxonomy order within each origin; `risk_ids` use risk taxonomy order.

### 9.5 Artifact

```text
GuidanceArtifact:
  artifact_id
  path
  scope_ids
  primary
  support_status
  status_evidence
```

`path` is non-null only when `artifact_resolution=known`. `scope_ids` contain at least one entry in scope order; when the same path applies to both a repository and a directory, retain both scopes in one artifact. Represent placeholders such as `<skill-name>` in angle brackets and do not return generated values that could be mistaken for actual paths. An artifact's own status also requires the section 5.4 `status_evidence`.

### 9.6 Guidance, risk, and source

```text
GuidanceRecord:
  guidance_id
  origin              project_control | common_surface | provider
  directive           must | should | may
  surface_ids
  description         GuidanceDescription | null

RiskRecord:
  risk_id
  kind                scope | execution | delegation | external_access |
                      compatibility | staleness
  surface_ids
  mitigation_guidance_ids
  description         GuidanceDescription | null

GuidanceSource:
  source_id
  provider_id
  title               string | null
  url                 string | null
  verified_at
```

For quick projection, set `description`, `title`, and `url` to `null`; for detail they are non-null. Do not omit the fields themselves by level.

For quick projection, a surface's `provider_terms`, and a status evidence's `facts` and `description`, are respectively empty arrays, empty arrays, and `null`; detail returns the profile values. Do not omit source IDs, statuses, artifacts, scopes, or guidance/risk relationships even in quick projection.

`surface_ids=[]` for project-control guidance represents applicability to every surface. Common-surface and provider guidance have one or more surface IDs in canonical order. Do not interpret an empty array as "no applicability."

### 9.7 Capability declaration

Version 1 always returns the following.

```text
capabilities:
  reads_project_files       false
  writes_files              false
  executes_hooks            false
  executes_commands         false
  accesses_network          false
  reads_provider_state      false
  writes_provider_state     false
```

Do not vary these values by renderer, alias, or lookup result.

## 10. Ordering and determinism

Canonical ordering is fixed as follows.

1. provider: provider order in section 5.1
2. surface: surface order in section 5.2
3. alias: profile alias declaration order
4. scope: scope order in section 5.5
5. artifact: primary first; then scope order of the first scope ID, UTF-8 byte order of path, and artifact ID
6. guidance: composition order, taxonomy order, and guidance ID
7. risk: taxonomy order and risk ID
8. source: provider order and UTF-8 byte order of source ID
9. diagnostic: occurrence phase, code, provider ID, and surface ID, not severity

The same tool version, profile bytes, and query produce identical Core-object meaning, JSON bytes, and text bytes. Do not depend on object insertion order, filesystem order, network responses, locale, time zone, or wall clock. JSON uses two-space indentation, UTF-8, a trailing newline, and schema-order keys.

## 11. CLI contract

### 11.1 Command

```text
perttool agent help [<provider> [<surface>]]
  [--level index|quick|detail]
  [--format text|json]
  [--color auto|always|never]
```

- `<provider>` is a canonical ID or stable alias
- `<surface>` is a canonical surface ID only
- Accept at most two operands
- Do not accept `--warnings-as-errors` or `--max-diagnostics`
- Command help is `perttool agent help --help`
- The domain result performs a profile lookup but does not read a project document
- Provider, surface, level, and format connect to the same Core result

Do not change the existing `dsl help` topics, default level, schema, PTHLP diagnostics, or text/JSON byte output.

### 11.2 Text layout

Index:

```text
AGENT GUIDANCE schema=Perttool.AgentGuidanceResult.v1 profile=1 snapshot=2026-07-23
PROVIDER codex aliases=- surfaces=instruction,workflow,delegated_agent,enforcement,prompt,connector
PROVIDER github-copilot aliases=- surfaces=instruction,workflow,delegated_agent,enforcement,prompt,connector
PROVIDER claude-code aliases=- surfaces=instruction,workflow,delegated_agent,enforcement,prompt,connector
PROVIDER grok-build aliases=grok surfaces=instruction,workflow,delegated_agent,enforcement,prompt,connector
PROVIDER antigravity aliases=- surfaces=instruction,workflow,delegated_agent,enforcement,prompt,connector
READ-ONLY files=false hooks=false commands=false network=false provider-write=false
```

Quick/detail:

```text
AGENT GUIDANCE schema=<schema> profile=<data-version> snapshot=<date>
QUERY provider=<canonical-id> surface=<surface-or-*> level=<level> alias=<true|false>
PROVIDER <provider-id> <display-name>
SURFACE <surface-id> support=<status> artifact=<resolution>
ARTIFACT <artifact-id> primary=<true|false> scopes=<scope,...> status=<status> path=<path-or-?>
GUIDANCE <guidance-id> directive=<directive>
RISK <risk-id> kind=<kind> mitigated-by=<guidance-id,...>
STALENESS status=<status> verified-at=<date-or-?> review-after=<date-or-?> basis=<date>
EVIDENCE <kind> sources=<source-id,...>
DESCRIPTION <key>: <text>
SOURCE <source-id> <url>
READ-ONLY files=false hooks=false commands=false network=false provider-write=false
```

Quick omits `DESCRIPTION` and URL-bearing `SOURCE`. Use `?` for an unknown path; do not display an empty string or an inferred path. Golden tests fix the meaning of text section order, labels, IDs, statuses, dates, and paths. Machine consumers use JSON.

## 12. Diagnostics and exit code

Agent guidance diagnostics use the `PTAGT-*` namespace and do not reuse `PTHLP-*`.

| Code | Severity | Exit | Meaning |
| --- | --- | ---: | --- |
| `PTAGT-101` | error | 1 | unknown provider ID or alias |
| `PTAGT-102` | error | 1 | unknown surface ID for a known provider |
| `PTAGT-201` | warning | 0 | support status is `unknown` |
| `PTAGT-202` | warning | 0 | profile entry is `review_due` |
| `PTAGT-203` | warning | 0 | staleness of a profile entry is `unknown` |
| `PTAGT-301` | error | 1 | unsupported profile, schema, or taxonomy version |
| `PTAGT-302` | error | 70 | reference, composition, or ordering invariant failure |
| `PTAGT-303` | error | 70 | canonical description or profile digest invariant failure |

An unknown lookup returns `ok=false`, empty provider/guidance/risk/source arrays, and one diagnostic. An `unsupported` or `unknown` surface for a known provider is a successful lookup with `ok=true`. Only `unknown` carries a `PTAGT-201` warning.

An unknown option, an extra operand, specifying only a surface, or an invalid level produces `PTCLI-001` and exit 2. Version 1 has no I/O before envelope creation, and an internal exception exits 70. JSON stream rules inherit section 9 of the CLI Interface specification.

## 13. Validation invariants

The profile validator checks at least the following.

- version identity matches a supported combination
- providers, surfaces, and order match this specification and are not duplicated
- no alias collides with a canonical provider or another alias
- every provider has six surfaces in canonical order
- statuses and evidence kinds correspond legally
- there is at most one primary artifact/capability per surface
- artifact resolution, path, and primary ID do not conflict
- an artifact's scope array is non-empty and in canonical order
- surface and artifact status evidence correspond legally to each status
- guidance, risk, and source references are closed
- every risk has at least one mitigation guidance entry
- composition order and `must` directives are not weakened
- the source provider matches the referring provider
- URLs are absolute HTTPS
- dates are canonical `YYYY-MM-DD`, with `verified_at <= review_after` and `verified_at <= snapshot_as_of`
- staleness is uniquely derived from fixed dates
- description key, parameter, and text match the registry
- canonical profile bytes and digest match

Do not return partial guidance from an invalid profile. Return `PTAGT-301` for an unsupported version only when a consumer can construct an understood envelope; if the shape itself cannot be interpreted, perform an internal safe stop.

## 14. Migration boundaries

### 14.1 Version 1: help

Version 1 exposes only read-only queries over the bundled profile. It makes no conformance claim about a repository or provider environment.

### 14.2 Future audit

When adding `agent audit`:

- define read paths, symlinks, encodings, ignores, and trust boundaries in a separate specification
- do not reuse help results as audit results
- use a separate schema such as `Perttool.AgentGuidanceAuditResult.v1`
- state read-only behavior explicitly in capabilities

### 14.3 Future scaffold

When adding `agent scaffold`:

- define preview, diff, collision, ownership, safe-write, and optimistic-lock behavior in a separate specification
- do not write files by default
- do not infer rules for overwriting or merging provider files
- do not reuse help/audit schemas for write results

### 14.4 Future enforcement

When adding hook or policy enforcement:

- define execution events, input/output, timeouts, failure modes, trust, secrets, and command execution in a separate specification
- bind explicitly to the `dag next` recommendation version and human-override validation
- do not let provider hooks compute task priority independently
- do not change Version 1 help's `executes_hooks=false`; expose it with a new operation/result

## 15. Acceptance trace

| Issue #2 acceptance | Contract |
| --- | --- |
| 5 providers | 5.1, chapter 7, 9.3 |
| 6 common surfaces | 5.2, 9.4 |
| stable IDs/aliases | chapter 5 |
| support/unknown/staleness | 5.3, 5.4, 7.3 |
| versioned offline profile | chapter 4, chapter 7 |
| deterministic Core | chapter 8, chapter 10 |
| text/JSON from the same Core | chapters 8, 9, 11 |
| diagnostics/exit | chapter 12 |
| project authority | chapter 2, chapter 6 |
| read-only/no network | chapter 3, 9.7 |
| no regression in legacy help | 11.1 |
| audit/scaffold/enforcement boundaries | chapter 14 |

The [normative example](../examples/agent-guidance.md) and `test/fixtures/agent-guidance/contract.v1.json` expand this table into case IDs. Core implementations MUST NOT conveniently change fixtures; when a contract change is necessary, update this specification and its version first.
