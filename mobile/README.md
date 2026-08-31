# Finwise mobile

This is the Expo Router TypeScript app for the post-web MVP mobile slice. It
uses development builds and Expo Prebuild/CNG; Expo Go is not the verification
runtime for native dependencies.

The checked-in slice is provider-neutral: `src/sync/outbox.ts` defines the
offline manual income/expense state machine and stable idempotency key,
`src/sync/online-sync.ts` adapts the generated client shape, and
`src/sync/outbox-persistence.ts` validates process-restart snapshots. The
`src/session/cache-partition.ts` helper isolates cached data by user and
workspace. SQLite, SecureStore wiring, generated API-client screens, and device
builds are follow-up adapters around these contracts.

## Local workflow

```text
pnpm --filter mobile install
pnpm --filter mobile prebuild
pnpm --filter mobile android   # or ios on macOS
```

Never place Supabase access/refresh tokens in AsyncStorage, SQLite, query
caches, route params, logs, or crash breadcrumbs. Offline drafts must be
explicitly synced, exported, or discarded before logout.
