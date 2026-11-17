import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), payments: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/school", () => ({ schoolAccess: mocks.access }));
vi.mock("@/lib/prisma", () => ({ prisma: { payment: { findMany: mocks.payments }, $queryRaw: mocks.query } }));
import { GET } from "../../src/app/schools/[schoolId]/reports/export/route";

const context = { params: Promise.resolve({ schoolId: "school" }) };
describe("school report exports", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.access.mockResolvedValue({}); });
  it("authorizes before reading or exporting any data", async () => {
    mocks.access.mockRejectedValue(new Error("not found"));
    await expect(GET(new Request("https://example.test/export?kind=collections"), context)).rejects.toThrow("not found");
    expect(mocks.payments).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it.each(["kind=unknown", "kind=collections&from=2026-02-30", "kind=collections&from=2026-04-02&to=2026-04-01"])("rejects invalid filters: %s", async query => {
    expect((await GET(new Request(`https://example.test/export?${query}`), context)).status).toBe(400);
    expect(mocks.payments).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("exports scoped inclusive dates and original receipt identities without caching", async () => {
    mocks.payments.mockResolvedValue([{ receiptNumber: "EX-0000001", paidOn: new Date("2026-04-01"), studentAdmissionNumber: "001", studentName: "=Example", mode: "CASH", reference: "", amountPaise: 10001, recordedByName: "Synthetic Staff" }]);
    const response = await GET(new Request("https://example.test/export?kind=collections&from=2026-04-01&to=2026-04-01"), context);
    expect(mocks.access).toHaveBeenCalledWith("school");
    expect(mocks.payments).toHaveBeenCalledWith({ where: { schoolId: "school", reversedAt: null, paidOn: { gte: new Date("2026-04-01"), lte: new Date("2026-04-01") } }, orderBy: [{ paidOn: "asc" }, { id: "asc" }] });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="collections.csv"');
    expect(await response.text()).toContain('"001","\'=Example","CASH","","100.01"');
  });
  it("exports complete overdue balances and retains exact monetary precision", async () => {
    mocks.query.mockResolvedValue([{ admissionNumber: "EX-1", name: "Synthetic Student", className: "5A", remaining: BigInt(10001), overdue: BigInt(1) }]);
    const response = await GET(new Request("https://example.test/export?kind=overdue"), context);
    expect(await response.text()).toContain('"EX-1","Synthetic Student","5A","100.01","0.01"');
    expect(mocks.payments).not.toHaveBeenCalled();
  });
  it("applies the same class, lifecycle, search and mode filters to collection downloads", async () => {
    mocks.payments.mockResolvedValue([]);
    await GET(new Request("https://example.test/export?kind=collections&q=Demo&className=5A&lifecycle=INACTIVE&mode=CASH"),context);
    expect(mocks.payments).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ schoolId:"school",mode:"CASH",reversedAt:null,student:expect.objectContaining({schoolId:"school",enrollments:{some:{schoolClass:{name:"5A"}}},status:"INACTIVE"}) }) }));
  });
  it("exports payments, discounts and signed reversal entries separately", async () => {
    mocks.query.mockResolvedValue([{eventOn:"2026-11-16",kind:"PAYMENT_REVERSAL",recordId:"p",admissionNumber:"EX-1",name:"Demo",className:"5A",lifecycle:"ACTIVE",mode:"CASH",amountPaise:200001,cashPaise:-200001,discountPaise:0,state:"REVERSED",receipt:"EX-0001",reason:"Correction",actor:"staff",recordedAt:new Date("2026-11-15T20:00:00Z")}]);
    const response=await GET(new Request("https://example.test/export?kind=transactions&className=5A"),context);
    const output=await response.text();
    expect(output).toContain('"PAYMENT_REVERSAL"');expect(output).toContain('"2000.01","-2000.01","0.00"');
    expect(mocks.payments).not.toHaveBeenCalled();
  });
});
