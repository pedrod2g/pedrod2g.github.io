---
title: "LLM-as-Judge: Replacing Brittle Assertions with Semantic Test Oracles"
date: 2025-10-15
summary: "As more product surfaces became generative — summaries, chatbot replies, AI-written copy — exact-match assertions stopped being viable. Fall 2025 tooling settled on a pattern: use a second, constrained LLM call as the test oracle instead of a string comparison..."
tags: [LLM-as-Judge, Test Oracles, Semantic Assertions, AI]
---
`assertEquals(actual, expected)` assumes the system under test is deterministic. Once a feature under test is itself an LLM call, that assumption breaks — the same prompt can produce two correct answers with different wording. Testing that stayed rigorous instead of "just eyeballing it in staging" needed a different kind of oracle.

##### Why Exact-Match Assertions Break on Generative Features

A support-ticket summarizer returning "Customer requests refund for order #4471" and "Refund requested by customer for order 4471" are both correct. A string diff sees two failures.

##### Building a Semantic Assertion Helper

The judge call is deliberately narrow — it doesn't grade quality in the abstract, it checks the actual output against a rubric tied to the specific test case:

{% raw %}
```python
def assert_semantically_equal(actual: str, expected: str, rubric: str):
    verdict = judge_model.complete(
        prompt=f"""
        Rubric: {rubric}

        Expected behavior: {expected}
        Actual output: {actual}

        Does the actual output satisfy the rubric and match the intent
        of the expected behavior? Answer with JSON:
        {{"pass": true|false, "reason": "..."}}
        """,
        temperature=0,
    )

    result = parse_json(verdict)
    if not result["pass"]:
        raise AssertionError(f"Semantic assertion failed: {result['reason']}")
```
{% endraw %}

```python
def test_ticket_summary_includes_order_and_intent():
    summary = summarize_ticket(sample_ticket)
    assert_semantically_equal(
        actual=summary,
        expected="mentions order #4471 and a refund request",
        rubric="Must reference the order number and the customer's core request. Wording is flexible.",
    )
```

##### Keeping LLM Judges Honest

- Judge calls run at `temperature=0` and against a pinned model version — an unpinned judge makes the test suite's pass rate depend on someone else's model update
- A curated set of hand-labeled goldens (known-good and known-bad outputs) gets run against the judge on every change to the rubric, so judge drift is caught before it reaches real tests
- Every judge failure logs its full reasoning, not just pass/fail — debugging a semantic assertion without the "why" is worse than debugging a diff
- Semantic assertions are reserved for genuinely non-deterministic outputs; anything with a deterministic expected value still uses a plain equality check, which is faster and cheaper
