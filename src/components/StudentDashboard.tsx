"use client";

import { useEffect, useState } from "react";

type HomeworkAttachment = { url: string; name: string; type: "image" | "audio" | "archive" };
type HomeworkResponse = {
  id: string;
  response: string;
  submittedAt: string;
  teacherFeedback?: string | null;
  teacherFeedbackAttachments?: string;
  feedbackAt?: string | null;
};
type Homework = {
  id: string;
  title: string;
  description: string;
  attachments?: string;
  createdAt: string;
  responses?: HomeworkResponse[];
};

function parseAttachments(item: Homework): HomeworkAttachment[] {
  try {
    const raw = item.attachments ?? "[]";
    const arr = JSON.parse(typeof raw === "string" ? raw : "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function parseFeedbackAttachments(raw: string | undefined): HomeworkAttachment[] {
  try {
    const arr = JSON.parse(typeof raw === "string" ? raw : "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function TeacherFeedbackDisplay({
  feedback,
  attachments,
  feedbackAt,
}: {
  feedback: string | null;
  attachments: string | undefined;
  feedbackAt: string | null;
}) {
  const items = parseFeedbackAttachments(attachments);
  return (
    <div className="mt-3 rounded-lg border border-accent/20 bg-accent/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-accent/80 uppercase tracking-wide">Teacher feedback</p>
        {feedbackAt && (
          <p className="text-xs text-ink/40">{new Date(feedbackAt).toLocaleString()}</p>
        )}
      </div>
      {feedback && (
        <p className="text-sm text-ink/80 whitespace-pre-wrap">{feedback}</p>
      )}
      {items.map((a) => (
        <div key={a.url}>
          {a.type === "audio" && (
            <div>
              <p className="text-xs text-ink/50 mb-1">{a.name}</p>
              <audio src={a.url} controls className="w-full max-w-md" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function HomeworkSubmit({
  homeworkId,
  initialResponse,
  submitting,
  onSubmit,
}: {
  homeworkId: string;
  initialResponse: string;
  submitting: boolean;
  onSubmit: (id: string, response: string) => Promise<void>;
}) {
  const [response, setResponse] = useState(initialResponse);
  useEffect(() => {
    setResponse(initialResponse);
  }, [initialResponse]);
  return (
    <div className="mt-3">
      <label className="block text-sm font-medium text-ink/80 mb-1">Your response</label>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Type your answer here..."
        className="input min-h-[100px] resize-y w-full"
        rows={3}
        disabled={submitting}
      />
      <button
        type="button"
        onClick={() => onSubmit(homeworkId, response)}
        disabled={submitting}
        className="mt-2 btn-primary"
      >
        {submitting ? "Submitting…" : initialResponse ? "Update response" : "Submit"}
      </button>
    </div>
  );
}
type LinkItem = { id: string; title: string; url: string };
type PaymentInfo = { id: string; content: string; amount: string | null } | null;

export function StudentDashboard() {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [lessons, setLessons] = useState<LinkItem[]>([]);
  const [miro, setMiro] = useState<LinkItem[]>([]);
  const [payment, setPayment] = useState<PaymentInfo>(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  function loadHomework() {
    return fetch("/api/homework")
      .then((r) => safeJson(r, []))
      .then((data) => setHomework(Array.isArray(data) ? data : []));
  }

  async function safeJson(res: Response, fallback: unknown) {
    const text = await res.text();
    if (!text.trim()) return fallback;
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/homework").then((r) => safeJson(r, [])),
      fetch("/api/lessons").then((r) => safeJson(r, [])),
      fetch("/api/miro").then((r) => safeJson(r, [])),
      fetch("/api/payment").then((r) => safeJson(r, null)),
    ]).then(([hw, les, m, pay]) => {
      setHomework(Array.isArray(hw) ? hw : []);
      setLessons(Array.isArray(les) ? les : []);
      setMiro(Array.isArray(m) ? m : []);
      setPayment(pay);
      setLoading(false);
    });
  }, []);

  async function submitResponse(homeworkId: string, response: string) {
    setSubmittingId(homeworkId);
    try {
      const res = await fetch(`/api/homework/${homeworkId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: response.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to submit");
        return;
      }
      await loadHomework();
    } finally {
      setSubmittingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-ink/50">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="card p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
          Homework
        </h2>
        {homework.length === 0 ? (
          <p className="text-ink/50">No homework posted yet.</p>
        ) : (
          <ul className="space-y-4">
            {homework.map((item) => {
              const attachments = parseAttachments(item);
              const myResponse = item.responses?.[0];
              return (
                <li key={item.id} className="border-b border-ink/5 pb-4 last:border-0 last:pb-0">
                  <h3 className="font-medium text-ink">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">
                      {item.description}
                    </p>
                  )}
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {attachments.map((a) => (
                        <div key={a.url} className="rounded border border-ink/10 bg-ink/5 p-2">
                          {a.type === "image" && (
                            <a href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                              <img src={a.url} alt={a.name} className="max-h-48 rounded object-contain" />
                              <span className="mt-1 block text-xs text-ink/60">{a.name}</span>
                            </a>
                          )}
                          {a.type === "audio" && (
                            <div>
                              <p className="text-xs text-ink/60 mb-1">{a.name}</p>
                              <audio src={a.url} controls className="w-full max-w-md" />
                            </div>
                          )}
                          {a.type === "archive" && (
                            <a href={a.url} download={a.name} className="text-accent hover:underline flex items-center gap-1">
                              <span className="text-ink/70">📦</span> {a.name}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <HomeworkSubmit
                    homeworkId={item.id}
                    initialResponse={myResponse?.response ?? ""}
                    submitting={submittingId === item.id}
                    onSubmit={submitResponse}
                  />
                  {myResponse && (myResponse.teacherFeedback || (myResponse.teacherFeedbackAttachments && myResponse.teacherFeedbackAttachments !== "[]")) && (
                    <TeacherFeedbackDisplay
                      feedback={myResponse.teacherFeedback ?? null}
                      attachments={myResponse.teacherFeedbackAttachments}
                      feedbackAt={myResponse.feedbackAt ?? null}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
          Lesson links
        </h2>
        {lessons.length === 0 ? (
          <p className="text-ink/50">No lesson links yet.</p>
        ) : (
          <ul className="space-y-2">
            {lessons.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
          Miro boards
        </h2>
        {miro.length === 0 ? (
          <p className="text-ink/50">No Miro links yet.</p>
        ) : (
          <ul className="space-y-2">
            {miro.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
          Payment for lessons
        </h2>
        {!payment ? (
          <p className="text-ink/50">No payment info yet.</p>
        ) : (
          <div>
            {payment.amount && (
              <p className="font-medium text-ink">Amount: {payment.amount}</p>
            )}
            <p className="mt-2 whitespace-pre-wrap text-ink/80">
              {payment.content}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
