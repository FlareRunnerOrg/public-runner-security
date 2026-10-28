# Independent FlareRunner assessment

Copy this template into your own assessment record. A blank, skipped, unavailable
or unreviewed item is **Not verified**, never Passed.

## Scope and provenance

- Assessor and authorized scope:
- Assessment repository and FlareRunner workspace:
- Upstream suite revision reviewed:
- Local verifier revision and configuration changes reviewed:
- Protected default branch (`main`) and reviewer:
- UTC start and end:
- Cache epoch:
- Production release observations at campaign start/end:
- Operator evidence of the release/image actually used by the campaign jobs:
- Result: Passed / Failed / Incomplete

## Executions

| Required execution | Run / attempt / source SHA | Trusted verdict or review | Result and evidence |
| --- | --- | --- | --- |
| Main seed: four controls, first cache miss and masking | | | Not verified |
| PR A: controls and all eleven denials | | | Not verified |
| PR B: independent PR cache and all eleven denials | | | Not verified |
| Controlled fork: controls and both privileged-trigger denials | | | Not verified |
| Main restore: trusted cache hit after the three PR writes | | | Not verified |
| Nondefault dispatch: three credential denials | | | Not verified |
| Nondefault dispatch: six container/token denials | | | Not verified |
| Started workload cancellation | | | Not verified |

Record every associated workflow-completion rejection and its exact source
baseline run. Attach the JSON/Markdown aggregate reports for each PR. Record cache
markers and all unsuccessful attempts; do not replace them with rerun links.

## Separate operator evidence

| Check | Evidence linked to exact campaign jobs | Result |
| --- | --- | --- |
| Actual runner image digest and application release | | Not verified |
| Dummy canary absent from every retained log chunk; masked marker present | | Not verified |
| Exact cancelled provider instance stopped, with request and stop times | | Not verified |
| Campaign GitHub runner registrations removed | | Not verified |

## Gaps, findings and cleanup

- Unexpected execution, incorrect denial or unavailable evidence:
- Reported privately to / tracking reference:
- Limits of the assessment and controls not tested:
- Disposable PRs closed without merging and branches deleted:
- Execution opt-in disabled or continuing-test owner recorded:
- Final reviewer and UTC date:

Do not include canary values, credentials or raw unredacted logs in this record.
