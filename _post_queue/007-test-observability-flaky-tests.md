---
title: "Test Observability: Correlating Flaky Tests with Production Traces"
date: 0000-00-00
summary: "A flaky test is usually treated as a test problem — add a retry, increase a timeout, move on. Sometimes it's actually an early warning about a race condition that exists in production too, and the only way to tell the difference is to look at the trace, not just the assertion."
tags: [Test Observability, Flaky Tests, OpenTelemetry, Test Strategy]
---
"Just quarantine the flaky test" is the right call most of the time — but occasionally a test flakes because it's the only thing exercising a genuine race condition in the system under test, and quarantining it just means the race condition ships without anyone noticing. The difference between those two cases is invisible from the assertion failure alone; it's visible in the trace.

##### Emitting Trace Context from Test Runs

The key move is treating a test run like any other traced request — instrument it with OpenTelemetry the same way you'd instrument a production call:

```python
from opentelemetry import trace

tracer = trace.get_tracer("test-suite")

def test_order_confirmation_email_sent():
    with tracer.start_as_current_span("test.order_confirmation_email") as span:
        order = place_order(sample_cart())
        span.set_attribute("order.id", order.id)

        email = wait_for_email(order.customer_email, timeout=10)
        span.set_attribute("email.received", email is not None)

        assert email is not None, f"No confirmation email — trace_id={span.get_span_context().trace_id:x}"
```

When the test fails, the assertion message includes the trace ID — the same ID that shows up in the service's own distributed tracing backend.

##### Correlating Failures Back to the System's Own Traces

```python
def investigate_flaky_failure(trace_id: str):
    spans = tracing_backend.get_trace(trace_id)

    slow_spans = [s for s in spans if s.duration_ms > s.expected_p99]
    errors = [s for s in spans if s.status == "error"]

    return FlakeReport(
        trace_id=trace_id,
        slow_spans=slow_spans,
        error_spans=errors,
        likely_real_issue=len(slow_spans) > 0 or len(errors) > 0,
    )
```

A flake where the trace shows a downstream span consistently near its p99 latency threshold is a very different finding than a flake with a clean trace and no anomalies — the first is a real system issue wearing a test failure as a disguise.

##### Building the Habit

- Every flaky-test ticket should include the trace ID from a failing run, not just "sometimes fails in CI" — the ticket without a trace ID is much harder to act on
- Track flake rate per test alongside p95 latency of the spans that test touches — a rising flake rate that correlates with rising latency somewhere downstream is a signal, not a coincidence
- Distinguish "flaky because of test infrastructure" (shared test env contention, timing assumptions) from "flaky because of the system under test" — only the traces make that distinction reliably
- Quarantining is still the right first move to keep CI usable — but quarantine should come with a ticket that has a trace attached, not a silent skip
