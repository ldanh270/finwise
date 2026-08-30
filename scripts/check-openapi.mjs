import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const contractPath = path.join(repositoryRoot, "contracts", "openapi.json");

let contract;
try {
  contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`Unable to read OpenAPI contract: ${message}`);
  process.exit(1);
}

if (
  contract?.openapi !== "3.1.0" ||
  typeof contract?.paths !== "object" ||
  !contract.paths["/session/bootstrap"] ||
  !contract.paths["/workspaces/{workspaceId}/transactions"]
) {
  console.error("OpenAPI contract is missing required first-slice paths.");
  process.exit(1);
}

console.log(
  "OpenAPI contract is valid and contains required first-slice paths.",
);
