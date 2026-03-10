"use client";

import { useState, useEffect } from "react";

type Invite = {
  id: string;
  token: string;
  usedAt: string | null;
  createdAt: string;
  student?: { id: string; email: string; name: string | null } | null;
};

export function InviteSection() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function load() {
    fetch("/api/invite", { credentials: "include" })
      .then((r) => r.json())
      .then(setInvites)
      .catch(() => setInvites([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function createInvite() {
    setLoading(true);
    setLink(null);
    const res = await fetch("/api/invite", { method: "POST", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && data.link) {
      setLink(data.link);
      load();
    }
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/70">
        Create an invite link and share it with a student. They use it once to create their account.
      </p>
      <button
        type="button"
        onClick={createInvite}
        className="btn-primary"
        disabled={loading}
      >
        {loading ? "Creating…" : "Create invite link"}
      </button>
      {link && (
        <div className="rounded-lg border border-ink/10 bg-ink/5 p-3">
          <p className="text-xs font-medium text-ink/60">New invite link (copy and share):</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate text-sm text-ink">{link}</code>
            <button
              type="button"
              onClick={() => copyLink(link)}
              className="btn-secondary text-sm shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
      {invites.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink/70">Recent invites</p>
          <ul className="space-y-1 text-sm">
            {invites.slice(0, 10).map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-ink/70">
                  …{inv.token.slice(-8)} —{" "}
                  {inv.usedAt
                    ? `Used by ${inv.student?.name || inv.student?.email || "unknown student"}`
                    : "Unused"}
                </span>
                <button
                  type="button"
                  onClick={() => copyLink(`${baseUrl}/join?token=${inv.token}`)}
                  className="shrink-0 text-accent hover:underline"
                >
                  Copy link
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
