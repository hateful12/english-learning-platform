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
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4"
      style={{ backgroundImage: "url('/uk-flag-bg.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
    >
      <div className="pointer-events-none fixed inset-0 bg-white/60 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="relative w-full max-w-sm">
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
