"use client";

import { useEffect, useState } from "react";
import { HomeworkEditor } from "./HomeworkEditor";
import { LinkEditor } from "./LinkEditor";
import { PaymentEditor } from "./PaymentEditor";
import { InviteSection } from "./InviteSection";

type Student = { id: string; email: string; name: string | null };
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
  responses?: HomeworkResponse[];
};
type LinkItem = { id: string; title: string; url: string; studentId?: string | null };
type PaymentInfo = { id: string; content: string; amount: string | null; studentId?: string | null };

export function TeacherDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [lessons, setLessons] = useState<LinkItem[]>([]);
  const [miro, setMiro] = useState<LinkItem[]>([]);
  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/students").then((r) => r.json()),
      fetch("/api/homework").then((r) => r.json()),
      fetch("/api/lessons").then((r) => r.json()),
      fetch("/api/miro").then((r) => r.json()),
      fetch("/api/payment").then((r) => r.json()),
    ])
      .then(([st, hw, les, m, pay]) => {
        setStudents(Array.isArray(st) ? st : []);
        setHomework(Array.isArray(hw) ? hw : []);
        setLessons(Array.isArray(les) ? les : []);
        setMiro(Array.isArray(m) ? m : []);
        setPayments(Array.isArray(pay) ? pay : []);
      })
      .catch(() => {
        setStudents([]);
        setHomework([]);
        setLessons([]);
        setMiro([]);
        setPayments([]);
      })
      .finally(() => setLoading(false));
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
    <div className="space-y-10">
      <section className="card p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
          Invite students
        </h2>
        <InviteSection />
      </section>

      <section className="card p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
          Homework
        </h2>
        <HomeworkEditor
          items={homework}
          students={students}
          onAdd={load}
          onDelete={load}
          onUpdate={load}
        />
      </section>

      <section className="card p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
          Lesson links
        </h2>
        <LinkEditor
          items={lessons}
          api="/api/lessons"
          students={students}
          onAdd={load}
          onDelete={load}
          onUpdate={load}
        />
      </section>

      <section className="card p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
          Miro boards
        </h2>
        <LinkEditor
          items={miro}
          api="/api/miro"
          students={students}
          onAdd={load}
          onDelete={load}
          onUpdate={load}
        />
      </section>

      <section className="card p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
          Payment info
        </h2>
        <PaymentEditor
          payments={payments}
          students={students}
          onSave={load}
        />
      </section>
    </div>
  );
}
