---
title: "Chaos Engineering for QA: Injecting Failure on Purpose"
date: 0000-00-00
summary: "Most test suites only verify the happy path plus a handful of anticipated error cases. Chaos engineering flips the question: instead of guessing what might fail, deliberately break something real and see whether the system — and the team — responds the way the runbook says it will."
tags: [Chaos Engineering, Resilience Testing, SRE, Test Strategy]
---
A retry policy that's never actually seen a timeout, a circuit breaker that's never actually tripped, a fallback path that's never actually executed — these are all things a normal test suite can claim to cover without ever proving they work under real failure conditions. Chaos experiments close that gap by causing the failure on purpose, in a controlled way, and checking whether the system degrades the way it's supposed to.

##### Defining a Chaos Experiment as a Hypothesis

A chaos experiment isn't "break things and see what happens" — it starts with an explicit, falsifiable prediction:

```yaml
# experiment: checkout-service-latency-injection.yml
title: "Checkout service tolerates elevated payment-provider latency"
hypothesis: >
  When the payment provider's response time increases to 3s,
  checkout requests still complete within 5s via the cached-rate
  fallback, and error rate stays below 1%.

method:
  - inject: network_latency
    target: payment-provider-proxy
    latency_ms: 3000
    duration: 5m

rollback:
  - remove: network_latency
    target: payment-provider-proxy

steady_state_check:
  metric: checkout_success_rate
  threshold: ">= 0.99"
```

The experiment fails — usefully — if the hypothesis turns out to be wrong. That's the point: a failed chaos experiment found a real gap before an actual payment provider outage did.

##### Running It Safely in a Real Environment

```python
def run_chaos_experiment(experiment: dict):
    baseline = capture_steady_state(experiment["steady_state_check"])

    with inject_fault(experiment["method"]):
        during_fault = capture_steady_state(experiment["steady_state_check"])

    after_rollback = capture_steady_state(experiment["steady_state_check"])

    if not meets_threshold(during_fault, experiment["steady_state_check"]["threshold"]):
        alert_team(
            f"Chaos experiment '{experiment['title']}' invalidated hypothesis: "
            f"{during_fault} did not meet {experiment['steady_state_check']['threshold']}"
        )

    return ExperimentResult(baseline, during_fault, after_rollback)
```

Every run captures baseline, during-fault, and after-rollback state — a system that "recovers" but never actually returns to baseline after the fault clears is its own finding.

##### Where to Start

- Begin in staging with synthetic traffic, not production — chaos engineering in production is a mature-team practice, not a starting point
- Pick experiments tied to a real, previously-seen failure mode (a past incident, a known single point of failure) rather than random fault injection
- Every experiment needs an automatic rollback and a hard time limit — "we forgot to turn the fault off" is its own incident
- Treat a failed hypothesis as the valuable outcome it is; the goal is finding gaps before an uncontrolled failure does, not proving the system is already perfect
