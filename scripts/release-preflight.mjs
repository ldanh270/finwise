import fs from "node:fs";
import path from "node:path";
import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function runReleasePreflight(environment = process.env) {
  const errors = [];
  const checks = [];

  requireValue(environment.NODE_ENV, "NODE_ENV", errors);
  if (environment.NODE_ENV !== "production") {
    errors.push("NODE_ENV must be production for a release preflight.");
  }
  if (environment.FINWISE_DEV_AUTH === "true") {
    errors.push("FINWISE_DEV_AUTH must not be true in a release.");
  }

  for (const name of [
    "DATABASE_URL",
    "FINWISE_JWT_ISSUER",
    "FINWISE_JWT_AUDIENCE",
    "FINWISE_JWT_KEY_ID",
    "FINWISE_JWT_PRIVATE_KEY_BASE64",
    "FINWISE_JWT_PUBLIC_KEY_BASE64",
    "FRONTEND_ORIGINS",
    "NEXT_PUBLIC_FINWISE_API_URL",
    "EXPO_PUBLIC_FINWISE_API_URL",
  ]) {
    requireValue(environment[name], name, errors);
  }

  validateDatabaseUrl(environment.DATABASE_URL, errors);
  validateIssuer(environment.FINWISE_JWT_ISSUER, errors);
  validateOrigins(environment.FRONTEND_ORIGINS, errors);
  validateHttpsUrl(
    environment.NEXT_PUBLIC_FINWISE_API_URL,
    "NEXT_PUBLIC_FINWISE_API_URL",
    errors,
  );
  validateHttpsUrl(
    environment.EXPO_PUBLIC_FINWISE_API_URL,
    "EXPO_PUBLIC_FINWISE_API_URL",
    errors,
  );
  validateJwtKeys(
    environment.FINWISE_JWT_PRIVATE_KEY_BASE64,
    environment.FINWISE_JWT_PUBLIC_KEY_BASE64,
    errors,
  );
  validateTtl(
    environment.FINWISE_ACCESS_TTL_SECONDS,
    "access",
    60,
    3600,
    errors,
  );
  validateTtl(
    environment.FINWISE_REFRESH_TTL_SECONDS,
    "refresh",
    3600,
    90 * 24 * 60 * 60,
    errors,
  );
  validateMobileReleaseConfig(errors);

  checks.push(
    "production environment",
    "JWT configuration",
    "HTTPS endpoints",
    "mobile release configuration",
  );
  return { status: errors.length === 0 ? "READY" : "BLOCKED", checks, errors };
}

function requireValue(value, name, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${name} is required.`);
  }
}

function validateDatabaseUrl(value, errors) {
  if (typeof value !== "string" || value.trim() === "") return;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      errors.push("DATABASE_URL must use the postgres or postgresql protocol.");
    }
  } catch {
    errors.push("DATABASE_URL must be a valid database URL.");
  }
}

function validateIssuer(value, errors) {
  if (typeof value !== "string" || value.trim() === "") return;
  validateHttpsUrl(value, "FINWISE_JWT_ISSUER", errors);
}

function validateOrigins(value, errors) {
  if (typeof value !== "string" || value.trim() === "") return;
  for (const origin of value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== "https:") {
        errors.push(
          "FRONTEND_ORIGINS must contain HTTPS origins in production.",
        );
      }
      if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
        errors.push("FRONTEND_ORIGINS entries must be origins without a path.");
      }
    } catch {
      errors.push("FRONTEND_ORIGINS contains an invalid URL.");
    }
  }
}

function validateHttpsUrl(value, name, errors) {
  if (typeof value !== "string" || value.trim() === "") return;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:")
      errors.push(`${name} must use HTTPS in production.`);
    if (parsed.username || parsed.password)
      errors.push(`${name} must not contain credentials.`);
  } catch {
    errors.push(`${name} must be a valid URL.`);
  }
}

function validateJwtKeys(privateValue, publicValue, errors) {
  if (typeof privateValue !== "string" || typeof publicValue !== "string")
    return;
  try {
    const privateKey = createPrivateKey({
      key: Buffer.from(privateValue, "base64"),
      format: "der",
      type: "pkcs8",
    });
    const publicKey = createPublicKey({
      key: Buffer.from(publicValue, "base64"),
      format: "der",
      type: "spki",
    });
    const payload = Buffer.from("finwise-release-preflight");
    const signature = sign("RSA-SHA256", payload, privateKey);
    if (!verify("RSA-SHA256", payload, publicKey, signature)) {
      errors.push("FINWISE_JWT private/public keys do not form a valid pair.");
    }
  } catch {
    errors.push(
      "FINWISE_JWT key material must be base64-encoded PKCS#8/SPKI DER.",
    );
  }
}

function validateTtl(value, name, minimum, maximum, errors) {
  if (value === undefined || value === "") return;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    errors.push(
      `FINWISE_${name.toUpperCase()}_TTL_SECONDS must be between ${minimum} and ${maximum}.`,
    );
  }
}

function validateMobileReleaseConfig(errors) {
  const appConfig = readJson("mobile/app.json", errors);
  const easConfig = readJson("mobile/eas.json", errors);
  const app = appConfig?.expo;
  if (!app?.ios?.bundleIdentifier || !app?.android?.package) {
    errors.push(
      "mobile/app.json must define iOS and Android application identifiers.",
    );
  }
  for (const profile of ["development", "preview", "production"]) {
    if (!easConfig?.build?.[profile])
      errors.push(`mobile/eas.json is missing the ${profile} build profile.`);
  }
}

function readJson(relativePath, errors) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"),
    );
  } catch {
    errors.push(`${relativePath} must be valid JSON.`);
    return undefined;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runReleasePreflight();
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "BLOCKED") process.exitCode = 1;
}
