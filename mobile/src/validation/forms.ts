import { z } from "zod";

const minorUnits = z
  .string()
  .regex(/^\d+$/, "Use VND minor units as a whole number.")
  .refine((value) => BigInt(value) > 0n, "Amount must be greater than zero.");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

export const manualTransactionSchema = z.object({
  type: z.enum(["income", "expense", "transfer"]),
  accountId: z.string().min(1),
  destinationAccountId: z.string().optional(),
  amountMinorUnits: minorUnits,
  effectiveDate: isoDate,
  description: z.string().max(500).optional(),
});

export type ManualTransactionForm = z.infer<typeof manualTransactionSchema>;
