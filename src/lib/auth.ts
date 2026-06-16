import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const TEACHER_COOKIE = "english_teacher_session";
const STUDENT_COOKIE = "english_student_session";
export const SUPER_ADMIN_EMAIL = "irenn.boiko@gmail.com";

export type TeacherRole = "teacher" | "super-admin";

export type TeacherSession = {
  id: string;
  email: string;
  role: TeacherRole;
  isSuperAdmin: boolean;
};

function getSessionSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET environment variable is not set");
  return new TextEncoder().encode(secret);
}

async function signToken(payload: Record<string, string>, maxAgeSeconds: number): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSeconds)
    .sign(getSessionSecret());
}

async function verifyToken(token: string): Promise<Record<string, string> | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return payload as Record<string, string>;
  } catch {
    return null;
  }
}

// ——— Teacher ———
export async function setTeacherSession(teacherId: string) {
  const maxAge = 60 * 60 * 24 * 7;
  const token = await signToken({ sub: teacherId, role: "teacher" }, maxAge);
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
  cookieStore.set(TEACHER_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge,
    path: "/",
  });
}

export async function clearTeacherSession() {
  const cookieStore = await cookies();
  cookieStore.delete(TEACHER_COOKIE);
}

function normalizeTeacherRole(role: string | null | undefined, email: string): TeacherRole {
  if (email.trim().toLowerCase() === SUPER_ADMIN_EMAIL) return "super-admin";
  if (role === "super-admin" || role === "admin") return "super-admin";
  return "teacher";
}

export async function getTeacherSession(): Promise<TeacherSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TEACHER_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.sub) return null;
  const teacher = await prisma.teacher.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true },
  });
  if (!teacher) return null;
  const role = normalizeTeacherRole(teacher.role, teacher.email);
  return {
    id: teacher.id,
    email: teacher.email,
    role,
    isSuperAdmin: role === "super-admin",
  };
}

export async function isTeacherLoggedIn(): Promise<boolean> {
  return (await getTeacherSession()) !== null;
}

export async function isSuperAdminTeacher(): Promise<boolean> {
  return (await getTeacherSession())?.isSuperAdmin === true;
}

export async function teacherCanAccessStudent(
  teacher: TeacherSession,
  studentId: string
): Promise<boolean> {
  if (teacher.isSuperAdmin) return true;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      teacherId: true,
      groups: { select: { group: { select: { teacherId: true } } } },
    },
  });
  if (!student) return false;
  if (student.teacherId === teacher.id) return true;
  // Also allow if the student is in a group assigned to this teacher
  return student.groups.some((sg) => sg.group.teacherId === teacher.id);
}

/** Returns teacher id if email+password match a teacher, null otherwise. */
export async function verifyTeacherPassword(
  email: string,
  password: string
): Promise<string | null> {
  const teacher = await prisma.teacher.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, passwordHash: true },
  });
  if (!teacher) return null;
  const ok = await bcrypt.compare(password, teacher.passwordHash);
  return ok ? teacher.id : null;
}

// ——— Student ———
export async function setStudentSession(studentId: string) {
  const maxAge = 60 * 60 * 24 * 7;
  const token = await signToken({ sub: studentId, role: "student" }, maxAge);
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
  cookieStore.set(STUDENT_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge,
    path: "/",
  });
}

export async function clearStudentSession() {
  const cookieStore = await cookies();
  cookieStore.delete(STUDENT_COOKIE);
}

export async function getStudentId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.sub) return null;
  const student = await prisma.student.findUnique({ where: { id: payload.sub }, select: { id: true } });
  return student?.id ?? null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyStudentPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
