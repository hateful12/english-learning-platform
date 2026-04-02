"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LEARN_ENGLISH_AI_PROMPTS,
  applyTemplateValues,
  friendlyPlaceholderLabel,
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

function fieldId(token: string, index: number): string {
  return `learn-ai-field-${index}-${token.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 24)}`;
}

export function LearnEnglishAiTab() {
  const byCat = useMemo(() => groupByCategory(LEARN_ENGLISH_AI_PROMPTS), []);
  const categories = useMemo(() => Array.from(byCat.keys()).sort(), [byCat]);
  const [openCategory, setOpenCategory] = useState<string | null>(categories[0] ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [optionalNote, setOptionalNote] = useState("");
  const [draft, setDraft] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedPrompt = useMemo(
    () => (selectedId ? LEARN_ENGLISH_AI_PROMPTS.find((p) => p.id === selectedId) ?? null : null),
    [selectedId]
  );

  const placeholders = useMemo(
    () => (selectedPrompt ? placeholdersInTemplate(selectedPrompt.template) : []),
    [selectedPrompt]
  );

  useEffect(() => {
    if (!selectedPrompt) {
      setFieldValues({});
      setOptionalNote("");
      return;
    }
    const keys = placeholdersInTemplate(selectedPrompt.template);
    setFieldValues(Object.fromEntries(keys.map((k) => [k, ""])));
    setOptionalNote("");
  }, [selectedPrompt]);

  const builtFirstMessage = useMemo(() => {
    if (!selectedPrompt) return "";
    if (placeholders.length === 0) {
      const base = selectedPrompt.template.trim();
      const note = optionalNote.trim();
      return note ? `${base}\n\n---\nMy note: ${note}` : base;
    }
    return applyTemplateValues(selectedPrompt.template, fieldValues).trim();
  }, [selectedPrompt, placeholders.length, fieldValues, optionalNote]);

  const guidedFieldsComplete =
    placeholders.length === 0 ||
    placeholders.every((token) => fieldValues[token]?.trim().length > 0);

  const pendingInBuilt =
    placeholders.length > 0 ? placeholdersInTemplate(builtFirstMessage).length > 0 : false;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  function selectPrompt(p: LearnEnglishAiPrompt) {
    setSelectedId(p.id);
    setDraft("");
    setError("");
    setShowPreview(false);
  }

  async function sendPayload(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError("");
    const next: ChatLine[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setDraft("");
    setLoading(true);
    try {
      const res = await fetch("/api/student/learn-english/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const rawText = await res.text();
      let data: { error?: unknown; message?: unknown } = {};
      try {
        data = JSON.parse(rawText) as typeof data;
      } catch {
        /* non-JSON */
      }
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : `Request failed (${res.status}). ${rawText.slice(0, 120)}`;
        throw new Error(msg);
      }
      if (typeof data.message !== "string") {
        throw new Error("Invalid response from tutor.");
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.message as string }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function sendFirstMessage() {
    if (pendingInBuilt || !guidedFieldsComplete) return;
    await sendPayload(builtFirstMessage);
  }

  async function sendFollowUp() {
    await sendPayload(draft);
  }

  function clearChat() {
    setMessages([]);
    setDraft("");
    setError("");
    setSelectedId(null);
    setOptionalNote("");
    setShowPreview(false);
  }

  const inConversation = messages.length > 0;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
      <aside className="lg:w-[min(100%,320px)] shrink-0 space-y-3">
        <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-4">
          <h3 className="font-serif text-lg font-semibold text-ink">Learn with AI</h3>
          <ol className="mt-3 list-decimal list-inside space-y-2 text-sm text-ink/75">
            <li>
              <span className="text-ink/80">Pick an activity</span> from the list below.
            </li>
            <li>
              <span className="text-ink/80">Fill the short boxes</span> (if any). You don’t need to edit curly{" "}
              <code className="rounded bg-ink/10 px-1 text-xs">{"{ }"}</code> text yourself.
            </li>
            <li>
              <span className="text-ink/80">Send to tutor</span> — then keep chatting in the box if you want.
            </li>
          </ol>
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
                          onClick={() => selectPrompt(p)}
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
                          <span className="mt-1 block text-[11px] text-accent/90 font-medium">Use this activity →</span>
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
            disabled={loading || (messages.length === 0 && !selectedPrompt && !draft.trim())}
          >
            Start over
          </button>
        </div>

        <div
          ref={scrollRef}
          className="min-h-[200px] max-h-[min(45vh,360px)] overflow-y-auto rounded-lg border border-ink/10 bg-ink/[0.02] p-4 space-y-4"
        >
          {messages.length === 0 && !loading && (
            <p className="text-sm text-ink/50 text-center py-6 px-2">
              {!selectedPrompt
                ? "Choose an activity on the left to begin, or scroll down and write your own question to the tutor."
                : "Fill the form below, then press “Send to tutor”."}
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "ml-4 sm:ml-8" : "mr-4 sm:mr-8"}>
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

        {!inConversation && selectedPrompt && (
          <div className="rounded-xl border border-accent/25 bg-accent/[0.06] p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Your activity</p>
              <p className="mt-1 font-medium text-ink">{selectedPrompt.title}</p>
              {selectedPrompt.description && (
                <p className="mt-1 text-sm text-ink/65">{selectedPrompt.description}</p>
              )}
            </div>

            {placeholders.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-ink/70">Answer these — we’ll build the message for you.</p>
                {placeholders.map((token, index) => {
                  const id = fieldId(token, index);
                  return (
                    <div key={token}>
                      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1">
                        {friendlyPlaceholderLabel(token)}
                      </label>
                      <textarea
                        id={id}
                        value={fieldValues[token] ?? ""}
                        onChange={(e) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [token]: e.target.value,
                          }))
                        }
                        rows={token.includes("Transcript") || token.includes("Paragraph") || token.includes("Sample") ? 4 : 2}
                        disabled={loading}
                        placeholder="Type here…"
                        className="input w-full min-h-[2.5rem] resize-y text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-ink/75">
                  Nothing to fill in — you can send this activity as it is. Optionally add a short note first.
                </p>
                <label className="block text-sm font-medium text-ink mb-1">Optional note for the tutor</label>
                <textarea
                  value={optionalNote}
                  onChange={(e) => setOptionalNote(e.target.value)}
                  rows={2}
                  disabled={loading}
                  placeholder="e.g. I’m preparing for a job interview next week."
                  className="input w-full resize-y text-sm"
                />
              </div>
            )}

            {placeholders.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowPreview((s) => !s)}
                  className="text-sm text-accent font-medium hover:underline"
                >
                  {showPreview ? "Hide" : "Show"} full message preview
                </button>
                {showPreview && (
                  <pre className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-ink/10 bg-white/80 p-3 text-xs text-ink/80 whitespace-pre-wrap break-words">
                    {builtFirstMessage || "…"}
                  </pre>
                )}
              </div>
            )}

            {pendingInBuilt && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
                Finish all boxes above — some placeholders are still empty inside your answers.
              </p>
            )}

            {!guidedFieldsComplete && placeholders.length > 0 && (
              <p className="text-xs text-ink/55">Fill every box to enable Send.</p>
            )}

            <button
              type="button"
              onClick={() => void sendFirstMessage()}
              disabled={loading || !guidedFieldsComplete || pendingInBuilt}
              className="btn-primary w-full sm:w-auto"
            >
              {loading ? "Sending…" : "Send to tutor"}
            </button>
          </div>
        )}

        {inConversation && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-ink">Your reply</label>
            <p className="text-xs text-ink/55 -mt-1">Answer the tutor, ask a follow-up, or type anything you want.</p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void sendFollowUp();
                }
              }}
              placeholder="Type your message…"
              rows={5}
              disabled={loading}
              className="input min-h-[100px] resize-y w-full font-sans text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void sendFollowUp()}
                disabled={loading || !draft.trim()}
                className="btn-primary"
              >
                {loading ? "Sending…" : "Send"}
              </button>
              <span className="text-xs text-ink/45">Ctrl+Enter to send</span>
            </div>
          </div>
        )}

        {!inConversation && !selectedPrompt && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-ink">Or write your own question</label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void sendPayload(draft);
                }
              }}
              placeholder="Example: Can you explain the difference between “say” and “tell” with examples?"
              rows={5}
              disabled={loading}
              className="input min-h-[100px] resize-y w-full font-sans text-sm"
            />
            <button
              type="button"
              onClick={() => void sendPayload(draft)}
              disabled={loading || !draft.trim()}
              className="btn-primary"
            >
              {loading ? "Sending…" : "Send to tutor"}
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
      </section>
    </div>
  );
}
