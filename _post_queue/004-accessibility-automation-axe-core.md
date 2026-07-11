---
title: "Accessibility Automation: Wiring axe-core into Your CI Pipeline"
date: 0000-00-00
summary: "Automated accessibility scanning won't catch everything a screen-reader user would — but it catches the majority of issues that ship purely because no one was checking, and it catches them on every PR instead of during an annual manual audit."
tags: [Accessibility, axe-core, CI/CD, Test Automation]
---
Manual accessibility audits are valuable and automated scanning doesn't replace them — but an annual audit means a missing alt attribute or a contrast ratio violation can live in production for months before anyone notices. axe-core running on every PR catches the mechanical, rule-based violations immediately, leaving manual review for the judgment calls automation can't make.

##### Running axe-core Against a Live Page

```javascript
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');

async function scanPage(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  await browser.close();
  return results.violations;
}
```

##### Gating on Severity, Not Just Presence

Not every violation should block a merge — a minor color-contrast issue on a debug page shouldn't have the same bar as a missing form label on checkout:

```javascript
const CRITICAL_RULES = new Set(['label', 'image-alt', 'button-name', 'color-contrast']);

function assertNoBlockingViolations(violations) {
  const blocking = violations.filter(
    (v) => v.impact === 'critical' || CRITICAL_RULES.has(v.id)
  );

  if (blocking.length > 0) {
    const details = blocking
      .map((v) => `${v.id}: ${v.nodes.length} instance(s) — ${v.help}`)
      .join('\n');
    throw new Error(`Blocking accessibility violations:\n${details}`);
  }
}
```

Non-blocking violations still get reported and tracked — they just don't fail the build, which keeps the gate meaningful instead of something people route around.

##### What Automated Scanning Won't Catch

- Whether alt text is actually descriptive, versus present but meaningless (`alt="image1.png"` passes automated checks and helps no one)
- Logical focus order and keyboard navigation flow through complex interactive components — axe-core checks individual elements, not the experience of tabbing through the page
- Whether a screen reader announces dynamic content changes (toasts, live regions) in a way that's actually useful, not just technically marked up
- These gaps are exactly what periodic manual testing with a real screen reader is for — automation handles the volume, manual testing handles the nuance
