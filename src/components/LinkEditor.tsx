"use client";

import { useState } from "react";

type Student = { id: string; email: string; name: string | null };
type Item = { id: string; title: string; url: string; studentId?: string | null };

export function LinkEditor({
  items,
  api,
  students = [],
  onAdd,
  onDelete,
  onUpdate,
}: {
  items: Item[];
  api: string;
  students?: Student[];
  onAdd: () => void;
  onDelete: () => void;
  onUpdate: () => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [studentId, setStudentId] = useState<string>("");
  const [editing, setEditing] = useState<Item | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), url: url.trim(), studentId: studentId || null }),
    });
    setTitle("");
    setUrl("");
    setStudentId("");
    onAdd();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this link?")) return;
    await fetch(`${api}/${id}`, { method: "DELETE" });
    onDelete();
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    await fetch(`${api}/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editing.title,
        url: editing.url,
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
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Link title"
          className="input flex-1"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="input flex-1"
        />
        {students.length > 0 && (
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="input w-auto max-w-[180px]"
          >
            <option value="">All students</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name || s.email}</option>
            ))}
          </select>
        )}
        <button type="submit" className="btn-primary shrink-0">Add link</button>
      </form>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-white p-3">
            {editing?.id === item.id ? (
              <form onSubmit={handleUpdate} className="flex flex-1 flex-wrap items-end gap-2">
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="input min-w-[120px] flex-1"
                />
                <input
                  value={editing.url}
                  onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                  className="input min-w-[200px] flex-1"
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
                <div className="flex gap-1">
                  <button type="submit" className="btn-primary">Save</button>
                  <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-ink">{item.title}</span>
                  <span className="ml-2 text-xs text-ink/50">({studentLabel(item.studentId)})</span>
                  <span className="ml-2 block truncate text-sm text-ink/50">{item.url}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => setEditing(item)} className="btn-secondary text-sm">Edit</button>
                  <button type="button" onClick={() => handleDelete(item.id)} className="text-sm text-red-600 hover:underline">Delete</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
