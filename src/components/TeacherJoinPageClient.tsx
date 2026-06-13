"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function TeacherJoinPageClient({ token: initialToken }: { token?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || initialToken;
  const [token, setToken] = useState(tokenFromUrl || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(!!tokenFromUrl);
  const [valid, setValid] = useState<boolean | null>(null);
  const [lockedEmail, setLockedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenFromUrl) {
      setValidating(false);
      setValid(null);
      return;
    }
    setToken(tokenFromUrl);
    fetch(`/api/teacher-invite/validate?token=${encodeURIComponent(tokenFromUrl)}`)
      .then((r) => r.json())
      .then((data) => {
        setValid(data.valid === true);
        if (typeof data.email === "string" && data.email) {
          setLockedEmail(data.email);
          setEmail(data.email);
        }
        setValidating(false);
      })
      .catch(() => {
        setValid(false);
        setValidating(false);
      });
  }, [tokenFromUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const t = token.trim() || tokenFromUrl;
    if (!t) {
      setError("Enter or paste your teacher invite token from the link.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/teacher/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: t,
        email: email.trim(),
        password,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Signup failed");
      return;
    }

    router.push("/teacher/dashboard");
    router.refresh();
  }

  if (validating) {
    return <div className="mt-6 text-center text-ink/50">Checking invite…</div>;
  }

  if (tokenFromUrl && valid === false) {
    return (
      <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        This teacher invite link is invalid or has already been used. Ask the super-admin for a new link.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {!tokenFromUrl && (
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Teacher invite token"
          className="input"
        />
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="input"
        required
        readOnly={lockedEmail !== null}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min 8 characters)"
        className="input"
        minLength={8}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Creating account…" : "Create teacher account"}
      </button>
    </form>
  );
}
