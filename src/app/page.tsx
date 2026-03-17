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

  if (!student) {
    return (
      <div className="min-h-screen">
        <header className="header-london-bg border-b border-ink/10">
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
        <main className="px-6 py-12 md:px-10">
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
    <div className="min-h-screen">
      {/* Red phone box in the left 7% free zone */}
      <div className="hidden md:flex pointer-events-none fixed left-0 top-0 bottom-0 w-[7%] items-center justify-center z-0 overflow-hidden" aria-hidden="true">
        <svg viewBox="0 0 70 160" className="w-[75%] max-w-[85px] opacity-85" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Base */}
          <rect x="6" y="148" width="58" height="12" rx="2" fill="#cc0000"/>
          {/* Body */}
          <rect x="10" y="38" width="50" height="112" rx="2" fill="#cc0000"/>
          {/* Door frame */}
          <rect x="18" y="70" width="34" height="78" rx="2" fill="#a00000"/>
          {/* Door panel top arc */}
          <path d="M18 80 Q35 65 52 80" stroke="#cc0000" strokeWidth="2" fill="none"/>
          {/* Door glass panels */}
          <rect x="21" y="82" width="13" height="28" rx="1" fill="#bde0f5" opacity="0.7"/>
          <rect x="36" y="82" width="13" height="28" rx="1" fill="#bde0f5" opacity="0.7"/>
          <rect x="21" y="114" width="13" height="28" rx="1" fill="#bde0f5" opacity="0.7"/>
          <rect x="36" y="114" width="13" height="28" rx="1" fill="#bde0f5" opacity="0.7"/>
          {/* Door handle */}
          <rect x="33" y="108" width="4" height="8" rx="2" fill="#ffcc00"/>
          {/* Crown / top section */}
          <rect x="8" y="26" width="54" height="14" rx="2" fill="#cc0000"/>
          {/* Crown windows */}
          <rect x="13" y="42" width="14" height="22" rx="1" fill="#bde0f5" opacity="0.6"/>
          <rect x="43" y="42" width="14" height="22" rx="1" fill="#bde0f5" opacity="0.6"/>
          <rect x="29" y="42" width="12" height="22" rx="1" fill="#bde0f5" opacity="0.6"/>
          {/* Crown top dome */}
          <rect x="14" y="14" width="42" height="14" rx="3" fill="#cc0000"/>
          <ellipse cx="35" cy="14" rx="21" ry="5" fill="#dd1111"/>
          {/* Finial */}
          <rect x="31" y="4" width="8" height="12" rx="2" fill="#cc0000"/>
          <ellipse cx="35" cy="4" rx="5" ry="4" fill="#cc0000"/>
          <circle cx="35" cy="2" r="2.5" fill="#ffcc00"/>
          {/* TELEPHONE text hint — small lines */}
          <rect x="16" y="64" width="38" height="3" rx="1" fill="#ffcc00" opacity="0.9"/>
        </svg>
      </div>

      {/* Big Ben in the right 7% free zone */}
      <div className="hidden md:flex pointer-events-none fixed right-0 top-0 bottom-0 w-[7%] items-end justify-center pb-4 z-0 overflow-hidden" aria-hidden="true">
        <svg viewBox="0 0 80 260" className="w-[80%] max-w-[90px] opacity-80" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Foundation */}
          <rect x="10" y="245" width="60" height="15" rx="2" fill="#1a1a2e"/>
          {/* Lower tower */}
          <rect x="18" y="145" width="44" height="100" fill="#1a1a2e"/>
          {/* Lower windows */}
          <rect x="24" y="156" width="10" height="16" rx="5" fill="#f8f5f0"/>
          <rect x="46" y="156" width="10" height="16" rx="5" fill="#f8f5f0"/>
          <rect x="24" y="182" width="10" height="16" rx="5" fill="#f8f5f0"/>
          <rect x="46" y="182" width="10" height="16" rx="5" fill="#f8f5f0"/>
          <rect x="24" y="208" width="10" height="16" rx="5" fill="#f8f5f0"/>
          <rect x="46" y="208" width="10" height="16" rx="5" fill="#f8f5f0"/>
          {/* Decorative band */}
          <rect x="14" y="133" width="52" height="14" rx="2" fill="#1a1a2e"/>
          <rect x="16" y="135" width="48" height="10" rx="1" fill="#e94560" opacity="0.7"/>
          {/* Clock section */}
          <rect x="10" y="88" width="60" height="47" rx="3" fill="#1a1a2e"/>
          {/* Clock face */}
          <circle cx="40" cy="112" r="18" fill="#f8f5f0"/>
          <circle cx="40" cy="112" r="15" fill="white" stroke="#1a1a2e" strokeWidth="1.5"/>
          {/* Clock tick marks */}
          <line x1="40" y1="98" x2="40" y2="101" stroke="#1a1a2e" strokeWidth="1.5"/>
          <line x1="40" y1="123" x2="40" y2="126" stroke="#1a1a2e" strokeWidth="1.5"/>
          <line x1="26" y1="112" x2="29" y2="112" stroke="#1a1a2e" strokeWidth="1.5"/>
          <line x1="51" y1="112" x2="54" y2="112" stroke="#1a1a2e" strokeWidth="1.5"/>
          {/* Clock hands */}
          <line x1="40" y1="112" x2="40" y2="100" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round"/>
          <line x1="40" y1="112" x2="50" y2="108" stroke="#e94560" strokeWidth="1.5" strokeLinecap="round"/>
          {/* Belfry */}
          <rect x="14" y="52" width="52" height="38" rx="2" fill="#1a1a2e"/>
          {/* Belfry arched windows */}
          <rect x="20" y="58" width="12" height="22" rx="6" fill="#f8f5f0"/>
          <rect x="48" y="58" width="12" height="22" rx="6" fill="#f8f5f0"/>
          {/* Corner turrets */}
          <rect x="6" y="40" width="14" height="18" rx="2" fill="#1a1a2e"/>
          <rect x="60" y="40" width="14" height="18" rx="2" fill="#1a1a2e"/>
          <polygon points="13,40 6,40 6,36 20,36 20,40" fill="#1a1a2e"/>
          <polygon points="60,40 74,40 74,36 60,36" fill="#1a1a2e"/>
          {/* Spire base */}
          <rect x="26" y="20" width="28" height="34" rx="2" fill="#1a1a2e"/>
          {/* Spire */}
          <polygon points="40,2 24,20 56,20" fill="#1a1a2e"/>
          {/* Spire flag */}
          <line x1="40" y1="2" x2="40" y2="10" stroke="#e94560" strokeWidth="1.5"/>
          <polygon points="40,2 52,5 40,8" fill="#e94560"/>
        </svg>
      </div>

      <StudentHeader student={student} />
      <main className="relative py-6 px-[4%] md:px-[7%]">
        <StudentDashboard />
      </main>
    </div>
  );
}
