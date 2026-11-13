import { Prisma } from "@prisma/client";
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
