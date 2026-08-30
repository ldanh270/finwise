# Finwise authentication and session architecture

Status: Proposed pending product-owner confirmation  
Last updated: 2026-08-30

## 1. Purpose and boundary

This document defines identity login, mobile/web session handling, internal user
provisioning, API authentication, logout, recovery, and account deletion. It
does not move Finwise authorization into the identity provider.

```text
Login method -> Supabase Auth -> provider session/JWT -> NestJS /v1
                                                     -> internal UserId
                                                     -> workspace permissions
                                                     -> Finwise response
```

Boundary rules:

1. Supabase Auth proves an external identity and manages its session.
2. NestJS maps the verified provider subject to an internal `UserId`.
3. Workspace membership, custom roles, account visibility, and financial
   permissions remain Finwise data evaluated by NestJS.
4. Next.js and React Native never use the Supabase Data API for financial data.
5. A valid identity token does not imply access to any workspace or account.
6. Biometric app lock is a local convenience and never replaces a valid server
   token or Nest authorization.

## 2. Identity-provider recommendation

Use Supabase Auth for MVP, subject to product-owner approval.

Reasons:

- the repository already targets PostgreSQL/Supabase infrastructure;
- Supabase supports email OTP, Apple, Google, React Native, and web sessions;
- Nest can verify JWTs and keep all domain authorization provider-neutral;
- the application stores only the stable provider issuer and subject mapping,
  so a later provider migration does not rewrite financial ownership.

Do not make `email` the internal identity key. Store an identity mapping such as:

```text
ExternalIdentity
  providerIssuer
  providerSubject
  userId
  emailSnapshot?
  createdAt
  lastSeenAt
```

The unique key is `(providerIssuer, providerSubject)`. Email is mutable and may
be private/relayed by a social provider.

## 3. First login-method recommendation

### Pilot baseline: email OTP code

Ship a six-digit email OTP flow first:

```text
enter email -> request code -> enter code -> authenticated session
```

Prefer a code-entry screen over a magic-link-only flow because it works across
desktop web and mobile without depending on which device or mail client opens a
link. A deep link may still be offered as a convenience, but code entry remains
the recovery path.

Before a real pilot:

- configure a production custom SMTP provider and authenticated sending domain;
- configure SPF, DKIM, and DMARC;
- use separate authentication and marketing sender identities;
- configure per-email, per-IP, and project rate limits;
- add resend cooldown, generic responses, and abuse monitoring;
- test delayed, duplicated, expired, and already-used codes.

