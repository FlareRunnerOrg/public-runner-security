# Public runner security qualification

Controlled integration fixtures for FlareRunner-owned public GitHub Actions jobs.
These tests use dummy canaries and disposable branches. They do not probe customer
repositories, retrieve cloud metadata credentials, exploit kernels, or generate abusive traffic.

## Boundaries exercised

| Case | Required result |
| --- | --- |
| Public default-branch job | Normal HTTPS access and successful read-only CI |
| Read-only GitHub job token | Creating a disposable fixture branch is denied |
| Platform credentials | Known platform credential variables are absent from job environment |
| Same-repository and fork PRs | Secretless positive controls run on managed runners |
| Project secret, write token, OIDC in an untrusted job | Runner denies admission before any customer step |
| `pull_request_target` and `workflow_run` | Runner denies privileged triggers before customer code |
| PR cache poisoning | Main restores trusted data; PRs restore only their own scope, including across separate PRs |
| Disk persistence | Files written by a previous job are absent in the next job |
| Dummy secret masking | Trusted work can use a generated fixture canary; logs redact its value |
| Cancellation | An executing managed workload receives cancellation and its runner registration disappears |
| Product privacy | An unauthenticated product request receives 401 |

## Controlled setup

The repository must be selected on the production FlareRunner App installation.
Account approval and existing workspace funding remain required. Keep
`FR_SECURITY_TEST_ENABLED` unset until the intended production release is verified.

Set these repository Actions variables:

- `FLARERUNNER_RUNNER_GROUP`: the verified workspace group from FlareRunner.
- `FR_SECURITY_CACHE_EPOCH`: a fresh identifier for this qualification campaign.
- `FR_SECURITY_CANARY_SHA256`: SHA-256 of the generated dummy canary.
- `FR_SECURITY_TEST_ENABLED`: `true` only when ready to execute the bounded fixtures.

Create the fixture-only GitHub environment `security-canary` and set its environment
secret `FR_SECURITY_CANARY` to a newly generated value beginning with
`fr-public-canary-`. It has no authority outside these fixtures. Never use real
platform, cloud, deployment, customer or payment credentials as a canary.
The positive PR job does not request this environment. The negative secret job does,
so its actual delivered credential is rejected before customer code. Keep real
deployment secrets in reviewed environments rather than making them available to PR jobs.

## Run the campaign

1. Run `bun test` to verify that the evidence checker rejects false positives.
2. Dispatch **Public runner security** on `main`; retain the trusted cache seed and dummy masking evidence.
3. Open two same-repository PRs with harmless README edits. Verify the positive workflow on each and the expected admission failures in **Reject credential-bearing untrusted jobs** and **Reject privileged PR trigger**.
4. Open a PR from a FlareRunner-owned fork. Verify the secretless positive workflow and privileged-trigger denial. A fork owned by an organization member exercises fork isolation, not the approval behavior of an unrelated outsider.
5. Dispatch **Public runner security** again on `main`; the cache must hit and still contain trusted data.
6. Dispatch **Runner cancellation**, wait until its last step is executing, cancel it, verify terminal cancellation, then verify the assigned runner disappears from the organization runner inventory.
7. Check each completed run with `bun run verify <run-id> baseline`, `denied`, or `cancelled`. A queued, skipped, unassigned, unrelated failure or executed rejection probe is never a passing denial.

The GitHub CLI must be authenticated as the authorized FlareRunner account. All
controller operations use `gh`. Retain exact run URLs, commit SHAs, job conclusions
and runner names with the release evidence; never retain tokens or secret values.

## Limits of the evidence

Passing fixtures establishes these specific deployed behaviors. GitHub runner
admission failures can also result from funding, assignment or provider availability.
The log checker verifies the platform step and absence of customer execution;
corroborate each negative case's intended credential or event rejection with
operator telemetry for that job. A generic admission failure alone does not prove
the tested restriction. Preserve initial failures and retries separately, and do
not infer successful concurrent scheduling from cases that passed after serial retries.

GitHub runner
deregistration does not itself prove Cloudflare VM destruction, and GitHub log
masking does not by itself prove first-party retained-log masking. Those require
separate provider and authenticated FlareRunner observations. These tests do not
establish immunity from VM escapes, malicious outbound traffic, stolen cards or
unknown vulnerabilities. They are regression evidence, not a security certification.
Controlled integration tests for FlareRunner public GitHub Actions runner security boundaries

Controlled release e2b814e qualification: same-repository PR scope B.

Release qualification: repeat the second PR positive control with a fresh run identity.
