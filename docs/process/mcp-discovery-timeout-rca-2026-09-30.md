# MCP discovery timeout RCA

Date: 2026-09-30
Related task: `PLAN_REVIEW_ACCEPTANCE` verification follow-up
Scope: local investigation, evidence, and the confirmed owner incident-release
decision below; no implementation correction, plan mutation, remote write or
publication.
Repository: `/home/katsumata-m/perttool-worktrees/issue-21-plan-review`
Baseline: `e39c739f07558cf0d6030ea89196856459efaed9` plus the retained local
acceptance changes. The unrelated main-worktree state was preserved. Cached
tracking state is 0/0; no fresh remote state is claimed or needed for this local
failure investigation.

## Incident and conclusion

The post-presentation default-concurrency acceptance run failed one unchanged
MCP test with `timed out waiting for server/discover`. It also had a separate
recommendation golden failure, which is not this incident. The MCP test had
already received the expected legacy rejection before sending discovery.
Its discovery deadline is 5,000ms. The test duration was 10,519ms, but that
whole-test duration is not the discovery latency.

**Controlled reproduction, high confidence:** cold synchronous schema
compilation in the first discovery competes for CPU execution capacity and
exceeds the test's fixed five-second wall-clock success budget. All timed-out
controlled requests later receive valid responses. The failure is reproducible
without changing server, SDK, protocol, schema or timeout behavior.

**Original occurrence, medium-confidence leading explanation:** the same
CPU-capacity/budget mismatch is consistent with its unconstrained worker count
and passing isolated/bounded retries. Original root-cause attribution remains
unconfirmed because that run did not retain process timings, CPU pressure or
late responses. The artificial four-CPU affinity and synchronized barrier were
not observed original conditions. No production latency defect is established:
the accepted MCP contract specifies no five-second discovery SLA.

## Observations and controlled interventions

The actual server is Node.js 22.22.3 with exact
`@modelcontextprotocol/server` 2.0.0. Each client sends the same legacy rejection
followed by modern discovery as the failed test. Diagnostic preload timestamps
raw stdin emission and stdout writes and samples process CPU usage; it does
not replace the server or force stdin into flowing mode. The replica retains
late responses after a soft five-second timer, with a 15-second observation
cutoff; the original deletes the pending ID and rejects immediately.

Only owned disposable server processes had their affinity changed. No busy-loop
load was generated, and no unrelated process was reconfigured. The discovery
barrier lets every legacy request finish before discovery starts.

| Scenario | Legacy response | Discovery response | Five-second discovery deadlines | Valid eventual replies |
| --- | --- | --- | --- | --- |
| One server, uninstrumented, normal affinity | 920ms | 748ms | 0/1 | 1/1 |
| One server, traced, normal affinity | 380ms | 479ms | 0/1 | 1/1 |
| 22 servers, normal affinity, requests as each legacy reply arrives | 1,260-4,937ms | 2,457-4,340ms | 0/22 | 22/22 |
| 22 warmed servers, discovery barrier, four-CPU server affinity | 1,243-2,325ms | 3,701-9,391ms | 18/22 | 22/22 |
| Four warmed servers, same barrier and four-CPU affinity, serial control run | 577-640ms | 970-1,359ms | 0/4 | 4/4 |

In the decisive 22-server trial, the client event-loop maximum sampled delay was
69ms. Example client 0 fired its deadline at 5,001ms and received the valid
result at 9,200ms. Its server receive-to-write interval was 9,174ms and aggregate
process CPU consumed in that interval was 2,026ms. Thus the response was created
after the deadline in this reproduction; parent callback delay cannot explain
that example. CPU time is aggregate process CPU, not measured person effort.
The final four-client control had maximum parent-loop delay of 17ms.

A preliminary run constrained processes during startup and also timed out
legacy requests. It does not match the original failure order and is retained
only as preliminary evidence. The final barrier removes that confound. The
first four-client comparison overlapped factory profiling; the final serial
four-client control above was run separately after profiling.

## Normal-suite discriminating run

One final default-worker unit-suite run replaced only the MCP test with a
scratch copy that preserved its five-second rejection and pending-ID deletion.
Instrumentation wrote parent send/receive/deadline and raw child stdio/CPU
records to scratch files, preserving protocol stdout. No affinity restriction,
discovery barrier or server behavior change was applied. All 1,421 tests passed.
Discovery client send-to-receive was 2,413ms; child receive-to-write was 2,412ms
with 3,156ms aggregate process CPU. Parent maximum event-loop delay was 30ms.
No deadline fired. This is negative reproduction evidence and a direct
observation of a successful default-suite run, not evidence of the original
failed request's timing. An initial launch omitted Node PATH, was stopped, and
is excluded from causal conclusions.

## Mechanism and profile

1. `serveStdio` rejects the legacy request without constructing the modern
   instance. Its first `server/discover` then awaits `connectInstance`.
2. `connectInstance` invokes the actual adapter's `createServer` factory.
3. `adapters/mcp/src/server.ts` registers five tools. Each converts its input and
   output schema through `fromJsonSchema`.
4. The installed SDK's `fromJsonSchema` obtains a validator eagerly; its default
   AJV provider compiles uncached schemas synchronously.
5. Competing cold server instances lengthen wall-clock factory execution. The
   test's independent timer expires before the valid discovery reply is written.

