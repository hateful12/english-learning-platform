"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScheduleViewer } from "./ScheduleViewer";
import { WordleTab } from "./WordleTab";
import { EmojiPicker } from "./EmojiPicker";
import { LinkifiedText } from "./LinkifiedText";
import { VoiceRecorder } from "./VoiceRecorder";
import { clipboardHasRenderableImageSync, imageFilesFromClipboard } from "@/lib/clipboard-images";
import { normalizeAttachmentUrl } from "@/lib/attachment-url";

type HomeworkAttachment = { url: string; name: string; type: "image" | "audio" | "archive" };
type HomeworkResponse = {
  id: string;
  response: string;
  studentResponseAttachments?: string;
  submittedAt: string;
  teacherFeedback?: string | null;
  teacherFeedbackAttachments?: string;
  feedbackAt?: string | null;
};
type Homework = {
  id: string;
  title: string;
  description: string;
  status?: string;
  studentClosed?: boolean;
  attachments?: string;
  createdAt: string;
  updatedAt?: string;
  responses?: HomeworkResponse[];
};

function parseAttachmentJsonArray(raw: unknown): HomeworkAttachment[] {
  try {
    const arr: unknown = Array.isArray(raw) ? raw : JSON.parse(typeof raw === "string" ? raw : "[]");
    if (!Array.isArray(arr)) return [];
    return arr.map((x: unknown) => {
      if (!x || typeof x !== "object") return x as HomeworkAttachment;
      const o = x as HomeworkAttachment;
      return typeof o.url === "string"
        ? { ...o, url: normalizeAttachmentUrl(o.url) }
        : o;
    });
  } catch {
    return [];
  }
}

type Tab = "schedule" | "homework" | "payments" | "learn-ai" | "games";

const TABS: { id: Tab; label: string; icon: string; comingSoon?: boolean }[] = [
  { id: "schedule", label: "Schedule", icon: "📅" },
  { id: "homework", label: "Homework", icon: "📝" },
  { id: "payments", label: "Payments", icon: "💳" },
  { id: "learn-ai", label: "Fluent Lab", icon: "✨", comingSoon: true },
  { id: "games", label: "Games", icon: "🎮" },
];

function FluentLabComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <span className="text-5xl mb-4" aria-hidden>✨</span>
      <h3 className="font-serif text-xl font-semibold text-ink">Fluent Lab</h3>
      <p className="mt-3 max-w-md text-sm text-ink/65 leading-relaxed">
        AI-powered practice for your level is on the way. Check back soon.
      </p>
      <span className="mt-6 inline-flex items-center rounded-full border border-accent/25 bg-accent/8 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
        Coming soon
      </span>
    </div>
  );
}

function parseAttachments(item: Homework): HomeworkAttachment[] {
  return parseAttachmentJsonArray(item.attachments ?? "[]");
}

function parseFeedbackAttachments(raw: string | undefined): HomeworkAttachment[] {
  return parseAttachmentJsonArray(raw ?? "[]");
}

