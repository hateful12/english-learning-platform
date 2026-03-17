import { redirect } from "next/navigation";
import { isTeacherLoggedIn } from "@/lib/auth";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { LogoutButton } from "@/components/LogoutButton";
import { Logo } from "@/components/Logo";
import Link from "next/link";

export default async function TeacherDashboardPage() {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    redirect("/teacher");
  }
  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-10 border-b border-white/10 overflow-hidden"
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 60%), url(/london-skyline-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 md:px-8 relative z-10 min-h-[130px] text-white">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden sm:inline-flex items-center rounded-full border border-white/40 bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white tracking-wide uppercase">
              Teacher
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-white/80 hover:text-white transition-colors">
              View as student
            </Link>
            <LogoutButton className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors" />
          </div>
        </div>
      </header>
      <main className="relative py-6 px-[4%] md:px-[7%]">
        <TeacherDashboard />
      </main>
    </div>
  );
}
