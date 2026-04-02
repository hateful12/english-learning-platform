import { Suspense } from "react";
import { StudentLogin } from "@/components/StudentLogin";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-sm text-ink/60 hover:text-ink">
          ← Back
        </Link>
        <h1 className="font-serif text-2xl font-semibold text-ink">
          Student login
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          Sign in to see your homework, lessons, and payment info.
        </p>
        <Suspense fallback={<p className="mt-6 text-sm text-ink/40">Loading…</p>}>
          <StudentLogin />
        </Suspense>
        <p className="mt-4 text-center text-sm text-ink/50">
          Need an account? Use the invite link from your teacher.
        </p>
      </div>
    </div>
  );
}
