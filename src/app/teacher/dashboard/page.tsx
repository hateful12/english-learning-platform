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
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-white/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-3 md:px-8">
          <Logo />
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
