"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/teacher");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} className="btn-secondary text-sm">
      Log out
    </button>
  );
}
