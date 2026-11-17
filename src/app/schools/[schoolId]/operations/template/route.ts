import { schoolAccess } from "@/lib/school";
import { importHeaders, optionalImportHeaders } from "@/services/student-import";
import { csv } from "@/services/report-filters";

export async function GET(_request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  await schoolAccess((await params).schoolId, "students");
  return new Response(csv([[...importHeaders, ...optionalImportHeaders]]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="student-import-template.csv"', "Cache-Control": "private, no-store" } });
}
