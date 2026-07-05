"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { HomeworkEditor } from "./HomeworkEditor";
import { InviteSection } from "./InviteSection";
import { GroupEditor, Group } from "./GroupEditor";
import { ScheduleEditor } from "./ScheduleEditor";

type CurrentTeacher = {
  id: string;
  email: string;
  role: "teacher" | "super-admin";
  isSuperAdmin: boolean;
};
type TeacherSummary = {
  id: string;
  email: string;
  role: "teacher" | "super-admin";
  studentsCount: number;
  createdAt?: string;
};
type Student = {
  id: string;
  email: string;
  name: string | null;
  paymentCode?: string;
  lessonPrice?: number | null;
  level?: string | null;
  teacherId?: string | null;
  teacher?: { id: string; email: string } | null;
  teacherStudents?: { teacher: { id: string; email: string } }[];
  createdAt?: string;
};
type HomeworkResponse = {
  id: string;
  response: string;
  submittedAt: string;
  student?: { id: string; email: string; name: string | null };
};
type Homework = {
  id: string;
  title: string;
  description: string;
  studentId?: string | null;
  groupId?: string | null;
  group?: { id: string; name: string } | null;
  closedForStudents?: string[];
  responses?: HomeworkResponse[];
};

type Tab = "homework" | "groups" | "students" | "schedule" | "payments" | "settings" | "teachers" | "stats";

const BASE_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "schedule", label: "Schedule", icon: "📅" },
  { id: "homework", label: "Homework", icon: "📝" },
  { id: "students", label: "Students", icon: "👩‍🎓" },
  { id: "groups", label: "Groups", icon: "👥" },
  { id: "stats", label: "Stats", icon: "📊" },
];

