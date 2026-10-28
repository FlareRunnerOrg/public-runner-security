# Run an independent FlareRunner security assessment

You can inspect our public results, verify their underlying evidence yourself, or
run the suite in a public repository connected to your own FlareRunner workspace.
This guide is for security teams assessing **FlareRunner**. Other CI providers
have different admission policies and evidence formats; pointing these workflows
at another provider does not produce a valid assessment of that provider.

The suite and this guide are [MIT licensed](LICENSE), copyright 2026 FlareRunner.
You may copy and adapt them; retain the license and copyright notice in your copy.

## Choose your starting point

| Goal | What you need |
| --- | --- |
| Read our published results | The [README](README.md), linked Actions runs and [dated qualification record](QUALIFICATION.md) |
| Independently recheck a completed cohort | A reviewed checkout, Bun 1.4.4 and a GitHub CLI session that can read Actions metadata and logs |
| Exercise your own configuration | A disposable public repository, repository administration access, and a funded, paid FlareRunner workspace connected to that repository |

Reading results does not require a FlareRunner account. Executing managed jobs
uses the paid workspace's capacity and credit, including jobs rejected at admission.

## Recheck the public evidence without running attacks

Clone this repository with `gh repo clone FlareRunnerOrg/public-runner-security`.
Choose and review the verifier revision before using it. In the checkout:

```sh
bun install --frozen-lockfile --ignore-scripts
bun run check
git rev-parse HEAD
git diff --exit-code
```

Record that verifier SHA. Find a completed **Fixture checks** run for a main push
or PR. The acceptance report links the tested revision and underlying workflows;
you can also list anchors with:

```sh
gh run list --repo FlareRunnerOrg/public-runner-security \
  --workflow fixture-check.yml --event pull_request \
  --limit 20 --json databaseId,headSha,createdAt,conclusion,url
```

Then substitute its numeric ID:

```sh
bun run review FIXTURE_RUN_ID --output reports.local/public-review
```

This command reads GitHub evidence and the public FlareRunner version endpoint.
It does not dispatch, cancel or rerun jobs, change settings, or publish statuses.
It saves `acceptance.json` and `acceptance.md` and exits successfully only when
the complete scoped assessment passes. Unfinished or unavailable evidence fails
the review; wait for completion and review again with a new output directory.
Existing report files are never overwritten. For one completed workflow,
including a manually dispatched attack or cancellation, use:

```sh
bun run verify WORKFLOW_RUN_ID auto
```

An old passing cohort establishes what happened in those runs. The production SHA
in a review is observed **while reviewing**, not an attestation of the image or
release used by historical jobs. For a new assessment, run a fresh campaign and
record its dates, source revisions and operator evidence.

## Set up a repository you control

### 1. Create an isolated copy

Fork the suite into the organization being assessed, clone it with `gh`, and keep
`main` as the default branch. Enable Actions for the fork. Use a repository with no
customer data or real credentials, including inherited organization secrets. The
only secret delivered to fixture jobs should be the dummy canary described below.

Check `gh api user --jq .login` before changing repository settings. On a setup
branch, point the suite at the fork's exact GitHub owner/name:

```sh
bun run configure --repo YOUR-ORG/runner-security
bun run check
```

Review and commit `security-suite.json` through your normal PR process. The setting
binds probes, evidence reads and report publication to your repository. It must be
present in the reviewed `main` checkout before qualification begins. Do not select
the expected repository from a candidate run or a PR artifact.

The trusted workflows check out **their own repository at `github.workflow_sha`**.
They do not execute FlareRunner's upstream verifier by mistake, a triggering PR's
source, a mutable branch ref, or downloaded artifacts. Keep those safeguards and
the regression tests intact when updating your copy.

### 2. Connect and protect it

Connect this public repository through the FlareRunner GitHub App installation
and select its funded workspace. Copy that workspace's nonsecret runner group.

Protect `main` against deletion and force pushes, require reviewed changes to
workflow/verifier code, and restrict who can edit Actions settings, variables and
environments. Require **Fixture checks**. Once a real same-repository PR has a
passing report, require **Security acceptance** too. Do not require the individual
raw attack jobs to succeed: their admission failures are the expected evidence.

The verifier must remain on GitHub-hosted `ubuntu-24.04`, outside the runner being
assessed. Keep contents/actions read permissions; only the separate acceptance
publisher needs statuses write. Ensure organization Actions policies allow the
suite's pinned actions and the workflow's declared token permissions. Do not work
around a policy restriction by weakening a probe. GitHub's
[secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use)
explains privileged triggers, untrusted checkouts and immutable action pins.

### 3. Configure the fixture

In repository **Settings → Secrets and variables → Actions**, set these repository
variables. Do not enable execution until setup and trusted source are reviewed.

| Variable | Value |
| --- | --- |
| `FLARERUNNER_RUNNER_GROUP` | Your workspace's `flarerunner-frg-…` group |
| `FR_SECURITY_CACHE_EPOCH` | A new, nonsecret campaign ID, such as `audit-20261027` |
| `FR_SECURITY_TEST_ENABLED` | `true` when ready to run |

Keep the cache epoch unchanged throughout one campaign and change it for the next.
Create a **security-canary** environment used only for this suite. Allow the
fixture's main, same-repository PR and disposable branch jobs to reference it;
required environment approval or a main-only branch restriction would prevent
the intended admission test. Give it no production authority.

Generate the dummy secret and matching repository variable with:

```sh
bun run configure-canary --repo YOUR-ORG/runner-security
```

