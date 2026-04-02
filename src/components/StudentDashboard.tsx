"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScheduleViewer } from "./ScheduleViewer";
import { LearnEnglishAiTab } from "./LearnEnglishAiTab";
import { WordleTab } from "./WordleTab";
import { EmojiPicker } from "./EmojiPicker";
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

type Tab = "schedule" | "homework" | "payments" | "learn-ai" | "games";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "schedule", label: "Schedule", icon: "📅" },
  { id: "homework", label: "Homework", icon: "📝" },
  { id: "payments", label: "Payments", icon: "💳" },
  { id: "learn-ai", label: "Fluent Lab", icon: "✨" },
  { id: "games", label: "Games", icon: "🎮" },
];

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

function parseStudentResponseAttachments(raw: string | undefined): HomeworkAttachment[] {
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
  initialAttachments,
  submitting,
  onSubmit,
}: {
  homeworkId: string;
  initialResponse: string;
  initialAttachments: HomeworkAttachment[];
  submitting: boolean;
  onSubmit: (id: string, response: string, attachments: HomeworkAttachment[]) => Promise<void>;
}) {
  const [response, setResponse] = useState(initialResponse);
  const [attachments, setAttachments] = useState<HomeworkAttachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setResponse(initialResponse);
    setAttachments(initialAttachments);
  }, [initialResponse, initialAttachments]);

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
        const data = await uploadFile(file).catch((e) => { alert(e.message); return null; });
        if (data) setAttachments((prev) => [...prev, { url: data.url, name: data.name, type: data.type }]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
      <div className="mt-2 flex flex-wrap gap-2 items-center">
        <EmojiPicker onInsert={(e) => setResponse((prev) => prev + e)} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*,.zip,.rar,.7z,.gz,.pdf,.doc,.docx"
          multiple
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || submitting}
          className="flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-sm text-ink/80 hover:bg-ink/10 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "📎 Add photo or file"}
        </button>
        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <li key={a.url} className="flex items-center gap-1 rounded bg-ink/5 px-2 py-1 text-xs">
                <span className="text-ink/70 truncate max-w-[120px]">{a.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                  className="text-red-500 hover:text-red-700"
                  aria-label="Remove"
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
        onClick={() => onSubmit(homeworkId, response, attachments)}
        disabled={submitting}
        className="mt-2 btn-primary"
      >
        {submitting ? "Submitting…" : initialResponse ? "Update response" : "Submit"}
      </button>
    </div>
  );
}

type StudentInfo = { id: string; email: string; name: string | null; paymentCode?: string; level?: string | null } | null;
type PublicSettings = { lessonPrice: number | null; monobankCard: string | null } | null;

const TAB_IDS: Tab[] = ["schedule", "homework", "payments", "learn-ai", "games"];

