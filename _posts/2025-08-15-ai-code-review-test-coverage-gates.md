---
title: "AI Code Review Gates: Blocking PRs on Missing Test Coverage Automatically"
date: 2025-08-15
summary: "Line-coverage thresholds have always been easy to game — a test that calls a function without asserting anything meaningful still counts. Late-summer 2025 saw teams replace that metric with an LLM reviewer that reads the diff and asks whether the new logic is actually tested..."
tags: [AI Code Review, Shift-Left, CI/CD, Test Coverage]
---
A coverage percentage tells you a line executed during a test run. It says nothing about whether that execution proved anything. The shift this year was toward review agents that read a diff the way a senior engineer would — is the new branch condition exercised, is the error path tested, does any test actually assert on the new behavior — and block the merge if the answer is no.

##### Beyond Line Coverage: Asking "Is This Actually Tested?"

The gate runs as a required check, reading the PR diff alongside the test files changed in the same PR:

{% raw %}
```yaml
# .github/workflows/test-coverage-gate.yml
name: AI Test Coverage Gate
on: pull_request

jobs:
  coverage-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run AI coverage review
        run: |
          python scripts/review_test_coverage.py \
            --diff "${{ github.event.pull_request.diff_url }}" \
            --fail-on-gap
```
{% endraw %}

##### The Review Agent's Prompt Contract

The agent is scoped narrowly — it doesn't rewrite tests, it identifies gaps and cites the exact line:

```python
def review_coverage(diff: str) -> list[CoverageGap]:
    response = llm_client.complete(
        prompt="""
        Review this diff. For each new or changed branch of logic
        (conditionals, error handling, edge cases), determine whether
        a test in this diff exercises it and asserts on the outcome.

        Return a JSON list of gaps: [{"file", "line", "reason"}].
        Do not flag formatting, refactors with no logic change, or
        code that is already covered by an unchanged existing test.
        """,
        context=diff,
    )
    return parse_gaps(response)
```

Each flagged gap gets posted as an inline PR comment, not just a red check — the author sees exactly which branch needs a test and why, before they go looking for it themselves.

##### Where the Gate Gets Overridden

- A `test-gap-acknowledged` label lets an author merge with a documented reason (e.g., "covered by integration suite in another repo") — the gate is a prompt for a conversation, not an absolute block
- Hotfixes on a declared incident bypass the gate entirely; test debt gets filed as a follow-up ticket instead of blocking the fix
- The gate only evaluates net-new logic in the diff, never retroactively fails a PR for pre-existing untested code it didn't touch
- False positives get logged and reviewed weekly — the prompt gets refined based on real disagreements, not left static
