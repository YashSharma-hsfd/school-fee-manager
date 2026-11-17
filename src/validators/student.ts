import { z } from "zod";
export const studentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  dateOfBirth: z.iso.date("A valid date of birth is required").refine(value => value <= new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), "Date of birth cannot be in the future"),
  admissionDate: z.union([z.iso.date(), z.literal("")]).default(""),
  admissionNumber: z.string().trim().min(1, "Admission number is required").max(40)
    .regex(/^[A-Za-z0-9/-]+$/, "Use letters, numbers, slashes or hyphens")
    .transform(value => value.toUpperCase()),
  guardianName: z.string().trim().max(120).default(""),
  guardianPhone: z.string().trim().max(30).default("")
    .refine(value => !value || (/^\+?[0-9 ()-]+$/.test(value) && value.replace(/\D/g, "").length >= 7), "Enter a valid phone number"),
});
export type StudentInput = z.infer<typeof studentSchema>;

