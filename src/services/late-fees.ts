// Feature boundary: configuration, catch-up posting and rollback switch live here.
// Posted late fees use the existing charge ledger, so payments/reports need no separate arithmetic.
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { SessionUser } from "./auth";
import { dateOnly, dateSchema, FeeRuleError, moneySchema } from "./fee-calculations";
import { inSchool } from "./school-transactions";
import { addDays, calculateLateFees, localDay } from "./late-fee-calculations";

export const lateFeesEnabled = () => !["false", "0"].includes(process.env.LATE_FEES_ENABLED?.toLowerCase() ?? "");
export const lateFeeAmountSchema = z.preprocess(value => value === undefined || value === "" ? "0" : value,
  z.string().trim().transform((value, ctx) => {
    if (/^0(?:\.0{1,2})?$/.test(value)) return 0;
    const parsed = moneySchema.safeParse(value);
    if (parsed.success) return parsed.data;
    ctx.addIssue({ code: "custom", message: "Enter a valid late fee in rupees, or 0 to disable it" }); return z.NEVER;
  }));

type Tx = Prisma.TransactionClient;
async function lateFeeAudit(tx: Tx, actor: SessionUser, schoolId: string, action: string, entityType: string, entityId: string, details: Prisma.InputJsonValue) {
  await tx.auditEvent.create({ data: { schoolId, actorId: actor.id, actorName: actor.name, action, entityType, entityId, details } });
}

export async function createLateFeePolicyInTransaction(tx: Tx, actor: SessionUser, schoolId: string, feePlanId: string, amountPaise: number, intervalMonths: number, effectiveFrom: Date) {
  const policy = await tx.lateFeePolicy.create({ data: { schoolId, feePlanId, amountPaise, intervalMonths, effectiveFrom, createdById: actor.id } });
  await lateFeeAudit(tx, actor, schoolId, "LATE_FEE_POLICY_CONFIGURED", "FeePlan", feePlanId, { policyId: policy.id, amountPaise, intervalMonths, effectiveFrom: dateOnly(effectiveFrom), graceDays: 15 });
  return policy;
}

export async function configureLateFees(actor: SessionUser, schoolId: string, input: unknown) {
  const data = z.object({ feePlanId: z.string().min(1).max(128), amount: lateFeeAmountSchema, effectiveFrom: dateSchema }).parse(input);
  if (!lateFeesEnabled()) throw new FeeRuleError("The late-fee module is disabled.");
  return inSchool(actor, schoolId, "configure", async tx => {
    const plan = await tx.feePlan.findFirst({ where: { schoolId, id: data.feePlanId }, include: { items: true, lateFeePolicies: true } });
    if (!plan || !plan.items.length) throw new FeeRuleError("Select a configured fee plan in this school");
    const today = localDay(new Date());
    // A new policy may start today. Changes to an existing active policy start tomorrow or later.
    const minimum = plan.lateFeePolicies.some(policy => dateOnly(policy.effectiveFrom) <= today) ? addDays(today, 1) : today;
    if (dateOnly(data.effectiveFrom) < minimum) throw new FeeRuleError(`Use an effective date of ${minimum} or later. Already posted fees are preserved.`);
    const count = Math.max(...plan.items.map(item => item.installment));
    const interval = ({ 12: 1, 4: 3, 1: 12 } as Record<number, number>)[count];
    if (!interval) throw new FeeRuleError("This fee plan has an unsupported installment schedule");
    return createLateFeePolicyInTransaction(tx, actor, schoolId, plan.id, data.amount, interval, data.effectiveFrom);
  });
}