Supabase's built-in email sender is for demonstration and has restrictive
delivery/rate behavior, so it is not a production dependency. See the official
[custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp) and
[Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

### Social login sequencing

Do not add Google alone to the iOS product. If social login enters MVP, implement
Google and Sign in with Apple in the same delivery slice and test identity
linking before launch. Apple's current review rules require an equivalent
privacy-preserving login option when a primary account uses third-party/social
login, subject to documented exceptions. See
[App Review Guideline 4.8](https://developer.apple.com/app-store/review/guidelines/).

Recommended sequence:

1. pilot: email OTP;
2. public mobile launch: Google plus Apple together if user research justifies
   faster social onboarding;
3. password login: add only if a validated audience needs it;
4. phone OTP: defer because of cost, abuse controls, number recycling, and
   country-delivery operations.

## 4. Session state machine

The application owns an explicit session state instead of scattering boolean
checks across routes:

```text
BOOTSTRAPPING
  -> SIGNED_OUT
  -> AUTHENTICATED_UNPROVISIONED
  -> AUTHENTICATED_READY

AUTHENTICATED_READY -> REFRESHING -> AUTHENTICATED_READY
AUTHENTICATED_READY -> LOCAL_LOCKED -> AUTHENTICATED_READY
REFRESHING -> SESSION_EXPIRED -> SIGNED_OUT
```

Meanings:

- `BOOTSTRAPPING`: secure storage and provider session are being restored;
- `SIGNED_OUT`: no usable provider session;
- `AUTHENTICATED_UNPROVISIONED`: provider identity is valid but Nest bootstrap
  has not completed;
- `AUTHENTICATED_READY`: Nest mapped an internal user and returned authorized
  workspace context;
- `REFRESHING`: one refresh operation is active; other requests wait for it;
- `LOCAL_LOCKED`: valid session exists but local biometric/PIN policy hides app
  content;
- `SESSION_EXPIRED`: refresh failed or the provider session was revoked.

Routes must not render protected cached data until bootstrap reaches
`AUTHENTICATED_READY` and the correct user/workspace cache partition is open.

## 5. Nest bootstrap contract

After acquiring a valid provider token, clients call one small authenticated
bootstrap endpoint:

```text
GET /v1/session/bootstrap
```

The endpoint:

1. verifies token signature, issuer, audience, expiry, and subject;
2. finds or safely provisions the internal identity mapping and `User`;
3. updates allowed identity snapshots such as display email without using them
   as ownership keys;
4. returns the internal public user profile;
5. returns active workspace summaries and the last workspace only if still
   authorized;
6. returns server/API compatibility metadata needed for startup;
7. does not return a global permission matrix for every resource.

Example response shape:

```json
{
  "user": {
    "id": "public-user-id",
    "displayName": "Duc An"
  },
  "workspaces": [
    {
      "id": "workspace-id",
      "name": "Personal",
      "intent": "PERSONAL"
    }
  ],
  "suggestedWorkspaceId": "workspace-id",
  "requestId": "request-id"
}
```

Resource permissions are returned with the relevant workspace/resource query or
evaluated by the command endpoint. The bootstrap response is not an
authorization cache that lets clients bypass Nest.

First-user provisioning must be concurrency-safe. Repeated bootstrap calls for
the same `(issuer, subject)` return the same internal user and cannot create
duplicate personal workspaces.

## 6. Token handling and API requests

### React Native

- use `@supabase/supabase-js` behind one auth adapter;
- use an approved asynchronous SecureStore-backed adapter for sensitive session
  material;
- do not place tokens in AsyncStorage, SQLite, TanStack Query, Zustand, Redux,
  logs, analytics, crash breadcrumbs, or route parameters;
- pause automatic refresh while the app is inactive if required by the provider
  SDK and resume it with application lifecycle changes;
- never use biometric-protected storage without a recovery login path because
  biometric enrollment changes may invalidate keys.

Supabase documents an Expo React Native integration with platform storage
adapters in its official
[Expo social-auth guide](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth).
Expo documents platform persistence and invalidation behavior in
[SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

### Next.js

- use the provider's supported server-side cookie integration;
- keep session cookies secure, HTTP-only, same-site, and scoped appropriately;
- server components/loaders pass a verified user token to Nest through an
  internal adapter, not through browser-accessible service credentials;
- state-changing endpoints retain CSRF protection appropriate to the chosen
  cookie/origin model.

### Shared generated API client

The generated client receives a runtime-specific token callback. It does not
import Supabase or SecureStore.

On `401`:

1. allow one single-flight refresh;
2. retry safe reads once after successful refresh;
3. retry a financial command only with its original idempotency key and exact
   request body;
4. never generate a new idempotency key during an authentication retry;
5. if refresh fails, transition to `SESSION_EXPIRED` and preserve local drafts
   until the logout policy is resolved.

On `403`, do not refresh automatically. Reload relevant membership/resource
context and show permission denied; a valid session can still lack authorization.

## 7. Deep links and callback safety

Auth callbacks use environment-specific universal/app links. Follow the official
[Supabase native deep-linking guide](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).

Rules:

- allowlist exact callback hosts/schemes per dev, staging, and production;
- never accept an arbitrary post-login redirect supplied by an untrusted URL;
- store only a validated internal destination before leaving for authentication;
- consume provider callback parameters once and clear transient state;
- after login, navigate only after Nest bootstrap succeeds;
- if the target resource is hidden/deleted/unauthorized, land on a safe screen;
- do not embed tokens or sensitive financial context in analytics events.

## 8. Logout, user switching, and local drafts

Logout is a coordinated workflow, not just clearing a token:

```text
request logout
  -> inspect queued/failed local drafts
  -> sync, export, or explicitly discard
  -> revoke/sign out provider session
  -> clear memory query cache
  -> clear or seal user-partitioned SQLite/cache/files
  -> remove session material
  -> return to signed-out routes
```

Recommended pilot rule: block normal logout while unsynced financial drafts
exist until the user chooses one of:

- sync now;
- export a recovery file and remove local drafts;
- explicitly discard with confirmation.

Do not expose one user's drafts after another user signs in on the same device.
If offline multi-user draft survival is later required, encrypt and seal each
partition with a user-specific recoverable design; do not improvise it in the
first slice.

## 9. Account deletion and identity linking

If clients allow account creation, mobile must expose account deletion. Apple
requires in-app deletion for apps that support account creation.

Deletion is a guarded Finwise use case, not a direct Supabase client delete:

```text
request deletion -> reauthenticate -> inspect ownership/legal blockers
-> transfer/delete/export choices -> schedule deletion -> audit
-> revoke sessions -> delete/anonymize according to retention policy
```

Block or guide deletion when the user is the protected owner of a workspace,
owns unresolved bank custody, or has required audit/financial records. Financial
records may need retained pseudonymous actor references rather than hard-delete.
The exact retention and recovery window require a product/legal decision.

Identity linking is deferred until multiple login methods are enabled. Before
then, do not automatically merge accounts merely because two providers report
the same email address.

## 10. Error contract

Clients handle stable public codes without parsing messages:

| Code | Meaning | Client behavior |
| --- | --- | --- |
| `AUTH_REQUIRED` | No valid token | Refresh once or sign in |
| `SESSION_EXPIRED` | Provider refresh/revocation failed | Preserve drafts, show sign-in |
| `IDENTITY_PROVISIONING_FAILED` | Nest could not map/create user safely | Retry/support with request ID |
| `MEMBERSHIP_REQUIRED` | Valid user lacks workspace membership | Workspace onboarding/switcher |
| `PERMISSION_DENIED` | Capability/resource policy rejected | Denied state, no token refresh |
| `ACCOUNT_DELETION_BLOCKED` | Ownership/retention dependency exists | Show typed blockers |
| `RATE_LIMITED` | Auth/API rate limit reached | Cooldown using safe retry metadata |

Public messages do not reveal whether an arbitrary email is registered.

## 11. Verification matrix

| Scenario | Expected proof |
| --- | --- |
| First OTP login | One internal user and at most one auto-created personal workspace |
| Repeated/concurrent bootstrap | Same `UserId`; no duplicate identity/workspace |
| App process restart | Correct session and user cache partition restored |
| Expired access token | One refresh; safe request replay behavior |
| Revoked refresh token | Drafts preserved; protected cache hidden; sign-in required |
| Valid token, removed membership | `403`/denied state; no refresh loop |
| Deep-link replay | Callback consumed once; safe destination only |
| Biometric enrollment changes | Recovery login remains possible |
| Logout with queued drafts | Explicit sync/export/discard required |
| Different user signs in | Previous user's cache/drafts never rendered |
| Account deletion | Reauthentication, blockers, audit, revocation, retention honored |
| Log/crash inspection | No token, OTP, password, or sensitive financial payload |

## 12. Delivery order

1. Confirm Supabase Auth and email OTP pilot method.
2. Define Nest JWT verification and `ExternalIdentity` mapping.
3. Implement concurrency-safe `/v1/session/bootstrap` with tests.
4. Implement React Native secure session adapter and auth state machine.
5. Implement Next.js session adapter against the same Nest contract.
6. Add custom SMTP, templates, rate limits, and abuse controls.
7. Add logout/draft policy and in-app account deletion before public release.
8. Add Google and Apple together only if approved for the launch scope.

## 13. Decisions requested

1. Approve Supabase Auth for MVP identity.
2. Approve email OTP code as the only pilot login method.
3. Approve custom SMTP as a pilot-release requirement.
4. Approve blocking logout until queued drafts are synced, exported, or
   explicitly discarded.
5. Choose whether a personal workspace is created automatically on first
   bootstrap or through an explicit onboarding step.
6. Define account-deletion retention/recovery requirements.
