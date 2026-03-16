import { redirect } from "next/navigation";
import { isTeacherLoggedIn } from "@/lib/auth";
import { TeacherLogin } from "@/components/TeacherLogin";
import Link from "next/link";

export default async function TeacherPage() {
  const loggedIn = await isTeacherLoggedIn();
  if (loggedIn) {
    redirect("/teacher/dashboard");
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-sm text-ink/60 hover:text-ink">
          ← Back to student view
        </Link>
        <h1 className="font-serif text-2xl font-semibold text-ink">
          Teacher login
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          Enter your password to manage homework and links.
        </p>
        <TeacherLogin />
      </div>
    </div>
  );
}
