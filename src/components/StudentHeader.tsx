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
    <header className="border-b border-ink/10 bg-white/60 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="senira.english"
            width={160}
            height={60}
            className="h-12 w-auto object-contain"
            priority
          />
        </Link>
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
