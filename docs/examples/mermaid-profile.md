# Mermaid Profile Normative Example

- Document status: Normative example 1.0
- Profile schema: `Perttool.MermaidProfile.v1`
- Specification: [Mermaid Profile Specification](../specs/mermaid-profile.md)

## 1. Source DSL

The following DSL semantic model is the input.

```pert
project PROFILE_SAMPLE:
  version 1
  title "Mermaid profile sample"
  as_of 2026-07-22
  duration_unit day
  finish RELEASE

resource DEVELOPERS:
  title "Developers"
  capacity 2
  tags [implementation]

milestone NOW:
  title "Now"
  state reached

milestone BUILT:
  title "Implementation complete"

milestone RELEASE:
  title "Ready to release"

task BUILD NOW -> BUILT:
  title "Implement \"A&B|C\\D\""
  duration 2d
  priority 10
  requires:
    DEVELOPERS 1
  owner "AI"
  tags [critical]
  source "Issue #10"

gate RELEASE_GATE BUILT -> RELEASE:
  reason "review accepted"
```

Apply the DSL grammar v1 defaults to omitted fields. The profile record retains complete semantic values after defaults are applied, rather than source omissions or field order.

## 2. Canonical Mermaid artifact

The following is the normative artifact byte for byte. Metadata records are ordered as project, resource, milestones in ascending ID order, tasks in ascending ID order, and gates in ascending ID order.

```mermaid
flowchart LR
  %% perttool:profile {"schema_version":"Perttool.MermaidProfile.v1","profile":"perttool","source_fidelity":"semantic-v1","record_count":7,"metadata_digest":"sha256:cb0343894128d65611a31b1eff3fc27b64f79e98432bfb7583e79158661f6bbc","projection_digest":"sha256:07e4568a9c4c5d3141541e4fbae9ae748d61bc08222a22bf01224bc194b39dd5","projection":{"schema_version":"Perttool.MermaidProjection.v1","direction":"LR","analysis":"none","capacity_overrides":[]}}
  %% perttool:project {"id":"PROFILE_SAMPLE","version":1,"title":"Mermaid profile sample","description":null,"as_of":"2026-07-22","duration_unit":"day","velocity":null,"finish":"RELEASE","critical_epsilon":"0d","target_duration":null}
  %% perttool:resource {"id":"DEVELOPERS","title":"Developers","description":null,"capacity":2,"tags":["implementation"]}
  %% perttool:milestone {"id":"BUILT","title":"Implementation complete","description":null,"state":"planned","tags":[]}
  %% perttool:milestone {"id":"NOW","title":"Now","description":null,"state":"reached","tags":[]}
  %% perttool:milestone {"id":"RELEASE","title":"Ready to release","description":null,"state":"planned","tags":[]}
  %% perttool:task {"id":"BUILD","from":"NOW","to":"BUILT","title":"Implement \"A&B|C\\D\"","description":null,"estimate":{"kind":"deterministic","duration":"2d"},"status":"planned","priority":10,"requires":[{"resource_id":"DEVELOPERS","units":1}],"owner":"AI","tags":["critical"],"blocked_reason":null,"source":"Issue #10"}
  %% perttool:gate {"id":"RELEASE_GATE","from":"BUILT","to":"RELEASE","reason":"review accepted"}
  %% perttool:projection-begin
  ptm_BUILT(("BUILT: Implementation complete"))
  ptm_NOW(("NOW: Now"))
  ptm_RELEASE(("RELEASE: Ready to release"))
  ptm_NOW -->|"BUILD: Implement #34;A#38;B#124;C#92;D#34; / owner=AI"| ptm_BUILT
  ptm_BUILT -.->|"RELEASE_GATE: gate"| ptm_RELEASE
  classDef pt_milestone_planned fill:#ffffff,stroke:#566573,stroke-width:1px;
  classDef pt_milestone_reached fill:#d5f5e3,stroke:#1e8449,stroke-width:2px;
  class ptm_BUILT,ptm_RELEASE pt_milestone_planned;
  class ptm_NOW pt_milestone_reached;
  linkStyle 0 stroke:#34495e,stroke-width:2px;
  linkStyle 1 stroke:#7f8c8d,stroke-width:1px,stroke-dasharray:3 3;
  %% perttool:projection-end
```

`metadata_digest` is the SHA-256 of the UTF-8 byte sequence produced by concatenating the canonical record body from `project {..}\n` through `gate {..}\n`. `projection_digest` is the SHA-256 of the byte sequence produced by concatenating the 11 physical lines between the markers, including two-space indentation and LF.

## 3. Expected import result

Importing this artifact as a profile yields:

- `loss_report.lossless = true`
- `loss_report.records = []`
- `generated_ids = []`
- the normalized semantic model obtained by reparsing canonical DSL is equivalent to section 1
- default-applied values such as `description=null`, `critical_epsilon=0d`, `state=planned`, and `status=planned` are retained
- resource requirements are not converted to precedence edges

Comments, blank lines, field/declaration order, and string escape spelling are outside semantic-equivalence comparison.

## 4. Required negative cases

During implementation, create fixtures that change exactly one location in this artifact and fix the following results:

| Change | Expected code | Plain fallback |
| --- | --- | --- |
| Delete one line of a `task` record | `PTCNV-103` or `PTCNV-104` | Prohibited |
| Change `duration` to `3d` without updating the digest | `PTCNV-104` | Prohibited |
| Change a projection edge endpoint | `PTCNV-105` | Prohibited |
| Add an unknown record key | `PTCNV-102` | Prohibited |
| Change the header schema to v2 | `PTCNV-101` | Prohibited |
| Add a `click` directive | `PTCNV-105` | Prohibited |

When multiple validations fail at once, return the code for the validation phase that executes first. Tests use the stable code and absence of a candidate as their primary assertions, not the full message.
