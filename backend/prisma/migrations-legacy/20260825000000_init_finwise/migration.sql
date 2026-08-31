CREATE EXTENSION IF NOT EXISTS pgcrypto;
 
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "finwise";
 
-- CreateEnum
CREATE TYPE "finwise"."WorkspaceMemberRole" AS ENUM ('owner', 'admin', 'member', 'viewer');
 
-- CreateEnum
CREATE TYPE "finwise"."WorkspaceMemberStatus" AS ENUM ('invited', 'active', 'removed');
 
-- CreateEnum
CREATE TYPE "finwise"."CategoryType" AS ENUM ('income', 'expense');
 
-- CreateEnum
CREATE TYPE "finwise"."TransactionType" AS ENUM ('income', 'expense', 'transfer', 'adjustment');
 
-- CreateEnum
CREATE TYPE "finwise"."AdjustmentType" AS ENUM ('opening_balance');
 
-- CreateEnum
CREATE TYPE "finwise"."TransactionStatus" AS ENUM ('posted', 'voided');
 
-- CreateEnum
CREATE TYPE "finwise"."TransactionAuditAction" AS ENUM ('created', 'updated', 'voided', 'restored');
 
-- CreateEnum
CREATE TYPE "finwise"."BankConnectionStatus" AS ENUM ('active', 'disconnected', 'error');
 
-- CreateEnum
CREATE TYPE "finwise"."BankSyncRunStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');
 
-- CreateTable
CREATE TABLE "finwise"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_auth_user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
 
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE "finwise"."workspaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
 
    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE "finwise"."workspace_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "finwise"."WorkspaceMemberRole" NOT NULL,
    "status" "finwise"."WorkspaceMemberStatus" NOT NULL,
    "invited_by" UUID,
    "invited_at" TIMESTAMPTZ(6),
    "joined_at" TIMESTAMPTZ(6),
    "removed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
 
    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE "finwise"."funds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "created_by" UUID NOT NULL,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
 
    CONSTRAINT "funds_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE "finwise"."categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "parent_category_id" UUID,
    "name" TEXT NOT NULL,
    "type" "finwise"."CategoryType" NOT NULL,
    "created_by" UUID NOT NULL,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
 
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE "finwise"."transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "fund_id" UUID NOT NULL,
    "destination_fund_id" UUID,
    "category_id" UUID,
    "amount" DECIMAL(20,4) NOT NULL,
    "type" "finwise"."TransactionType" NOT NULL,
    "adjustment_type" "finwise"."AdjustmentType",
    "currency_code" CHAR(3) NOT NULL,
    "transaction_date" DATE NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "status" "finwise"."TransactionStatus" NOT NULL DEFAULT 'posted',
    "voided_by" UUID,
    "voided_at" TIMESTAMPTZ(6),
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
 
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE "finwise"."transaction_audits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "action" "finwise"."TransactionAuditAction" NOT NULL,
    "changed_by" UUID NOT NULL,
    "old_data" JSONB,
    "new_data" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 
    CONSTRAINT "transaction_audits_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE "finwise"."fund_balances" (
    "fund_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "balance" DECIMAL(20,4) NOT NULL,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL,
 
    CONSTRAINT "fund_balances_pkey" PRIMARY KEY ("fund_id")
);
 
-- CreateTable
CREATE TABLE "finwise"."bank_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "display_name" TEXT,
    "status" "finwise"."BankConnectionStatus" NOT NULL DEFAULT 'active',
    "created_by" UUID NOT NULL,
    "disconnected_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
 
    CONSTRAINT "bank_connections_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE "finwise"."bank_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bank_connection_id" UUID NOT NULL,
    "encrypted_access_token" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
 
    CONSTRAINT "bank_credentials_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE "finwise"."bank_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "bank_connection_id" UUID NOT NULL,
    "external_account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mask" VARCHAR(8),
    "currency_code" CHAR(3) NOT NULL,
    "fund_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
 
    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE "finwise"."bank_sync_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "bank_connection_id" UUID NOT NULL,
    "status" "finwise"."BankSyncRunStatus" NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 
    CONSTRAINT "bank_sync_runs_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE "finwise"."bank_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "external_transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "transaction_date" DATE NOT NULL,
    "description" TEXT,
    "transaction_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
 
    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);
 
-- CreateIndex
CREATE UNIQUE INDEX "users_external_auth_user_id_key" ON "finwise"."users"("external_auth_user_id");
 
-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "finwise"."users"("email");
 
-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "finwise"."workspace_members"("user_id");
 
