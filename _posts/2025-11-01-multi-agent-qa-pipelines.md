---
title: "Multi-Agent QA Pipelines: Planner, Executor, and Triager Agents in Production"
date: 2025-11-01
summary: "A single agent trying to plan test coverage, execute the run, and triage every failure ends up mediocre at all three. Late-2025 QA orgs started splitting that into specialized agents with narrow jobs, coordinated by a lightweight orchestrator..."
tags: [Multi-Agent Systems, Agentic AI, QA Pipelines, Orchestration]
---
The first generation of "AI QA agents" tried to do everything in one loop: read the diff, decide what to test, run it, and explain the failures. It worked for small suites and fell over on anything real — context got diluted across too many concerns, and failures got explained by whichever heuristic happened to fire first. The fix was organizational, not architectural: split the responsibilities the way you would across a human team.

##### Splitting the Agent Loop into Roles

- **Planner** — reads the diff, decides which test suites and edge cases are relevant, produces a scoped test plan
- **Executor** — runs exactly the plan it's handed, nothing more; no judgment calls, just execution and raw result collection
- **Triager** — takes the raw results and classifies each failure: flaky, known issue, or genuine regression

Each agent gets a narrow, well-specified context window instead of the entire history of the run.

##### Orchestrating Planner, Executor, and Triager Agents

```python
def run_qa_pipeline(diff: str):
    plan = planner_agent.run(
        task="Produce a scoped test plan for this diff",
        context={"diff": diff, "suite_catalog": load_suite_catalog()},
    )

    results = executor_agent.run(
        task="Execute this test plan exactly as specified",
        context={"plan": plan},
    )

    triaged = triager_agent.run(
        task="Classify each failing test",
        context={"results": results.failures, "flake_history": load_flake_history()},
    )

    return build_report(plan, results, triaged)
```

Each agent call is a separate, auditable step — if the triager misclassifies something, you can inspect exactly what context it had, without needing to untangle a single monolithic transcript.

##### Costs of Multi-Agent QA

- Latency and token cost both go up compared to a single-agent loop — three focused calls cost more than one broad one, and that overhead has to be worth it
- Coordination failures are a new failure mode: a planner that scopes too narrowly silently under-tests a change, and nothing downstream catches it
- Small suites and simple diffs don't need this — a single generalist agent is faster and cheaper when the test plan is obvious
- Each agent's prompt and context contract needs its own versioning and eval set; three agents mean three things that can silently regress when a model gets swapped
