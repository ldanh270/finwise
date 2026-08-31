import assert from "node:assert/strict";
import test from "node:test";
import { safeDatabaseFailureMessage } from "./database-preflight.mjs";

test("database preflight failure messages do not expose raw connection details", () => {
  const message = safeDatabaseFailureMessage({
    code: "ECONNREFUSED",
    message: "password=super-secret host=db.internal",
  });
  assert.equal(
    message,
    "Database preflight failed (ECONNREFUSED); no migration decision was made.",
  );
  assert.equal(message.includes("super-secret"), false);
  assert.equal(message.includes("db.internal"), false);
});

test("unknown preflight failures use a stable generic code", () => {
  assert.equal(
    safeDatabaseFailureMessage(new Error("connection detail")),
    "Database preflight failed (UNKNOWN); no migration decision was made.",
  );
});