function parseStudentResponseAttachments(raw: string | undefined): HomeworkAttachment[] {
  return parseAttachmentJsonArray(raw ?? "[]");
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
              <audio src={normalizeAttachmentUrl(a.url)} controls className="w-full max-w-md" />
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
  initialAttachments,
  submittedAt,
  submitting,
  onSubmit,
}: {
  homeworkId: string;
  initialResponse: string;
  initialAttachments: HomeworkAttachment[];
  submittedAt?: string | null;
  submitting: boolean;
  onSubmit: (id: string, response: string, attachments: HomeworkAttachment[]) => Promise<boolean>;
}) {
  const hasSavedWork =
    initialResponse.trim().length > 0 || initialAttachments.length > 0;
  const [editingOpen, setEditingOpen] = useState(!hasSavedWork);
  const [response, setResponse] = useState(initialResponse);
  const [attachments, setAttachments] = useState<HomeworkAttachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setResponse(initialResponse);
    setAttachments(initialAttachments);
  }, [initialResponse, initialAttachments]);

  const savedWorkSignature = `${homeworkId}:${initialResponse.trim()}:${initialAttachments.map((a) => a.url).sort().join("|")}`;
  useEffect(() => {
    const has = initialResponse.trim().length > 0 || initialAttachments.length > 0;
    setEditingOpen(!has);
  }, [savedWorkSignature]);

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }
    return res.json() as Promise<{ url: string; name: string; type: "image" | "audio" | "archive" }>;
  }

  async function handleFileChange(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const data = await uploadFile(file).catch((e: unknown) => {
          alert(e instanceof Error ? e.message : "Upload failed");
          return null;
        });
        if (data) setAttachments((prev) => [...prev, { url: data.url, name: data.name, type: data.type }]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    if (submitting) return;
    if (!clipboardHasRenderableImageSync(e.nativeEvent)) return;
    e.preventDefault();
    void (async () => {
      const files = await imageFilesFromClipboard(e.nativeEvent);
      if (!files.length) return;
      setUploading(true);
      try {
        for (const file of files) {
          const data = await uploadFile(file).catch((err: unknown) => {
            alert(err instanceof Error ? err.message : "Upload failed");
            return null;
          });
          if (data) setAttachments((prev) => [...prev, { url: data.url, name: data.name, type: data.type }]);
        }
      } finally {
        setUploading(false);
      }
    })();
  }

  async function handleVoiceRecorded(blob: Blob, filename: string) {
    setUploading(true);
    try {
      const file = new File([blob], filename, { type: blob.type });
      const data = await uploadFile(file).catch((e) => { alert(e.message); return null; });
      if (data) setAttachments((prev) => [...prev, { url: data.url, name: data.name, type: data.type }]);
    } finally {
      setUploading(false);
    }
  }

  async function handleTurnIn() {
    const ok = await onSubmit(homeworkId, response, attachments);
    if (ok) setEditingOpen(false);
  }

  if (hasSavedWork && !editingOpen) {
    return (
      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-accent/25 bg-accent/8 px-4 py-3">
          <p className="text-sm font-semibold text-ink">Your homework was sent to your teacher</p>
          <p className="mt-1 text-sm text-ink/70">
            They will see your answer and files here. When something changes, you can open your work again below.
          </p>
          {submittedAt && (
            <p className="mt-2 text-xs text-ink/50">
              Submitted {new Date(submittedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditingOpen(true)}
          className="rounded-lg border border-ink/15 bg-white/80 px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:border-accent/35 hover:bg-accent/5"
        >
          Check my answer
        </button>
      </div>
    );
  }

  return (
    <div
      className="mt-4 rounded-xl border border-ink/15 bg-gradient-to-b from-ink/[0.03] to-transparent p-4 shadow-sm"
      onPaste={handlePaste}
    >
      {hasSavedWork && (
        <button
          type="button"
          onClick={() => setEditingOpen(false)}
          className="mb-3 text-sm font-medium text-ink/55 hover:text-ink"
        >
          ← Back to sent homework
        </button>
      )}
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Hand in your work</p>
        <p className="mt-0.5 text-sm text-ink/65">
          Write your answer below. You can attach files or record a voice message, same as your teacher.
        </p>
      </div>
      <label className="block text-sm font-semibold text-ink mb-1">Written answer</label>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Type your homework answer or notes here…"
        className="input min-h-[120px] resize-y w-full"
        rows={4}
        disabled={submitting}
      />
      <p className="mt-3 text-xs font-medium text-ink/50">Attachments</p>
      <div className="mt-1.5 flex flex-wrap gap-2 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*,.zip,.rar,.7z,.gz,.pdf,.doc,.docx"
          multiple
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files)}
        />
        <VoiceRecorder
          onRecorded={handleVoiceRecorded}
          disabled={uploading || submitting}
          className="rounded-lg border-2 border-ink/20 bg-white/60 px-3.5 py-2 shadow-sm hover:border-accent/40 hover:bg-accent/5"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || submitting}
          className="flex items-center gap-2 rounded-lg border-2 border-ink/20 bg-white/60 px-3.5 py-2 text-sm font-medium text-ink shadow-sm hover:border-accent/40 hover:bg-accent/5 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : (
            <>
              <span className="text-base" aria-hidden>📎</span>
              Attach files for this assignment
            </>
          )}
        </button>
        <span className="text-xs text-ink/45">Voice, images, PDF, Office docs, zip, audio · Paste screenshot (Ctrl+V)</span>
        <EmojiPicker onInsert={(e) => setResponse((prev) => prev + e)} />
        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2 basis-full">
            {attachments.map((a, i) => (
              <li key={a.url} className="flex items-center gap-1 rounded-md border border-ink/10 bg-ink/5 px-2 py-1 text-xs">
                <span className="text-ink/70 truncate max-w-[140px]">{a.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                  className="text-red-500 hover:text-red-700"
                  aria-label="Remove attachment"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={() => void handleTurnIn()}
        disabled={submitting}
        className="mt-4 btn-primary font-semibold"
      >
        {submitting
          ? "Sending…"
          : hasSavedWork
            ? "Update your submission"
            : "Send for the teacher"}
      </button>
    </div>
  );
}

type StudentInfo = { id: string; email: string; name: string | null; paymentCode?: string; level?: string | null } | null;
type PublicSettings = { lessonPrice: number | null; monobankCard: string | null } | null;

const TAB_IDS: Tab[] = ["schedule", "homework", "payments", "learn-ai", "games"];
const STUDENT_TAB_STORAGE_KEY = "english-student-dashboard-tab";

function isTab(s: string | null): s is Tab {
  return s !== null && TAB_IDS.includes(s as Tab);
}

function persistStudentTab(tab: Tab) {
  try {
    localStorage.setItem(STUDENT_TAB_STORAGE_KEY, tab);
  } catch {
    /* ignore quota / private mode */
  }
}

export function StudentDashboard() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const [homework, setHomework] = useState<Homework[]>([]);
  const [studentInfo, setStudentInfo] = useState<StudentInfo>(null);
  const [publicSettings, setPublicSettings] = useState<PublicSettings>(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveMonth, setArchiveMonth] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [lessonsToPay, setLessonsToPay] = useState(1);

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

  function copyPaymentCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/homework").then((r) => safeJson(r, [])),
      fetch("/api/auth/student/session").then((r) => safeJson(r, null)),
      fetch("/api/settings/public").then((r) => safeJson(r, null)),
      fetch("/api/auth/student/payment-code").then((r) => safeJson(r, null)),
    ]).then(([hw, session, settings, paymentCodeData]) => {
      setHomework(Array.isArray(hw) ? hw : []);
      if (session?.loggedIn && session.student) {
        setStudentInfo({ ...session.student, paymentCode: paymentCodeData?.paymentCode });
      }
      setPublicSettings(settings);
      setLoading(false);
    });
  }, []);

  useLayoutEffect(() => {
    const hw = searchParams.get("hw");
    const tab = searchParams.get("tab");
    if (hw) {
      setActiveTab("homework");
      persistStudentTab("homework");
      return;
    }
    if (isTab(tab)) {
      setActiveTab(tab);
      persistStudentTab(tab);
      return;
    }
    try {
      const stored = localStorage.getItem(STUDENT_TAB_STORAGE_KEY);
      if (isTab(stored)) setActiveTab(stored);
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  useEffect(() => {
    const hw = searchParams.get("hw");
    if (!hw || activeTab !== "homework" || homework.length === 0) return;
    const id = `student-hw-${hw}`;
    const run = () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = window.setTimeout(run, 80);
    return () => window.clearTimeout(t);
  }, [searchParams, activeTab, homework]);

  async function deleteArchiveItem(homeworkId: string) {
    await fetch(`/api/homework/${homeworkId}/student-hide`, { method: "POST" });
    await loadHomework();
  }

  async function submitResponse(homeworkId: string, response: string, attachments: HomeworkAttachment[] = []): Promise<boolean> {
    setSubmittingId(homeworkId);
    try {
      const res = await fetch(`/api/homework/${homeworkId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: response.trim(), attachments }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to submit");
        return false;
      }
      await loadHomework();
      return true;
    } catch {
      alert("Something went wrong. Please try again.");
      return false;
    } finally {
      setSubmittingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="text-ink/40 text-sm tracking-wide">Loading…</span>
      </div>
    );
  }

  const activeHomework = homework.filter((h) => h.status !== "closed" && !h.studentClosed);
  const closedHomework = homework.filter((h) => h.status === "closed" || h.studentClosed);

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/80 shadow-md backdrop-blur-sm">
      {/* Tab bar */}
      <div className="flex border-b border-ink/10 bg-ink/[0.025]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              persistStudentTab(tab.id);
            }}
            className={[
              "flex flex-1 items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "border-b-2 border-accent text-accent bg-white/90"
                : "border-b-2 border-transparent text-ink/50 hover:text-ink/70 hover:bg-white/40",
            ].join(" ")}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.comingSoon && (
              <span className="hidden sm:inline rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/45">
                Soon
              </span>
            )}
            {tab.id === "homework" && activeHomework.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white leading-none">
                {activeHomework.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="p-6 md:p-8">
        {/* Schedule */}
        {activeTab === "schedule" && (
          <div>
            <ScheduleViewer />
          </div>
        )}

        {/* Homework */}
        {activeTab === "homework" && (
          <HomeworkTab
            active={activeHomework}
            closed={closedHomework}
            submittingId={submittingId}
            archiveOpen={archiveOpen}
            archiveMonth={archiveMonth}
            onArchiveToggle={() => setArchiveOpen((o) => !o)}
            onArchiveMonthChange={setArchiveMonth}
            onSubmit={submitResponse}
            onDelete={deleteArchiveItem}
          />
        )}

        {/* Payments */}
        {activeTab === "payments" && (
          <PaymentsTab
            studentInfo={studentInfo}
            publicSettings={publicSettings}
            lessonsToPay={lessonsToPay}
            copiedCode={copiedCode}
            onLessonsChange={setLessonsToPay}
            onCopy={copyPaymentCode}
          />
        )}

        {activeTab === "learn-ai" && <FluentLabComingSoon />}

        {/* Games */}
        {activeTab === "games" && (
          <WordleTab studentId={studentInfo?.id ?? null} />
        )}
      </div>
    </div>
  );
}

function HomeworkItem({
  item,
  readOnly,
  submittingId,
  onSubmit,
  onDelete,
  defaultOpen,
}: {
  item: Homework;
  readOnly?: boolean;
  submittingId: string | null;
  onSubmit: (id: string, response: string, attachments: HomeworkAttachment[]) => Promise<boolean>;
  onDelete?: (id: string) => Promise<void>;
  defaultOpen?: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const attachments = parseAttachments(item);
  const myResponse = item.responses?.[0];
  const hasSubmission = !!(myResponse?.response || parseStudentResponseAttachments(myResponse?.studentResponseAttachments).length > 0);
  const hasFeedback = !!(myResponse?.teacherFeedback || (myResponse?.teacherFeedbackAttachments && myResponse.teacherFeedbackAttachments !== "[]"));

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setDeleting(false);
    }
  }

  const body = (
    <>
      {item.description && (
        <div className="mt-2 rounded-lg border border-ink/10 bg-ink/[0.04] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/45">Instructions</p>
          <LinkifiedText
            text={item.description}
            className="mt-1 whitespace-pre-wrap text-sm text-ink/75"
          />
        </div>
      )}
      {attachments.length > 0 && (
        <div className="mt-2 space-y-2">
          {attachments.map((a) => (
            <div key={a.url} className="rounded border border-ink/10 bg-ink/5 p-2">
              {a.type === "image" && (
                <a href={normalizeAttachmentUrl(a.url)} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={normalizeAttachmentUrl(a.url)} alt={a.name} className="max-h-48 rounded object-contain" />
                  <span className="mt-1 block text-xs text-ink/60">{a.name}</span>
                </a>
              )}
              {a.type === "audio" && (
                <div>
                  <p className="text-xs text-ink/60 mb-1">{a.name}</p>
                  <audio src={normalizeAttachmentUrl(a.url)} controls className="w-full max-w-md" />
                </div>
              )}
              {a.type === "archive" && (
                <a href={normalizeAttachmentUrl(a.url)} download={a.name} className="text-accent hover:underline flex items-center gap-1">
                  <span className="text-ink/70">📦</span> {a.name}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <HomeworkSubmit
          homeworkId={item.id}
          initialResponse={myResponse?.response ?? ""}
          initialAttachments={parseStudentResponseAttachments(myResponse?.studentResponseAttachments)}
          submittedAt={myResponse?.submittedAt}
          submitting={submittingId === item.id}
          onSubmit={onSubmit}
        />
      )}
      {readOnly && myResponse && (myResponse.response || parseStudentResponseAttachments(myResponse.studentResponseAttachments).length > 0) && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/45 mb-1">Your submission</p>
          {myResponse.response && <p className="whitespace-pre-wrap text-sm text-ink/70">{myResponse.response}</p>}
          {parseStudentResponseAttachments(myResponse.studentResponseAttachments).map((a) => (
            <div key={a.url} className="mt-2 rounded border border-ink/10 bg-ink/5 p-2">
              {a.type === "image" && (
                <a href={normalizeAttachmentUrl(a.url)} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={normalizeAttachmentUrl(a.url)} alt={a.name} className="max-h-48 rounded object-contain" />
                  <span className="mt-1 block text-xs text-ink/60">{a.name}</span>
                </a>
              )}
              {a.type === "audio" && (
                <div>
                  <p className="text-xs text-ink/60 mb-1">{a.name}</p>
                  <audio src={normalizeAttachmentUrl(a.url)} controls className="w-full max-w-md" />
                </div>
              )}
              {(a.type === "archive" || !["image", "audio"].includes(a.type)) && (
                <a href={normalizeAttachmentUrl(a.url)} download={a.name} className="text-accent hover:underline flex items-center gap-1">
                  <span className="text-ink/70">📎</span> {a.name}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {myResponse && (myResponse.teacherFeedback || (myResponse.teacherFeedbackAttachments && myResponse.teacherFeedbackAttachments !== "[]")) && (
        <TeacherFeedbackDisplay
          feedback={myResponse.teacherFeedback ?? null}
          attachments={myResponse.teacherFeedbackAttachments}
          feedbackAt={myResponse.feedbackAt ?? null}
        />
      )}
    </>
  );

  if (defaultOpen !== undefined) {
    return (
      <li id={`student-hw-${item.id}`} className="scroll-mt-24 rounded-lg border border-ink/10 bg-white overflow-hidden">
        <details open={defaultOpen} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-ink/[0.02] transition-colors [&::-webkit-details-marker]:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-xs text-ink/30 transition-transform group-open:rotate-90" aria-hidden>▶</span>
              <div className="min-w-0">
                <h3 className="font-semibold text-ink leading-snug truncate">{item.title}</h3>
                <p className="text-[11px] text-ink/40 mt-0.5">
                  Assigned {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {hasFeedback && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">💬 Feedback</span>
              )}
              {hasSubmission && !hasFeedback && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">✓ Sent</span>
              )}
              {!hasSubmission && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Pending</span>
              )}
            </div>
          </summary>
          <div className="border-t border-ink/5 px-4 pb-4 pt-3">
            {body}
          </div>
        </details>
      </li>
    );
  }

  return (
    <li id={`student-hw-${item.id}`} className="border-b border-ink/5 pb-5 last:border-0 last:pb-0 scroll-mt-24">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/40">Assignment</p>
          <h3 className="font-semibold text-ink leading-snug">{item.title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-ink/40" title="Assigned">
            Assigned {new Date(item.createdAt).toLocaleDateString()}
          </span>
          {readOnly && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              title="Remove from archive"
              className="rounded p-1 text-ink/30 hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {body}
    </li>
  );
}

function HomeworkTab({
  active,
  closed,
  submittingId,
  archiveOpen,
  archiveMonth,
  onArchiveToggle,
  onArchiveMonthChange,
  onSubmit,
  onDelete,
}: {
  active: Homework[];
  closed: Homework[];
  submittingId: string | null;
  archiveOpen: boolean;
  archiveMonth: string;
  onArchiveToggle: () => void;
  onArchiveMonthChange: (m: string) => void;
  onSubmit: (id: string, response: string, attachments: HomeworkAttachment[]) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}) {
  const months = Array.from(
    new Set(closed.map((i) => (i.updatedAt ? i.updatedAt.slice(0, 7) : "")))
  ).filter(Boolean).sort((a, b) => b.localeCompare(a));

  const filteredClosed = archiveMonth
    ? closed.filter((i) => (i.updatedAt ?? "").slice(0, 7) === archiveMonth)
    : closed;

  function monthLabel(ym: string) {
    const [y, m] = ym.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleString("default", { month: "long", year: "numeric" });
  }

  if (active.length === 0 && closed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl mb-3">📭</span>
        <p className="text-ink/50">No homework posted yet.</p>
      </div>
    );
  }

  return (
    <div>
      {active.length === 0 && (
        <p className="mb-6 text-sm text-ink/50">No active homework right now.</p>
      )}
      {active.length > 0 && (
        <ul className={active.length > 1 ? "space-y-2" : "space-y-5"}>
          {active.map((item, index) => (
            <HomeworkItem
              key={item.id}
              item={item}
              submittingId={submittingId}
              onSubmit={onSubmit}
              defaultOpen={active.length > 1 ? index === 0 : undefined}
            />
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={onArchiveToggle}
            className="flex items-center gap-2 text-sm font-medium text-ink/50 hover:text-ink/70 transition-colors"
          >
            <span className={`inline-block transition-transform ${archiveOpen ? "rotate-90" : ""}`}>▶</span>
            Archive ({closed.length})
          </button>
          {archiveOpen && (
            <div className="mt-3 rounded-lg border border-ink/5 bg-ink/[0.02] p-4 space-y-3">
              {months.length > 1 && (
                <div className="flex items-center gap-2">
                  <select
                    value={archiveMonth}
                    onChange={(e) => onArchiveMonthChange(e.target.value)}
                    className="input text-sm py-1 w-auto"
                  >
                    <option value="">All dates</option>
                    {months.map((m) => (
                      <option key={m} value={m}>{monthLabel(m)}</option>
                    ))}
                  </select>
                  {archiveMonth && (
                    <button
                      type="button"
                      onClick={() => onArchiveMonthChange("")}
                      className="text-xs text-ink/40 hover:text-ink/70 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
              {filteredClosed.length === 0 ? (
                <p className="text-sm text-ink/40">No archived homework for this period.</p>
              ) : (
                <ul className="space-y-4">
                  {filteredClosed.map((item) => (
                    <HomeworkItem key={item.id} item={item} readOnly submittingId={null} onSubmit={onSubmit} onDelete={onDelete} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function MonoLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="60" height="24" rx="6" fill="#1B1F3B"/>
      <text x="50%" y="17" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="Arial,sans-serif">mono</text>
    </svg>
  );
}

function CopyButton({ text, label = "Copy", copiedLabel = "Copied!" }: { text: string; label?: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button type="button" onClick={copy}
      className="shrink-0 rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-ink/5 transition-colors">
      {copied ? copiedLabel : label}
    </button>
  );
}

function PaymentsTab({
  studentInfo,
  publicSettings,
  lessonsToPay,
  copiedCode,
  onLessonsChange,
  onCopy,
}: {
  studentInfo: StudentInfo;
  publicSettings: PublicSettings;
  lessonsToPay: number;
  copiedCode: boolean;
  onLessonsChange: (n: number) => void;
  onCopy: (code: string) => void;
}) {
  const [flow, setFlow] = useState<"mono" | "other" | null>(null);
  const [studentCents, setStudentCents] = useState<number | null>(null);
  const [centsLoading, setCentsLoading] = useState(false);
  const [centsError, setCentsError] = useState<string | null>(null);
  const [amountCopied, setAmountCopied] = useState(false);

  const card = publicSettings?.monobankCard;
  const pricePerLesson = publicSettings?.lessonPrice ?? 0; // in UAH

  // When "other bank" flow is selected, fetch the student's fixed cents
  useEffect(() => {
    if (flow !== "other" || studentCents !== null) return;
    setCentsLoading(true);
    setCentsError(null);
    fetch("/api/student/payment-cents")
      .then((r) => r.json())
      .then((d) => {
        if (d.cents) setStudentCents(d.cents);
        else setCentsError(d.error ?? "Error loading identifier");
      })
      .catch(() => setCentsError("Network error"))
      .finally(() => setCentsLoading(false));
  }, [flow, studentCents]);

  // Exact amount to transfer: (price * lessons) UAH + cents kopecks
  const exactKopecks = studentCents != null
    ? (pricePerLesson * lessonsToPay * 100) + studentCents
    : null;

  function copyAmount() {
    if (!exactKopecks) return;
    navigator.clipboard.writeText((exactKopecks / 100).toFixed(2)).catch(() => {});
    setAmountCopied(true);
    setTimeout(() => setAmountCopied(false), 2000);
  }

  const hasPaymentSetup = !!(pricePerLesson || studentInfo?.paymentCode || card);

  if (!hasPaymentSetup) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl mb-3">💳</span>
        <p className="text-ink/50">Payment info not set up yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Lesson counter */}
      {pricePerLesson > 0 && (
        <div className="rounded-xl border border-ink/10 bg-ink/[0.02] p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-1">Price per lesson</p>
            <span className="text-3xl font-bold text-ink">₴{pricePerLesson}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-ink/70 shrink-0">Pay for</label>
            <div className="flex items-center border border-ink/20 rounded-lg overflow-hidden">
              <button type="button" onClick={() => onLessonsChange(Math.max(1, lessonsToPay - 1))}
                className="px-3 py-2 text-ink/60 hover:bg-ink/5 text-lg font-medium">−</button>
              <span className="px-4 py-2 font-semibold text-ink min-w-[3rem] text-center">{lessonsToPay}</span>
              <button type="button" onClick={() => onLessonsChange(lessonsToPay + 1)}
                className="px-3 py-2 text-ink/60 hover:bg-ink/5 text-lg font-medium">+</button>
            </div>
            <span className="text-sm text-ink/70 shrink-0">lesson{lessonsToPay > 1 ? "s" : ""} =</span>
            <span className="font-bold text-accent text-2xl">₴{(pricePerLesson * lessonsToPay).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* ── Flow selector ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-3">Choose how to pay</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Monobank */}
          <button
            type="button"
            onClick={() => setFlow("mono")}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              flow === "mono"
                ? "border-[#1B1F3B] bg-[#1B1F3B]/5 shadow-sm"
                : "border-ink/10 bg-white hover:border-ink/30"
            }`}
          >
            <MonoLogo className="h-6 w-auto mb-3" />
            <p className="font-semibold text-sm text-ink">Monobank</p>
            <p className="text-xs text-ink/50 mt-0.5">Code in comment</p>
          </button>

          {/* Any bank */}
          <button
            type="button"
            onClick={() => setFlow("other")}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              flow === "other"
                ? "border-blue-500 bg-blue-50 shadow-sm"
                : "border-ink/10 bg-white hover:border-ink/30"
            }`}
          >
            <div className="text-2xl mb-2">🏦</div>
            <p className="font-semibold text-sm text-ink">PrivatBank / other</p>
            <p className="text-xs text-ink/50 mt-0.5">No comment needed</p>
          </button>
        </div>
      </div>

      {/* ── Monobank flow ──────────────────────────────────────────────────── */}
      {flow === "mono" && (
        <div className="rounded-xl border border-[#1B1F3B]/20 bg-[#1B1F3B]/[0.03] p-5 space-y-4">
          {studentInfo?.paymentCode && card && (
            <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3 text-sm text-ink/70 leading-relaxed">
              Перекажіть на картку нижче. У коментарі до переказу впишіть ваш код.
            </div>
          )}

          {/* Code */}
          {studentInfo?.paymentCode && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Your payment code</p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl font-bold tracking-widest text-accent select-all">
                  {studentInfo.paymentCode}
                </span>
                <button type="button" onClick={() => onCopy(studentInfo!.paymentCode!)}
                  className="shrink-0 rounded-lg border border-accent/30 bg-white px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors">
                  {copiedCode ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-ink/40 mt-1">Paste this code in the transfer comment</p>
            </div>
          )}

          {/* Card */}
          {card && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Send to card</p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-lg font-semibold text-ink tracking-wider">{card}</span>
                <CopyButton text={card} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Other bank flow ────────────────────────────────────────────────── */}
      {flow === "other" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 space-y-4">
          <p className="text-sm text-ink/60">
            Transfer the exact amount below from <strong>any bank</strong> (PrivatBank, Oschadbank, cash wire…). The last kopecks are your permanent ID — no comment needed.
          </p>

          {centsLoading && (
            <p className="text-sm text-ink/40">Loading your payment identifier…</p>
          )}

          {centsError && (
            <p className="text-sm text-red-600">{centsError}</p>
          )}

          {!centsLoading && studentCents != null && exactKopecks != null && (
            <>
              {/* Exact amount */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Transfer EXACTLY</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-3xl font-bold text-blue-700 select-all">
                    ₴{(exactKopecks / 100).toFixed(2)}
                  </span>
                  <button type="button" onClick={copyAmount}
                    className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors">
                    {amountCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="mt-2 text-xs text-ink/50 space-y-0.5">
                  <p>₴{(pricePerLesson * lessonsToPay).toFixed(2)} lesson fee + ₴0.{String(studentCents).padStart(2, "0")} your ID = <span className="font-semibold text-blue-700">₴{(exactKopecks / 100).toFixed(2)}</span></p>
                  <p>Your ID kopecks are always <strong>₴0.{String(studentCents).padStart(2, "0")}</strong> — use the same suffix for any future payment.</p>
                </div>
              </div>

              {/* Card */}
              {card && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Send to card</p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-semibold text-ink tracking-wider">{card}</span>
                    <CopyButton text={card} />
                  </div>
                </div>
              )}

              <p className="text-xs text-ink/40 pt-1">
                The system matches the payment automatically — lessons are marked paid once the transfer arrives.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
