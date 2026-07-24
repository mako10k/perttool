# AI Agent Guidance Registry Normative Examples

- Document status: Normative 1.0
- Created: 2026-07-23
- Related requirements: [../requirements.md](../requirements.md)
- Interface contract: [../specs/agent-guidance.md](../specs/agent-guidance.md)
- Provider baseline: [../process/agent-guidance-provider-baseline.md](../process/agent-guidance-provider-baseline.md)
- Related issue: [Issue #2](https://github.com/mako10k/perttool/issues/2)

## 1. Purpose

This document provides normative examples that fix queries and expected projections so the AI Agent Guidance Registry specification can be transferred to the Core, CLI, and golden tests without changing its meaning.

The examples distinguish the following:

- Provider/surface lookup and alias normalization
- Surface-summary status and artifact-specific status
- Support status and artifact-path resolution
- Stable guidance/risk IDs and canonical descriptions
- Staleness at the profile snapshot
- Successful unsupported/unknown results and lookup errors
- Read-only help and future audit/scaffold/enforcement

The profile fragments in these examples explain the meaning of the Version 1 contract fixture; they are not provider configuration files. The Core implementation task expands them into the bundled profile.

## 2. Common conditions

Unless otherwise noted, use the following.

```text
schema_version              = Perttool.AgentGuidanceResult.v1
guidance_interface_version  = 1
profile_schema_version      = Perttool.AgentGuidanceProfile.v1
profile_data_version        = 1
guidance_taxonomy_version   = 1
risk_taxonomy_version       = 1
description_registry_version = 1
description_locale          = en
staleness_policy_version    = 1
snapshot_as_of              = 2026-07-23
operation                   = agent.help
```

Every result has the following capabilities.

```json
{
  "reads_project_files": false,
  "writes_files": false,
  "executes_hooks": false,
  "executes_commands": false,
  "accesses_network": false,
  "reads_provider_state": false,
  "writes_provider_state": false
}
```

## 3. Lookup and ordering

### AGT-001 Provider index

Query:

```text
provider_id = null
surface_id  = null
level       = index
```

Expected provider order:

```text
codex
github-copilot
claude-code
grok-build
antigravity
```

Every provider's `available_surface_ids` use the following order.

```text
instruction
workflow
delegated_agent
enforcement
prompt
connector
```

Only `grok-build` has the Version 1 alias `grok`. The index excludes surface details, guidance, risks, and sources, and returns all arrays in canonical order.

### AGT-002 Normalize aliases to canonical providers

CLI:

```sh
perttool agent help grok workflow --format json
```

Expected query:

```json
{
  "input_provider_id": "grok",
  "canonical_provider_id": "grok-build",
  "surface_id": "workflow",
  "level": "quick",
  "alias_applied": true
}
```

Provider records, artifact IDs, and provider IDs in sources all return `grok-build`. Do not retain the alias as a provider ID in output.

### AGT-003 Do not infer non-normative aliases

The following all return `PTAGT-101` with exit 1.

```text
Grok
grok_build
copilot
claude
```

The result has `ok=false` and `canonical_provider_id=null`, with empty provider/guidance/risk/source arrays. Do not mix suggestions or fuzzy matches into the canonical result.

## 4. Support status and explanation

### AGT-004 Native primary and compatible secondary

Suppose one surface has the following.

```text
primary artifact:
  id       = grok-build.instruction.agents
  path     = AGENTS.md
  status   = native
  evidence = official_native_documentation

secondary artifact:
  id       = grok-build.instruction.claude
  path     = CLAUDE.md
  status   = compatible
  evidence = official_compatibility_documentation
```

The surface summary is the primary artifact's `native` status. Retain the fact that the secondary is compatible in the artifact record, the `compatibility_not_native` risk, and source references. Do not make the whole surface compatible, and do not present a compatible path as native.

### AGT-005 Preview requires an explicit notice

For the GitHub Copilot `prompt`, an official source in the provider baseline explicitly states public preview; therefore, the corresponding Version 1 profile artifact has the following.

```text
support_status      = preview
evidence_kind       = official_preview_notice
source_ids          = [github-prompt-files]
```

Do not infer preview merely because a feature is new, changes frequently, or is limited to an IDE.

### AGT-006 Keep deprecated separate from preferred replacement

The Codex `prompt` denotes custom prompts, and its official source explicitly states that they are deprecated; therefore, it has the following.

```text
support_status      = deprecated
evidence_kind       = official_deprecation_notice
source_ids          = [codex-custom-prompts]
risk_ids            = [prompt_not_persistent, provider_surface_availability_varies]
```

Workflow/Skill may be described as a replacement, but do not restore the prompt artifact's own status to native. Provider-specific migration guidance does not change project-control guidance.

### AGT-007 Distinguish unsupported from unknown

The contract fixture fixes status decisions with the following two sentinels.

```text
explicit unsupported:
  status        = unsupported
  evidence_kind = official_unsupported_notice
  diagnostic    = none
  ok            = true

insufficient evidence:
  status        = unknown
  evidence_kind = insufficient_official_evidence
  diagnostic    = PTAGT-201 warning
  ok            = true
```

Even when the current provider profile has no applicable unsupported surface, do not remove it from the vocabulary that consumers recognize. Conversely, lack of documentation MUST NOT be assigned to the unsupported sentinel.

### AGT-008 A native capability can still have an unknown artifact path

When a provider officially describes a delegated-agent capability but a durable definition path cannot be established:

```text
support_status      = native
artifact_resolution = unknown
primary_artifact_id = null
risk_ids includes artifact_path_unknown
```

Do not create an artifact with an empty path, downgrade it to `unsupported`, or reuse another provider's path.

## 5. Guidance composition

### AGT-009 Enforcement detail

CLI:

```sh
perttool agent help codex enforcement --level detail --format json
```

Return at least the following guidance in this order.

```text
project_plan_is_authority
consult_dag_next_before_start
recompute_after_state_change
require_explicit_human_override
keep_provider_priority_identical
use_narrowest_durable_surface
preserve_scope_and_precedence
review_executable_customization
```

Return at least the following risks in taxonomy order.

```text
hook_executes_code
hook_can_block_or_mutate_flow
provider_surface_availability_varies
profile_may_be_stale
```

Each risk has at least one guidance ID in `mitigation_guidance_ids`. For example, `hook_executes_code` refers to `review_executable_customization`.

Provider detail may describe Codex hook paths, scope, and trust behavior, but MUST NOT independently define whether a hook permits task start.

### AGT-010 Canonical descriptions supplement stable IDs

Example guidance in a detail result:

```json
{
  "guidance_id": "consult_dag_next_before_start",
  "origin": "project_control",
  "directive": "must",
  "surface_ids": [],
  "description": {
    "key": "guidance.consult_dag_next_before_start",
    "parameters": [],
    "text": "Consult the project recommendation before starting new work."
  }
}
```

An AI can answer “why this directive was shown” from the following structure, rather than from natural language alone.

```text
origin       = project_control
directive    = must
guidance_id  = consult_dag_next_before_start
applies_to   = all providers and surfaces
```

Do not change the meaning of a guidance ID or directive through a text-only change.

## 6. Staleness

### AGT-011 Snapshot-relative review due

Profile entry:

```text
verified_at  = 2026-04-01
review_after = 2026-07-01
snapshot_as_of = 2026-07-23
```

Expected:

```text
staleness.status = review_due
staleness.basis_date = 2026-07-23
diagnostic = PTAGT-202 warning
ok = true
```

Running the same profile bytes in 2027 does not change the result. When an update is needed, update the profile data version, snapshot date, review date, and profile digest.

### AGT-012 Unknown staleness

An entry whose `verified_at` or `review_after` cannot be fixed has `staleness.status=unknown` and a `PTAGT-203` warning. Do not supply a runtime date or substitute the profile build date for the verified date.

## 7. Text/JSON parity

### AGT-013 Quick text

Command:

```sh
perttool agent help github-copilot prompt
```

The text includes at least the following.

```text
QUERY provider=github-copilot surface=prompt level=quick alias=false
SURFACE prompt support=preview artifact=known
GUIDANCE consult_dag_next_before_start directive=must
RISK prompt_not_persistent kind=scope
STALENESS status=verified verified-at=2026-07-23 review-after=<profile-date> basis=2026-07-23
READ-ONLY files=false hooks=false commands=false network=false provider-write=false
```

The JSON for the same query agrees on provider ID, surface ID, support status, artifact, guidance/risk IDs, staleness, and capabilities. The text renderer does not re-evaluate status or risks.

### AGT-014 Detail source

Only detail returns source titles, official URLs, and canonical description text. Quick retains source IDs, so detail does not substitute a different source. URLs are displayed only and are not fetched.

## 8. Errors and the read-only boundary

### AGT-015 Unknown surface

```sh
perttool agent help codex policy --format json
```

Expected:

```text
diagnostic code = PTAGT-102
severity        = error
exit            = 1
ok              = false
providers       = []
```

Do not automatically convert `policy` to `enforcement`.

### AGT-016 Usage error

The following are `PTCLI-001` with exit 2, rather than domain lookups.

```sh
perttool agent help codex enforcement extra
perttool agent help --level exhaustive
perttool agent help codex --warnings-as-errors
```

### AGT-017 Help does not change external state

Verify the following in every case.

- Do not open a project file.
- Do not search provider configuration.
- Do not execute hooks or commands.
- Do not open network sockets.
- Do not infer provider state from the environment.
- Do not write files or provider state.

The presence of a source URL in a result does not imply network access.

## 9. Migration

### AGT-018 Audit is not a help result

A future `agent audit` may inspect the presence or contents of repository files, but MUST NOT add `found`, `compliant`, or local path content to `Perttool.AgentGuidanceResult.v1`. Use a separate query, capability, and result schema.

### AGT-019 Scaffold is preview-first

A future `agent scaffold` returns candidates, diffs, collisions, digests, and write results through a separate contract. Do not make Version 1 help's `writes_files=false` true through an option.

### AGT-020 Bind enforcement to Recommendation

When future hooks are generated or executed, they do not reimplement project-specific priority; bind them to a supported `dag next` result and an explicit human override. Do not advance project state solely because a provider hook succeeds.

## 10. Test mapping

| Case | Primary tests |
| --- | --- |
| AGT-001..003 | provider order, surface order, aliases, unknown lookup |
| AGT-004..008 | six statuses, evidence kinds, artifact resolution |
| AGT-009..010 | composition, reference closure, descriptions |
| AGT-011..012 | fixed-date staleness, warnings |
| AGT-013..014 | Core/text/JSON parity, source projection |
| AGT-015..016 | PTAGT/PTCLI, exit codes |
| AGT-017 | no-side-effect boundary |
| AGT-018..020 | future operation/schema isolation |

`test/fixtures/agent-guidance/contract.v1.json` fixes the stable vocabulary and case expectations in machine-readable form. `provider-baseline.v1.json` is authoritative for factual provider-mapping input; do not infer new provider paths from normative examples.
