---
title: "Computer-Use Agents for Exploratory Testing: Letting AI Click Around Your App"
date: 2025-11-15
summary: "Selector-based automation assumes a well-instrumented DOM. Canvas-rendered dashboards, embedded webviews, and legacy widgets never had that, and never will. Late 2025's answer was computer-use agents that drive the app the way a human does — by looking at the screen..."
tags: [Computer-Use Agents, Exploratory Testing, Browser Automation, AI]
---
Some surfaces were never going to get clean `data-testid` attributes — a canvas-based charting library, a third-party embedded widget you don't control, a legacy Flash-era UI ported into a webview. Teams stopped waiting for those to become automatable in the traditional sense and started pointing vision-driven agents at them instead.

##### When DOM Selectors Aren't an Option

If there's no reliable element tree to query, the only stable interface left is the same one a human uses: pixels on screen and a pointer.

##### Driving an App by Screenshot Instead of Selector

The loop is simple at its core — screenshot, decide, act, repeat — with the model reasoning over the image directly instead of a selector tree:

```python
def exploratory_session(app_url: str, goal: str, max_steps: int = 25):
    session = launch_browser_session(app_url)
    history = []

    for step in range(max_steps):
        screenshot = session.capture_screenshot()

        action = vision_agent.decide_next_action(
            screenshot=screenshot,
            goal=goal,
            history=history,
        )

        if action.type == "done":
            break

        if action.type == "click":
            session.click_at(action.x, action.y)
        elif action.type == "type":
            session.type_text(action.text)

        history.append(action)
        if session.detect_error_state(screenshot):
            report_anomaly(step, screenshot, action)

    return build_exploration_report(history)
```

The agent isn't following a script — it's given a goal ("find and use the export feature") and left to figure out the path, flagging anything that looks like an error state or dead end along the way.

##### Exploratory Coverage Isn't Regression Coverage

- These sessions are exploratory, not deterministic — the same goal can produce a different click path on two runs, which makes them unsuitable as a CI gate on their own
- Findings get triaged into real, selector-based regression tests once a bug or edge case is confirmed; the agent's job is discovery, not long-term maintenance
- Coordinate-based clicking is inherently more brittle to layout changes than DOM selectors — this is a tool for the untestable 10%, not a replacement for the other 90%
- Session recordings (screenshots + actions) are kept alongside the report, since "the agent got stuck" is only debuggable if you can see exactly what it saw
