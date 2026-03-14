"use client";

import { useEffect, useState } from "react";
import { HomeworkEditor } from "./HomeworkEditor";
import { LinkEditor } from "./LinkEditor";
import { PaymentEditor } from "./PaymentEditor";
import { InviteSection } from "./InviteSection";
import { GroupEditor, Group } from "./GroupEditor";

type Student = { id: string; email: string; name: string | null; createdAt?: string };
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
type LinkItem = { id: string; title: string; url: string; studentId?: string | null };
type PaymentInfo = { id: string; content: string; amount: string | null; studentId?: string | null };

type Tab = "homework" | "groups" | "students" | "links" | "miro" | "payment";

const TABS: { id: Tab; label: string }[] = [
  { id: "homework", label: "Homework" },
  { id: "groups", label: "Groups" },
  { id: "students", label: "Students" },
  { id: "links", label: "Lesson links" },
  { id: "miro", label: "Miro boards" },
  { id: "payment", label: "Payment" },
];

export function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("homework");
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [lessons, setLessons] = useState<LinkItem[]>([]);
  const [miro, setMiro] = useState<LinkItem[]>([]);
  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/students").then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/homework").then((r) => r.json()),
      fetch("/api/lessons").then((r) => r.json()),
      fetch("/api/miro").then((r) => r.json()),
      fetch("/api/payment").then((r) => r.json()),
    ]).then(([st, gr, hw, les, m, pay]) => {
      setStudents(Array.isArray(st) ? st : []);
      setGroups(Array.isArray(gr) ? gr : []);
      setHomework(Array.isArray(hw) ? hw : []);
      setLessons(Array.isArray(les) ? les : []);
      setMiro(Array.isArray(m) ? m : []);
      setPayments(Array.isArray(pay) ? pay : []);
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

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
                      <div className="flex shrink-0 items-center gap-2">
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

      {activeTab === "links" && (
        <section className="card p-6">
          <h2 className="mb-4 font-serif text-xl font-semibold text-ink">Lesson links</h2>
          <LinkEditor
            items={lessons}
            api="/api/lessons"
            students={students}
            onAdd={load}
            onDelete={load}
            onUpdate={load}
          />
        </section>
      )}

      {activeTab === "miro" && (
        <section className="card p-6">
          <h2 className="mb-4 font-serif text-xl font-semibold text-ink">Miro boards</h2>
          <LinkEditor
            items={miro}
            api="/api/miro"
            students={students}
            onAdd={load}
            onDelete={load}
            onUpdate={load}
          />
        </section>
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
    </div>
  );
}