The command requires the environment to exist, generates a random
`fr-public-canary-…` value, sets its `FR_SECURITY_CANARY` environment secret and
sets the `FR_SECURITY_CANARY_SHA256` repository variable. It prints neither value
nor raw logs. Configure it before starting jobs; do not rotate it midway through
a campaign. If setup fails, leave execution disabled and rerun setup before
starting a campaign. Never substitute a real credential. The masking probe deliberately
prints this dummy value to test redaction.

## Run a complete campaign

Use [the assessment template](ASSESSMENT-TEMPLATE.md) to record every run ID,
attempt, source SHA, result and evidence link. Run one PR's cohort to completion
before starting the next; the rejection chains already serialize their probes.

1. **Seed trusted cache and verify masking.** Dispatch **Public runner security**
   on `main`. Require a successful **Security verdict** for its four controls and
   for its associated privileged workflow-completion rejection. Record the cache
   marker: the first run of a fresh epoch must miss and write trusted provenance.
2. **Exercise two same-repository PRs.** For each, branch from the reviewed `main`
   revision and change only a harmless README line. Open the PR without merging.
   Require **Fixture checks**, all trusted **Security verdicts**, and **Security
   acceptance** to pass. Each PR report must include all eleven admission
   rejections and the positive controls: fifteen report rows including fixture
   validation. Preserve the first PR while testing the second so their cache
   identities remain distinct. Record each initial PR cache miss and PR-specific
   provenance; a later run of the same PR may hit its own cache.
3. **Exercise a controlled fork PR.** Fork your assessment repository into a
   second account or organization you control. Keep `security-suite.json` pointing
   at the assessment's base repository. On a disposable branch in that fork, run:

   ```sh
   bun run prepare-fork --runner-group YOUR-RUNNER-GROUP \
     --cache-epoch YOUR-CAMPAIGN-ID
   bun run check
   ```

   This makes only the fork positive-control opt-in, runner routing and cache key
   literal, because repository variables are not available in this fork context.
   Review that diff, push it to the controlled fork and open a PR **against the
   assessment repository's `main`**. Keep read-only permissions, action pins and
   all probes unchanged. Never merge the fork override into `main`. Require fork
   controls and both privileged-trigger denials to pass. The credential matrices
   are intentionally excluded for forks, where GitHub withholds that authority;
   their absence is not evidence that those matrices were tested.
4. **Check main after the PR writes.** Dispatch the main control again with the
   same epoch. Its cache must hit and still contain trusted main provenance.
   All three PRs must have their own provenance, never trusted main's or another
   PR's. A set of individually green runs without this sequence does not establish
   cache separation.
5. **Check arbitrary branch dispatch.** On a disposable, nondefault branch from
   reviewed `main`, dispatch **Reject credential-bearing untrusted jobs** and
   **Reject container and token escalation**. Require both trusted verdicts to
   pass: all nine attacks must fail admission with their expected policies.
6. **Check cancellation.** Dispatch **Runner cancellation** on `main`. Wait until
   its final workload step logs `FR_SECURITY_LIFETIME_STARTED`, then cancel that
   run. Dispatch **Security verdict** on `main` with that run's `run_id`, or use
   `bun run verify RUN_ID cancelled`. Cancellation before the workload starts
   cannot pass. Obtain separate provider shutdown evidence as described below.
7. **Review and clean up.** Recheck the PR cohorts using `bun run review` with
   their Fixture checks IDs. Keep failing attempts alongside later successful
   attempts. Close the three disposable PRs without merging, delete their source
   branches, and remove the manual-dispatch branch. Set the execution opt-in to
   `false` when the campaign is finished if you do not want continuing paid tests.
   Disabled testing reports **Not run**, not a passing security assessment.

For example, manual dispatch and read-only run discovery use:

```sh
gh workflow run public-security.yml --repo YOUR-ORG/runner-security --ref main
gh run list --repo YOUR-ORG/runner-security --workflow public-security.yml \
  --limit 10 --json databaseId,event,headSha,createdAt,conclusion,url
gh workflow run security-verdict.yml --repo YOUR-ORG/runner-security \
  --ref main -f run_id=COMPLETED_RUN_ID
```

Manual control and attack runs use individual verdicts. The aggregate review takes
a **Fixture checks** anchor from a main push or PR, not a manual control run.
If verification needs repeating, use the same anchor's manual **Security
acceptance** dispatch (`fixture_run_id`) instead of silently replacing failed
source runs. A fresh campaign should use a fresh epoch and explicit new records.

## Interpret failures and evidence gaps

An expected rejection requires an assigned managed runner, a failed first
**FlareRunner admission** step, its exact policy marker and no customer/action or
container setup. A funding failure, queue timeout, missing secret, cancellation,
unrelated error, or a job that executes the attack does not qualify. A green attack
workflow wrapper alone proves nothing. Keep the fatal verifier and aggregate
checks enabled.

Request operator evidence, bound to the exact campaign jobs, for:

- The runner image digest and the release actually used by those jobs.
- Masking in every retained FlareRunner log chunk, separately from GitHub masking.
- The exact cancelled provider instance reaching stopped state, its stop time,
  and the removal of its GitHub runner registration.

Without that access or an independently reviewed operator record, mark these
items **Not verified**. Do not copy our historical qualification as evidence for
your own workspace. Fresh filesystem sentinels do not prove physical disk erasure;
an owned fork does not test GitHub's unrelated first-contributor approval policy.
This suite also does not establish isolation between unrelated customer tenants,
exclude kernel/provider vulnerabilities, or audit an application's own workflow
scripts and dependencies. It is a repeatable check of the listed controls.

Share unexpected results with the responsible operator through an agreed private
reporting channel. Include run IDs, attempts, source revisions and policy classes;
omit raw secrets, tokens, customer data and unredacted logs.
