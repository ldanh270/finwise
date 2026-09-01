import type { OutboxRecord } from "./outbox";

const columns = [
  "clientCommandId",
  "accountId",
  "kind",
  "amountMinorUnits",
  "effectiveDate",
  "description",
  "state",
] as const;

export function draftExportCsv(records: readonly OutboxRecord[]): string {
  const rows = records.map((record) => [
    record.clientCommandId,
    record.accountId,
    record.kind,
    record.amount.minorUnits,
    record.effectiveDate,
    record.description ?? "",
    record.state,
  ]);
  return [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
