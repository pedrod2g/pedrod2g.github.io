---
title: "Playwright and WebDriver BiDi: The Selenium Migration Wave of 2025"
date: 2025-07-15
summary: "This summer marked a tipping point: WebDriver BiDi shipped as a stable, cross-browser standard, and it took away the last real technical argument for staying on classic Selenium. Here's what a pragmatic migration actually looked like..."
tags: [Playwright, WebDriver BiDi, Selenium, Migration]
---
For years, Playwright's pitch to Selenium teams was "faster and more reliable, but you lose the W3C standard." WebDriver BiDi closed that gap — a bidirectional protocol, natively supported in Chrome and Firefox, that gives Playwright-style capabilities (network interception, real console access, fine-grained event streams) without leaving the standards track.

##### Why WebDriver BiDi Mattered in 2025

Classic WebDriver's request/response model couldn't push events to the client — no live console logs, no network events, no way to react mid-test. BiDi's persistent, bidirectional session fixes that at the protocol level:

```typescript
import { chromium } from "playwright";

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

// Native event stream, not polling
page.on("console", (msg) => {
  if (msg.type() === "error") {
    testLogger.captureConsoleError(msg.text());
  }
});

page.on("request", (request) => {
  if (request.resourceType() === "xhr") {
    apiCallLog.push({ url: request.url(), method: request.method() });
  }
});
```

##### Migrating a Selenium Suite to Playwright

The mechanical parts of migration were straightforward — locator strategy translates almost directly:

```java
// Before: Selenium + TestNG
WebElement loginButton = driver.findElement(By.id("login-btn"));
loginButton.click();
wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("dashboard")));
```

```typescript
// After: Playwright
await page.getByTestId("login-btn").click();
await expect(page.getByTestId("dashboard")).toBeVisible();
```

Playwright's built-in auto-waiting removed most of the explicit `WebDriverWait` boilerplate outright — that was the single biggest line-count reduction in the migration, not the assertion syntax.

##### What We Didn't Migrate

- Legacy IE11/older-Safari compatibility suites stayed on Selenium Grid, since Playwright's browser support doesn't reach that far back
- Appium-driven native mobile tests were untouched — BiDi and Playwright are a web-browser story, not a mobile one
- Test data setup and CI orchestration stayed exactly as-is; only the browser-driving layer changed, which kept the migration reviewable in normal-sized PRs instead of one big rewrite
- Flaky-test debt from the old suite didn't get inherited — tests were ported, not rewritten from scratch, so pre-existing flakiness had to be triaged separately
