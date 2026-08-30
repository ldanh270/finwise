import type { MoneyDto } from "../api/contracts";

const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatMoney(money: MoneyDto | null | undefined): string {
  if (!money) return "—";

  try {
    const minorUnits = BigInt(money.minorUnits);
    return vndFormatter.format(minorUnits);
  } catch {
    return "—";
  }
}

export function formatShortDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.valueOf())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
  }).format(parsed);
}
