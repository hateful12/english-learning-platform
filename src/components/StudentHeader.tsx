"use client";

import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

type Student = { id: string; email: string; name: string | null };

export function StudentHeader({ student }: { student: Student }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/student/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="header-london-bg sticky top-0 z-10 border-b border-ink/10">
      <div className="flex items-center justify-between px-6 py-1 md:px-8">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="rounded-lg border border-ink/15 bg-ink/5 px-3 py-1.5 text-sm text-ink">
            {student.name || student.email}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="btn-secondary text-sm"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
