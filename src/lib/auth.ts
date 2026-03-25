import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const TEACHER_COOKIE = "english_teacher_session";
const STUDENT_COOKIE = "english_student_session";

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

// ——— Teacher (admin can manage homeworks, links, payment) ———
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

const TEACHER_ROLES = ["admin", "teacher"] as const;

export async function isTeacherLoggedIn(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TEACHER_COOKIE)?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  if (!payload?.sub) return false;
  const teacher = await prisma.teacher.findUnique({
    where: { id: payload.sub },
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
