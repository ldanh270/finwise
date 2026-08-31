# Finwise custom authentication and session architecture

Status: Confirmed for PostgreSQL deployment
Last updated: 2026-08-31

## Boundary and decisions

Finwise owns authentication credentials and sessions. PostgreSQL is the system
of record; NestJS is the only service allowed to read or mutate auth data.
There is no Supabase Auth dependency and no provider-managed identity session.

```text
email/password -> Nest AuthController -> PostgreSQL User
               -> rotated opaque refresh cookie + signed RS256 access JWT
               -> Nest guards -> workspace policy -> domain use case
```

- Passwords use Node `scrypt` with a per-password random salt; plaintext is
  never stored or logged.
- Access tokens are RS256 JWTs with `iss`, `aud`, `sub`, `sid`, `jti`, `iat`,
  `exp`, `kid`, and `typ=access`. The private key signs; only the public key
  verifies. Production keys are supplied as base64 DER values and rotated by
  changing `kid` with a controlled overlap window.
- Refresh tokens are 256-bit opaque values. Only SHA-256 hashes are stored.
  Every refresh atomically marks the old session `rotated` and creates a new
  child. Reuse of a rotated/revoked token revokes its complete family.
- Web uses an HTTP-only, `SameSite=Lax`, secure-in-production cookie. API
  calls use `Authorization: Bearer <access-jwt>`. React Native will use the
  same contract with SecureStore in Phase 8.
- Custom workspace authorization remains in NestJS. A valid JWT proves a user,
  not membership, account visibility, or permission.

## Public API

| Endpoint | Contract | Notes |
| --- | --- | --- |
| `POST /v1/auth/register` | `{email,password,displayName?}` → `{accessToken,accessTokenExpiresAt,user}` | Creates credentials and a refresh family. |
| `POST /v1/auth/login` | `{email,password}` → same session response | Generic invalid-credential response; five failures lock for 15 minutes. |
| `POST /v1/auth/refresh` | cookie → same session response | Single-use rotation; replay revokes family. |
| `POST /v1/auth/logout` | cookie → `204` | Revokes only the presented session. |
| `GET /v1/auth/session` | cookie → `{user:null|user}` | Server-rendering check; never returns a token. |
| `GET /v1/session/bootstrap` | Bearer access JWT → workspace bootstrap | Existing workspace boundary and custom RBAC remain unchanged. |

All errors use the existing envelope `{code,message,details?,requestId}`. Auth
codes include `AUTH_REQUIRED`, `SESSION_EXPIRED`,
`AUTH_INVALID_CREDENTIALS`, `AUTH_ACCOUNT_LOCKED`, and
`AUTH_CONFIGURATION`. Messages do not disclose whether an arbitrary email is
registered.

## Request and session lifecycle

```text
register/login
  -> normalize email and validate password
  -> create/update User
  -> create refresh session (active)
  -> return access JWT; set refresh cookie

access request
  -> RS256 signature + kid + issuer + audience + expiry validation
  -> actor{sub=userId}
  -> membership/policy checks in the requested workspace

refresh
  -> hash cookie -> find session
  -> active and unexpired? atomically rotate and issue child
  -> rotated/revoked/replayed? revoke family and require login

logout
  -> hash cookie -> revoke presented session -> clear cookie
```

The browser keeps the access token only in module memory. A single-flight
refresh request prevents concurrent page queries from racing. It is not written
to localStorage, sessionStorage, cookies, query caches, logs, or analytics.

## Persistence model and migration

`finwise.users` gains nullable `normalized_email` (unique), `password_hash`,
`status`, lockout counters, and `last_login_at`. Existing `ExternalIdentity`
rows are preserved for historical/provider-linked users. New
`finwise.auth_refresh_sessions` stores family/parent/replacement links, token
hash, status, expiry, timestamps, and redacted request metadata.

Migration `20260831000000_custom_auth` is additive and forward-only. Before
deployment, run Phase 0 database preflight. Do not apply it to an unknown old
schema or delete the existing initial migration. Rollback is an application
rollback (disable custom auth routes, revoke sessions, restore the previous
image); columns and session rows remain for audit and safe re-deploy. A future
cleanup migration may remove unused provider columns only after an explicit data
retention review.

## Security controls

- Production startup requires `DATABASE_URL`, RSA private/public key material,
  JWT issuer, and audience. Missing or malformed key material fails closed.
- Password length is 12–128 characters; email is normalized before lookup.
- Login failures are counted server-side and lock the account after five
  failures. Rate limiting and abuse telemetry remain release hardening work.
- Cookies are scoped to `/`, `HttpOnly`, `SameSite=Lax`, and `Secure` in
  production. CORS allows only configured frontend origins with credentials.
- Request IDs are returned in the error envelope. Passwords, tokens, key
  material, and raw auth payloads are not logged.
- Dev `x-finwise-user-id` and `Bearer dev:<id>` shortcuts are available only
  when `FINWISE_DEV_AUTH` is not `false` and `NODE_ENV` is not production; CI
  uses them to exercise protected domain slices without a database.

## Client behavior

Next.js middleware only performs the cheap cookie-presence redirect. The server
page validates the cookie against `GET /v1/auth/session`, so stale cookies do
not grant access. The `/auth` page supports sign-in and account creation and
redirects to the dashboard only after a successful API response. Sign-out calls
the revoke endpoint and clears memory state.

The generated API client receives a token callback. Safe reads may retry once
after a single-flight refresh; financial commands keep the original body and
`Idempotency-Key`, and are never replayed with a new key. A `403` never triggers
refresh.

## Verification matrix

| Scenario | Expected proof |
| --- | --- |
| Password hash | Different salts; wrong password fails; timing-safe comparison. |
| JWT | Invalid signature, `kid`, issuer, audience, future `iat`, and expiry fail. |
| Registration race | Unique normalized email yields one account. |
| Refresh race | One child wins; replay revokes the family; no duplicate child. |
| Logout | Presented session is revoked; sibling device remains active. |
| Tenant boundary | Valid JWT without membership is `403`; no cross-workspace lookup. |
| Web | Login/register, protected redirect, stale-cookie denial, refresh, logout. |
| Secrets | Test logs and error bodies contain no password, token, or key material. |

## Delivery and follow-up

This slice replaces the previous Supabase/OTP proposal with custom
email/password JWT sessions. Workspace persistence, invitation email delivery,
password reset, MFA, login rate-limit middleware, key-overlap rotation tooling,
and account deletion/retention remain explicit follow-up slices. They must not
reintroduce a provider SDK into domain or application code.
