import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { runReleasePreflight } from "./release-preflight.mjs";

function validEnvironment() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "der" },
    publicKeyEncoding: { type: "spki", format: "der" },
  });
  return {
    NODE_ENV: "production",
    FINWISE_DEV_AUTH: "false",
    DATABASE_URL: "postgresql://db.example/finwise",
    FINWISE_JWT_ISSUER: "https://auth.example",
    FINWISE_JWT_AUDIENCE: "finwise-api",
    FINWISE_JWT_KEY_ID: "release-2026-09",
    FINWISE_JWT_PRIVATE_KEY_BASE64: privateKey.toString("base64"),
    FINWISE_JWT_PUBLIC_KEY_BASE64: publicKey.toString("base64"),
    FINWISE_ACCESS_TTL_SECONDS: "900",
    FINWISE_REFRESH_TTL_SECONDS: "2592000",
    FRONTEND_ORIGINS: "https://app.example",
    NEXT_PUBLIC_FINWISE_API_URL: "https://api.example",
    EXPO_PUBLIC_FINWISE_API_URL: "https://api.example",
  };
}

test("release preflight accepts a complete production configuration", () => {
  assert.equal(runReleasePreflight(validEnvironment()).status, "READY");
});

test("release preflight rejects dev auth and insecure endpoints", () => {
  const environment = validEnvironment();
  environment.FINWISE_DEV_AUTH = "true";
  environment.NEXT_PUBLIC_FINWISE_API_URL = "http://localhost:3001";
  environment.EXPO_PUBLIC_FINWISE_API_URL = "http://10.0.2.2:3001";
  const result = runReleasePreflight(environment);

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.errors.some((error) => error.includes("FINWISE_DEV_AUTH")));
  assert.ok(result.errors.some((error) => error.includes("HTTPS")));
});
