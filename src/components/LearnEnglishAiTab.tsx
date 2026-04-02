"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LEARN_ENGLISH_AI_PROMPTS,
  placeholdersInTemplate,
  type LearnEnglishAiPrompt,
} from "@/data/learnEnglishAiWorkbook";

type ChatRole = "user" | "assistant";

type ChatLine = { role: ChatRole; content: string };

function groupByCategory(prompts: LearnEnglishAiPrompt[]): Map<string, LearnEnglishAiPrompt[]> {
  const m = new Map<string, LearnEnglishAiPrompt[]>();
  for (const p of prompts) {
    const list = m.get(p.category) ?? [];
    list.push(p);
    m.set(p.category, list);
  }
  return m;
}

export function LearnEnglishAiTab() {
  const byCat = useMemo(() => groupByCategory(LEARN_ENGLISH_AI_PROMPTS), []);
  const categories = useMemo(() => Array.from(byCat.keys()).sort(), [byCat]);
  const [openCategory, setOpenCategory] = useState<string | null>(categories[0] ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const pendingPlaceholders = useMemo(() => placeholdersInTemplate(draft), [draft]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  function insertPrompt(p: LearnEnglishAiPrompt) {
    setSelectedId(p.id);
    setDraft(p.template);
    setError("");
  }

  async function send() {
    const text = draft.trim();
    if (!text || loading) return;
    setError("");
    const next: ChatLine[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    setLoading(true);
    try {
      const res = await fetch("/api/student/learn-english/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Request failed");
      }
      if (typeof data.message !== "string") {
        throw new Error("Invalid response from tutor.");
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setDraft("");
    setError("");
    setSelectedId(null);
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
      <aside className="lg:w-[min(100%,320px)] shrink-0 space-y-3">
        <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-4">
          <h3 className="font-serif text-lg font-semibold text-ink">Prompt library</h3>
          <p className="mt-1 text-sm text-ink/65">
            Pick a workbook-style prompt, replace{" "}
            <code className="rounded bg-ink/10 px-1 text-xs">{"{placeholders}"}</code>, then send. This is
            self-study practice alongside your teacher and homework.
          </p>
        </div>
        <div className="max-h-[min(52vh,420px)] overflow-y-auto rounded-lg border border-ink/10 bg-white/60">
          {categories.map((cat) => {
            const items = byCat.get(cat) ?? [];
            const open = openCategory === cat;
            return (
              <div key={cat} className="border-b border-ink/8 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenCategory(open ? null : cat)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-ink/[0.04]"
                >
                  <span>{cat}</span>
                  <span className="text-ink/40">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <ul className="space-y-1 px-2 pb-2">
                    {items.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => insertPrompt(p)}
                          className={[
                            "w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors",
                            selectedId === p.id
                              ? "border-accent/40 bg-accent/10 text-ink"
                              : "border-transparent bg-ink/[0.03] text-ink/85 hover:bg-ink/[0.06]",
                          ].join(" ")}
                        >
                          <span className="font-medium">{p.title}</span>
                          {p.description && (
                            <span className="mt-0.5 block text-xs text-ink/55 line-clamp-2">{p.description}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 flex-1 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-lg font-semibold text-ink">Chat with your AI tutor</h3>
          <button
            type="button"
            onClick={clearChat}
            className="btn-secondary text-sm py-1.5 px-3"
            disabled={loading || (messages.length === 0 && !draft)}
          >
            Clear chat
          </button>
        </div>

        <div
          ref={scrollRef}
          className="min-h-[200px] max-h-[min(45vh,360px)] overflow-y-auto rounded-lg border border-ink/10 bg-ink/[0.02] p-4 space-y-4"
        >
          {messages.length === 0 && !loading && (
            <p className="text-sm text-ink/50 text-center py-8">
              Insert a prompt from the library or type your own message to begin.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "ml-4 sm:ml-8" : "mr-4 sm:mr-8"}
            >
              <div
                className={[
                  "rounded-xl px-3 py-2.5 text-sm whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "bg-accent/15 text-ink border border-accent/20"
                    : "bg-white/90 text-ink border border-ink/10",
                ].join(" ")}
              >
                {m.content}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-ink/40">
                {m.role === "user" ? "You" : "Tutor"}
              </div>
            </div>
          ))}
          {loading && (
            <div className="mr-4 sm:mr-8">
              <div className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2.5 text-sm text-ink/50">
                Tutor is thinking…
              </div>
            </div>
          )}
        </div>

        {pendingPlaceholders.length > 0 && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
            Replace placeholders before sending for best results:{" "}
            {pendingPlaceholders.join(", ")}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Your message to the tutor…"
            rows={6}
            disabled={loading}
            className="input min-h-[120px] resize-y w-full font-sans text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void send()} disabled={loading || !draft.trim()} className="btn-primary">
              {loading ? "Sending…" : "Send"}
            </button>
            <span className="text-xs text-ink/45">Ctrl+Enter to send</span>
          </div>
        </div>
      </section>
    </div>
  );
}
