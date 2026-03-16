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
    <header className="border-b border-ink/10 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-1">
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
