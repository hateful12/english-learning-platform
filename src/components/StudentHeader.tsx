"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Student = { id: string; email: string; name: string | null };

export function StudentHeader({ student }: { student: Student }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/student/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-white/10 bg-[#0a0f2c]">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="senira.english"
            width={220}
            height={88}
            className="h-16 w-auto object-contain"
            priority
          />
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/70">
            {student.name || student.email}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-white/30 px-3 py-1.5 text-sm text-white/80 hover:border-white/60 hover:text-white transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
