"use client";

import { useState } from "react";

type Student = { id: string; email: string; name: string | null };
type Item = { id: string; title: string; description: string; studentId?: string | null };

export function HomeworkEditor({
  items,
  students = [],
  onAdd,
  onDelete,
  onUpdate,
}: {
  items: Item[];
  students?: Student[];
  onAdd: () => void;
  onDelete: () => void;
  onUpdate: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [studentId, setStudentId] = useState<string>("");
  const [editing, setEditing] = useState<Item | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch("/api/homework", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        studentId: studentId || null,
      }),
    });
    setTitle("");
    setDescription("");
    setStudentId("");
    onAdd();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this homework?")) return;
    await fetch(`/api/homework/${id}`, { method: "DELETE" });
    onDelete();
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    await fetch(`/api/homework/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editing.title,
        description: editing.description,
        studentId: editing.studentId ?? null,
      }),
    });
    setEditing(null);
    onUpdate();
  }

  function studentLabel(id: string | null | undefined) {
    if (!id) return "All students";
    const s = students.find((x) => x.id === id);
    return s ? s.name || s.email : id;
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Homework title"
              className="input flex-1 min-w-[180px]"
            />
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="input w-auto max-w-[200px]"
            >
              <option value="">All students</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.email}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="input min-h-[80px] resize-y w-full"
            rows={2}
          />
        </div>
        <button type="submit" className="btn-primary shrink-0">
          Add homework
        </button>
      </form>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-ink/10 bg-white p-3">
            {editing?.id === item.id ? (
              <form onSubmit={handleUpdate} className="space-y-2">
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="input"
                />
                <textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="input min-h-[60px] resize-y"
                  rows={2}
                />
                {students.length > 0 && (
                  <select
                    value={editing.studentId ?? ""}
                    onChange={(e) => setEditing({ ...editing, studentId: e.target.value || null })}
                    className="input w-auto"
                  >
                    <option value="">All students</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.name || s.email}</option>
                    ))}
                  </select>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary">Save</button>
                  <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-ink">{item.title}</h3>
                      <span className="text-xs text-ink/50">({studentLabel(item.studentId)})</span>
                    </div>
                    {item.description && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{item.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => setEditing(item)} className="btn-secondary text-sm">Edit</button>
                    <button type="button" onClick={() => handleDelete(item.id)} className="text-sm text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
