import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const require = createRequire(import.meta.url);

export async function runDatabasePreflight(environment = process.env) {
  const connectionString = databaseUrlFrom(environment);
  if (!connectionString || isPlaceholder(connectionString)) {
    return {
      status: "NOT_CONFIGURED",
      message:
        "No usable DATABASE_URL was provided; no migration decision was made.",
    };
  }

  let Client;
  try {
    ({ Client } = require("../backend/node_modules/pg"));
  } catch {
    return {
      status: "BLOCKED",
      message:
        "The PostgreSQL driver is not installed; no database was touched.",
    };
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const identity = await client.query(
      "SELECT current_database() AS database, current_schema() AS schema",
    );
    const tables = await client.query(
      `SELECT n.nspname AS schema, c.relname AS table_name,
              GREATEST(c.reltuples, 0)::bigint AS estimated_rows
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind IN ('r', 'p')
         AND n.nspname IN ('public', 'finwise')
       ORDER BY n.nspname, c.relname`,
    );
    await client.query("ROLLBACK");
    const rows = tables.rows.map((row) => ({
      schema: String(row.schema),
      table: String(row.table_name),
      estimatedRows: Number(row.estimated_rows),
    }));
    return {
      status: "READY",
      database: String(identity.rows[0]?.database ?? "unknown"),
      schema: String(identity.rows[0]?.schema ?? "unknown"),
      tables: rows,
      estimatedDataPresent: rows.some((row) => row.estimatedRows > 0),
      message:
        "Read-only metadata inspection completed; choose fresh baseline versus preserving migration from the evidence.",
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection may have failed before a transaction was opened.
    }
    return {
      status: "FAILED",
      message: safeDatabaseFailureMessage(error),
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function safeDatabaseFailureMessage(error) {
  const code =
    error && typeof error === "object" && typeof error.code === "string"
      ? error.code.replace(/[^A-Za-z0-9_:-]/g, "").slice(0, 40)
      : "UNKNOWN";
  return `Database preflight failed (${code}); no migration decision was made.`;
}

function databaseUrlFrom(environment) {
  if (typeof environment.DATABASE_URL === "string") {
    return environment.DATABASE_URL.trim();
  }
  const envPath = path.join(repositoryRoot, "backend", ".env");
  try {
    const line = fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .find((entry) => /^\s*DATABASE_URL\s*=/.test(entry));
    return line
      ?.split("=")
      .slice(1)
      .join("=")
      .trim()
      .replace(/^['"]|['"]$/g, "");
  } catch {
    return undefined;
  }
}

function isPlaceholder(value) {
  return (
    value.includes("[YOUR-PASSWORD]") ||
    value.includes("localhost:5432/finwise")
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runDatabasePreflight();
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "FAILED" || result.status === "BLOCKED")
    process.exitCode = 1;
}