-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "finwise"."workspace_members"("workspace_id", "user_id");
 
-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_id_key" ON "finwise"."workspace_members"("workspace_id", "id");
 
-- CreateIndex
CREATE INDEX "funds_workspace_id_archived_at_idx" ON "finwise"."funds"("workspace_id", "archived_at");
 
-- CreateIndex
CREATE UNIQUE INDEX "funds_workspace_id_id_key" ON "finwise"."funds"("workspace_id", "id");
 
-- CreateIndex
CREATE INDEX "categories_workspace_id_archived_at_idx" ON "finwise"."categories"("workspace_id", "archived_at");
 
-- CreateIndex
CREATE UNIQUE INDEX "categories_workspace_id_id_key" ON "finwise"."categories"("workspace_id", "id");
 
-- CreateIndex
CREATE INDEX "transactions_workspace_id_transaction_date_idx" ON "finwise"."transactions"("workspace_id", "transaction_date" DESC);
 
-- CreateIndex
CREATE INDEX "transactions_fund_id_transaction_date_idx" ON "finwise"."transactions"("fund_id", "transaction_date" DESC);
 
-- CreateIndex
CREATE INDEX "transactions_category_id_idx" ON "finwise"."transactions"("category_id");
 
-- CreateIndex
CREATE UNIQUE INDEX "transactions_workspace_id_id_key" ON "finwise"."transactions"("workspace_id", "id");
 
-- CreateIndex
CREATE INDEX "transaction_audits_transaction_id_created_at_idx" ON "finwise"."transaction_audits"("transaction_id", "created_at");
 
-- CreateIndex
CREATE UNIQUE INDEX "fund_balances_workspace_id_fund_id_key" ON "finwise"."fund_balances"("workspace_id", "fund_id");
 
-- CreateIndex
CREATE UNIQUE INDEX "bank_connections_workspace_id_id_key" ON "finwise"."bank_connections"("workspace_id", "id");
 
-- CreateIndex
CREATE UNIQUE INDEX "bank_credentials_bank_connection_id_key" ON "finwise"."bank_credentials"("bank_connection_id");
 
-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_fund_id_key" ON "finwise"."bank_accounts"("fund_id");
 
-- CreateIndex
CREATE INDEX "bank_accounts_bank_connection_id_idx" ON "finwise"."bank_accounts"("bank_connection_id");
 
-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_workspace_id_id_key" ON "finwise"."bank_accounts"("workspace_id", "id");
 
-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_workspace_id_bank_connection_id_external_acco_key" ON "finwise"."bank_accounts"("workspace_id", "bank_connection_id", "external_account_id");
 
-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_workspace_id_fund_id_key" ON "finwise"."bank_accounts"("workspace_id", "fund_id");
 
-- CreateIndex
CREATE INDEX "bank_sync_runs_bank_connection_id_created_at_idx" ON "finwise"."bank_sync_runs"("bank_connection_id", "created_at");
 
-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_transaction_id_key" ON "finwise"."bank_transactions"("transaction_id");
 
-- CreateIndex
CREATE INDEX "bank_transactions_bank_account_id_idx" ON "finwise"."bank_transactions"("bank_account_id");
 
-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_workspace_id_bank_account_id_external_tra_key" ON "finwise"."bank_transactions"("workspace_id", "bank_account_id", "external_transaction_id");
 
