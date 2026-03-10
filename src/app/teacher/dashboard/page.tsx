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
    <div className="min-h-screen">
      <header className="border-b border-ink/10 bg-white/60 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="font-serif text-2xl font-semibold text-ink">
            Teacher dashboard
          </h1>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-ink/60 hover:text-ink">
              View as student
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <TeacherDashboard />
      </main>
    </div>
  );
}
