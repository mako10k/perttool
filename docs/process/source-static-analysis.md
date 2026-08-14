# Source static-analysis gate

- Status: Accepted 1.0
- Date: 2026-08-14

## Decision

The repository source gate composes TypeScript type checking with exact
`jscpd@5.0.15` duplicate detection and exact `lizard==1.23.0` function
complexity analysis. `npm run check:static` is part of the complete
`npm run check` entrypoint and therefore runs on both CI Node.js lines.

The scan covers `src/`, private LSP source and runtime, private MCP source,
private VSIX source, and repository scripts. Generated `dist/`, installed
dependencies, tests, fixtures, plans, schemas, and documentation are excluded.
jscpd uses strict TypeScript/JavaScript cross-format matching with minima of
eight lines and sixty tokens. Lizard uses review thresholds of CCN 15,
function length 100, and six parameters.

## Ratchet

The accepted source contains existing debt, so this gate does not claim zero
duplication or zero high-complexity functions. The reviewed baseline records:

- no more than 148 clones, 2,749 duplicated lines, 15,252 duplicated tokens,
  and 3.39 percent duplication; and
- 171 named legacy Lizard entries with an exact per-metric upper bound.

A new Lizard violation, any increase in a recorded function metric, a stale
entry after an improvement, or any jscpd maximum increase fails. Removing a
stale Lizard entry in the same reviewed improvement prevents the finding from
being reintroduced silently. `STATIC-001` tracks reduction of the legacy debt;
the baseline is not an exemption from review.

## Reproducibility and failure behavior

`package-lock.json` fixes jscpd and `requirements-static-analysis.txt` fixes
Lizard. Both wrappers verify the runtime tool version before analyzing source.
jscpd writes its machine report only to an operating-system temporary
directory and removes it after comparison. Neither gate writes source,
generates a tracked report, invokes Git, or uses network access after its
dependencies are installed.

Run the focused gate with:

```sh
npm ci
python -m pip install --requirement requirements-static-analysis.txt
npm run check:static
git diff --check
```

The complete acceptance boundary remains `npm run check`; passing the focused
gate alone does not authorize publication, remote writes, or release changes.

## Acceptance evidence

The local Node.js 22.22.3 acceptance run completed with:

- exact jscpd 5.0.15: 148 clones, 2,749 duplicated lines, 15,252 duplicated
  tokens, and 3.385 percent duplication;
- exact Lizard 1.23.0: 3,513 functions and 171 reviewed legacy entries;
- 1,069 of 1,069 Node.js tests;
- the 897-file English baseline, 269 Markdown documents, seven PERT examples,
  and all forty-one self-use plans; and
- isolated LSP and MCP packages, the supported VS Code 1.101.0 host workflow,
  temporary linking, and the 717-file installed public-package workflow.

`npm ci` reported zero audited vulnerabilities. This was local acceptance
only; no remote CI run, publication, dist-tag change, release mutation, or
other external write was performed.