-- AddForeignKey
ALTER TABLE "finwise"."workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "finwise"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."workspace_members" ADD CONSTRAINT "workspace_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "finwise"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."funds" ADD CONSTRAINT "funds_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."funds" ADD CONSTRAINT "funds_workspace_id_created_by_fkey" FOREIGN KEY ("workspace_id", "created_by") REFERENCES "finwise"."workspace_members"("workspace_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."categories" ADD CONSTRAINT "categories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."categories" ADD CONSTRAINT "categories_workspace_id_parent_category_id_fkey" FOREIGN KEY ("workspace_id", "parent_category_id") REFERENCES "finwise"."categories"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."categories" ADD CONSTRAINT "categories_workspace_id_created_by_fkey" FOREIGN KEY ("workspace_id", "created_by") REFERENCES "finwise"."workspace_members"("workspace_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."transactions" ADD CONSTRAINT "transactions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."transactions" ADD CONSTRAINT "transactions_workspace_id_fund_id_fkey" FOREIGN KEY ("workspace_id", "fund_id") REFERENCES "finwise"."funds"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."transactions" ADD CONSTRAINT "transactions_workspace_id_destination_fund_id_fkey" FOREIGN KEY ("workspace_id", "destination_fund_id") REFERENCES "finwise"."funds"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."transactions" ADD CONSTRAINT "transactions_workspace_id_category_id_fkey" FOREIGN KEY ("workspace_id", "category_id") REFERENCES "finwise"."categories"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."transactions" ADD CONSTRAINT "transactions_workspace_id_created_by_fkey" FOREIGN KEY ("workspace_id", "created_by") REFERENCES "finwise"."workspace_members"("workspace_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."transactions" ADD CONSTRAINT "transactions_workspace_id_updated_by_fkey" FOREIGN KEY ("workspace_id", "updated_by") REFERENCES "finwise"."workspace_members"("workspace_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."transaction_audits" ADD CONSTRAINT "transaction_audits_workspace_id_transaction_id_fkey" FOREIGN KEY ("workspace_id", "transaction_id") REFERENCES "finwise"."transactions"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."transaction_audits" ADD CONSTRAINT "transaction_audits_workspace_id_changed_by_fkey" FOREIGN KEY ("workspace_id", "changed_by") REFERENCES "finwise"."workspace_members"("workspace_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."transaction_audits" ADD CONSTRAINT "transaction_audits_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."fund_balances" ADD CONSTRAINT "fund_balances_workspace_id_fund_id_fkey" FOREIGN KEY ("workspace_id", "fund_id") REFERENCES "finwise"."funds"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."bank_connections" ADD CONSTRAINT "bank_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."bank_connections" ADD CONSTRAINT "bank_connections_workspace_id_created_by_fkey" FOREIGN KEY ("workspace_id", "created_by") REFERENCES "finwise"."workspace_members"("workspace_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."bank_credentials" ADD CONSTRAINT "bank_credentials_bank_connection_id_fkey" FOREIGN KEY ("bank_connection_id") REFERENCES "finwise"."bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."bank_accounts" ADD CONSTRAINT "bank_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."bank_accounts" ADD CONSTRAINT "bank_accounts_workspace_id_bank_connection_id_fkey" FOREIGN KEY ("workspace_id", "bank_connection_id") REFERENCES "finwise"."bank_connections"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."bank_accounts" ADD CONSTRAINT "bank_accounts_workspace_id_fund_id_fkey" FOREIGN KEY ("workspace_id", "fund_id") REFERENCES "finwise"."funds"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."bank_sync_runs" ADD CONSTRAINT "bank_sync_runs_workspace_id_bank_connection_id_fkey" FOREIGN KEY ("workspace_id", "bank_connection_id") REFERENCES "finwise"."bank_connections"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."bank_transactions" ADD CONSTRAINT "bank_transactions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "finwise"."workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."bank_transactions" ADD CONSTRAINT "bank_transactions_workspace_id_bank_account_id_fkey" FOREIGN KEY ("workspace_id", "bank_account_id") REFERENCES "finwise"."bank_accounts"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "finwise"."bank_transactions" ADD CONSTRAINT "bank_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "finwise"."transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
 
-- Financial invariants that are not expressible in the Prisma schema DSL.
ALTER TABLE "finwise"."funds"
  ADD CONSTRAINT "funds_currency_code_format_chk"
  CHECK (btrim("currency_code") ~ '^[A-Z]{3}$');
 
ALTER TABLE "finwise"."categories"
  ADD CONSTRAINT "categories_name_not_blank_chk"
  CHECK (length(btrim("name")) > 0);
 
ALTER TABLE "finwise"."transactions"
  ADD CONSTRAINT "transactions_amount_positive_chk"
  CHECK ("amount" > 0),
  ADD CONSTRAINT "transactions_currency_code_format_chk"
  CHECK (btrim("currency_code") ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "transactions_type_shape_chk"
  CHECK (
    ("type" = 'transfer' AND "destination_fund_id" IS NOT NULL AND "destination_fund_id" <> "fund_id" AND "category_id" IS NULL AND "adjustment_type" IS NULL)
    OR ("type" IN ('income', 'expense') AND "destination_fund_id" IS NULL AND "adjustment_type" IS NULL)
    OR ("type" = 'adjustment' AND "destination_fund_id" IS NULL AND "category_id" IS NULL AND "adjustment_type" = 'opening_balance')
  ),
  ADD CONSTRAINT "transactions_status_shape_chk"
  CHECK (
    ("status" = 'posted' AND "voided_by" IS NULL AND "voided_at" IS NULL AND "void_reason" IS NULL)
    OR ("status" = 'voided' AND "voided_by" IS NOT NULL AND "voided_at" IS NOT NULL AND length(btrim("void_reason")) > 0)
  );
 
ALTER TABLE "finwise"."bank_accounts"
  ADD CONSTRAINT "bank_accounts_currency_code_format_chk"
  CHECK (btrim("currency_code") ~ '^[A-Z]{3}$');
 
ALTER TABLE "finwise"."bank_transactions"
  ADD CONSTRAINT "bank_transactions_amount_positive_chk"
  CHECK ("amount" > 0),
  ADD CONSTRAINT "bank_transactions_currency_code_format_chk"
  CHECK (btrim("currency_code") ~ '^[A-Z]{3}$');
 
CREATE UNIQUE INDEX "categories_workspace_root_active_name_key"
  ON "finwise"."categories" ("workspace_id", lower("name"))
  WHERE "parent_category_id" IS NULL AND "archived_at" IS NULL;
 
CREATE UNIQUE INDEX "categories_workspace_child_active_name_key"
  ON "finwise"."categories" ("workspace_id", "parent_category_id", lower("name"))
  WHERE "parent_category_id" IS NOT NULL AND "archived_at" IS NULL;
 
CREATE OR REPLACE FUNCTION "finwise"."validate_category_parent_type"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_type "finwise"."CategoryType";
BEGIN
  IF NEW."parent_category_id" IS NOT NULL THEN
    SELECT "type"
      INTO parent_type
      FROM "finwise"."categories"
     WHERE "workspace_id" = NEW."workspace_id"
       AND "id" = NEW."parent_category_id";
 
    IF parent_type IS NOT NULL AND parent_type <> NEW."type" THEN
      RAISE EXCEPTION 'Category parent and child must have the same type';
    END IF;
  END IF;
 
  RETURN NEW;
END;
$$;
 
CREATE TRIGGER "categories_validate_parent_type"
BEFORE INSERT OR UPDATE OF "workspace_id", "parent_category_id", "type"
ON "finwise"."categories"
FOR EACH ROW
EXECUTE FUNCTION "finwise"."validate_category_parent_type"();
 
CREATE OR REPLACE FUNCTION "finwise"."validate_transaction_financial_rules"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_currency CHAR(3);
  destination_currency CHAR(3);
  category_type "finwise"."CategoryType";
BEGIN
  SELECT "currency_code"
    INTO source_currency
    FROM "finwise"."funds"
   WHERE "workspace_id" = NEW."workspace_id"
     AND "id" = NEW."fund_id";
 
  IF source_currency IS NOT NULL AND btrim(source_currency) <> btrim(NEW."currency_code") THEN
    RAISE EXCEPTION 'Transaction currency must match source fund currency';
  END IF;
 
  IF NEW."destination_fund_id" IS NOT NULL THEN
    SELECT "currency_code"
      INTO destination_currency
      FROM "finwise"."funds"
     WHERE "workspace_id" = NEW."workspace_id"
       AND "id" = NEW."destination_fund_id";
 
    IF destination_currency IS NOT NULL AND btrim(destination_currency) <> btrim(NEW."currency_code") THEN
      RAISE EXCEPTION 'Transfer currency must match destination fund currency';
    END IF;
  END IF;
 
  IF NEW."category_id" IS NOT NULL THEN
    SELECT "type"
      INTO category_type
      FROM "finwise"."categories"
     WHERE "workspace_id" = NEW."workspace_id"
       AND "id" = NEW."category_id";
 
    IF category_type IS NOT NULL AND category_type::text <> NEW."type"::text THEN
      RAISE EXCEPTION 'Transaction type must match category type';
    END IF;
  END IF;
 
  RETURN NEW;
END;
$$;
 
CREATE TRIGGER "transactions_validate_financial_rules"
BEFORE INSERT OR UPDATE OF "workspace_id", "fund_id", "destination_fund_id", "category_id", "amount", "type", "adjustment_type", "currency_code", "status", "voided_by", "voided_at", "void_reason"
ON "finwise"."transactions"
FOR EACH ROW
EXECUTE FUNCTION "finwise"."validate_transaction_financial_rules"();
 
CREATE OR REPLACE FUNCTION "finwise"."set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
 
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users',
    'workspaces',
    'workspace_members',
    'funds',
    'categories',
    'transactions',
    'bank_connections',
    'bank_credentials',
    'bank_accounts',
    'bank_transactions'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION %I.%I()',
      table_name || '_set_updated_at',
      'finwise',
      table_name,
      'finwise',
      'set_updated_at'
    );
  END LOOP;
END;
$$;
