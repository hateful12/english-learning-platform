import Link from "next/link";
import { getStudentId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StudentDashboard } from "@/components/StudentDashboard";
import { StudentHeader } from "@/components/StudentHeader";

export default async function HomePage() {
  const studentId = await getStudentId();
  const student = studentId
    ? await prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, email: true, name: true },
      })
    : null;

  if (!student) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-ink/10 bg-white/60 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <h1 className="font-serif text-2xl font-semibold text-ink">
              English with Teacher
            </h1>
            <div className="flex gap-3">
              <Link href="/login" className="text-sm text-ink/60 hover:text-ink">
                Log in
              </Link>
              <Link href="/teacher" className="text-sm text-ink/60 hover:text-ink">
                Teacher
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-12">
          <div className="card p-8 text-center">
            <h2 className="font-serif text-xl font-semibold text-ink">
              Welcome
            </h2>
            <p className="mt-2 text-ink/70">
              Log in to see your homework and payment info.
            </p>
            <p className="mt-4 text-sm text-ink/50">
              New here? Ask your teacher for an invite link to create your account.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/login" className="btn-primary">
                Log in
              </Link>
              <Link href="/join" className="btn-secondary">
                I have an invite link
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <StudentHeader student={student} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="mb-8 text-ink/70">
          Your homework and payment info.
        </p>
        <StudentDashboard />
      </main>
    </div>
  );
}
