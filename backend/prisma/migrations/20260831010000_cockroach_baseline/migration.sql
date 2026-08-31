-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "finwise";

-- CreateEnum
CREATE TYPE "finwise"."WorkspaceKind" AS ENUM ('personal', 'family', 'class_fund', 'other');

-- CreateEnum
CREATE TYPE "finwise"."WorkspaceStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "finwise"."MembershipStatus" AS ENUM ('invited', 'active', 'removed');

-- CreateEnum
CREATE TYPE "finwise"."AccountKind" AS ENUM ('cash', 'bank', 'savings', 'investment_cash', 'loan_receivable', 'liability', 'system');

-- CreateEnum
CREATE TYPE "finwise"."AccountStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "finwise"."AccountVisibilityMode" AS ENUM ('workspace_default', 'exclude_selected', 'include_only', 'owner_only');

-- CreateEnum
CREATE TYPE "finwise"."JournalKind" AS ENUM ('opening_balance', 'income', 'expense', 'transfer', 'adjustment');

-- CreateEnum
CREATE TYPE "finwise"."JournalStatus" AS ENUM ('posted', 'voided');

-- CreateEnum
CREATE TYPE "finwise"."EntryDirection" AS ENUM ('increase', 'decrease');

-- CreateEnum
CREATE TYPE "finwise"."TransactionAuditAction" AS ENUM ('created', 'voided', 'replaced');

-- CreateEnum
CREATE TYPE "finwise"."UserStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "finwise"."AuthRefreshSessionStatus" AS ENUM ('active', 'rotated', 'revoked');

