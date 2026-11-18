// Pure, independent calculation module. Only principal installments generate penalties.
import { dateOnly, FeeRuleError } from "./fee-calculations";

export const LATE_FEE_GRACE_DAYS = 15;
export function addDays(day: string, count: number) {
  const value = new Date(`${day}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + count); return dateOnly(value);
}
export function localDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function monthAnniversary(day: string, months: number) {
  const original = new Date(`${day}T00:00:00Z`);
  const target = new Date(Date.UTC(original.getUTCFullYear(), original.getUTCMonth() + months, 1));
  target.setUTCDate(Math.min(original.getUTCDate(), new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()));
  return dateOnly(target);
}
type Settlement = { amountPaise: number; on: string; reversedOn: string | null };
export type LateFeePrincipal = { dueOn: string; amountPaise: number; settlements: Settlement[] };
export type LateFeeRate = { amountPaise: number; intervalMonths: number; effectiveFrom: string };
export type LateFeeAssessment = { forDueOn: string; cycleOn: string; dueOn: string; amountPaise: number };

export function calculateLateFees({ principals, policies, eligibleFrom, asOf }: {
  principals: LateFeePrincipal[]; policies: LateFeeRate[]; eligibleFrom: string; asOf: string;
}): LateFeeAssessment[] {
  if (!policies.length) return [];
  const rates = [...policies].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  if (rates.some(rate => ![1, 3, 12].includes(rate.intervalMonths) || !Number.isSafeInteger(rate.amountPaise) || rate.amountPaise < 0 || rate.amountPaise > 1_000_000_000)) throw new FeeRuleError("Invalid late-fee policy");
  const intervalMonths = rates[0].intervalMonths;
  if (rates.some(rate => rate.intervalMonths !== intervalMonths)) throw new FeeRuleError("The late-fee frequency cannot change within a fee plan");
  const firstAssessment = [rates[0].effectiveFrom, eligibleFrom].sort().at(-1)!;
  const groups = Map.groupBy(principals, item => item.dueOn);
  const result: LateFeeAssessment[] = [];
  for (const [forDueOn, group] of groups) {
    const anchor = new Date(`${forDueOn}T00:00:00Z`), earliestCycle = new Date(`${addDays(firstAssessment, -16)}T00:00:00Z`);
    const difference = (earliestCycle.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + earliestCycle.getUTCMonth() - anchor.getUTCMonth();
    for (let index = Math.max(0, Math.floor(difference / intervalMonths) - 1); ; index++) {
      const cycleOn = monthAnniversary(forDueOn, index * intervalMonths);
      const deadline = addDays(cycleOn, LATE_FEE_GRACE_DAYS), dueOn = addDays(deadline, 1);
      if (dueOn > asOf) break;
      if (dueOn < firstAssessment) continue;
      const rate = rates.findLast(item => item.effectiveFrom <= dueOn);
      if (!rate?.amountPaise) continue;
      const unpaid = group.reduce((sum, principal) => sum + Math.max(0, principal.amountPaise - principal.settlements.filter(item => item.on <= deadline && (!item.reversedOn || item.reversedOn > deadline)).reduce((paid, item) => paid + item.amountPaise, 0)), 0);
      if (unpaid > 0) result.push({ forDueOn, cycleOn, dueOn, amountPaise: rate.amountPaise });
    }
  }
  return result;
}
