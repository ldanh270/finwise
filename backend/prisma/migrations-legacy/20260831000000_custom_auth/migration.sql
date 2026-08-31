-- Custom Finwise authentication is additive. Existing users and external
-- identity rows remain intact; the application backfills credentials lazily.
CREATE TYPE "finwise"."UserStatus" AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE "finwise"."AuthRefreshSessionStatus" AS ENUM ('active', 'rotated', 'revoked');

ALTER TABLE "finwise"."users"
  ADD COLUMN IF NOT EXISTS "email_snapshot" TEXT,
  ADD COLUMN "normalized_email" TEXT,
  ADD COLUMN "password_hash" TEXT,
  ADD COLUMN "status" "finwise"."UserStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMPTZ(6),
  ADD COLUMN "last_login_at" TIMESTAMPTZ(6);

-- The repository's original draft used `email`; preserve it when present so
-- the current User mapping remains readable during the additive transition.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'finwise' AND table_name = 'users' AND column_name = 'email'
  ) THEN
    UPDATE "finwise"."users"
    SET "email_snapshot" = COALESCE("email_snapshot", "email")
    WHERE "email_snapshot" IS NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'finwise' AND table_name = 'users' AND column_name = 'email'
  ) THEN
    ALTER TABLE "finwise"."users" ALTER COLUMN "email" DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'finwise' AND table_name = 'users' AND column_name = 'external_auth_user_id'
  ) THEN
    ALTER TABLE "finwise"."users" ALTER COLUMN "external_auth_user_id" DROP NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX "users_normalized_email_key"
  ON "finwise"."users" ("normalized_email");

CREATE TABLE "finwise"."auth_refresh_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "parent_id" UUID,
  "replaced_by_id" UUID,
  "status" "finwise"."AuthRefreshSessionStatus" NOT NULL DEFAULT 'active',
  "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "last_used_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "user_agent" TEXT,
  "ip_hash" CHAR(64),
  CONSTRAINT "auth_refresh_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_refresh_sessions_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "auth_refresh_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "finwise"."users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "auth_refresh_sessions_user_id_status_idx"
  ON "finwise"."auth_refresh_sessions" ("user_id", "status");
CREATE INDEX "auth_refresh_sessions_family_id_status_idx"
  ON "finwise"."auth_refresh_sessions" ("family_id", "status");
