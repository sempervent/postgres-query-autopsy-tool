# Auth-mode E2E (Phase 52–54)

Each project expects the **API** to be started with the matching **`.env.testing.*`** (one **`Auth:Mode`** at a time). From repo root, **`./scripts/e2e-playwright-docker.sh --help`** lists Docker entry points; **`--all-auth`** runs API key, JWT, and proxy suites sequentially with teardown between stacks.

## API key (`e2e-auth-api-key`)

Tests in **`../auth-artifact-access.spec.ts`**:

- **Owner** persist + reopen (**`X-Api-Key`** via **`installApiKeyRoute`**).
- **Cross-user** private **Analyze** denial.
- **Group sharing** on **Analyze** (Sharing UI).

Env: **`.env.testing.auth`**. Identities: **`e2e/auth/constants.ts`** / **`PQAT_E2E_API_KEY_*`**.

## JWT bearer (`e2e-auth-jwt`)

Tests in **`../jwt-auth-smoke.spec.ts`**:

- **Analyze** + **Compare** owner reopen.
- **Compare** private artifact denied to another **`sub`**.
- **Compare Copy link** (clipboard capture): URL + **`PQAT compare:`** + **`Pair ref:`** under JWT (**Phase 90**).

**`jwtMint.ts`** (HS256), **`installBearerRoute`** → **`Authorization: Bearer`**. Env: **`.env.testing.jwt`**.

## Trusted proxy headers (`e2e-auth-proxy`)

Tests in **`../proxy-auth-smoke.spec.ts`**:

- **Analyze** owner persist + reopen with **`X-PQAT-User`** (and optional **`X-PQAT-Groups`**) on **`/api/*`**, via **`installProxyHeadersRoute`** — same “edge injected identity” shape as production **ProxyHeaders** mode.

Env: **`.env.testing.proxy`** (**`PQAT_AUTH_MODE=ProxyHeaders`**). Principals: **`PQAT_PROXY_USER_ID_A`**, **`PQAT_PROXY_USER_ID_B`** (see **`proxyHeadersConfig.ts`**).

## Not browser-covered

- **`BearerSubject`** (legacy opaque bearer = user id): intentionally **not** in Playwright; document in **`docs/deployment-auth.md`**.

## Run

```bash
./scripts/e2e-playwright-docker.sh --auth
./scripts/e2e-playwright-docker.sh --jwt
./scripts/e2e-playwright-docker.sh --proxy
./scripts/e2e-playwright-docker.sh --all-auth
```

See **`docs/contributing.md`** and **`docs/deployment-auth.md`** for CI mapping and nginx / reverse-proxy header forwarding.
