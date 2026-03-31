# Getting Started

## Prerequisites

- .NET 8 SDK
- Node 20+
- Docker Desktop (optional, for `docker compose`)
- Python 3.11+ (for docs)

## Run with Docker

```bash
make up
```

- Web: `http://localhost:3000`
- API: `http://localhost:3000/api/health`

## Run backend + frontend in dev mode

Backend:

```bash
cd src/backend/PostgresQueryAutopsyTool.Api
dotnet run
```

Frontend:

```bash
cd src/frontend/web
npm ci
npm run dev
```

## Run tests

```bash
make test
```

## Build and serve docs locally

```bash
python -m venv .venv-docs
source .venv-docs/bin/activate
pip install -r requirements-docs.txt
mkdocs serve
```
