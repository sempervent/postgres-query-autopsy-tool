# Deployment: non-auth vs optional auth (Phase 37–38)

The API supports **two coherent deployment modes** (single codebase, configuration-driven). **Phase 38** adds real identity for auth mode: **JWT (HS256)** and **API keys** (hashed in SQLite), while keeping **non-auth** and **legacy** modes.

## Non-auth mode (default)

- **`Auth:Enabled`** is **`false`** (omit the section or set explicitly).
- **`GET /api/analyses/{id}`** and **`GET /api/comparisons/{id}`** behave like **capability URLs**: anyone who knows the opaque id can load the snapshot (same as Phase 36).
- No user identity is required for reads or writes.
- Suitable for local development and small trusted networks.

## Auth-enabled mode

Set **`Auth:Enabled`** to **`true`** and choose **`Auth:Mode`** (case-insensitive):

| Mode | Identity source | Stored owner id |
|------|-------------------|-----------------|
| **`ProxyHeaders`** | Trusted proxy headers (**`X-PQAT-User`**, optional groups) | Header user id |
| **`BearerSubject`** | **Legacy (Phase 37):** `Authorization: Bearer <opaque>` — **entire bearer string** is the user id (no JWT parsing). | Raw bearer string |
| **`JwtBearer`** | **`Authorization: Bearer <JWT>`** — HS256, validated in-process | **`sub`** claim (or **`Auth:Jwt:SubjectClaim`**) |
| **`ApiKey`** | **`X-Api-Key`** (or **`Auth:ApiKey:HeaderName`**) | Stable **`UserId`** from SQLite mapping (key stored as **SHA-256 hash** only) |

### JWT mode (`JwtBearer`)

Configure **`Auth:Jwt`**:

- **`Issuer`**, **`Audience`** — required when mode is `JwtBearer` (startup fails if missing).
- **`SigningKeyBase64`** — symmetric key (recommended; base64, decodes to 32+ bytes for HS256), **or** **`SigningKey`** (UTF-8 secret; dev only).
- **`SubjectClaim`** — default `sub`.
- **`GroupsClaimNames`** — default `groups`, `roles`; values may be comma-separated or a JSON array string in a single claim.

Invalid or expired JWTs → **401** `{ "error": "invalid_token", ... }` when a Bearer token is present. Missing Bearer → no identity (**401** on writes if identity required).

### API key mode (`ApiKey`)

- **`Auth:ApiKey:HeaderName`** — default `X-Api-Key`.
- **`Auth:ApiKey:Seeds`** — optional bootstrap rows (plaintext **`Key`** only in trusted config; stored hashed). Each seed: **`UserId`**, optional **`Groups`**, **`DisplayName`**, **`Enabled`**, **`Description`**.

Unknown key or disabled key → **401** (`invalid_api_key` / `api_key_disabled`).

### Common settings

- **`Auth:RequireIdentityForWrites`** (default **`true`**): **`POST /api/analyze`** and **`POST /api/compare`** require a resolved identity (**401** if missing).
- **`Auth:DefaultAccessScope`**: default **`private`**, **`link`**, **`group`**, or **`public`** for new artifacts.
- **Groups (proxy / legacy bearer):** comma-separated **`X-PQAT-Groups`** (header names: **`Auth:ProxyUserGroupsHeader`**, delimiter **`Auth:GroupsDelimiter`**). User id header defaults to **`X-PQAT-User`** (**`Auth:ProxyUserIdHeader`**).

### Access scopes (persisted on each artifact)

| Scope | Meaning |
|-------|---------|
| `private` | Owner only (+ **manage sharing** via **`PUT …/sharing`**). |
| `group` | Owner plus members of **`sharedGroupIds`** (ids must appear in the viewer’s group list). |
| `public` | Any authenticated user (`Auth:Enabled` + identity on the request). |
| `link` | Opaque URL access when **`allowLinkAccess`** is true (capability-style within auth mode). |

**`PUT /api/analyses/{id}/sharing`** and **`PUT /api/comparisons/{id}/sharing`**: **401** without identity, **403** if not owner, **400** if auth is disabled.

### Legacy rows and migration (honest)

