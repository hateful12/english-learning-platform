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
    <header className="sticky top-0 z-10 border-b border-ink/10 bg-white/70 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-1 md:px-8">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-sm text-ink/60">
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
