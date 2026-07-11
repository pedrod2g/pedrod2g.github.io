---
title: "Self-Healing Test Automation: How LLM Agents Are Cutting Flaky Test Maintenance in Half"
date: 2025-06-15
summary: "Brittle locators have always been the single biggest source of test maintenance overhead. Mid-2025 saw a real shift: teams wiring LLM agents directly into their Selenium and Playwright suites to auto-repair broken selectors instead of paging an engineer..."
tags: [AI Agents, Self-Healing Tests, LLM, Test Maintenance]
---
Locator drift is the quiet tax on every automation suite — a `data-testid` gets renamed, a div gets wrapped in a new component, and a perfectly good test starts failing for reasons that have nothing to do with the feature it covers. This year, the fix stopped being "add more `try/catch` fallback selectors" and started being "let a model figure it out."

##### From Brittle Locators to Self-Healing Selectors

The core idea: when a locator fails, snapshot the DOM, hand it to an LLM along with the element's last-known attributes, and ask for the closest match instead of failing the run outright.

```python
from dataclasses import dataclass
from playwright.sync_api import Page

@dataclass
class LocatorMemory:
    role: str
    accessible_name: str
    last_selector: str

def heal_locator(page: Page, memory: LocatorMemory) -> str:
    dom_snapshot = page.content()

    suggestion = llm_client.complete(
        prompt=f"""
        The selector '{memory.last_selector}' no longer matches any element.
        Given this DOM, suggest the most likely CSS selector for an
        element with role='{memory.role}' and accessible name
        '{memory.accessible_name}'. Return only the selector.
        """,
        context=dom_snapshot,
    )

    return suggestion.strip()
```

##### Wiring a Healing Layer into Playwright

Rather than scattering fallback logic across every test, teams wrapped locator resolution in a single healing layer that only engages when the primary selector fails:

```typescript
async function resolve(page: Page, testId: string, fallback: LocatorMemory) {
  const primary = page.locator(`[data-testid="${testId}"]`);

  if (await primary.count() > 0) {
    return primary;
  }

  const healedSelector = await healLocator(page, fallback);
  logHealingEvent(testId, healedSelector);

  return page.locator(healedSelector);
}
```

Every healing event gets logged, not silently swallowed — the point isn't to hide breakage, it's to keep the suite green while surfacing a diff for a human to confirm.

##### Guardrails: When Not to Trust the Model

Teams that shipped this well treated the model as a suggestion engine, not an oracle:

- Healed selectors run once, get logged with a diff, and require a human approval before they're promoted into the test source
- A confidence threshold below which the test still fails loudly rather than healing silently
- Healing is disabled entirely on critical-path smoke tests, where a false-positive pass is worse than a flaky failure
- Weekly review of the healing log to catch selectors that keep drifting — that's usually a sign of a real UI regression, not test fragility
