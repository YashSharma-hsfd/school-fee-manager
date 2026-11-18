import { saveLateFeePolicy } from "@/actions/late-fees";
import { lateFeesEnabled } from "@/services/late-fees";
import { addDays, localDay } from "@/services/late-fee-calculations";
import { dateOnly, displayMoney } from "@/services/fee-calculations";
import { SchoolForm } from "./school-forms";

export function LateFeeSettings({ schoolId, planId, policies }: { schoolId: string; planId: string; policies: { id: string; amountPaise: number; effectiveFrom: Date; intervalMonths: number }[] }) {
  if (!lateFeesEnabled()) return null;
  const today = localDay(new Date());
  const active = policies.findLast(policy => dateOnly(policy.effectiveFrom) <= today);
  const minimum = active ? addDays(today, 1) : today;
  return <div className="mt-5 space-y-4 border-t border-slate-200 pt-5"><h3 className="font-semibold">Late-fee policy</h3><p className="text-sm text-slate-600">{active?.amountPaise ? `${displayMoney(active.amountPaise)} per unpaid installment every ${active.intervalMonths === 1 ? "month" : active.intervalMonths === 3 ? "quarter" : "year"}, after 15 days of grace.` : "Late fees are currently off for this plan."} Multiple fee components sharing a due date count as one installment. A partially unpaid installment still incurs the full penalty. Penalties continue after the academic year until the installment is settled.</p>
    <SchoolForm action={saveLateFeePolicy.bind(null, schoolId, planId)} submit="Save late-fee policy" fields={[
      { name: "amount", label: "Late fee per unpaid installment", value: active ? String(active.amountPaise / 100) : "0", help: "Rupees per cycle. Enter 0 to stop new penalties from the effective date." },
      { name: "effectiveFrom", label: "Late-fee policy effective from", type: "date", value: minimum, min: minimum, help: "A new policy may start today. Changes to an active policy start tomorrow or later." },
    ]} />
    {!!policies.length && <ul className="space-y-1 text-xs text-slate-500">{policies.map(policy => <li key={policy.id}>From {dateOnly(policy.effectiveFrom)}: {displayMoney(policy.amountPaise)} per cycle{dateOnly(policy.effectiveFrom) > today ? " (scheduled)" : ""}</li>)}</ul>}
    <p className="text-xs text-slate-500">Already posted penalties remain in the account. Use an audited discount for a concession. Backdated payments do not silently remove posted penalties.</p>
  </div>;
}
