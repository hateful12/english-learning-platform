"use client";

import { useEffect, useState } from "react";
import { HomeworkEditor } from "./HomeworkEditor";
import { PaymentEditor } from "./PaymentEditor";
import { InviteSection } from "./InviteSection";
import { GroupEditor, Group } from "./GroupEditor";
import { ScheduleEditor } from "./ScheduleEditor";

type Student = { id: string; email: string; name: string | null; paymentCode?: string; createdAt?: string };
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
type PaymentInfo = { id: string; content: string; amount: string | null; studentId?: string | null };

type Tab = "homework" | "groups" | "students" | "payment" | "schedule" | "payments" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "homework", label: "Homework" },
  { id: "schedule", label: "Schedule" },
  { id: "groups", label: "Groups" },
  { id: "students", label: "Students" },
  { id: "payment", label: "Payment Info" },
  { id: "payments", label: "Transactions" },
  { id: "settings", label: "Settings" },
];

type Transaction = {
  id: string;
  studentId: string;
  lessonId: string | null;
  monoId: string;
  amount: number;
  comment: string | null;
  receivedAt: string;
  createdAt: string;
  student: { id: string; name: string | null; email: string };
  lesson: { id: string; title: string; startAt: string } | null;
};

type SettingsData = {
  hasMonobankToken: boolean;
  monobankCard: string;
  appUrl: string;
};

export function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("homework");
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
      fetch("/api/homework").then((r) => r.json()),
      fetch("/api/payment").then((r) => r.json()),
    ]).then(([st, gr, hw, pay]) => {
      setStudents(Array.isArray(st) ? st : []);
      setGroups(Array.isArray(gr) ? gr : []);
      setHomework(Array.isArray(hw) ? hw : []);
      setPayments(Array.isArray(pay) ? pay : []);
      setLoading(false);
    });
  }

  function loadTransactions() {
    fetch("/api/payments")
      .then((r) => r.json())
      .then((data) => setTransactions(Array.isArray(data) ? data : []));
  }

  function loadSettings() {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: SettingsData) => {
        setSettingsData(data);
        setSettingsCard(data.monobankCard ?? "");
        setSettingsAppUrl(data.appUrl ?? "");
      });
  }

  useEffect(() => {
    load();
    loadTransactions();
    loadSettings();
  }, []);

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

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="border-b border-ink/10 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-ink/50 hover:text-ink/80 hover:border-ink/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
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
          />
        </section>
      )}

      {activeTab === "groups" && (
        <section className="card p-6">
          <h2 className="mb-4 font-serif text-xl font-semibold text-ink">Groups</h2>
          <GroupEditor
            groups={groups}
            allStudents={students}
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
                    <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        {s.name && <p className="font-medium text-ink truncate">{s.name}</p>}
                        <p className={`text-sm truncate ${s.name ? "text-ink/50" : "font-medium text-ink"}`}>
                          {s.email}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 flex-wrap justify-end">
                        {s.paymentCode && (
                          <span className="font-mono text-xs text-ink/50 bg-ink/5 rounded px-2 py-0.5">
                            {s.paymentCode}
                          </span>
                        )}
                        {group && (
                          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                            {group.name}
                          </span>
                        )}
                        {s.createdAt && (
                          <span className="text-xs text-ink/30">
                            {new Date(s.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </li>
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

      {activeTab === "payment" && (
        <section className="card p-6">
          <h2 className="mb-4 font-serif text-xl font-semibold text-ink">Payment info</h2>
          <PaymentEditor
            payments={payments}
            students={students}
            onSave={load}
          />
        </section>
      )}

      {activeTab === "schedule" && (
        <section className="card overflow-hidden">
          <ScheduleEditor students={students} groups={groups} />
        </section>
      )}

      {activeTab === "payments" && (
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
                    <th className="pb-2 pr-4">Comment</th>
                    <th className="pb-2 pr-4">Lesson</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {transactions.map((t) => {
                    const isManual = t.comment?.includes("Manually marked");
                    const isUnmatched = !t.student.id || students.find((s) => s.id === t.studentId) === undefined;
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
                          {isManual ? "—" : `₴${(t.amount / 100).toFixed(2)}`}
                        </td>
                        <td className="py-2 pr-4 max-w-[200px] truncate text-ink/60">
                          {isManual ? <span className="italic text-ink/40">manual</span> : (t.comment ?? "—")}
                        </td>
                        <td className="py-2 pr-4">
                          {t.lesson ? (
                            <span className="text-ink/70">
                              {t.lesson.title}{" "}
                              <span className="text-ink/40 text-xs">
                                {new Date(t.lesson.startAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              </span>
                            </span>
                          ) : (
                            <span className="text-ink/30 italic text-xs">no lesson linked</span>
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

          {/* Manual paid toggle per lesson */}
          <div className="mt-8 border-t border-ink/10 pt-6">
            <h3 className="font-semibold text-ink mb-3">Mark lessons as paid manually</h3>
            <p className="text-sm text-ink/50 mb-4">Use this if a student paid without including their code in the comment.</p>
            <LessonPaidToggle students={students} onToggle={togglePaid} />
          </div>
        </section>
      )}

      {activeTab === "settings" && (
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
    </div>
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
    fetch("/api/schedule")
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
    const res = await fetch("/api/schedule");
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
