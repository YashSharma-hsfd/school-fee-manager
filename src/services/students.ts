import { Prisma } from "@prisma/client";
import { z } from "zod";
import { studentSchema, type StudentInput } from "../validators/student";

export class StudentAccessError extends Error {
  constructor() {
    super("Administrator access is required");
  }
}

export class DuplicateAdmissionNumberError extends Error {
  constructor() {
    super("A student with this admission number already exists");
  }
}

type StudentRepository<T> = {
  create(args: { data: StudentInput }): Promise<T>;
};

// Resolve this from a verified server session, never from form or request data.
type SessionReader = () => Promise<{ role: string } | null>;

export class StudentConflictError extends Error {
  constructor() {
    super("This student was changed or removed since you opened the form. Reload the page before editing again.");
  }
}

const studentVersionSchema = z.object({ id: z.string().min(1).max(128), updatedAt: z.iso.datetime() });

export async function updateStudent(
  version: unknown,
  input: unknown,
  dependencies: {
    readSession: SessionReader;
    students: { updateMany(args: { where: { id: string; updatedAt: Date }; data: StudentInput & { updatedAt: Date } }): Promise<{ count: number }> };
  },
): Promise<void> {
  const session = await dependencies.readSession();
  if (session?.role !== "ADMIN") throw new StudentAccessError();
  const { id, updatedAt } = studentVersionSchema.parse(version);
  const data = studentSchema.parse(input);
  const previous = new Date(updatedAt);
  try {
    // Compare and update atomically so a stale form cannot overwrite a newer edit.
    const result = await dependencies.students.updateMany({
      where: { id, updatedAt: previous },
      data: { ...data, updatedAt: new Date(Math.max(Date.now(), previous.getTime() + 1)) },
    });
    if (result.count !== 1) throw new StudentConflictError();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DuplicateAdmissionNumberError();
    }
    throw error;
  }
}

export async function createStudent<T>(
  input: unknown,
  dependencies: { readSession: SessionReader; students: StudentRepository<T> },
): Promise<T> {
  const session = await dependencies.readSession();
  if (session?.role !== "ADMIN") throw new StudentAccessError();

  const data = studentSchema.parse(input);
  try {
    // The database unique constraint also protects concurrent submissions.
    return await dependencies.students.create({ data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DuplicateAdmissionNumberError();
    }
    throw error;
  }
}
