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

  const DecorativeLetters = () => (
    <div className="pointer-events-none fixed inset-0 overflow-hidden select-none" aria-hidden="true">
      <span className="absolute font-serif font-bold text-[160px] text-ink/[0.025] top-[2%] left-[0%]" style={{ transform: "rotate(-15deg)", lineHeight: 1 }}>A</span>
      <span className="absolute font-serif font-bold text-[120px] text-accent/[0.04] top-[18%] right-[2%]" style={{ transform: "rotate(8deg)", lineHeight: 1 }}>B</span>
      <span className="absolute font-serif font-bold text-[100px] text-ink/[0.025] top-[48%] left-[0%]" style={{ transform: "rotate(6deg)", lineHeight: 1 }}>C</span>
      <span className="absolute font-serif font-bold text-[130px] text-ink/[0.02] bottom-[18%] right-[1%]" style={{ transform: "rotate(-10deg)", lineHeight: 1 }}>D</span>
      <span className="absolute font-serif font-bold text-[90px] text-accent/[0.035] bottom-[4%] left-[4%]" style={{ transform: "rotate(12deg)", lineHeight: 1 }}>E</span>
      <span className="absolute font-serif font-bold text-[80px] text-ink/[0.02] top-[36%] right-[7%]" style={{ transform: "rotate(-6deg)", lineHeight: 1 }}>F</span>
      <span className="absolute font-serif font-bold text-[110px] text-ink/[0.02] bottom-[40%] left-[3%]" style={{ transform: "rotate(-18deg)", lineHeight: 1 }}>G</span>
    </div>
  );

  if (!student) {
    return (
      <div className="relative min-h-screen" style={{ background: "radial-gradient(ellipse 70% 45% at 8% 0%, rgba(233,69,96,0.07) 0%, transparent 55%), radial-gradient(ellipse 55% 55% at 92% 100%, rgba(26,26,46,0.05) 0%, transparent 50%), var(--paper)" }}>
        <DecorativeLetters />
        <header className="relative border-b border-ink/10 bg-white/70 backdrop-blur-md">
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
    <div className="relative min-h-screen" style={{ background: "radial-gradient(ellipse 70% 45% at 8% 0%, rgba(233,69,96,0.07) 0%, transparent 55%), radial-gradient(ellipse 55% 55% at 92% 100%, rgba(26,26,46,0.05) 0%, transparent 50%), var(--paper)" }}>
      <DecorativeLetters />
      <StudentHeader student={student} />
      <main className="relative py-6 px-[4%] md:px-[7%]">
        <StudentDashboard />
      </main>
    </div>
  );
}
