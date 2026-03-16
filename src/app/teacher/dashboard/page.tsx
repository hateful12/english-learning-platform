import { redirect } from "next/navigation";
import { isTeacherLoggedIn } from "@/lib/auth";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { LogoutButton } from "@/components/LogoutButton";
import Link from "next/link";

export default async function TeacherDashboardPage() {
  const loggedIn = await isTeacherLoggedIn();
  if (!loggedIn) {
    redirect("/teacher");
  }
  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundImage: "url('/uk-flag-bg.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
    >
      <div className="pointer-events-none fixed inset-0 bg-white/55 backdrop-blur-[2px]" aria-hidden="true" />
      <header className="sticky top-0 z-10 relative border-b border-white/40 bg-white/70 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-3 md:px-8">
          <h1 className="font-serif text-xl font-semibold text-ink">
            Teacher dashboard
          </h1>
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
