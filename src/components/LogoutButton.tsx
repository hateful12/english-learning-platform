"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/teacher");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={className ?? "btn-secondary text-sm"}
    >
      Log out
    </button>
  );
}
