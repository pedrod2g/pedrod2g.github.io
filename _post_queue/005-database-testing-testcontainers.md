---
title: "Database Testing with Testcontainers: Real Databases, Disposable State"
date: 0000-00-00
summary: "Mocking the database layer means your tests never exercise real SQL, real constraints, or real transaction behavior. Testcontainers makes running an actual, disposable Postgres instance in CI cheap enough that there's no longer a good reason to fake it."
tags: [Testcontainers, Database Testing, Integration Testing, Java]
---
A mocked repository layer proves your code calls the right method with the right arguments. It proves nothing about whether the SQL that method generates actually runs, whether a unique constraint fires when it should, or whether a migration you wrote yesterday is compatible with the schema in production. Testing against a real, ephemeral database closes that gap without the cost of a shared test environment.

##### Spinning Up a Real Database Per Test Class

```java
@Testcontainers
class OrderRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
        .withDatabaseName("orders_test")
        .withUsername("test")
        .withPassword("test");

    @DynamicPropertySource
    static void configureDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Test
    void savingDuplicateOrderNumberViolatesUniqueConstraint() {
        orderRepository.save(new Order("ORD-001", 99.99));

        assertThrows(DataIntegrityViolationException.class, () ->
            orderRepository.save(new Order("ORD-001", 149.99))
        );
    }
}
```

That test is only possible against a real database — a mock would happily accept the duplicate insert because it has no idea a unique constraint exists.

##### Testing Migrations Against Real State

The same container pattern verifies a migration doesn't break on data that already exists, not just on an empty schema:

```java
@Test
void migrationHandlesExistingNullEmailRows() {
    jdbcTemplate.execute(
        "INSERT INTO users (id, email) VALUES (1, NULL)"
    );

    flyway.migrate(); // applies V12__make_email_not_null.sql

    List<Map<String, Object>> users = jdbcTemplate.queryForList(
        "SELECT email FROM users WHERE id = 1"
    );
    assertEquals("unknown@example.com", users.get(0).get("email"));
}
```

Running this against an empty schema would never have caught that the migration needed a backfill step for existing null rows — the bug only exists when there's real state to migrate.

##### Keeping the Suite Fast

- Reuse a single container across a test class rather than spinning one up per test method; startup time dominates if you don't
- Wipe and reseed data between tests instead of restarting the container — `TRUNCATE ... CASCADE` between tests is far cheaper than a fresh container boot
- Run these as a distinct "integration" suite from fast unit tests, so a slow database spin-up doesn't sit in the feedback loop for every trivial change
- Pin the container image version explicitly (`postgres:16`, not `postgres:latest`) — a database testing suite that silently changes behavior on a base image update is its own source of flakiness