- **Pre–Phase 37** SQLite rows may lack ACL columns; the store backfills safe defaults so old share links often keep working.
- **`BearerSubject` (legacy)** artifacts store **`ownerUserId` = entire raw bearer string**. That is **not** the same namespace as **`JwtBearer`** (`sub`) or **`ApiKey`** (mapped user id). **Switching auth modes** can strand old rows: owners no longer match. Mitigations: widen scope to **link**/**public**, re-create artifacts, or one-off SQL updates (out of scope for the app).

### Rate limiting (optional)

When **`RateLimiting:Enabled`** is **`true`**, a fixed-window limiter applies to **`POST /api/analyze`** and **`POST /api/compare`** (policy **`pqatWrite`**). Configure **`RateLimiting:PermitLimit`** and **`RateLimiting:WindowSeconds`**. **429** with `rate_limit_exceeded` when exceeded.

### Remote backup / export

Not implemented in Phase 38. Operate on the SQLite file (volume snapshot, `sqlite3 .backup`, or file copy when the API is stopped). Documented as a natural next step for production.

### Frontend

- **`GET /api/config`** exposes **`authEnabled`**, **`authMode`**, **`authIdentityKind`** (`none` \| `proxy` \| `legacy_bearer` \| `jwt` \| `api_key`), **`authHelp`** (non-secret summary), **`rateLimitingEnabled`**, and storage path.
- **`VITE_AUTH_BEARER_TOKEN`** — adds **`Authorization: Bearer …`** (JWT or legacy bearer).
- **`VITE_AUTH_API_KEY`** — adds **`X-Api-Key`** (if set, preferred over bearer for browser calls).
- **Phase 55:** When auth is on, the **Sharing & access** panel (Analyze/Compare summary) surfaces **`authHelp`** and browser env hints inside a compact **info** callout; controls use shared **`pqat-*`** inputs/buttons for consistency with the rest of the workstation.

### Reverse proxies, nginx, and auth headers (Phase 53)

The browser talks to the **same origin** as the SPA; the UI’s **`fetch('/api/…')`** must reach the API with credentials intact.

- **`Authorization`** — required for **`JwtBearer`** and legacy bearer modes.
- **`X-Api-Key`** (or whatever **`Auth:ApiKey:HeaderName`** is) — required for **ApiKey** mode when the client sends a key.

**Docker Compose `web` image:** **`nginx.conf`** proxies **`/api/`** to the API. nginx forwards normal client headers to **`proxy_pass`** by default; the repo documents this in **`nginx.conf`** comments. If you insert another reverse proxy (TLS terminator, CDN, corporate gateway), configure it to **forward** **`Authorization`**, **`X-Api-Key`**, and (for **`ProxyHeaders`** mode) **`X-PQAT-User`** / **`X-PQAT-Groups`** — do not strip them.

**Trusted proxy (`ProxyHeaders`)** mode expects the **edge** to authenticate the user and set identity headers before traffic hits the API; the API does not validate a password at the HTTP layer for that mode.

### Environment variables

ASP.NET Core binds nested config: **`Auth__Enabled`**, **`Auth__Mode`**, **`Auth__Jwt__Issuer`**, **`Auth__Jwt__Audience`**, **`Auth__Jwt__SigningKeyBase64`**, **`Auth__ApiKey__HeaderName`**, **`RateLimiting__Enabled`**, etc.

### Automated browser E2E (Phase 52–54)

The stack runs **one** auth mode at a time. Playwright projects and **`.env.testing.*`** files are paired; see **`docs/contributing.md`** and **`scripts/e2e-playwright-docker.sh --help`**.

| Mode | Browser-covered? | Env / mechanism |
|------|------------------|-----------------|
| None (smoke) | Yes | **`.env.testing`**, project **`e2e-smoke`** |
| **ApiKey** | Yes | **`.env.testing.auth`**, **`installApiKeyRoute`** → **`X-Api-Key`** on **`/api/*`** |
| **JwtBearer** | Yes | **`.env.testing.jwt`**, **`installBearerRoute`** → **`Authorization: Bearer`** (HS256 via **`jwtMint.ts`**) |
| **ProxyHeaders** | Yes (Phase 54) | **`.env.testing.proxy`**, **`installProxyHeadersRoute`** → **`X-PQAT-User`** / optional **`X-PQAT-Groups`** on **`/api/*`** (simulates an authenticated edge) |
| **BearerSubject** (legacy) | **No** | Not browser-E2E’d; verify via integration or manual calls. Opaque bearer-as-user-id is easy to confuse with JWT in automation. |

**JWT test secret:** UTF-8 **`pqat-jwt-e2e-sign-secret-key-32b`** → base64 **`cHFhdC1qd3QtZTJlLXNpZ24tc2VjcmV0LWtleS0zMmI=`**; subjects **`PQAT_JWT_SUB_A`** / **`PQAT_JWT_SUB_B`**.

**ProxyHeaders E2E identities:** **`PQAT_PROXY_USER_ID_A`** / **`PQAT_PROXY_USER_ID_B`** (defaults **`e2e-proxy-user-a`** / **`e2e-proxy-user-b`**) — test-only strings, not secrets.

- **Never** ship **`.env.testing.*`** files’ keys to production; they are test-only.
- **`POST /api/e2e/seed/*`** remains gated by **`E2E:Enabled`** ( **`PQAT_E2E_ENABLED`** ), independent of auth mode.

## Trust summary

| Mode | Trust boundary |
|------|----------------|
| Non-auth | Anyone with the id can read; protect network exposure. |
| Auth + proxy headers | **The proxy** must authenticate users and set headers; the API trusts them. |
| Legacy **BearerSubject** | Whoever can present the **same full bearer string** is that user (opaque; not a JWT). |
| **JwtBearer** | Only **valid** JWTs for the configured issuer/audience/key; owner = **subject claim**. |
| **ApiKey** | Whoever has a **valid enabled key** maps to a stable **`UserId`**; keys are not stored in plaintext in SQLite. |

SQLite remains **one file per API instance**; multi-instance deployments need a **shared** database path for consistent ACLs and API key rows.
