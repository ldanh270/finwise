-- Additive persistence boundary for the synchronous domain-store adapters.
CREATE TABLE "finwise"."finwise_runtime_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "namespace" STRING NOT NULL,
    "version" INT4 NOT NULL DEFAULT 1,
    "state" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finwise_runtime_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "finwise_runtime_snapshots_namespace_key"
    ON "finwise"."finwise_runtime_snapshots" ("namespace");
