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

const requiredOperations = {
  "/session/bootstrap": ["get"],
  "/workspaces/{workspaceId}/overview": ["get"],
  "/workspaces/{workspaceId}/reports": ["get"],
  "/workspaces/{workspaceId}/roles": ["get", "post"],
  "/workspaces/{workspaceId}/members": ["get"],
  "/workspaces/{workspaceId}/accounts": ["get", "post"],
  "/workspaces/{workspaceId}/transactions": ["get", "post"],
  "/workspaces/{workspaceId}/transactions/{transactionId}/void": ["post"],
  "/workspaces/{workspaceId}/budgets": ["get", "post"],
  "/workspaces/{workspaceId}/imports": ["get", "post"],
  "/workspaces/{workspaceId}/reconciliations": ["get", "post"],
  "/workspaces/{workspaceId}/wealth/loans": ["get", "post"],
  "/workspaces/{workspaceId}/wealth/loans/{contractId}/payments": [
    "get",
    "post",
  ],
  "/workspaces/{workspaceId}/wealth/investments/positions": ["get"],
  "/workspaces/{workspaceId}/wealth/investments/trades": ["post"],
  "/workspaces/{workspaceId}/wealth/investments/valuations": ["get", "post"],
};

if (contract?.openapi !== "3.1.0" || !isRecord(contract?.paths)) {
  console.error("OpenAPI contract must be an OpenAPI 3.1 document with paths.");
  process.exit(1);
}

const missingOperations = Object.entries(requiredOperations).flatMap(
  ([route, methods]) =>
    methods
      .filter(
        (method) =>
          !isRecord(contract.paths[route]) ||
          !isRecord(contract.paths[route][method]),
      )
      .map((method) => `${method.toUpperCase()} ${route}`),
);
if (missingOperations.length > 0) {
  console.error(
    `OpenAPI contract is missing operations: ${missingOperations.join(", ")}`,
  );
  process.exit(1);
}

const operationIds = [];
for (const [route, pathItem] of Object.entries(contract.paths)) {
  if (!isRecord(pathItem)) continue;
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!["get", "post", "patch", "delete", "put"].includes(method)) continue;
    if (!isRecord(operation) || typeof operation.operationId !== "string") {
      console.error(
        `OpenAPI operation ${method.toUpperCase()} ${route} needs an operationId.`,
      );
      process.exit(1);
    }
    operationIds.push(operation.operationId);
  }
}
if (new Set(operationIds).size !== operationIds.length) {
  console.error("OpenAPI operationIds must be unique.");
  process.exit(1);
}

const idempotentCommands = [
  ["post", "/workspaces/{workspaceId}/accounts/{accountId}/opening-balance"],
  ["post", "/workspaces/{workspaceId}/transactions"],
  ["post", "/workspaces/{workspaceId}/transactions/{transactionId}/void"],
  ["post", "/workspaces/{workspaceId}/transactions/{transactionId}/replace"],
  ["post", "/workspaces/{workspaceId}/imports/records/confirm"],
  ["post", "/workspaces/{workspaceId}/imports/records/{recordId}/confirm"],
  ["post", "/workspaces/{workspaceId}/group/expenses"],
  ["post", "/workspaces/{workspaceId}/wealth/loans"],
  ["post", "/workspaces/{workspaceId}/wealth/loans/{contractId}/payments"],
  ["post", "/workspaces/{workspaceId}/wealth/investments/trades"],
  ["post", "/workspaces/{workspaceId}/wealth/investments/valuations"],
];
const missingIdempotency = idempotentCommands.filter(([method, route]) => {
  const operation = contract.paths[route]?.[method];
  return (
    !isRecord(operation) ||
    !Array.isArray(operation.parameters) ||
    !operation.parameters.some(
      (parameter) =>
        isRecord(parameter) &&
        parameter.$ref === "#/components/parameters/IdempotencyKey",
    )
  );
});
if (missingIdempotency.length > 0) {
  console.error(
    `Financial commands missing Idempotency-Key: ${missingIdempotency.map(([method, route]) => `${method.toUpperCase()} ${route}`).join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `OpenAPI contract is valid: ${operationIds.length} unique operations and ${idempotentCommands.length} idempotent financial commands checked.`,
);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
