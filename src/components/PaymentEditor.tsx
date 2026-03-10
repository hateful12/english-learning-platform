"use client";

import { useState, useEffect } from "react";

type Student = { id: string; email: string; name: string | null };
type PaymentInfo = { id: string; content: string; amount: string | null; studentId?: string | null };

export function PaymentEditor({
  payments = [],
  students = [],
  onSave,
}: {
  payments: PaymentInfo[];
  students?: Student[];
  onSave: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [amount, setAmount] = useState("");
  const [studentId, setStudentId] = useState<string>("");
  const [isNew, setIsNew] = useState(false);

  const selected = selectedId ? payments.find((p) => p.id === selectedId) : payments[0] ?? null;
  const displayPayments = payments.length > 0 ? payments : null;

  useEffect(() => {
    if (selected) {
      setContent(selected.content);
      setAmount(selected.amount ?? "");
      setStudentId(selected.studentId ?? "");
      setIsNew(false);
    } else if (isNew) {
      setContent("");
      setAmount("");
      setStudentId("");
    }
  }, [selected?.id, isNew]);

  function studentLabel(id: string | null | undefined) {
    if (!id) return "All students";
    const s = students.find((x) => x.id === id);
    return s ? s.name || s.email : id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected) {
      await fetch("/api/payment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          content: content.trim(),
          amount: amount.trim() || null,
          studentId: studentId || null,
        }),
      });
    } else {
      await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          amount: amount.trim() || null,
          studentId: studentId || null,
        }),
      });
    }
    setSelectedId(null);
    setIsNew(false);
    onSave();
  }

  function startNew() {
    setSelectedId(null);
    setIsNew(true);
    setContent("");
    setAmount("");
    setStudentId("");
  }

  if (!displayPayments && !isNew) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink/60">No payment info yet. Add one below (for all students or a specific student).</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {students.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-ink">Assign to</label>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input mt-1 w-auto">
                <option value="">All students</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name || s.email}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-ink">Amount (e.g. price per lesson)</label>
            <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. $25 per lesson" className="input mt-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink">Payment details</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Bank details, PayPal..." className="input mt-1 min-h-[120px] resize-y" rows={4} />
          </div>
          <button type="submit" className="btn-primary">Save payment info</button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(displayPayments?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {displayPayments!.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { setSelectedId(p.id); setIsNew(false); }}
              className={`rounded-lg border px-3 py-1.5 text-sm ${selectedId === p.id ? "border-accent bg-accent/10 text-accent" : "border-ink/20 text-ink/70 hover:bg-ink/5"}`}
            >
              {studentLabel(p.studentId)}
            </button>
          ))}
          <button type="button" onClick={startNew} className="rounded-lg border border-dashed border-ink/30 px-3 py-1.5 text-sm text-ink/60 hover:bg-ink/5">
            + New
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {students.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-ink">Assign to</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input mt-1 w-auto">
              <option value="">All students</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name || s.email}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-ink">Amount (e.g. price per lesson)</label>
          <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. $25 per lesson" className="input mt-1" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Payment details</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Bank details, PayPal..." className="input mt-1 min-h-[120px] resize-y" rows={4} />
        </div>
        <button type="submit" className="btn-primary">
          {selected ? "Update payment info" : "Save payment info"}
        </button>
      </form>
    </div>
  );
}
