import { LoanScheduleItem, PaymentAllocation } from './wealth.types';

export function buildInterestFreeSchedule(
  principalMinorUnits: bigint,
  installmentCount: number,
  firstDueDate: string,
  feeMinorUnits = 0n,
): readonly LoanScheduleItem[] {
  validatePrincipal(principalMinorUnits);
  validateInstallmentCount(installmentCount);
  validateDate(firstDueDate);
  if (feeMinorUnits < 0n) throw new Error('fee must not be negative');

  let remaining = principalMinorUnits;
  return Array.from({ length: installmentCount }, (_, index) => {
    const installmentsLeft = BigInt(installmentCount - index);
    const principal =
      index === installmentCount - 1 ? remaining : remaining / installmentsLeft;
    const opening = remaining;
    remaining -= principal;
    return {
      installment: index + 1,
      dueDate: addMonths(firstDueDate, index),
      principalMinorUnits: principal,
      interestMinorUnits: 0n,
      feeMinorUnits,
      totalDueMinorUnits: principal + feeMinorUnits,
      openingPrincipalMinorUnits: opening,
      closingPrincipalMinorUnits: remaining,
    };
  });
}

/**
 * Reducing-balance convention: equal principal installments, with monthly
 * interest floored to whole VND minor units from the opening balance.
 */
export function buildReducingBalanceSchedule(
  principalMinorUnits: bigint,
  annualRateBasisPoints: bigint,
  termMonths: number,
  firstDueDate: string,
  feeMinorUnits = 0n,
): readonly LoanScheduleItem[] {
  validatePrincipal(principalMinorUnits);
  validateInstallmentCount(termMonths);
  validateDate(firstDueDate);
  if (annualRateBasisPoints < 0n)
    throw new Error('annual rate must not be negative');
  if (feeMinorUnits < 0n) throw new Error('fee must not be negative');

  let remaining = principalMinorUnits;
  return Array.from({ length: termMonths }, (_, index) => {
    const opening = remaining;
    const installmentsLeft = BigInt(termMonths - index);
    const principal =
      index === termMonths - 1 ? remaining : remaining / installmentsLeft;
    const interest = (opening * annualRateBasisPoints) / (12n * 10_000n);
    remaining -= principal;
    return {
      installment: index + 1,
      dueDate: addMonths(firstDueDate, index),
      principalMinorUnits: principal,
      interestMinorUnits: interest,
      feeMinorUnits,
      totalDueMinorUnits: principal + interest + feeMinorUnits,
      openingPrincipalMinorUnits: opening,
      closingPrincipalMinorUnits: remaining,
    };
  });
}

export function allocatePayment(
  paymentMinorUnits: bigint,
  feeDueMinorUnits: bigint,
  interestDueMinorUnits: bigint,
  principalDueMinorUnits: bigint,
): PaymentAllocation {
  if (paymentMinorUnits < 0n) throw new Error('payment must not be negative');
  for (const due of [
    feeDueMinorUnits,
    interestDueMinorUnits,
    principalDueMinorUnits,
  ]) {
    if (due < 0n) throw new Error('due amounts must not be negative');
  }
  let unapplied = paymentMinorUnits;
  const fee = min(unapplied, feeDueMinorUnits);
  unapplied -= fee;
  const interest = min(unapplied, interestDueMinorUnits);
  unapplied -= interest;
  const principal = min(unapplied, principalDueMinorUnits);
  unapplied -= principal;
  return {
    feeMinorUnits: fee,
    interestMinorUnits: interest,
    principalMinorUnits: principal,
    unappliedMinorUnits: unapplied,
  };
}

function min(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

function validatePrincipal(principalMinorUnits: bigint): void {
  if (principalMinorUnits <= 0n) throw new Error('principal must be positive');
}

function validateInstallmentCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('installment count must be a positive integer');
  }
}

function validateDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('date must use YYYY-MM-DD');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (parsed.toISOString().slice(0, 10) !== value)
    throw new Error('date is invalid');
}

function addMonths(date: string, months: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCMonth(parsed.getUTCMonth() + months);
  return parsed.toISOString().slice(0, 10);
}