-- CreateTable
CREATE TABLE "finwise"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "display_name" STRING,
    "email_snapshot" STRING,
    "normalized_email" STRING,
    "password_hash" STRING,
    "status" "finwise"."UserStatus" NOT NULL DEFAULT 'active',
    "failed_login_count" INT4 NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "user_agent" STRING,
    "ip_hash" CHAR(64),

    CONSTRAINT "auth_refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finwise"."external_identities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider_issuer" STRING NOT NULL,
    "provider_subject" STRING NOT NULL,
    "email_snapshot" STRING,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finwise"."workspaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" STRING NOT NULL,
    "kind" "finwise"."WorkspaceKind" NOT NULL DEFAULT 'personal',
    "default_currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "timezone" STRING NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "status" "finwise"."WorkspaceStatus" NOT NULL DEFAULT 'active',
    "archived_at" TIMESTAMPTZ(6),
    "owner_membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finwise"."workspace_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "finwise"."MembershipStatus" NOT NULL DEFAULT 'active',
    "is_owner" BOOL NOT NULL DEFAULT false,
    "joined_at" TIMESTAMPTZ(6),
    "removed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finwise"."roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" STRING NOT NULL,
    "protected" BOOL NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finwise"."role_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finwise"."role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "permission" STRING NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finwise"."financial_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" STRING NOT NULL,
    "kind" "finwise"."AccountKind" NOT NULL,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'VND',
    "status" "finwise"."AccountStatus" NOT NULL DEFAULT 'active',
    "visibility_mode" "finwise"."AccountVisibilityMode" NOT NULL DEFAULT 'workspace_default',
    "is_system" BOOL NOT NULL DEFAULT false,
    "balance_minor" INT8 NOT NULL DEFAULT 0,
    "created_by_member_id" UUID NOT NULL,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finwise"."account_member_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "allowed" BOOL NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_member_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finwise"."journal_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "kind" "finwise"."JournalKind" NOT NULL,
    "status" "finwise"."JournalStatus" NOT NULL DEFAULT 'posted',
    "amount_minor" INT8 NOT NULL,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'VND',
    "effective_date" DATE NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" STRING,
    "created_by_member_id" UUID NOT NULL,
    "reversal_of_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finwise"."journal_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "amount_minor" INT8 NOT NULL,
    "direction" "finwise"."EntryDirection" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finwise"."transaction_audits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "actor_member_id" UUID NOT NULL,
    "action" "finwise"."TransactionAuditAction" NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finwise"."idempotency_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "key" STRING NOT NULL,
    "operation" STRING NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response" JSONB NOT NULL,
    "transaction_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_email_key" ON "finwise"."users"("normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_refresh_sessions_token_hash_key" ON "finwise"."auth_refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_refresh_sessions_user_id_status_idx" ON "finwise"."auth_refresh_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "auth_refresh_sessions_family_id_status_idx" ON "finwise"."auth_refresh_sessions"("family_id", "status");

-- CreateIndex
CREATE INDEX "external_identities_user_id_idx" ON "finwise"."external_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_provider_issuer_provider_subject_key" ON "finwise"."external_identities"("provider_issuer", "provider_subject");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_owner_membership_id_key" ON "finwise"."workspaces"("owner_membership_id");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_status_idx" ON "finwise"."workspace_members"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "finwise"."workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_workspace_id_name_key" ON "finwise"."roles"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_member_id_role_id_key" ON "finwise"."role_assignments"("member_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_key" ON "finwise"."role_permissions"("role_id", "permission");

-- CreateIndex
CREATE INDEX "financial_accounts_workspace_id_status_is_system_idx" ON "finwise"."financial_accounts"("workspace_id", "status", "is_system");

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_workspace_id_id_key" ON "finwise"."financial_accounts"("workspace_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "account_member_access_account_id_member_id_key" ON "finwise"."account_member_access"("account_id", "member_id");

-- CreateIndex
CREATE INDEX "journal_transactions_workspace_id_effective_date_idx" ON "finwise"."journal_transactions"("workspace_id", "effective_date" DESC);

-- CreateIndex
CREATE INDEX "journal_transactions_workspace_id_status_idx" ON "finwise"."journal_transactions"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "journal_transactions_workspace_id_id_key" ON "finwise"."journal_transactions"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "journal_entries_account_id_created_at_idx" ON "finwise"."journal_entries"("account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_transaction_id_account_id_direction_key" ON "finwise"."journal_entries"("transaction_id", "account_id", "direction");

-- CreateIndex
CREATE INDEX "transaction_audits_workspace_id_transaction_id_created_at_idx" ON "finwise"."transaction_audits"("workspace_id", "transaction_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_workspace_id_key_key" ON "finwise"."idempotency_keys"("workspace_id", "key");

-- AddForeignKey
ALTER TABLE "finwise"."auth_refresh_sessions" ADD CONSTRAINT "auth_refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "finwise"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."external_identities" ADD CONSTRAINT "external_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "finwise"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."workspaces" ADD CONSTRAINT "workspaces_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "finwise"."workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "finwise"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."roles" ADD CONSTRAINT "roles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."role_assignments" ADD CONSTRAINT "role_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "finwise"."workspace_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."role_assignments" ADD CONSTRAINT "role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "finwise"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "finwise"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."financial_accounts" ADD CONSTRAINT "financial_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."financial_accounts" ADD CONSTRAINT "financial_accounts_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "finwise"."workspace_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."account_member_access" ADD CONSTRAINT "account_member_access_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finwise"."financial_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."account_member_access" ADD CONSTRAINT "account_member_access_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "finwise"."workspace_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."journal_transactions" ADD CONSTRAINT "journal_transactions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."journal_transactions" ADD CONSTRAINT "journal_transactions_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "finwise"."workspace_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."journal_transactions" ADD CONSTRAINT "journal_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "finwise"."journal_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."journal_entries" ADD CONSTRAINT "journal_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "finwise"."journal_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."journal_entries" ADD CONSTRAINT "journal_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finwise"."financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."transaction_audits" ADD CONSTRAINT "transaction_audits_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."transaction_audits" ADD CONSTRAINT "transaction_audits_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "finwise"."journal_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."transaction_audits" ADD CONSTRAINT "transaction_audits_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "finwise"."workspace_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."idempotency_keys" ADD CONSTRAINT "idempotency_keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finwise"."idempotency_keys" ADD CONSTRAINT "idempotency_keys_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "finwise"."journal_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
