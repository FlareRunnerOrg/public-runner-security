# Public runner security tests

[![Security acceptance](https://github.com/FlareRunnerOrg/public-runner-security/actions/workflows/security-acceptance.yml/badge.svg?branch=main)](https://github.com/FlareRunnerOrg/public-runner-security/actions/workflows/security-acceptance.yml)

This is FlareRunner’s public acceptance suite. It runs controlled attack fixtures
against our production runners using a dummy secret and disposable branches.

## Read the overall result

Open the **Security acceptance** status on the tested commit or PR to view its
linked workflow report, or follow the badge above. The report lists each required
test, its result and its evidence. A rejected attack
appears as **Passed — blocked before execution**. A missing workflow, wrong denial,
executed attack or failed positive control makes acceptance fail. While work is
running the check stays pending; disabled testing is **Not run**, never a green pass.

Each report names its scope, tested commit, date and production release observed
before and after verification. A same-repository PR requires the positive controls
and all eleven admission rejection probes. A main push requires trusted controls,
including masking, and the privileged completion rejection. Fork reports explicitly
exclude the credential matrices that GitHub does not run for forks. These scoped
CI reports do not replace the complete production qualification campaign below.

**Latest full qualification:** October 27, 2026 (UTC), application release
[`cfc6419`](https://github.com/FlareRunnerOrg/flarerunner/commit/cfc6419bb76e1f14784efaa2fb2d42be7ab81989),
20 passing verdicts across 53 managed jobs. Its operator-verified runner image is
`sha256:c54213ec9d8e97c5878e85470c356be90451b4bb241647243d5419562f57da2a`.
The [qualification record](QUALIFICATION.md) binds the release, image and date;
it is historical evidence, not a claim that every later release was requalified.

## What a passing test means

**Security verdict** checks one underlying workflow. **Security acceptance** combines
all required workflows for the same trigger and revision. Both check
GitHub’s job metadata and logs for every required probe. A rejected attack must:

- run on an assigned FlareRunner instance;
- fail in the platform’s first **FlareRunner admission** step;
- report the specific policy that blocked it;
- leave all customer steps, action setup, and container initialization unstarted.

An attack that runs, an unrelated failure, a missing probe, a timeout, or a
cancellation fails verification. Customer output cannot impersonate the platform
step. Jobs labelled **Attack probe — expected rejection** intentionally show
`Failure` when the runner rejects them. Their workflows use GitHub's job-level
`continue-on-error` so these expected failures do not send routine failed-workflow
emails. The job results and admission logs stay available as evidence.

A green probe workflow is not a security verdict. **Security verdict** and
**Security acceptance** still fail for executed attacks, missing or skipped probes,
incorrect denials, infrastructure errors and failed positive controls. Those checks
remain fatal and produce the usual failure notifications. Use their results to
judge the suite; historical failures are preserved.

The verifier runs on GitHub-hosted infrastructure with read-only permissions. It
checks out the protected branch’s verifier revision, never the triggering PR’s
code, and never downloads or executes its artifacts. The aggregate publisher also
uses trusted protected-branch code and has only the additional `statuses: write`
permission needed to link its report from the tested commit. Commit statuses keep
reporting separate from the Actions job evidence being verified. This follows GitHub’s
[guidance on privileged workflow triggers](https://docs.github.com/en/actions/reference/security/secure-use).

## What we exercise

| Attack or control | Required result |
| --- | --- |
| Public main, same-repository PR, and owned-fork PR | Secretless CI succeeds with normal HTTPS access |
| Repository write with the job token | GitHub returns 403 |
| Job token used against FlareRunner’s private product API | FlareRunner returns 401 |
| Project secret in an untrusted job | `untrusted_secrets`, before customer code |
| Secret with `permissions: {}` | Still `untrusted_secrets`; token scopes do not remove delivered secrets |
| Contents-write, checks-write, or Actions-read token | `untrusted_token_permissions` |
| OIDC request in an untrusted job | `untrusted_oidc` |
| Secret in a job container or service container | `untrusted_secrets`, before image or container setup |
| Docker action with a write token | `untrusted_token_permissions`, before action setup |
| `pull_request_target` or `workflow_run` | `privileged_event`, before customer code |
| PR cache poisoning | Main restores trusted data; each PR has its own cache scope |
| Files left by a previous job | Absent in the next job |
| Root inside the job guest | Sudo works; platform credentials and operator APIs remain inaccessible |
| Dummy secret used by trusted main | Usable by the job and masked in its logs |
| Cancellation | Started workload stops and its runner registration disappears |

See the [qualification record](QUALIFICATION.md) for production evidence and the
failures that led to regression tests. Preserve failed attempts alongside fixes.

## Configuration and execution

Select this repository on the FlareRunner App installation and fund its workspace.
Configure these Actions variables:

- `FLARERUNNER_RUNNER_GROUP`: the workspace runner group.
- `FR_SECURITY_CACHE_EPOCH`: a fresh campaign identifier.
- `FR_SECURITY_CANARY_SHA256`: SHA-256 of the dummy canary.
- `FR_SECURITY_TEST_ENABLED`: `true` to run the production fixtures on pushes and PRs.

The `security-canary` environment holds `FR_SECURITY_CANARY`, a generated value
beginning with `fr-public-canary-`. It grants no authority anywhere. Never substitute
real cloud, platform, payment, deployment, or customer credentials.
Its jobs use `deployment: false`: they still receive the environment's dummy
secret without creating misleading deployment records. Older records are preserved.

1. Run `bun test` to check the verifier’s false-positive regressions.
2. Dispatch **Public runner security** on `main` to seed trusted cache data.
3. Open two harmless same-repository PRs, waiting for each matrix to finish before
   starting the next. Each must pass the positive controls and the security verdicts
   for credential, container/token, and privileged-trigger probes. Rejection jobs
   run in sequence so expected failures cannot overload the test workspace.
4. Open a harmless PR from the owned fork to test secretless fork execution and
   privileged-trigger rejection. Repository variables are withheld from fork jobs;
   use literal, nonsecret runner routing in the disposable fixture branch.
5. Dispatch the main control again. Its cache must hit and retain trusted provenance.
6. On one disposable nondefault branch, dispatch both rejection matrices. All nine
   attacks must be blocked there too, with green security verdicts.
7. Run **Runner cancellation**, cancel it after its final step starts, and verify
   provider shutdown and runner deregistration. Dispatch **Security verdict** with
   its run ID to check the cancellation evidence in CI.
8. Close the disposable PRs and delete their branches. Merged branches are deleted automatically.

Each completed main/PR control and rejection workflow starts a **Security verdict**
automatically. Cancellation uses the manual verdict described above.
**Fixture checks** completion starts **Security acceptance**, which waits up to
twenty minutes for the required cohort. It binds the completion rejection to its
exact baseline run, rejects ambiguous executions, and rechecks run attempts before
publishing. A manual acceptance dispatch takes a **Fixture checks** run ID for a
main push or PR; individual manual attack and cancellation runs still use Security verdict.
You can also dispatch that workflow with a run ID, or inspect it locally with
`bun run verify <run-id> auto`. The CLI requires an authorized `gh` session.
Verification binds the job listing to the recorded run attempt and rejects partial
listings, unknown workflows, substituted paths, and the wrong repository.

## Scope of the evidence

These tests use only FlareRunner-owned resources. They do not retrieve cloud
metadata credentials, exploit kernels, access customer data, or generate abusive
traffic. No suite proves the absence of every vulnerability.

GitHub log masking does not prove masking in FlareRunner’s retained logs; the
qualification driver checks that separately. Runner deregistration does not prove
physical disk erasure; provider shutdown is separate evidence. An owned fork tests
fork isolation, not GitHub’s approval behavior for an unrelated first-time contributor.
