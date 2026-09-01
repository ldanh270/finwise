import assert from "node:assert/strict";
import test from "node:test";
import {
  listMigrationDirectories,
  migrationChecksum,
  quoteIdentifier,
  safeMigrationFailure,
} from "./database-deploy.mjs";

test("database deploy discovers migrations in deterministic order", () => {
  assert.deepEqual(listMigrationDirectories(), [
    "20260831010000_cockroach_baseline",
    "20260901000000_runtime_store_snapshots",
  ]);
});

test("migration checksums are stable and identifiers are quoted", () => {
  assert.equal(
    migrationChecksum("CREATE TABLE finwise.example (id STRING);"),
    "2ad42727a7483b1a53617b2fa79e66aa5121d4484035f924afbfef44458fb3bf",
  );
  assert.equal(quoteIdentifier("finwise"), '"finwise"');
  assert.throws(
    () => quoteIdentifier("finwise;DROP"),
    /Unsafe database identifier/,
  );
});

test("migration diagnostics do not expose connection details", () => {
  const message = safeMigrationFailure({
    code: "ECONNREFUSED",
    message: "postgresql://user:secret@example.com/finwise",
  });
  assert.equal(
    message,
    "Database migration failed (ECONNREFUSED). Inspect the migration logs without exposing connection credentials.",
  );
  assert.equal(message.includes("secret"), false);
});
