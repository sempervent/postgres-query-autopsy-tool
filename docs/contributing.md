# Contributing

## Repo layout

- `src/backend/` .NET 8 API + core analysis engine
- `src/frontend/web/` React + TypeScript UI
- `tests/backend.unit/` xUnit tests + fixtures
- `docs/` documentation source (MkDocs)

## Development workflow

### Tests

```bash
make test
```

### Docs

Install:

```bash
python -m venv .venv-docs
source .venv-docs/bin/activate
pip install -r requirements-docs.txt
```

`requirements-docs.txt` pins **MkDocs** and the **mermaid2** plugin (diagrams on Architecture). Use this venv for `mkdocs serve` / `mkdocs build` so local builds match CI.

Serve:

```bash
mkdocs serve
```

Build:

```bash
mkdocs build --strict
```

## Adding a fixture

- Add the plan JSON under the appropriate fixture directory.
- Add a sibling `.sql` file (illustrative is fine; be honest).
- Run tests; fixture hygiene checks will enforce required companions.

## Adding a finding rule

- Add a rule under `src/backend/PostgresQueryAutopsyTool.Core/Findings/Rules/`
- Add unit tests that prove the rule triggers and that evidence is bounded.
- Update the findings catalog docs page.

