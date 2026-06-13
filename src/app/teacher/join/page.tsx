import { Suspense } from "react";
import Link from "next/link";
import { TeacherJoinPageClient } from "@/components/TeacherJoinPageClient";

export default async function TeacherJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/teacher" className="mb-6 block text-sm text-ink/60 hover:text-ink">
          ← Back to teacher login
        </Link>
        <h1 className="font-serif text-2xl font-semibold text-ink">
          Join as a teacher
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          Use your teacher invite link to create your account.
        </p>
        <Suspense fallback={<div className="mt-6 text-ink/50">Loading…</div>}>
          <TeacherJoinPageClient token={token} />
        </Suspense>
      </div>
    </div>
  );
}
