"use client";

import { useEffect, useState } from "react";

type Homework = { id: string; title: string; description: string; createdAt: string };
type LinkItem = { id: string; title: string; url: string };
type PaymentInfo = { id: string; content: string; amount: string | null } | null;

export function StudentDashboard() {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [lessons, setLessons] = useState<LinkItem[]>([]);
  const [miro, setMiro] = useState<LinkItem[]>([]);
  const [payment, setPayment] = useState<PaymentInfo>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/homework").then((r) => r.json()),
      fetch("/api/lessons").then((r) => r.json()),
      fetch("/api/miro").then((r) => r.json()),
      fetch("/api/payment").then((r) => r.json()),
    ]).then(([hw, les, m, pay]) => {
      setHomework(hw);
      setLessons(les);
      setMiro(m);
      setPayment(pay);
      setLoading(false);
    });
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
          Homework
        </h2>
        {homework.length === 0 ? (
          <p className="text-ink/50">No homework posted yet.</p>
        ) : (
          <ul className="space-y-4">
            {homework.map((item) => (
              <li key={item.id} className="border-b border-ink/5 pb-4 last:border-0 last:pb-0">
                <h3 className="font-medium text-ink">{item.title}</h3>
                {item.description && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">
                    {item.description}
                  </p>
                )}
              </li>
            ))}
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
