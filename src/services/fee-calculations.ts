import { z } from "zod";

export class FeeRuleError extends Error {}

export const moneySchema = z.string().trim().regex(/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/, "Enter a positive amount with at most two decimal places")
  .transform(value => {
    const [whole, fraction = ""] = value.split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  }).refine(value => value > 0 && value <= 1_000_000_000, "Amount must be greater than zero and no more than 10,000,000");

export function displayMoney(cents: number) {
  if (!Number.isSafeInteger(cents)) throw new FeeRuleError("Invalid monetary amount");
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100).toLocaleString("en-IN")}.${String(absolute % 100).padStart(2, "0")}`;
}

export const dateSchema = z.iso.date().transform(value => new Date(`${value}T00:00:00.000Z`));
export function dateOnly(value: Date) { return value.toISOString().slice(0, 10); }

export function installments(total: number, count: number, firstDue: Date, endsOn: Date) {
  if (!Number.isSafeInteger(total) || total < count || ![1, 4, 12].includes(count)) throw new FeeRuleError("Fee amount is too small for this schedule");
  if (firstDue.getUTCDate() > 28) throw new FeeRuleError("Choose a first due date on or before the 28th");
  const step = 12 / count;
  return Array.from({ length: count }, (_, index) => {
    const dueOn = new Date(firstDue);
    dueOn.setUTCMonth(dueOn.getUTCMonth() + index * step);
    if (dueOn > endsOn) throw new FeeRuleError("The installment schedule extends beyond the academic year");
    return { installment: index + 1, dueOn, amountCents: Math.floor(total / count) + (index < total % count ? 1 : 0) };
  });
}

export type OpenCharge = { id: string; amountCents: number; settledCents: number; dueOn: Date };

export function allocateOldest(amount: number, charges: OpenCharge[]) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new FeeRuleError("Enter a positive amount");
  let remaining = amount;
  const result: { chargeId: string; amountCents: number }[] = [];
  for (const charge of [...charges].sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime() || a.id.localeCompare(b.id))) {
    const available = charge.amountCents - charge.settledCents;
    if (available < 0) throw new FeeRuleError("A charge has inconsistent allocations");
    const allocated = Math.min(remaining, available);
    if (allocated > 0) result.push({ chargeId: charge.id, amountCents: allocated });
    remaining -= allocated;
    if (!remaining) break;
  }
  if (remaining) throw new FeeRuleError("Amount exceeds the student's outstanding balance");
  return result;
}

export function balances(charges: OpenCharge[], asOf: Date) {
  const cutoff = dateOnly(asOf);
  let outstanding = 0, overdue = 0;
  for (const charge of charges) {
    const balance = charge.amountCents - charge.settledCents;
    if (balance < 0) throw new FeeRuleError("A charge has inconsistent allocations");
    outstanding += balance;
    // Due today remains current until that date has passed.
    if (dateOnly(charge.dueOn) < cutoff) overdue += balance;
  }
  return { outstanding, overdue, futureAndCurrent: outstanding - overdue };
}
