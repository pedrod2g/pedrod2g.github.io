---
title: "Shift-Left Security Testing: SAST and DAST in the PR Pipeline"
date: 2026-07-18
summary: "A security scan that runs once a quarter finds vulnerabilities that have been in production for months. Running static and dynamic analysis on every pull request turns 'we'll fix it in the next audit' into 'the PR won't merge until it's fixed' — a much shorter feedback loop for the same class of bugs."
tags: [Security Testing, SAST, DAST, Shift-Left, CI/CD]
---
Static analysis (SAST) catches vulnerable patterns in source code before it ever runs — SQL built by string concatenation, a hardcoded credential, a deserialization call on untrusted input. Dynamic analysis (DAST) catches what SAST can't see: how the running application actually behaves when it's attacked. Neither replaces a real penetration test, but both catch a large, well-understood class of bugs for a fraction of the cost, on every single PR.

##### Gating on Static Analysis in CI

{% raw %}
```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on: pull_request

jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Semgrep
        uses: semgrep/semgrep-action@v1
        with:
          config: >-
            p/owasp-top-ten
            p/secrets
          publishToken: ${{ secrets.SEMGREP_APP_TOKEN }}
```
{% endraw %}

Semgrep's OWASP Top Ten and secrets rulesets catch the well-known offenders — injection patterns, hardcoded keys, insecure deserialization — as inline PR comments, at the exact line that introduced them.

##### Running DAST Against a Live Preview Environment

{% raw %}
```yaml
  dast:
    needs: deploy-preview
    runs-on: ubuntu-latest
    steps:
      - name: OWASP ZAP baseline scan
        uses: zaproxy/action-baseline@v0.12.0
        with:
          target: ${{ needs.deploy-preview.outputs.preview_url }}
          fail_action: true
          cmd_options: '-a'
```
{% endraw %}

Scanning the actual preview deployment for a PR catches issues that only exist at runtime — missing security headers, verbose error pages leaking stack traces, endpoints that respond differently than the source code alone would suggest.

##### Making the Gate Sustainable

- New rules and rulesets start in report-only mode against the existing codebase before becoming a blocking gate — turning on a strict ruleset that immediately fails 200 existing PRs trains everyone to ignore the scanner
- Findings need clear severity tiers; only high/critical block merge automatically, medium/low get filed and tracked without stopping work
- False positives get triaged and suppressed with a documented reason inline, not silently ignored — an unexplained suppression is indistinguishable from someone just disabling the check
- SAST and DAST cover known vulnerability classes; they don't replace periodic manual penetration testing or a bug bounty program for anything business-critical
