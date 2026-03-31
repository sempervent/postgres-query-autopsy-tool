# Fixtures & Sample SQL

Fixtures live under backend unit tests and are used to validate parsing, metrics, findings, and compare behavior.

## Why `.sql` companions exist

Execution plans are hard to reason about without a “query-shaped” anchor.

For many fixtures we provide a sibling `.sql` file that is **illustrative**:

- It is intended to plausibly produce a similar plan shape/operator pattern.
- It is not guaranteed to reproduce the fixture exactly unless explicitly noted.

## Conventions

### Single-plan fixtures

Directory: `tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/fixtures/postgres-json/`

Convention:

- `foo.json` ↔ `foo.sql`

### Comparison fixtures

Directory: `tests/backend.unit/PostgresQueryAutopsyTool.Tests.Unit/fixtures/comparison/<name>/`

Convention:

- `planA.json` ↔ `planA.sql`
- `planB.json` ↔ `planB.sql`

## Adding a new fixture

1. Add the `.json` plan.
2. Add a sibling `.sql` query that matches relation names where possible.
3. If it’s illustrative, say so at the top of the SQL file.
4. Ensure fixture hygiene checks pass (CI will fail if required companions are missing).

