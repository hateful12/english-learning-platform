import { Suspense } from "react";
import { JoinPageClient } from "@/components/JoinPageClient";
import Link from "next/link";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-sm text-ink/60 hover:text-ink">
          ← Back
        </Link>
        <h1 className="font-serif text-2xl font-semibold text-ink">
          Join the platform
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          Use your invite link to create your student account.
        </p>
        <Suspense fallback={<div className="mt-6 text-ink/50">Loading…</div>}>
          <JoinPageClient token={token} />
        </Suspense>
      </div>
    </div>
  );
}
