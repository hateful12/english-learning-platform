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
    <header className="header-london-bg sticky top-0 z-10 border-b border-white/20 bg-black/40 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-1 md:px-8">
        <Logo variant="light" />
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/90">
            {student.name || student.email}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white/95 hover:text-white border border-white/40 bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
