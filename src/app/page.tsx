import type React from "react";
import Link from "next/link";
import { getStudentId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StudentDashboard } from "@/components/StudentDashboard";
import { StudentHeader } from "@/components/StudentHeader";
import { Logo } from "@/components/Logo";

export default async function HomePage() {
  const studentId = await getStudentId();
  const student = studentId
    ? await prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, email: true, name: true },
      })
    : null;

  const pageBg: React.CSSProperties = {
    backgroundImage: "url('/uk-flag-bg.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
  };

  if (!student) {
    return (
      <div className="relative min-h-screen" style={pageBg}>
        <div className="pointer-events-none fixed inset-0 bg-white/60 backdrop-blur-[2px]" aria-hidden="true" />
        <header className="relative border-b border-white/40 bg-white/70 backdrop-blur-md">
          <div className="flex items-center justify-between px-6 py-1 md:px-10">
            <Logo />
            <div className="flex gap-3">
              <Link href="/login" className="text-sm text-ink/60 hover:text-ink transition-colors">
                Log in
              </Link>
              <Link href="/teacher" className="text-sm text-ink/60 hover:text-ink transition-colors">
                Teacher
              </Link>
            </div>
          </div>
        </header>
        <main className="relative px-6 py-12 md:px-10">
          <div className="mx-auto max-w-md">
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
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen" style={pageBg}>
      <div className="pointer-events-none fixed inset-0 bg-white/55 backdrop-blur-[2px]" aria-hidden="true" />
      <StudentHeader student={student} />
      <main className="relative py-6 px-[4%] md:px-[7%]">
        <StudentDashboard />
      </main>
    </div>
  );
}
