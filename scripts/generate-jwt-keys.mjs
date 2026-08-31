import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 3072,
  publicExponent: 0x10001,
  privateKeyEncoding: { type: "pkcs8", format: "der" },
  publicKeyEncoding: { type: "spki", format: "der" },
});

console.log("FINWISE_JWT_KEY_ID=local-2026-08");
console.log(`FINWISE_JWT_PRIVATE_KEY_BASE64=${privateKey.toString("base64")}`);
console.log(`FINWISE_JWT_PUBLIC_KEY_BASE64=${publicKey.toString("base64")}`);