function isTab(s: string | null): s is Tab {
  return s !== null && TAB_IDS.includes(s as Tab);
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

  useEffect(() => {
    const hw = searchParams.get("hw");
    const tab = searchParams.get("tab");
    if (hw) {
      setActiveTab("homework");
      return;
    }
    if (isTab(tab)) {
      setActiveTab(tab);
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

  async function submitResponse(homeworkId: string, response: string, attachments: HomeworkAttachment[] = []) {
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
        return;
      }
      await loadHomework();
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
            onClick={() => setActiveTab(tab.id)}
            className={[
              "flex flex-1 items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "border-b-2 border-accent text-accent bg-white/90"
                : "border-b-2 border-transparent text-ink/50 hover:text-ink/70 hover:bg-white/40",
            ].join(" ")}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
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

        {activeTab === "learn-ai" && <LearnEnglishAiTab assignedLevel={studentInfo?.level ?? null} />}

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
}: {
  item: Homework;
  readOnly?: boolean;
  submittingId: string | null;
  onSubmit: (id: string, response: string, attachments: HomeworkAttachment[]) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const attachments = parseAttachments(item);
  const myResponse = item.responses?.[0];

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li id={`student-hw-${item.id}`} className="border-b border-ink/5 pb-5 last:border-0 last:pb-0 scroll-mt-24">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-ink">{item.title}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-ink/40">
            {new Date(item.createdAt).toLocaleDateString()}
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
      {item.description && (
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{item.description}</p>
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
      {!readOnly && (
        <HomeworkSubmit
          homeworkId={item.id}
          initialResponse={myResponse?.response ?? ""}
          initialAttachments={parseStudentResponseAttachments(myResponse?.studentResponseAttachments)}
          submitting={submittingId === item.id}
          onSubmit={onSubmit}
        />
      )}
      {readOnly && myResponse && (myResponse.response || parseStudentResponseAttachments(myResponse.studentResponseAttachments).length > 0) && (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink/50 mb-1">Your response</p>
          {myResponse.response && <p className="whitespace-pre-wrap text-sm text-ink/70">{myResponse.response}</p>}
          {parseStudentResponseAttachments(myResponse.studentResponseAttachments).map((a) => (
            <div key={a.url} className="mt-2 rounded border border-ink/10 bg-ink/5 p-2">
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
              {(a.type === "archive" || !["image", "audio"].includes(a.type)) && (
                <a href={a.url} download={a.name} className="text-accent hover:underline flex items-center gap-1">
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
  onSubmit: (id: string, response: string, attachments: HomeworkAttachment[]) => Promise<void>;
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
        <ul className="space-y-5">
          {active.map((item) => (
            <HomeworkItem key={item.id} item={item} submittingId={submittingId} onSubmit={onSubmit} />
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
  return (
    <div className="space-y-5">
      {/* Lesson price calculator */}
      {publicSettings?.lessonPrice && (
        <div className="rounded-xl border border-ink/10 bg-ink/[0.02] p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-1">Price per lesson</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-ink">₴{publicSettings.lessonPrice}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-ink/70 shrink-0">Pay for</label>
            <div className="flex items-center border border-ink/20 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => onLessonsChange(Math.max(1, lessonsToPay - 1))}
                className="px-3 py-2 text-ink/60 hover:bg-ink/5 text-lg font-medium"
              >−</button>
              <span className="px-4 py-2 font-semibold text-ink min-w-[3rem] text-center">
                {lessonsToPay}
              </span>
              <button
                type="button"
                onClick={() => onLessonsChange(lessonsToPay + 1)}
                className="px-3 py-2 text-ink/60 hover:bg-ink/5 text-lg font-medium"
              >+</button>
            </div>
            <span className="text-sm text-ink/70 shrink-0">
              lesson{lessonsToPay > 1 ? "s" : ""} =
            </span>
            <span className="font-bold text-accent text-2xl">
              ₴{(publicSettings.lessonPrice * lessonsToPay).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Payment code */}
      {studentInfo?.paymentCode && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-2xl font-bold tracking-widest text-accent select-all">
              {studentInfo.paymentCode}
            </span>
            <span className="text-xs text-ink/40 hidden sm:block">add to transfer comment</span>
          </div>
          <button
            type="button"
            onClick={() => onCopy(studentInfo!.paymentCode!)}
            className="shrink-0 rounded-lg border border-accent/30 bg-white px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
          >
            {copiedCode ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {/* Card / bank details */}
      {publicSettings?.monobankCard && (
        <div className="rounded-xl border border-ink/10 bg-ink/[0.02] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-2">Send to card</p>
          <span className="font-mono text-lg font-semibold text-ink tracking-wider">
            {publicSettings.monobankCard}
          </span>
        </div>
      )}

      {!publicSettings?.lessonPrice && !studentInfo?.paymentCode && !publicSettings?.monobankCard && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-4xl mb-3">💳</span>
          <p className="text-ink/50">Payment info not set up yet.</p>
        </div>
      )}
    </div>
  );
}
