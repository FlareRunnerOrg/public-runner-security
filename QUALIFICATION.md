# Public runner acceptance record

## What counts as a pass

Positive controls must finish successfully on an assigned FlareRunner runner,
with both successful platform admission and the probe's completion markers.
Skipped, cancelled, timed-out and retried positive controls do not pass a campaign.

The **Reject …** workflows intentionally appear red in GitHub. They pass their
acceptance check only when platform admission fails before any customer step,
and operator telemetry identifies the intended credential or event restriction
for that exact job. A generic admission error is insufficient.

## Verified production campaign: October 27, 2026 (UTC)

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
