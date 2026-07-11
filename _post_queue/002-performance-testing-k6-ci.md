---
title: "Performance Testing as Code: Load Testing with k6 in CI"
date: 0000-00-00
summary: "Performance testing used to mean a specialist with a separate tool running load tests by hand before a big launch. Treating load tests as code that lives in the repo and runs in CI catches regressions the same week they're introduced, not the week before launch."
tags: [Performance Testing, k6, Load Testing, CI/CD]
---
A performance regression introduced in March and caught in a pre-launch load test in November is a much more expensive bug than the same regression caught by a CI check the day it landed. k6 scripts are just JavaScript, which means load tests can live in the same repo, get reviewed in the same PRs, and run on the same schedule as everything else.

##### Writing a Load Test as Code

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('https://staging.example.com/api/products');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has products': (r) => JSON.parse(r.body).products.length > 0,
  });
  sleep(1);
}
```

The `thresholds` block is the important part — it turns a load test into a pass/fail CI gate instead of a chart someone has to interpret manually.

##### Running It as a Required Check

```yaml
# .github/workflows/load-test.yml
name: Load Test
on:
  pull_request:
    paths: ['api/**']

jobs:
  k6-load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run k6 load test
        uses: grafana/k6-action@v0.3.1
        with:
          filename: perf/products-endpoint.js
```

Scoping it to `paths: ['api/**']` keeps it from running on every unrelated PR — it only fires when the code that could actually affect performance changes.

##### Keeping Load Tests Honest

- Run against a staging environment sized proportionally to production, not a full-scale replica — thresholds should be calibrated to that environment, not copy-pasted from a different one
- Track p95/p99 latency over time, not just pass/fail — a test that stays green while p95 creeps up every week is hiding a slow regression
- Seed test data deterministically; a load test against an empty database tells you nothing about how queries behave at realistic data volumes
- Keep the steady-state stage long enough to surface issues like connection pool exhaustion or memory growth that only show up after sustained load, not just a traffic spike