export async function assessLateFeesInTransaction(tx: Tx, schoolId: string, studentId?: string, asOf = localDay(new Date())) {
  if (!lateFeesEnabled()) return 0;
  dateSchema.parse(asOf);
  const policies = await tx.lateFeePolicy.findMany({ where: { schoolId, effectiveFrom: { lte: new Date(`${asOf}T00:00:00Z`) } }, orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }, { id: "asc" }] });
  const planIds = [...new Set(policies.filter(policy => policy.amountPaise > 0).map(policy => policy.feePlanId))];
  if (!planIds.length) return 0;
  const assignments = await tx.enrollmentFeeAssignment.findMany({ where: { schoolId, feePlanId: { in: planIds }, ...(studentId ? { enrollment: { studentId } } : {}) }, include: { enrollment: { include: { charges: { include: { allocations: { include: { payment: true } }, credits: { include: { discount: true } } } } } } } });
  const pending: { data: Prisma.StudentChargeCreateManyInput & { enrollmentId: string; lateFeeForDueOn: Date; lateFeeCycleOn: Date }; details: Prisma.InputJsonValue }[] = [];
  for (const assignment of assignments) {
    const enrollment = assignment.enrollment;
    const versions = policies.filter(policy => policy.feePlanId === assignment.feePlanId);
    const eligibleFrom = addDays([dateOnly(enrollment.startsOn), localDay(assignment.createdAt)].sort().at(-1)!, 16);
    const assessments = calculateLateFees({ asOf, eligibleFrom,
      policies: versions.map(policy => ({ amountPaise: policy.amountPaise, intervalMonths: policy.intervalMonths, effectiveFrom: dateOnly(policy.effectiveFrom) })),
      principals: enrollment.charges.filter(charge => charge.planItemId !== null).map(charge => ({ dueOn: dateOnly(charge.dueOn), amountPaise: charge.amountPaise,
        settlements: [
          ...charge.allocations.map(item => ({ amountPaise: item.amountPaise, on: dateOnly(item.payment.paidOn), reversedOn: item.payment.reversedAt ? localDay(item.payment.reversedAt) : null })),
          ...charge.credits.map(item => ({ amountPaise: item.amountPaise, on: localDay(item.discount.createdAt), reversedOn: item.discount.reversedAt ? localDay(item.discount.reversedAt) : null })),
        ],
      })),
    });
    const existing = new Set(enrollment.charges.filter(charge => charge.lateFeeForDueOn && charge.lateFeeCycleOn).map(charge => `${dateOnly(charge.lateFeeForDueOn!)}:${dateOnly(charge.lateFeeCycleOn!)}`));
    for (const assessment of assessments) {
      if (existing.has(`${assessment.forDueOn}:${assessment.cycleOn}`)) continue;
      const data = { schoolId, enrollmentId: enrollment.id, amountPaise: assessment.amountPaise,
        dueOn: new Date(`${assessment.dueOn}T00:00:00Z`), lateFeeForDueOn: new Date(`${assessment.forDueOn}T00:00:00Z`), lateFeeCycleOn: new Date(`${assessment.cycleOn}T00:00:00Z`),
        label: `Late fee: installment ${assessment.forDueOn}, cycle ${assessment.cycleOn}` };
      const policy = versions.findLast(item => dateOnly(item.effectiveFrom) <= assessment.dueOn)!;
      pending.push({ data, details: { ...assessment, policyId: policy.id, studentId: enrollment.studentId, enrollmentId: enrollment.id } });
    }
  }
  if (!pending.length) return 0;
  // Batch both writes: catching up a school must not require multiple round trips per penalty.
  const inserted = await tx.studentCharge.createManyAndReturn({ data: pending.map(item => item.data), skipDuplicates: true,
    select: { id: true, enrollmentId: true, lateFeeForDueOn: true, lateFeeCycleOn: true } });
  const key = (enrollmentId: string, original: Date, cycle: Date) => `${enrollmentId}:${dateOnly(original)}:${dateOnly(cycle)}`;
  const details = new Map(pending.map(item => [key(item.data.enrollmentId, item.data.lateFeeForDueOn, item.data.lateFeeCycleOn), item.details]));
  if (inserted.length) await tx.auditEvent.createMany({ data: inserted.map(charge => ({ schoolId, actorId: "system:late-fees", actorName: "Automatic late fees", action: "LATE_FEE_ASSESSED", entityType: "StudentCharge", entityId: charge.id,
    details: details.get(key(charge.enrollmentId!, charge.lateFeeForDueOn!, charge.lateFeeCycleOn!))!,
  })) });
  return inserted.length;
}

export async function refreshLateFees(actor: SessionUser, schoolId: string) {
  if (!lateFeesEnabled()) return 0;
  return inSchool(actor, schoolId, "view", tx => assessLateFeesInTransaction(tx, schoolId));
}
