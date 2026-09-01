import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backendRoot = path.join(repositoryRoot, "backend");
const migrationsRoot = path.join(backendRoot, "prisma", "migrations");
const migrationSchema = "finwise";
const require = createRequire(path.join(backendRoot, "package.json"));

loadBackendEnvironment();

export function listMigrationDirectories(directory = migrationsRoot) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        /^\d+_[A-Za-z0-9_-]+$/.test(entry.name) &&
        fs.existsSync(path.join(directory, entry.name, "migration.sql")),
    )
    .map((entry) => entry.name)
    .sort();
}

export function migrationChecksum(sql) {
  return crypto.createHash("sha256").update(sql).digest("hex");
}

export function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error("Unsafe database identifier");
  }
  return `"${identifier}"`;
}

export function safeMigrationFailure(error) {
  const code =
    error && typeof error === "object" && typeof error.code === "string"
      ? error.code.replace(/[^A-Za-z0-9_:-]/g, "").slice(0, 40)
      : "UNKNOWN";
  return `Database migration failed (${code}). Inspect the migration logs without exposing connection credentials.`;
}

async function deployWithPg() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DIRECT_URL or DATABASE_URL is required for database deployment.",
    );
  }

  const { Client } = require("pg");
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
  });

  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(migrationSchema)}`,
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(migrationSchema)}.${quoteIdentifier("_prisma_migrations")} (
        id STRING NOT NULL,
        checksum STRING NOT NULL,
        finished_at TIMESTAMP(3),
        migration_name STRING NOT NULL,
        logs STRING,
        rolled_back_at TIMESTAMP(3),
        started_at TIMESTAMP(3) NOT NULL DEFAULT current_timestamp(),
        applied_steps_count INT4 NOT NULL DEFAULT 0,
        CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id)
      )
    `);
    await client.query("COMMIT");

    const appliedMigrations = await readAppliedMigrations(client);
    const migrationNames = listMigrationDirectories();
    let appliedCount = 0;

    for (const migrationName of migrationNames) {
      const migrationPath = path.join(
        migrationsRoot,
        migrationName,
        "migration.sql",
      );
      const sql = fs.readFileSync(migrationPath, "utf8");
      const checksum = migrationChecksum(sql);
      const applied = appliedMigrations.get(migrationName);

      if (applied) {
        assertMigrationMatches(migrationName, checksum, applied);
        continue;
      }

      await applyMigration(client, migrationName, checksum, sql);
      appliedCount += 1;
      console.log(`Applied ${migrationName}`);
    }

    console.log(
      appliedCount === 0
        ? `Database is up to date (${migrationNames.length} migrations).`
        : `Database deployment completed (${appliedCount} migration${appliedCount === 1 ? "" : "s"} applied).`,
    );
  } finally {
    await client.end();
  }
}

async function readAppliedMigrations(client) {
  const result = await client.query(
    `SELECT migration_name, checksum, finished_at, rolled_back_at
     FROM ${quoteIdentifier(migrationSchema)}.${quoteIdentifier("_prisma_migrations")}
     ORDER BY started_at ASC`,
  );
  return new Map(result.rows.map((row) => [String(row.migration_name), row]));
}

function assertMigrationMatches(migrationName, checksum, applied) {
  if (applied.checksum !== checksum) {
    throw new Error(
      `Checksum mismatch for ${migrationName}; restore the checked-in migration before retrying.`,
    );
  }
  if (!applied.finished_at || applied.rolled_back_at) {
    throw new Error(
      `Migration ${migrationName} is incomplete or rolled back; inspect the database before retrying.`,
    );
  }
}

async function applyMigration(client, migrationName, checksum, sql) {
  const migrationId = crypto.randomUUID();
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO ${quoteIdentifier(migrationSchema)}.${quoteIdentifier("_prisma_migrations")}
       (id, checksum, migration_name, started_at, applied_steps_count)
       VALUES ($1, $2, $3, current_timestamp(), 0)`,
      [migrationId, checksum, migrationName],
    );
    await client.query(sql);
    await client.query(
      `UPDATE ${quoteIdentifier(migrationSchema)}.${quoteIdentifier("_prisma_migrations")}
       SET finished_at = current_timestamp(), applied_steps_count = 1
       WHERE id = $1`,
      [migrationId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

function loadBackendEnvironment() {
  try {
    const { config } = require("dotenv");
    config({ path: path.join(backendRoot, ".env") });
  } catch {
    // Environment variables may be provided by CI/container orchestration.
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await deployWithPg();
  } catch (error) {
    console.error(safeMigrationFailure(error));
    process.exitCode = 1;
  }
}