A V8 profile limited to the actual factory measured 973ms wall time and 1,466ms
aggregate process CPU. Of 905,025 sampled microseconds under `createServer`,
892,026 (98.56%) were self-time in AJV frames. Inspector setup/stop frames were
excluded from that ratio by selecting descendants of the factory frame.
This is a profile of one cold local factory, not a production latency benchmark.
It identifies the measured CPU work; it does not prove the original CPU load.

The installed Node runner uses `availableParallelism() - 1` file workers when
no explicit concurrency is supplied; the current host reports 22, giving 21
workers plus test-owned child processes. The failed command supplied no
explicit concurrency. Original instantaneous runnable-process count and CPU
service capacity were not recorded.

## Causal classification and alternatives

- **Producing condition, controlled reproduction:** eager cold schema
  compilation within discovery, competing execution capacity, and a fixed
  five-second test success budget with no coordinated workload limit.
- **Contributing conditions:** the first request constructs a fresh server;
  the default gate allows many file workers and their child processes.
- **Trigger:** discovery immediately after successful legacy rejection.
- **Detection/escape gap:** timeout removes its pending ID; late replies are
  unclaimed. No request/response timestamps, factory CPU interval, or parent
  event-loop delay were retained. This gap is not the producing cause.
- **Original attribution:** leading explanation supported by reproduction and
  earlier isolation/concurrency-four success; still unconfirmed.

Parent-only event-loop starvation does not explain the decisive reproduction:
its measured delay is tens of milliseconds while the server itself writes
seconds after the deadline. A lost or invalid protocol response does not
explain that reproduction either: all responses are valid and eventual exits
are clean. Those alternatives are not retrospectively excluded for the
untraced original occurrence. A permanent SDK deadlock is inconsistent with
the observed controlled normal completion and prior passing gates.

## Corrective and recurrence-prevention candidates

Recommended immediate correction candidate: explicitly bound the canonical
unit-test worker concurrency to four, preserving the existing timeout and
semantic assertions. The same four-CPU control then responds within 1.36s;
the earlier complete acceptance retry at concurrency four passed 1,421 tests
and every installed/adapter/host gate. This controls the producing condition
seen in the experiment, rather than relaxing validation.

Separately improve detection: retain request send, raw child receive/write,
parent event-loop delay, exit status and late-response information on timeout.
Any further original-environment failure can then distinguish server processing
from client dispatch delay before increasing attribution confidence. Existing
success assertions and normal protocol-only stdout must remain intact.

Alternative A: adjust a deadline only after defining the supported workload,
latency threshold and evidence method. Alternative B: reduce cold compilation
cost after defining a beneficiary workload and profiling its schema ownership
and caching correctness. Neither alternative is selected or implemented here.

Provisional combined correction/instrumentation preparation is 0.3-0.8
agent-hours, low confidence (0.1-0.2 for bounded runner selection and
0.2-0.6 for diagnostic capture and verification), excluding owner waiting.
Implementation requires a separately selected change scope. Its exit condition
is both a complete-gate pass and retained evidence identifying a deliberately
induced timeout; production response-time behavior must remain governed by the
accepted contract. A passing retry alone is not proof that the original cause
has been corrected.

## Evidence, audit and closure

The adjacent `-evidence.json` retains raw results, annotated final replay code,
profile summary and original failure excerpt. The `.cpuprofile.gz` retains the
complete profile, with compressed/uncompressed SHA-256 bindings in that JSON.
The final replay script is extracted to its recorded `/tmp` filename and run
with arguments `22 0-3` or `4 0-3`; its owned processes alone receive affinity
changes. Earlier variants differed in tracing and discovery-barrier behavior.
Recorded timings are observations, not fixed acceptance thresholds.

The adjacent `.think` records competing explanations, original-attribution
unknowns, interventions, conclusions and candidates. Command-line
`llmthink dsl audit` passed with zero fatal, error or warning findings.
Pending original attribution remains an explicit limitation. The audit does
not supply facts or authority.

This investigation is complete with zero remaining investigation effort
(high confidence for completion of the bounded evidence work). The recommended
next action is the separately selected bounded-runner and timeout-diagnostic
change above. `PLAN_REVIEW_ACCEPTANCE` remains technically done; its owner
acceptance is unchanged. No RCA task or actuals were invented in the canonical
PERT, and no second planning ledger was created. Experimental wall and CPU time
are measured in the evidence; independent human/agent person effort was not
measured. No source fix, timeout increase, commit, push, Issue, release or
publication action occurred.

## Confirmed owner release judgment

On 2026-09-30, the owner confirmed the following decision and explicitly
instructed continuing on that basis:

- Complete attribution of the original timeout is not a release blocker. The
  experimentally explained leading mechanism is sufficient to account for
  the incident while the original cause remains unconfirmed.
- A successful rerun satisfies this incident-specific release condition. The
  instrumented default-concurrency rerun passed all 1,421 tests, with discovery
  completing in 2,413ms and no discovery deadline firing.
- Timeout-budget adjustment belongs to separate work. This owner direction
  supersedes the immediate four-worker correction recommendation above; the
  experiments and historical recommendations remain evidence, not a selected
  implementation.

This confirms the incident release judgment, not the original causal
attribution. Release version selection, a frozen distributable candidate,
publication, and PERT acceptance receipts remain distinct steps. No timeout
value or production behavior was changed by recording this decision.
