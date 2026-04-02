import { redirect } from "next/navigation";
import { isTeacherLoggedIn } from "@/lib/auth";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { LogoutButton } from "@/components/LogoutButton";
import { Logo } from "@/components/Logo";
import { HeaderBackground } from "@/components/HeaderBackground";
import Link from "next/link";

export default async function TeacherDashboardPage() {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    redirect("/teacher");
  }
  return (
    <div className="min-h-screen">
      <header className="relative sticky top-0 z-10 min-h-[88px] border-b border-ink/10 overflow-hidden">
        <HeaderBackground />
        <div className="relative flex items-center justify-between px-6 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden sm:inline-flex items-center rounded-full border border-accent/30 bg-accent/8 px-2.5 py-0.5 text-xs font-semibold text-accent tracking-wide uppercase">
              Teacher
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-ink/60 hover:text-ink transition-colors">
              View as student
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="relative py-6 px-[4%] md:px-[7%]">
        <TeacherDashboard />
      </main>
    </div>
  );
}
