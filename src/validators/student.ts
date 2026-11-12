import { z } from "zod";
export const studentSchema = z.object({ name: z.string().trim().min(1, "Name is required"), admissionNumber: z.string().trim().min(1, "Admission number is required") });
export type StudentInput = z.infer<typeof studentSchema>;

