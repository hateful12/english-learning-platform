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
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-lg bg-[#d42020] px-4 py-2 text-sm font-medium text-white hover:bg-[#b81a1a] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d42020] focus:ring-offset-2"
    >
      Log out
    </button>
  );
}