const SUPER_ADMIN_TABS: { id: Tab; label: string; icon: string }[] = [
  ...BASE_TABS,
  { id: "teachers", label: "Teachers", icon: "🧑‍🏫" },
  { id: "payments", label: "Payments", icon: "💳" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

const TEACHER_TAB_STORAGE_KEY = "english-teacher-dashboard-tab";

function isTeacherDashboardTab(s: string | null, tabs: { id: Tab }[]): s is Tab {
  return s !== null && tabs.some((t) => t.id === s);
}

function persistTeacherTab(tab: Tab) {
  try {
    localStorage.setItem(TEACHER_TAB_STORAGE_KEY, tab);
  } catch {
    /* ignore quota / private mode */
  }
}

type Transaction = {
  id: string;
  studentId: string;
  monoId: string;
  amount: number;
  lessonsCount: number;
  comment: string | null;
  receivedAt: string;
  createdAt: string;
  student: { id: string; name: string | null; email: string };
  lessons: { id: string; title: string; startAt: string }[];
};

type StudentStat = {
  studentId: string;
  name: string | null;
  email: string;
  pricePerLesson: number;
  futurePaidLessons: number;
  futurePaidAmount: number;
  overdueLessons: number;
  overdueAmount: number;
  totalPaidAmount: number;
  balanceLessons: number;
  balanceAmount: number;
  lastPaymentAt: string | null;
};

type PaymentIntentSummary = {
  id: string;
  studentId: string;
  requestedAmount: number;
  uniqueAmount: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  student: { id: string; name: string | null; email: string };
};

type SettingsData = {
  hasMonobankToken: boolean;
  monobankCard: string;
  appUrl: string;
};

export function TeacherDashboard({ currentTeacher }: { currentTeacher: CurrentTeacher }) {
  const tabs = currentTeacher.isSuperAdmin ? SUPER_ADMIN_TABS : BASE_TABS;
  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [teachers, setTeachers] = useState<TeacherSummary[]>([]);
  const [settingsData, setSettingsData] = useState<SettingsData>({ hasMonobankToken: false, monobankCard: "", appUrl: "" });
  const [loading, setLoading] = useState(true);

  // Settings form state
  const [settingsToken, setSettingsToken] = useState("");
  const [settingsCard, setSettingsCard] = useState("");
  const [settingsAppUrl, setSettingsAppUrl] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [webhookRegistering, setWebhookRegistering] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/students").then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/homework?view=teacher").then((r) => r.json()),
    ]).then(([st, gr, hw]) => {
      setStudents(Array.isArray(st) ? st : []);
      setGroups(Array.isArray(gr) ? gr : []);
      setHomework(Array.isArray(hw) ? hw : []);
      setLoading(false);
    });
  }


  function loadTransactions() {
    if (!currentTeacher.isSuperAdmin) return;
    fetch("/api/payments")
      .then((r) => r.json())
      .then((data) => setTransactions(Array.isArray(data) ? data : []));
  }

  function loadSettings() {
    if (!currentTeacher.isSuperAdmin) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: SettingsData) => {
        setSettingsData(data);
        setSettingsCard(data.monobankCard ?? "");
        setSettingsAppUrl(data.appUrl ?? "");
      });
  }

  function loadTeachers() {
    if (!currentTeacher.isSuperAdmin) return;
    fetch("/api/teachers")
      .then((r) => r.json())
      .then((data) => setTeachers(Array.isArray(data) ? data : []))
      .catch(() => setTeachers([]));
  }

  useEffect(() => {
    load();
    if (currentTeacher.isSuperAdmin) {
      loadTransactions();
      loadSettings();
      loadTeachers();
      loadPaymentIntents();
    }
    // Auto-load stats if that tab was last active
    try {
      const stored = localStorage.getItem(TEACHER_TAB_STORAGE_KEY);
      if (stored === "stats") loadStudentStats();
    } catch { /* ignore */ }
  }, [currentTeacher.isSuperAdmin]);

  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(TEACHER_TAB_STORAGE_KEY);
      if (isTeacherDashboardTab(stored, tabs)) setActiveTab(stored);
    } catch {
      /* ignore */
    }
  }, [tabs]);

  async function togglePaid(lessonId: string, currentlyPaid: boolean) {
    await fetch("/api/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: currentlyPaid ? "markUnpaid" : "markPaid",
        lessonId,
      }),
    });
    loadTransactions();
  }

  async function assignPayment(paymentId: string, studentId: string) {
    await fetch("/api/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assignPayment", paymentId, studentId }),
    });
    loadTransactions();
  }

  const [manualPayStudentId, setManualPayStudentId] = useState("");
  const [manualPayAmount, setManualPayAmount] = useState("");
  const [manualPayDate, setManualPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualPayNote, setManualPayNote] = useState("");
  const [manualPaySaving, setManualPaySaving] = useState(false);
  const [manualPayMsg, setManualPayMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Payment intents (any-bank flow)
  const [paymentIntents, setPaymentIntents] = useState<PaymentIntentSummary[]>([]);
  function loadPaymentIntents() {
    if (!currentTeacher.isSuperAdmin) return;
    fetch("/api/payment-intent/admin")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setPaymentIntents(Array.isArray(d) ? d : []))
      .catch(() => {});
  }

  // Student payment stats
  const [studentStats, setStudentStats] = useState<StudentStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [resettingStatId, setResettingStatId] = useState<string | null>(null);
  function loadStudentStats() {
    setStatsLoading(true);
    fetch("/api/teacher/student-stats")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setStudentStats(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }
  async function resetStat(studentId: string, action: "overdue" | "balance", label: string) {
    if (!window.confirm(`Скинути ${label} для цього студента? Дію не можна відмінити.`)) return;
    setResettingStatId(studentId + action);
    try {
      const res = await fetch("/api/teacher/reset-stat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as { error?: string }).error ?? "Could not reset stat");
        return;
      }
      loadStudentStats();
    } finally {
      setResettingStatId(null);
    }
  }

  async function recordManualPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!manualPayStudentId || !manualPayAmount) return;
    setManualPaySaving(true);
    setManualPayMsg(null);
    try {
      const res = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "recordManual",
          studentId: manualPayStudentId,
          amount: parseFloat(manualPayAmount),
          date: manualPayDate,
          note: manualPayNote || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setManualPayMsg({ ok: false, text: data.error || "Failed to record payment" });
        return;
      }
      const assigned = typeof data.lessonsAssigned === "number" ? data.lessonsAssigned : 0;
      setManualPayMsg({ ok: true, text: `Recorded ₴${manualPayAmount} — ${assigned} lesson${assigned !== 1 ? "s" : ""} marked as paid.` });
      setManualPayAmount("");
      setManualPayNote("");
      setManualPayDate(new Date().toISOString().slice(0, 10));
      loadTransactions();
    } finally {
      setManualPaySaving(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          monobankToken: settingsToken || undefined,
          monobankCard: settingsCard,
          appUrl: settingsAppUrl,
        }),
      });
      if (res.ok) {
        setSettingsMsg({ type: "ok", text: "Settings saved." });
        setSettingsToken("");
        loadSettings();
      } else {
        const d = await res.json();
        setSettingsMsg({ type: "error", text: d.error ?? "Failed to save" });
      }
    } finally {
      setSettingsSaving(false);
    }
  }

  async function registerWebhook() {
    setWebhookRegistering(true);
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "registerWebhook" }),
      });
      const d = await res.json();
      if (res.ok) {
        setSettingsMsg({ type: "ok", text: `Webhook registered: ${d.webhookUrl}` });
      } else {
        setSettingsMsg({ type: "error", text: d.error ?? "Failed to register webhook" });
      }
    } finally {
      setWebhookRegistering(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-ink/50">Loading…</span>
      </div>
    );
  }

  const pendingHomework = homework.filter((hw) => (hw.responses?.length ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="overflow-x-auto rounded-xl bg-ink/5 p-1.5">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const badge = tab.id === "homework" && pendingHomework > 0 ? pendingHomework : null;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  persistTeacherTab(tab.id);
                  if (tab.id === "stats") loadStudentStats();
                }}
                className={`relative flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? "bg-white text-ink shadow-sm border border-ink/10"
                    : "text-ink/50 hover:text-ink/80 hover:bg-white/50"
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                {tab.label}
                {badge !== null && (
                  <span className="ml-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white leading-none">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "homework" && (
        <section className="card p-6">
          <h2 className="mb-4 font-serif text-xl font-semibold text-ink">Homework</h2>
          <HomeworkEditor
            items={homework}
            students={students}
            groups={groups}
            onAdd={load}
            onDelete={load}
            onUpdate={load}
            isSuperAdmin={currentTeacher.isSuperAdmin}
            allTeachers={currentTeacher.isSuperAdmin ? teachers : []}
          />
        </section>
      )}

      {activeTab === "groups" && (
        <section className="card p-6">
          <h2 className="mb-4 font-serif text-xl font-semibold text-ink">Groups</h2>
          <GroupEditor
            groups={groups}
            allStudents={students}
            allTeachers={currentTeacher.isSuperAdmin ? teachers : []}
            canManagePayments={currentTeacher.isSuperAdmin}
            onAdd={load}
            onUpdate={load}
            onDelete={load}
          />
        </section>
      )}

      {activeTab === "students" && (
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
              Students ({students.length})
            </h2>
            {students.length === 0 ? (
              <p className="text-sm text-ink/50">No students yet.</p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {students.map((s) => {
                  const group = groups.find((g) => g.students.some((m) => m.id === s.id));
                  return (
                    <StudentRow
                      key={s.id}
                      student={s}
                      group={group ?? null}
                      teachers={teachers}
                      canManagePayments={currentTeacher.isSuperAdmin}
                      onUpdate={load}
                    />
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card p-6">
            <h2 className="mb-4 font-serif text-xl font-semibold text-ink">Invite students</h2>
            <InviteSection />
          </section>
        </div>
      )}

      {activeTab === "schedule" && (
        <section className="card overflow-hidden">
          <ScheduleEditor
            students={students}
            groups={groups}
            canManagePayments={currentTeacher.isSuperAdmin}
          />
        </section>
      )}

      {activeTab === "teachers" && currentTeacher.isSuperAdmin && (
        <section className="card p-6 space-y-6">
          <div>
            <h2 className="font-serif text-xl font-semibold text-ink">Teachers</h2>
            <p className="mt-1 text-sm text-ink/50">
              Invite teachers and then assign students to them from the Students tab.
            </p>
          </div>

          <TeacherInviteSection onCreated={loadTeachers} />

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">
              Current teachers
            </h3>
            {teachers.length === 0 ? (
              <p className="text-sm text-ink/50">No teachers yet.</p>
            ) : (
              <ul className="divide-y divide-ink/5 rounded-lg border border-ink/10">
                {teachers.map((teacher) => (
                  <li key={teacher.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{teacher.email}</p>
                      <p className="text-xs text-ink/45">
                        {teacher.role === "super-admin" ? "Super-admin" : "Teacher"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-0.5 text-xs font-medium text-ink/60">
                      {teacher.studentsCount} student{teacher.studentsCount === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {activeTab === "payments" && currentTeacher.isSuperAdmin && (
        <section className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-semibold text-ink">Transactions</h2>
            <button type="button" onClick={loadTransactions} className="btn-secondary text-sm">
              Refresh
            </button>
          </div>

          {transactions.length === 0 ? (
            <p className="text-ink/50 text-sm">No transactions yet. They will appear here once students pay via Monobank.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-xs font-semibold text-ink/50 uppercase tracking-wide">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Student</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2 pr-4">Lessons paid</th>
                    <th className="pb-2 pr-4">Linked lessons</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {transactions.map((t) => {
                    const isManual = t.comment?.includes("Manually marked");
                    const isUnmatched = t.lessonsCount === 0 || students.find((s) => s.id === t.studentId) === undefined;
                    return (
                      <tr key={t.id} className="py-2">
                        <td className="py-2 pr-4 whitespace-nowrap text-ink/60">
                          {new Date(t.receivedAt).toLocaleDateString("en-GB", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="font-medium text-ink">
                            {t.student.name || t.student.email}
                          </span>
                          {isUnmatched && (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">unmatched</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap font-mono text-ink">
                          {isManual ? "—" : `₴${(t.amount / 100).toFixed(0)}`}
                        </td>
                        <td className="py-2 pr-4">
                          {isManual ? (
                            <span className="italic text-ink/40 text-xs">manual</span>
                          ) : (
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              t.lessonsCount > 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {t.lessonsCount > 0 ? `${t.lessonsCount} lesson${t.lessonsCount > 1 ? "s" : ""}` : "0 — unmatched"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 max-w-[220px]">
                          {t.lessons.length > 0 ? (
                            <div className="space-y-0.5">
                              {t.lessons.map((l) => (
                                <div key={l.id} className="text-xs text-ink/70">
                                  {l.title}{" "}
                                  <span className="text-ink/40">
                                    {new Date(l.startAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                  </span>
                                </div>
                              ))}
                              {t.lessonsCount > t.lessons.length && (
                                <div className="text-xs text-amber-600">
                                  +{t.lessonsCount - t.lessons.length} more (not yet scheduled)
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-ink/30 italic text-xs">no lessons linked yet</span>
                          )}
                        </td>
                        <td className="py-2">
                          {isUnmatched && (
                            <select
                              defaultValue=""
                              onChange={(e) => { if (e.target.value) assignPayment(t.id, e.target.value); }}
                              className="input text-xs py-1 w-auto"
                            >
                              <option value="" disabled>Assign…</option>
                              {students.map((s) => (
                                <option key={s.id} value={s.id}>{s.name || s.email}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Record payment from any bank */}
          <div className="mt-8 border-t border-ink/10 pt-6">
            <h3 className="font-semibold text-ink mb-1">Record payment from another bank</h3>
            <p className="text-sm text-ink/50 mb-4">
              PrivatBank, Oschadbank, cash, wire transfer — enter the details and the system will auto-assign the payment to upcoming lessons.
            </p>
            <form onSubmit={recordManualPayment} className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1 min-w-[160px]">
                <label className="block text-xs font-medium text-ink/60">Student</label>
                <select
                  value={manualPayStudentId}
                  onChange={(e) => setManualPayStudentId(e.target.value)}
                  className="input text-sm py-1.5 w-full"
                  required
                >
                  <option value="">Select student…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name || s.email}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 w-28">
                <label className="block text-xs font-medium text-ink/60">Amount (₴)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={manualPayAmount}
                  onChange={(e) => setManualPayAmount(e.target.value)}
                  placeholder="500"
                  className="input text-sm py-1.5 w-full"
                  required
                />
              </div>
              <div className="space-y-1 w-36">
                <label className="block text-xs font-medium text-ink/60">Date</label>
                <input
                  type="date"
                  value={manualPayDate}
                  onChange={(e) => setManualPayDate(e.target.value)}
                  className="input text-sm py-1.5 w-full"
                  required
                />
              </div>
              <div className="space-y-1 min-w-[140px] flex-1">
                <label className="block text-xs font-medium text-ink/60">Note (bank / reference)</label>
                <input
                  type="text"
                  value={manualPayNote}
                  onChange={(e) => setManualPayNote(e.target.value)}
                  placeholder="PrivatBank, cash, …"
                  className="input text-sm py-1.5 w-full"
                />
              </div>
              <button
                type="submit"
                disabled={manualPaySaving || !manualPayStudentId || !manualPayAmount}
                className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50 shrink-0"
              >
                {manualPaySaving ? "Saving…" : "Record payment"}
              </button>
            </form>
            {manualPayMsg && (
              <p className={`mt-2 text-sm ${manualPayMsg.ok ? "text-green-700" : "text-red-600"}`}>
                {manualPayMsg.ok ? "✓ " : "✗ "}{manualPayMsg.text}
              </p>
            )}
          </div>

          {/* Any-bank payment intents */}
          <div className="mt-8 border-t border-ink/10 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-ink">Any-bank payment intents</h3>
              <button
                type="button"
                onClick={loadPaymentIntents}
                className="text-xs text-ink/40 hover:text-accent transition-colors"
              >
                ↻ Refresh
              </button>
            </div>
            <p className="text-sm text-ink/50 mb-4">
              Students who clicked &ldquo;Generate exact amount&rdquo; — the system matches incoming transfers by the unique amount automatically.
            </p>
            {paymentIntents.length === 0 ? (
              <p className="text-sm text-ink/40 italic">No active intents right now.</p>
            ) : (
              <div className="divide-y divide-ink/5 rounded-xl border border-ink/10 overflow-hidden">
                {paymentIntents.map((pi) => {
                  const isExpired = new Date(pi.expiresAt) < new Date();
                  const statusColor =
                    pi.status === "matched" ? "text-green-600" :
                    pi.status === "manual_review" ? "text-red-600" :
                    isExpired ? "text-ink/30" : "text-blue-600";
                  return (
                    <div key={pi.id} className="flex items-center gap-4 px-4 py-3 bg-white text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink truncate">
                          {pi.student.name || pi.student.email}
                        </p>
                        <p className="text-xs text-ink/40">
                          {new Date(pi.createdAt).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-semibold text-ink">
                          ₴{(pi.uniqueAmount / 100).toFixed(2)}
                        </p>
                        <p className={`text-xs font-medium ${statusColor}`}>
                          {pi.status === "matched" ? "✓ matched" :
                           pi.status === "manual_review" ? "⚠ collision" :
                           isExpired ? "expired" : "⏳ pending"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual paid toggle per lesson */}
          <div className="mt-8 border-t border-ink/10 pt-6">
            <h3 className="font-semibold text-ink mb-3">Mark lessons as paid manually</h3>
            <p className="text-sm text-ink/50 mb-4">Use this if a student paid without including their code in the comment.</p>
            <LessonPaidToggle students={students} onToggle={togglePaid} />
          </div>
        </section>
      )}

      {activeTab === "settings" && currentTeacher.isSuperAdmin && (
        <section className="card p-6 space-y-8">
          <div>
            <h2 className="font-serif text-xl font-semibold text-ink mb-1">Monobank integration</h2>
            <p className="text-sm text-ink/50">
              Connect your Monobank account so payments are matched automatically. Get your token at{" "}
              <a href="https://api.monobank.ua/" target="_blank" rel="noopener noreferrer" className="text-accent underline">api.monobank.ua</a>.
            </p>
          </div>

          <form onSubmit={saveSettings} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Monobank API token
                {settingsData.hasMonobankToken && (
                  <span className="ml-2 text-xs font-normal text-green-600">✓ saved</span>
                )}
              </label>
              <input
                type="password"
                value={settingsToken}
                onChange={(e) => setSettingsToken(e.target.value)}
                placeholder={settingsData.hasMonobankToken ? "Leave blank to keep existing token" : "u…_your_token_here"}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">Card / IBAN to display to students</label>
              <input
                type="text"
                value={settingsCard}
                onChange={(e) => setSettingsCard(e.target.value)}
                placeholder="e.g. 5375 4141 1234 5678"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                App public URL (for webhook registration)
              </label>
              <input
                type="url"
                value={settingsAppUrl}
                onChange={(e) => setSettingsAppUrl(e.target.value)}
                placeholder="https://your-domain.com"
                className="input w-full"
              />
              <p className="text-xs text-ink/40 mt-1">Must be a publicly accessible HTTPS URL. For local dev, use ngrok.</p>
            </div>

            <button type="submit" disabled={settingsSaving} className="btn-primary">
              {settingsSaving ? "Saving…" : "Save settings"}
            </button>
          </form>

          <div className="border-t border-ink/10 pt-6">
            <h3 className="font-semibold text-ink mb-2">Webhook registration</h3>
            <p className="text-sm text-ink/50 mb-4">
              Register the webhook with Monobank so the app receives payment notifications automatically.
              You need to save your token and app URL first.
            </p>
            <button
              type="button"
              onClick={registerWebhook}
              disabled={webhookRegistering || !settingsData.hasMonobankToken}
              className="btn-secondary"
            >
              {webhookRegistering ? "Registering…" : "Register webhook with Monobank"}
            </button>
            {!settingsData.hasMonobankToken && (
              <p className="text-xs text-ink/40 mt-2">Save your Monobank token first.</p>
            )}
          </div>

          {settingsMsg && (
            <div className={`rounded-lg px-4 py-3 text-sm ${
              settingsMsg.type === "ok"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {settingsMsg.text}
            </div>
          )}
        </section>
      )}

      {/* ── Stats tab ──────────────────────────────────────────────────────── */}
      {activeTab === "stats" && (
        <section className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-serif text-xl font-semibold text-ink">Payment stats per student</h2>
              <p className="text-sm text-ink/50 mt-0.5">Prepaid lessons and outstanding balances</p>
            </div>
            <button type="button" onClick={loadStudentStats} className="btn-secondary text-sm">
              ↻ Refresh
            </button>
          </div>

          {statsLoading && (
            <div className="flex items-center gap-2 text-sm text-ink/40 py-8">
              <span className="animate-spin">⟳</span> Loading…
            </div>
          )}

          {!statsLoading && studentStats.length === 0 && (
            <p className="text-sm text-ink/40 italic py-8 text-center">No students found.</p>
          )}

          {!statsLoading && studentStats.length > 0 && (
            <>
              {/* Summary row */}
              {(() => {
                const totalOverdue = studentStats.reduce((s, r) => s + r.overdueLessons, 0);
                const totalBalance = studentStats.reduce((s, r) => s + r.balanceLessons, 0);
                const totalPaid = studentStats.reduce((s, r) => s + r.totalPaidAmount, 0);
                return (
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-1">Загальний баланс</p>
                      <p className="text-2xl font-bold text-green-700">{totalBalance}</p>
                      <p className="text-xs text-green-600">занять залишок</p>
                    </div>
                    <div className={`rounded-xl border p-4 ${totalOverdue > 0 ? "border-red-200 bg-red-50" : "border-ink/10 bg-ink/[0.02]"}`}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-1">Заборгованість</p>
                      <p className={`text-2xl font-bold ${totalOverdue > 0 ? "text-red-600" : "text-ink/30"}`}>{totalOverdue}</p>
                      <p className={`text-xs ${totalOverdue > 0 ? "text-red-500" : "text-ink/30"}`}>занять усього</p>
                    </div>
                    <div className="rounded-xl border border-ink/10 bg-ink/[0.02] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink/40 mb-1">Всього отримано</p>
                      <p className="text-2xl font-bold text-ink">₴{totalPaid.toLocaleString("uk-UA")}</p>
                      <p className="text-xs text-ink/40">за весь час</p>
                    </div>
                  </div>
                );
              })()}

              {/* Per-student table */}
              <div className="divide-y divide-ink/5 rounded-xl border border-ink/10 overflow-hidden">
                {studentStats.map((s) => (
                  <div key={s.studentId} className="grid grid-cols-[1fr_auto] gap-4 items-center px-4 py-3 bg-white hover:bg-ink/[0.01] transition-colors">
                    {/* Left: student info */}
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{s.name || s.email}</p>
                      {s.name && <p className="text-xs text-ink/40 truncate">{s.email}</p>}
                      {s.lastPaymentAt && (
                        <p className="text-xs text-ink/35 mt-0.5">
                          Last payment: {new Date(s.lastPaymentAt).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>

                    {/* Right: stats badges */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {/* Accumulator / balance */}
                      <div className={`rounded-lg px-3 py-1.5 text-center min-w-[72px] border-2 ${
                        s.balanceLessons > 0
                          ? "bg-green-50 border-green-300"
                          : s.overdueLessons > 0
                          ? "bg-red-50 border-red-300"
                          : "bg-ink/[0.03] border-ink/10"
                      }`}>
                        <p className={`text-lg font-bold leading-none ${
                          s.balanceLessons > 0 ? "text-green-700" : s.overdueLessons > 0 ? "text-red-600" : "text-ink/25"
                        }`}>
                          {s.balanceLessons > 0 ? s.balanceLessons : s.overdueLessons > 0 ? `-${s.overdueLessons}` : "0"}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${
                          s.balanceLessons > 0 ? "text-green-600" : s.overdueLessons > 0 ? "text-red-500" : "text-ink/25"
                        }`}>
                          {s.balanceLessons > 0
                            ? `₴${s.balanceAmount.toLocaleString()}`
                            : s.overdueLessons > 0
                            ? `₴${s.overdueAmount.toLocaleString()}`
                            : "баланс 0"}
                        </p>
                        <p className="text-[9px] text-ink/30 uppercase tracking-wide mt-0.5">баланс</p>
                      </div>

                      {/* Reset buttons — only shown when there's something to reset */}
                      {currentTeacher.isSuperAdmin && (s.overdueLessons > 0 || s.balanceLessons > 0) && (
                        <div className="flex flex-col gap-1">
                          {s.overdueLessons > 0 && (
                            <button
                              onClick={() => resetStat(s.studentId, "overdue", `борг (${s.overdueLessons} занять)`)}
                              disabled={resettingStatId === s.studentId + "overdue"}
                              title="Reset overdue — mark past unpaid lessons as paid"
                              className="text-[10px] px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-400 transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              {resettingStatId === s.studentId + "overdue" ? "…" : "Reset overdue"}
                            </button>
                          )}
                          {s.balanceLessons > 0 && (
                            <button
                              onClick={() => resetStat(s.studentId, "balance", `аванс (${s.balanceLessons} занять)`)}
                              disabled={resettingStatId === s.studentId + "balance"}
                              title="Reset paid ahead — remove paid status from future lessons"
                              className="text-[10px] px-2 py-1 rounded border border-green-200 text-green-600 hover:bg-green-50 hover:border-green-400 transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              {resettingStatId === s.studentId + "balance" ? "…" : "Reset paid ahead"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Total paid */}
                      <div className="rounded-lg px-3 py-1.5 text-center min-w-[72px] bg-ink/[0.03] border border-ink/10">
                        <p className="text-sm font-bold text-ink leading-none">
                          ₴{s.totalPaidAmount > 0 ? s.totalPaidAmount.toLocaleString() : "0"}
                        </p>
                        <p className="text-[9px] text-ink/30 uppercase tracking-wide mt-1">всього</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

type TeacherInvite = {
  id: string;
  token: string;
  email: string | null;
  usedAt: string | null;
  createdAt: string;
  createdTeacherId?: string | null;
};

function TeacherInviteSection({ onCreated }: { onCreated: () => void }) {
  const [invites, setInvites] = useState<TeacherInvite[]>([]);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/teacher-invite", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setInvites(Array.isArray(data) ? data : []))
      .catch(() => setInvites([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLink(null);
    setError("");
    const res = await fetch("/api/teacher-invite", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && data.link) {
      setLink(data.link);
      setEmail("");
      load();
      onCreated();
      return;
    }
    setError(data.error || "Could not create invite");
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-4 rounded-lg border border-ink/10 bg-ink/[0.02] p-4">
      <form onSubmit={createInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-ink">Teacher email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full"
            placeholder="teacher@example.com"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creating…" : "Create teacher invite"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {link && (
        <div className="rounded-lg border border-ink/10 bg-white p-3">
          <p className="text-xs font-medium text-ink/60">New teacher invite link:</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate text-sm text-ink">{link}</code>
            <button
              type="button"
              onClick={() => copyLink(link)}
              className="btn-secondary shrink-0 text-sm"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink/70">Recent teacher invites</p>
          <ul className="space-y-1 text-sm">
            {invites.slice(0, 10).map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-ink/70">
                  {invite.email || `…${invite.token.slice(-8)}`} —{" "}
                  {invite.usedAt ? "Used" : "Unused"}
                </span>
                {!invite.usedAt && (
                  <button
                    type="button"
                    onClick={() => copyLink(`${baseUrl}/teacher/join?token=${invite.token}`)}
                    className="shrink-0 text-accent hover:underline"
                  >
                    Copy link
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const LEVEL_STYLES: Record<string, string> = {
  A1: "bg-gray-100 text-gray-700 border-gray-200",
  A2: "bg-blue-100 text-blue-700 border-blue-200",
  B1: "bg-green-100 text-green-700 border-green-200",
  B2: "bg-teal-100 text-teal-700 border-teal-200",
  C1: "bg-purple-100 text-purple-700 border-purple-200",
  C2: "bg-amber-100 text-amber-700 border-amber-200",
};

function StudentRow({
  student,
  group,
  teachers,
  canManagePayments,
  onUpdate,
}: {
  student: Student;
  group: { id: string; name: string } | null;
  teachers: TeacherSummary[];
  canManagePayments: boolean;
  onUpdate: () => void;
}) {
  const currentPrice = student.lessonPrice != null ? student.lessonPrice / 100 : null;
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(currentPrice != null ? String(currentPrice) : "");
  const [savingPrice, setSavingPrice] = useState(false);
  const [savingLevel, setSavingLevel] = useState(false);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function deleteStudent() {
    if (
      !window.confirm(
        `Remove student ${student.email}? Their homework responses, schedule links, and payments in this app will be deleted. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/students", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: student.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as { error?: string }).error ?? "Could not delete student");
        return;
      }
      onUpdate();
    } finally {
      setDeleting(false);
    }
  }

  async function savePrice() {
    setSavingPrice(true);
    await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: student.id, lessonPrice: priceInput !== "" ? Number(priceInput) : 0 }),
    });
    setSavingPrice(false);
    setEditingPrice(false);
    onUpdate();
  }

  async function toggleTeacher(teacherId: string) {
    const current = (student.teacherStudents ?? []).map((ts) => ts.teacher.id);
    const next = current.includes(teacherId)
      ? current.filter((id) => id !== teacherId)
      : [...current, teacherId];
    setSavingTeacher(true);
    await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: student.id, teacherIds: next }),
    });
    setSavingTeacher(false);
    onUpdate();
  }

  async function setLevel(level: string | null) {
    setSavingLevel(true);
    await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: student.id, level: level ?? "" }),
    });
    setSavingLevel(false);
    onUpdate();
  }

  async function saveTemporaryPassword() {
    setSavingPassword(true);
    setPasswordMsg(null);
    const res = await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: student.id, temporaryPassword: tempPassword }),
    });
    let data: { error?: string } = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    setSavingPassword(false);
    if (!res.ok) {
      setPasswordMsg({ type: "error", text: data.error ?? "Could not update password" });
      return;
    }
    setPasswordMsg({
      type: "ok",
      text: "New password saved. Share it with the student so they can log in.",
    });
    setTempPassword("");
    onUpdate();
  }

  return (
    <li className="flex flex-col w-full">
      <div className="flex items-center justify-between gap-3 py-3 flex-wrap">
      <div className="min-w-0">
        {student.name && <p className="font-medium text-ink truncate">{student.name}</p>}
        <p className={`text-sm truncate ${student.name ? "text-ink/50" : "font-medium text-ink"}`}>
          {student.email}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 flex-wrap justify-end">

        {/* CEFR level selector */}
        <div className="flex items-center gap-1">
          {student.level && (
            <span
              className={[
                "inline-flex items-center rounded border px-2 py-0.5 text-xs font-bold",
                LEVEL_STYLES[student.level] ?? "bg-gray-100 text-gray-700 border-gray-200",
              ].join(" ")}
            >
              {student.level}
            </span>
          )}
          <select
            value={student.level ?? ""}
            disabled={savingLevel}
            onChange={(e) => setLevel(e.target.value || null)}
            className="text-xs text-ink/50 border border-dashed border-ink/20 rounded px-1.5 py-0.5 bg-transparent hover:border-ink/40 transition-colors cursor-pointer disabled:opacity-50"
            title="Set student level"
          >
            <option value="">{student.level ? "clear level" : "+ set level"}</option>
            {CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          {savingLevel && <span className="text-xs text-ink/40">…</span>}
        </div>

        {canManagePayments && (
          <div className="flex flex-wrap items-center gap-1">
            {savingTeacher && <span className="text-xs text-ink/40">…</span>}
            {teachers.map((t) => {
              const assigned = (student.teacherStudents ?? []).some((ts) => ts.teacher.id === t.id);
              const label = t.email.split("@")[0];
              return (
                <button
                  key={t.id}
                  disabled={savingTeacher}
                  onClick={() => toggleTeacher(t.id)}
                  title={`${assigned ? "Remove" : "Add"} teacher: ${t.email}`}
                  className={[
                    "text-xs rounded px-1.5 py-0.5 border transition-colors disabled:opacity-50",
                    assigned
                      ? "bg-accent/10 border-accent text-accent font-medium"
                      : "border-dashed border-ink/20 text-ink/40 hover:border-ink/40",
                  ].join(" ")}
                >
                  {assigned ? "✓ " : ""}{label}
                </button>
              );
            })}
          </div>
        )}

        {/* Lesson price */}
        {canManagePayments && (
          editingPrice ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-ink/40">₴</span>
              <input
                type="number"
                min="0"
                step="50"
                autoFocus
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") savePrice(); if (e.key === "Escape") setEditingPrice(false); }}
                className="input text-xs py-0.5 w-20"
                placeholder="price"
              />
              <button type="button" disabled={savingPrice} onClick={savePrice} className="text-xs text-accent hover:underline">
                {savingPrice ? "…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditingPrice(false)} className="text-xs text-ink/40 hover:underline">Cancel</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setPriceInput(currentPrice != null ? String(currentPrice) : ""); setEditingPrice(true); }}
              className="text-xs text-ink/50 hover:text-ink/80 border border-dashed border-ink/20 rounded px-2 py-0.5 hover:border-ink/40 transition-colors"
              title="Set lesson price"
            >
              {currentPrice != null ? `₴${currentPrice}/lesson` : "+ set price"}
            </button>
          )
        )}

        {canManagePayments && student.paymentCode && (
          <span className="font-mono text-xs text-ink/40 bg-ink/5 rounded px-2 py-0.5">
            {student.paymentCode}
          </span>
        )}
        {group && (
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
            {group.name}
          </span>
        )}
        {student.createdAt && (
          <span className="text-xs text-ink/30">
            {new Date(student.createdAt).toLocaleDateString()}
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            setPasswordMsg(null);
            setShowPasswordReset((p) => {
              if (p) setTempPassword("");
              return !p;
            });
          }}
          className="text-xs text-ink/50 hover:text-ink/80 border border-dashed border-ink/20 rounded px-2 py-0.5 hover:border-ink/40 transition-colors"
          title="Set a new password if the student forgot theirs"
        >
          {showPasswordReset ? "Close" : "New password"}
        </button>

        {canManagePayments && (
          <button
            type="button"
            onClick={() => void deleteStudent()}
            disabled={deleting}
            className="text-xs text-red-600/90 hover:text-red-700 border border-dashed border-red-200 rounded px-2 py-0.5 hover:border-red-300 transition-colors disabled:opacity-50"
            title="Permanently remove this student from the app"
          >
            {deleting ? "Removing…" : "Delete student"}
          </button>
        )}
      </div>
      </div>

      {showPasswordReset && (
        <div className="pb-4 pt-3 space-y-2 border-t border-ink/5">
          <p className="text-xs text-ink/50">
            Set a temporary password (at least 8 characters). Tell the student the new password out of band.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              autoComplete="new-password"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTemporaryPassword();
              }}
              className="input text-sm py-1 max-w-[220px]"
              placeholder="New password"
              disabled={savingPassword}
            />
            <button
              type="button"
              disabled={savingPassword || tempPassword.length < 8}
              onClick={saveTemporaryPassword}
              className="btn-secondary text-xs py-1 disabled:opacity-50"
            >
              {savingPassword ? "Saving…" : "Save password"}
            </button>
          </div>
          {passwordMsg && (
            <p
              className={`text-xs ${passwordMsg.type === "ok" ? "text-green-700" : "text-red-600"}`}
              role="status"
            >
              {passwordMsg.text}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function LessonPaidToggle({
  students,
  onToggle,
}: {
  students: Student[];
  onToggle: (lessonId: string, currentlyPaid: boolean) => Promise<void>;
}) {
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [lessons, setLessons] = useState<{ id: string; title: string; startAt: string; isPaid: boolean }[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedStudent) { setLessons([]); return; }
    setLoadingLessons(true);
    fetch("/api/schedule?view=teacher")
      .then((r) => r.json())
      .then((data) => {
        const filtered = Array.isArray(data)
          ? data.filter((l: { studentId: string | null }) => l.studentId === selectedStudent)
          : [];
        setLessons(filtered);
        setLoadingLessons(false);
      });
  }, [selectedStudent]);

  async function handleToggle(lessonId: string, isPaid: boolean) {
    setTogglingId(lessonId);
    await onToggle(lessonId, isPaid);
    // Refresh lesson list
    const res = await fetch("/api/schedule?view=teacher");
    const data = await res.json();
    const filtered = Array.isArray(data)
      ? data.filter((l: { studentId: string | null }) => l.studentId === selectedStudent)
      : [];
    setLessons(filtered);
    setTogglingId(null);
  }

  return (
    <div className="space-y-3">
      <select
        value={selectedStudent}
        onChange={(e) => setSelectedStudent(e.target.value)}
        className="input w-auto"
      >
        <option value="">Select a student…</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>{s.name || s.email}</option>
        ))}
      </select>

      {loadingLessons && <p className="text-sm text-ink/40">Loading…</p>}

      {!loadingLessons && selectedStudent && lessons.length === 0 && (
        <p className="text-sm text-ink/40">No individual lessons for this student.</p>
      )}

      {lessons.length > 0 && (
        <ul className="divide-y divide-ink/5 rounded-lg border border-ink/10">
          {lessons.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-sm text-ink">{l.title}</p>
                <p className="text-xs text-ink/50">
                  {new Date(l.startAt).toLocaleDateString("en-GB", {
                    weekday: "short", day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  l.isPaid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {l.isPaid ? "Paid" : "Unpaid"}
                </span>
                <button
                  type="button"
                  disabled={togglingId === l.id}
                  onClick={() => handleToggle(l.id, l.isPaid)}
                  className="btn-secondary text-xs py-1 px-2"
                >
                  {togglingId === l.id ? "…" : l.isPaid ? "Mark unpaid" : "Mark paid"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
