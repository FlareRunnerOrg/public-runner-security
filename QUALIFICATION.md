# Public runner acceptance record

## What counts as a pass

Positive controls must finish successfully on an assigned FlareRunner runner,
with both successful platform admission and the probe's completion markers.
Skipped, cancelled, timed-out and retried positive controls do not pass a campaign.

The **Reject …** workflows intentionally appear red in GitHub. They pass their
acceptance check only when platform admission fails before any customer step,
and operator telemetry identifies the intended credential or event restriction
for that exact job. A generic admission error is insufficient.

## Verified production campaign: October 27, 2026 (UTC), release cfc6419

The expanded suite passed **20 executing public workflow runs covering 53 managed
jobs**, with **20 green Security verdict runs**. All source runs and verdicts used
their first attempt. There were 17 successful positive-control jobs, 35 exact
policy rejections, and one started workload that was cancelled as intended. The
fork’s two credential matrices and their verdicts are intentionally skipped;
those skips do not count toward these totals.

| Check | Public evidence |
| --- | --- |
| Trusted main: API/token boundaries, fresh user/root files, sudo and masking | [Seed](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40449829539), [green verdict](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40450022220) |
| Independent PR cache scopes, read-only tokens and guest-root isolation | [PR A](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40450129846), [PR B](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40450510039), [owned fork](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40450886440) |
| Secrets, elevated tokens, OIDC and container/action startup blocked in PRs | [PR 1](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40450510056), [PR 2](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40450129854) |
| Same attacks from a nondefault branch with manual triggers | [Matrix 1](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40451355925), [Matrix 2](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40451352860) |
| Main restores its trusted cache after all PR scopes wrote theirs | [Final main control](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40451120781) |
| Started workload cancelled, exact provider instance stopped, runner removed | [Cancellation](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40451620870) |

Each rejection needed its matching policy class in the platform-owned first
admission step: delivered secrets, elevated token authority, OIDC, or a privileged
trigger. No customer step, action setup, service container or job container could
initialize after that denial. All three PR-target runs and all five
workflow-completion runs were rejected. A timeout, generic funding
failure, wrong policy, missing probe or executed attack makes the CI verdict fail.

