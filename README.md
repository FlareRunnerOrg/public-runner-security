# Public runner security tests

This is FlareRunner’s public acceptance suite. It runs controlled attack fixtures
against our production runners using a dummy secret and disposable branches.

## What a passing test means

**Security verdict** is the security test to read. It succeeds only after checking
GitHub’s job metadata and logs for every required probe. A rejected attack must:

- run on an assigned FlareRunner instance;
- fail in the platform’s first **FlareRunner admission** step;
- report the specific policy that blocked it;
- leave all customer steps, action setup, and container initialization unstarted.

An attack that runs, an unrelated failure, a missing probe, a timeout, or a
cancellation fails verification. Customer output cannot impersonate the platform
step. The underlying **Reject …** workflows intentionally show `Failure` when the
runner rejects their jobs; their corresponding **Security verdict** should be green.

The verifier runs on GitHub-hosted infrastructure with read-only permissions. It
checks out the protected branch’s verifier revision, never the triggering PR’s
code, and never downloads or executes its artifacts. This follows GitHub’s
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

1. Run `bun test` to check the verifier’s false-positive regressions.
2. Dispatch **Public runner security** on `main` to seed trusted cache data.
3. Open two harmless same-repository PRs. Each must pass the positive controls and
   the security verdicts for credential, container/token, and privileged-trigger probes.
4. Open a harmless PR from the owned fork to test secretless fork execution and
   privileged-trigger rejection. Repository variables are withheld from fork jobs;
   use literal, nonsecret runner routing in the disposable fixture branch.
5. Dispatch the main control again. Its cache must hit and retain trusted provenance.
6. Run **Runner cancellation**, cancel it after its final step starts, and verify
   provider shutdown and runner deregistration.
7. Close the disposable PRs and delete their branches. Merged branches are deleted automatically.

Every completed attack/control run starts a **Security verdict** automatically.
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

Controlled production attack qualification bounded-cfc6419-20261027: b.
