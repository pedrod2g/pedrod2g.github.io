---
title: "Reducing CI Time: Parallelization and Test Sharding Strategies"
date: 2026-07-20
summary: "A 45-minute CI run doesn't just cost 45 minutes — it costs the context-switch every time someone waits on it, and it costs the temptation to skip tests locally because 'CI will catch it.' Sharding a suite across parallel runners is usually the single highest-leverage change to make it fast again."
tags: [CI/CD, Test Sharding, Parallelization, Developer Experience]
---
The naive fix for slow CI is "buy a faster runner." The actual fix is almost always "run the same tests on more runners at once" — most test suites parallelize far better than they currently do, because the default is one runner running everything sequentially, and nobody's revisited that since the suite was small.

##### Splitting a Suite by Runtime, Not by File Count

Splitting alphabetically or by file count seems fair but isn't — a shard with ten fast unit test files and a shard with two slow integration test files finish at wildly different times. Splitting by historical runtime balances the shards instead:

{% raw %}
```yaml
# .github/workflows/test.yml
name: Test
on: pull_request

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - name: Run tests (shard ${{ matrix.shard }} of 4)
        run: |
          npx jest --shard=${{ matrix.shard }}/4 --ci
```
{% endraw %}

Jest's built-in `--shard` flag distributes test files using its own historical timing data, so shard 1 and shard 4 finish at roughly the same time instead of one straggling behind the rest.

##### Caching What Doesn't Need to Be Rebuilt Every Run

Sharding parallelizes test execution, but dependency installation and build steps running fresh on every shard erases most of the win:

{% raw %}
```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - uses: actions/cache@v4
        with:
          path: .next/cache
          key: build-${{ hashFiles('**/package-lock.json') }}-${{ github.sha }}
          restore-keys: |
            build-${{ hashFiles('**/package-lock.json') }}-
```
{% endraw %}

A cache keyed on the lockfile hash means a PR that only changes test files skips dependency installation entirely across all four shards, not just the first one.

##### Where Parallelization Stops Helping

- Shared test databases or fixtures become the bottleneck once you parallelize — four shards hitting the same non-isolated test database will flake in ways sequential execution never surfaced
- Runner cost scales with shard count; four runners for eight minutes isn't free just because it's faster than one runner for thirty
- Flaky tests get worse, not better, under parallelization — timing-sensitive tests that "usually pass" sequentially often fail more often when resource contention increases
- Past a certain shard count, fixed overhead (checkout, cache restore, environment setup) dominates total time — measure the actual wall-clock improvement per additional shard rather than assuming more is always faster
