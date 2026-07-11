---
title: "Contract Testing with Pact: Catching Breaking API Changes Before Deploy"
date: 2026-07-11
summary: "Integration tests that spin up every downstream service catch real bugs, but they're slow and fragile. Consumer-driven contract testing catches the same class of breakage — without ever running the provider's code in your CI pipeline."
tags: [Contract Testing, Pact, API Testing, CI/CD]
---
The classic integration test problem: to verify your service talks correctly to a downstream API, you either mock that API (and drift out of sync with reality) or stand up the real thing in CI (and inherit its flakiness, startup time, and test data). Consumer-driven contract testing sidesteps both by making the contract itself the artifact under test.

##### How a Consumer Defines the Contract

The consumer writes a test against a mock provider, and that interaction gets recorded as a contract file:

```javascript
const { PactV3 } = require('@pact-foundation/pact');

const provider = new PactV3({ consumer: 'OrderService', provider: 'InventoryService' });

describe('Inventory contract', () => {
  it('returns stock level for a known SKU', () => {
    provider
      .given('SKU ABC123 has stock')
      .uponReceiving('a request for stock level')
      .withRequest({ method: 'GET', path: '/stock/ABC123' })
      .willRespondWith({
        status: 200,
        body: { sku: 'ABC123', quantity: 42 },
      });

    return provider.executeTest(async (mockServer) => {
      const stock = await getStockLevel(mockServer.url, 'ABC123');
      expect(stock.quantity).toBe(42);
    });
  });
});
```

##### Verifying the Provider Actually Honors It

The provider side runs the same contract against its real implementation — no consumer code involved, just the recorded interactions:

```javascript
const { Verifier } = require('@pact-foundation/pact');

new Verifier({
  provider: 'InventoryService',
  providerBaseUrl: 'http://localhost:8080',
  pactUrls: ['./pacts/orderservice-inventoryservice.json'],
  stateHandlers: {
    'SKU ABC123 has stock': () => seedStock('ABC123', 42),
  },
}).verifyProvider();
```

If the provider ever changes the response shape in a way that breaks the contract, this step fails in the provider's own CI pipeline — before the change ships, not after the consumer's tests mysteriously start failing in production.

##### Where This Fits Alongside Other Tests

- Contract tests replace the narrow slice of integration tests that exist purely to check "did the shape of this API change," not full end-to-end coverage
- A broker (Pact Broker or an equivalent) tracks which provider versions satisfy which consumer contracts, so a provider can query "is it safe to deploy this version" before releasing
- Contract tests are fast and hermetic — no shared test environment, no network flakiness, which makes them a much better CI citizen than cross-service integration suites
- They don't replace end-to-end tests entirely; a handful of true end-to-end smoke tests still catch issues contracts can't, like auth or infra-level failures
