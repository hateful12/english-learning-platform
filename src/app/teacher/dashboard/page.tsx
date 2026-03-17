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
      <header className="header-london-bg sticky top-0 z-10 border-b border-white/20 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Logo variant="light" />
            <span className="hidden sm:inline-flex items-center rounded-full border border-white/40 bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white tracking-wide uppercase">
              Teacher
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-white/90 hover:text-white transition-colors">
              View as student
            </Link>
            <LogoutButton className="rounded-lg px-4 py-2 text-sm font-medium text-white/95 hover:text-white border border-white/40 bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent" />
          </div>
        </div>
      </header>
      <main className="relative py-6 px-[4%] md:px-[7%]">
        <TeacherDashboard />
      </main>
    </div>
  );
}
