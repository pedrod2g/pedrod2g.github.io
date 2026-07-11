---
title: "Testing Feature Flags: Strategies for Flag-Gated Releases"
date: 0000-00-00
summary: "Feature flags decouple deploy from release, which is great for shipping safely — until your test suite has no idea which combination of flags it's supposed to be testing. Untested flag states are where a surprising number of production incidents actually live."
tags: [Feature Flags, Test Strategy, Release Engineering]
---
A codebase with ten independent boolean flags has, in theory, 1024 possible states. Nobody tests all of them, and nobody should — but "we only test with every flag at its default" is how a flag combination that's live for 5% of users in production goes completely unverified.

##### Parameterizing Tests Across Flag States

Rather than one flag configuration per test run, the flags that matter for a given feature get parameterized directly into the test:

```python
import pytest

@pytest.mark.parametrize("flags", [
    {"new_checkout_flow": False, "express_pay": False},
    {"new_checkout_flow": True, "express_pay": False},
    {"new_checkout_flow": True, "express_pay": True},
])
def test_checkout_completes(flags, test_client):
    with feature_flags(**flags):
        response = test_client.post("/checkout", json=sample_order())
        assert response.status_code == 200
        assert response.json()["status"] == "confirmed"
```

Note what's missing: `{"new_checkout_flow": False, "express_pay": True}` isn't a real combination the rollout plan allows — express pay depends on the new checkout flow — so it's deliberately not tested. Parameterizing forces you to be explicit about which combinations are actually reachable.

##### Verifying Flag Cleanup, Not Just Flag Behavior

The other half of flag testing is catching flags that outlived their purpose:

```python
def test_no_flags_older_than_90_days_without_owner_signoff():
    stale_flags = [
        f for f in load_flag_registry()
        if f.age_days > 90 and not f.cleanup_ticket
    ]
    assert not stale_flags, (
        f"Stale flags need a cleanup ticket or removal: "
        f"{[f.name for f in stale_flags]}"
    )
```

This isn't testing product behavior — it's testing that the flag system itself doesn't accumulate permanent dead branches disguised as "temporary" rollout flags.

##### Practical Guardrails

- Every flag gets an explicit test matrix entry when it's created, not retrofitted after the first incident traces back to an untested combination
- Kill-switch flags (the ones meant to disable a feature under incident conditions) get tested in their "off" state on a schedule — a kill switch nobody has verified works is not a safety net
- Flag state is part of the test report, not just pass/fail — when a test fails, knowing which flag combination it ran under is the first debugging step
- Long-lived flags (targeting, entitlements) are tested like permanent configuration; short-lived rollout flags get a removal deadline tracked alongside the code