The secret cases include an empty GitHub token permission set, environment secrets,
job containers and service containers. Token cases include Contents-write,
Checks-write, Actions-read and a Docker action with a write token. Both manual
nondefault-branch matrices also passed, covering the stolen-token pattern of
planting a workflow on an arbitrary branch. See the [Wiz incident analysis](https://www.wiz.io/blog/gheist-attempted-scaled-abuse-of-stolen-github-tokens-stumbles)
for the motivation.

Main seeded and restored trusted cache data. Each of the two same-repository PRs
and the owned fork missed that cache and wrote its own PR scope. All five positive-control runs
passed fresh-filesystem checks, including a root-owned persistence sentinel.
Sudo remained available while the known platform credential names were absent
from guest process environments and provisioning/cross-instance operator requests
were denied. The read-only job token could read this public repository over HTTPS,
could not create a repository branch, and could not authenticate to the private
FlareRunner product API.

Both trusted runs passed dummy-secret masking in GitHub logs and every retained
FlareRunner log chunk (26 and 30 chunks).
Normal cancellation was requested at `2026-10-27T04:47:26.303Z`; the exact
provider instance was stopped at `2026-10-27T04:48:27.282Z` with the
qualified image. All 53 managed runner identities were distinct, and all campaign
runner registrations were absent at final verification.

The same production release also passed three operator-verified compatibility
jobs: Ubuntu with sudo, service containers, and a job container with Docker
actions. The fixture revision was `27d313f2294727394abb743fe5d6d2436de31e85`. The runner image passed
209 compiled admission assertions and its final-image sudo contract before
publication.

The [sanitized evidence](evidence/2026-10-27-cfc6419.json) binds every source run to
its green CI verdict and records policy matches, cache scopes, masking and provider
teardown. The disposable PRs were closed without merging and their branches were
deleted. The production fixture remains enabled.

This campaign sequences probes within the paid test workspace concurrency limit.
It does not qualify behavior above that limit. The fork is owned; unrelated
first-time contributor approval behavior is outside this test. Fresh files and
stopped instances do not independently prove physical disk erasure or exclude all
kernel, provider or supply-chain vulnerabilities.

## Earlier verified campaign: October 27, 2026 (UTC), release f139580

Release `f139580` passed **16 executing public workflow runs covering 27 jobs**.
Every case used its first attempt. All positive controls succeeded, and all 14
intended policy denials matched their exact jobs before any customer step ran.

| Check | Public run evidence |
| --- | --- |
| Trusted baseline, fresh files and dummy-secret masking | [Seed](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40425851230) |
| Two overlapping, independent PRs | [PR A](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40426325449), [PR B](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40426332043) |
| Owned fork, read-only token and fresh files | [Fork](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40426794463) |
| Project secrets, write tokens and OIDC blocked in PR jobs | [PR A](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40426325181), [PR B](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40426332022) |
| Privileged PR triggers blocked | [PR A](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40426325044), [PR B](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40426332102), [fork](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40426794462) |
| Privileged completion triggers blocked | [Seed](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40426049310), [PR A](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40426600648), [PR B](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40426690393), [fork](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40426964301), [restore](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40427182071) |
| Trusted cache restored after all three PR scopes wrote their own caches | [Final main control](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40427047104) |
| Running workload cancelled and its VM stopped | [Cancellation](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40427320940) |

The two PRs and the fork each started with an empty, separate cache. Main then
restored its original cache with trusted provenance intact. Both trusted runs
also passed masking checks against GitHub logs and every retained FlareRunner log
chunk: the masked dummy-canary and completion markers were present, and the raw
canary was absent.

Normal cancellation stopped the exact provider instance at
`00:36:41.433 UTC`, after the cancellation request at `00:35:48.302 UTC`.
Its GitHub runner registration was removed. All campaign runner registrations were
gone at final verification. These observations establish stopped state and fresh
job files; they do not independently measure physical disk destruction.

Three additional deployed compatibility jobs passed on the same release:
Ubuntu with sudo/root access, service containers, and job containers with Docker
actions. These results were checked by the operator in the application repository.
The fork's credential matrix is intentionally skipped; its positive and
privileged-event controls all executed.

The [sanitized evidence](evidence/2026-10-27-f139580.json) records the public job
identities, exact policy matches, cache scopes, masking results and cancellation
times. It contains no secret values or raw job logs. Test variables were restored,
and the three disposable PRs were closed without merging their branches.

## Earlier failures

The first expanded campaign passed its main and same-repository controls but
stalled on fork ingress. Repeated installation-binding writes exhausted D1 catalog
revision retries. The application fix makes identical, already-validated bindings
read-only; conflict checks and transactional metadata enrichment remain intact.
The failed [fork verdict](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40445144368)
and [privileged-trigger verdict](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40445145182)
remain failures, not passing policy evidence. Native regressions reproduce both
unnecessary revision changes and concurrent replay failure before the fix.

The next expanded campaign hit the test workspace concurrency limit. One positive
control received 88 pending admission responses while unfunded. Its
[CI verdict failed](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40447943047),
as did other incomplete probes. The fixture now runs each rejection matrix as a
dependency chain and executes one PR matrix at a time, preserving every policy
assertion and all production funding limits. This does not establish one cause
for every earlier timeout or qualify scheduling above the workspace limit.

The first campaign after the dependency release exposed real scheduling defects.
GitHub could assign a job to another compatible ready slot while its own capacity
was still provisioning. The old dispatch path could then close the running job's
funding reservation. The assignment correction added deterministic regression
coverage for that transition.

On October 26, both overlapping same-repository PR controls passed on their first
attempts: [PR A](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40412616718)
and [PR B](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40412630329).
The [trusted seed](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40412295958)
also passed, alongside operator-verified deployed container contracts.

That campaign was still incomplete. The
[fork control](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40413365763)
and several rejection cases timed out at admission without all the required
policy evidence. Those failures remain visible. Review also reproduced a queued
delivery being discarded when GitHub reported `in_progress` without a runner
name. The follow-up correction retains that incomplete assignment for bounded
retry. The earlier telemetry does
not establish that this was the sole cause of every timeout.

The next campaign also remained incomplete: its
[second PR control](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40417669228)
stalled before admission. Two regression tests then reproduced excessive provider
work inside one scheduler alarm. The correction drains immediately due admission
pages first and processes one provisioning dispatch per alarm, so a queued job
does not wait behind a whole batch of VM starts. Funding and security checks still
apply to every job.

After that release, the [trusted control](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40422695965)
passed admission but its outbound probe received HTTP 503 from `example.com`.
The fixture now verifies an HTTPS read of this owned public repository instead.
Its separate attempt to write with the read-only job token must still fail.

The [workflow-completion control](https://github.com/FlareRunnerOrg/public-runner-security/actions/runs/40422772258)
also stalled at admission. Assignment recovery previously depended on a queued
webhook having arrived first. New regression coverage removes that dependency:
a signed assignment can supply the admission candidate, which still needs live
GitHub verification, its own funding reservation and all execution policy checks.
Those initial failures remain visible and do not count as successful rejection
tests.
