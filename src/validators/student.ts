import { z } from "zod";
export const studentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  admissionNumber: z.string().trim().min(1, "Admission number is required").max(40)
    .regex(/^[A-Za-z0-9/-]+$/, "Use letters, numbers, slashes or hyphens")
    .transform(value => value.toUpperCase()),
  className: z.string().trim().min(1, "Class is required").max(60),
  guardianName: z.string().trim().min(1, "Guardian name is required").max(120),
  guardianPhone: z.string().trim().min(1, "Guardian phone is required").max(30)
    .regex(/^\+?[0-9 ()-]+$/, "Enter a valid phone number")
    .refine(value => value.replace(/\D/g, "").length >= 7, "Enter at least seven digits"),
});
export type StudentInput = z.infer<typeof studentSchema>;

