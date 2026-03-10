import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const TEACHER_COOKIE = "english_teacher_session";
const STUDENT_COOKIE = "english_student_session";
const SESSION_SECRET = process.env.NEXTAUTH_SECRET || "default-dev-secret";

// ——— Teacher (admin can manage homeworks, links, payment) ———
export async function setTeacherSession(teacherId: string) {
  const cookieStore = await cookies();
  cookieStore.set(TEACHER_COOKIE, teacherId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearTeacherSession() {
  const cookieStore = await cookies();
  cookieStore.delete(TEACHER_COOKIE);
}

const TEACHER_ROLES = ["admin", "teacher"] as const;

export async function isTeacherLoggedIn(): Promise<boolean> {
  const cookieStore = await cookies();
  const teacherId = cookieStore.get(TEACHER_COOKIE)?.value;
  if (!teacherId) return false;
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { role: true },
  });
  return teacher != null && TEACHER_ROLES.includes(teacher.role as (typeof TEACHER_ROLES)[number]);
}

/** Returns teacher id if email+password match a teacher, null otherwise. */
export async function verifyTeacherPassword(
  email: string,
  password: string
): Promise<string | null> {
  const teacher = await prisma.teacher.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, passwordHash: true, role: true },
  });
  if (!teacher || !TEACHER_ROLES.includes(teacher.role as (typeof TEACHER_ROLES)[number])) return null;
  const ok = await bcrypt.compare(password, teacher.passwordHash);
  return ok ? teacher.id : null;
}

// ——— Student ———
export async function setStudentSession(studentId: string) {
  const cookieStore = await cookies();
  cookieStore.set(STUDENT_COOKIE, studentId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function clearStudentSession() {
  const cookieStore = await cookies();
  cookieStore.delete(STUDENT_COOKIE);
}

export async function getStudentId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(STUDENT_COOKIE)?.value;
  if (!value) return null;
  const student = await prisma.student.findUnique({ where: { id: value }, select: { id: true } });
  return student?.id ?? null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyStudentPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
