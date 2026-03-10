"use client";

import { useState, useRef } from "react";

type Student = { id: string; email: string; name: string | null };
export type HomeworkAttachment = { url: string; name: string; type: "image" | "audio" | "archive" };
type ResponseItem = {
  id: string;
  response: string;
  submittedAt: string;
  student?: { id: string; email: string; name: string | null };
};
type Item = {
  id: string;
  title: string;
  description: string;
  studentId?: string | null;
  attachments?: string;
  responses?: ResponseItem[];
};

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
  const [attachments, setAttachments] = useState<HomeworkAttachment[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [editingAttachments, setEditingAttachments] = useState<HomeworkAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  function parseAttachments(item: Item): HomeworkAttachment[] {
    try {
      const raw = item.attachments ?? "[]";
      const arr = JSON.parse(typeof raw === "string" ? raw : "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  async function handleUpload(fileList: FileList | null, setTarget: React.Dispatch<React.SetStateAction<HomeworkAttachment[]>>) {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.set("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.error || "Upload failed");
          continue;
        }
        const data = await res.json();
        setTarget((prev) => [...prev, { url: data.url, name: data.name, type: data.type }]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
        attachments,
      }),
    });
    setTitle("");
    setDescription("");
    setStudentId("");
    setAttachments([]);
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
        attachments: editingAttachments,
      }),
    });
    setEditing(null);
    setEditingAttachments([]);
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
          <div className="space-y-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,audio/*,.zip,.rar,.7z,.gz"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files, setAttachments)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-sm text-accent hover:underline disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "+ Add photo, audio or archive"}
            </button>
            {attachments.length > 0 && (
              <ul className="flex flex-wrap gap-2 mt-1">
                {attachments.map((a, i) => (
                  <li key={a.url} className="flex items-center gap-1 rounded bg-ink/5 px-2 py-1 text-sm">
                    <span className="text-ink/80 truncate max-w-[120px]">{a.name}</span>
                    <button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-red-600 hover:underline" aria-label="Remove">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
                <div className="space-y-1">
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*,audio/*,.zip,.rar,.7z,.gz"
                    multiple
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files, setEditingAttachments)}
                  />
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-sm text-accent hover:underline disabled:opacity-50"
                  >
                    {uploading ? "Uploading…" : "+ Add photo, audio or archive"}
                  </button>
                  {editingAttachments.length > 0 && (
                    <ul className="flex flex-wrap gap-2 mt-1">
                      {editingAttachments.map((a, i) => (
                        <li key={a.url} className="flex items-center gap-1 rounded bg-ink/5 px-2 py-1 text-sm">
                          <span className="text-ink/80 truncate max-w-[120px]">{a.name}</span>
                          <button type="button" onClick={() => setEditingAttachments((p) => p.filter((_, j) => j !== i))} className="text-red-600 hover:underline" aria-label="Remove">×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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
                  <button type="button" onClick={() => { setEditing(null); setEditingAttachments([]); }} className="btn-secondary">Cancel</button>
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
                    {parseAttachments(item).length > 0 && (
                      <p className="mt-1 text-xs text-ink/50">
                        Attachments: {parseAttachments(item).map((a) => a.name).join(", ")}
                      </p>
                    )}
                    {item.responses && item.responses.length > 0 && (
                      <div className="mt-3 rounded border border-ink/10 bg-ink/5 p-3 space-y-2">
                        <p className="text-xs font-medium text-ink/70">Student responses</p>
                        {item.responses.map((r) => (
                          <div key={r.id} className="text-sm">
                            {r.student && (
                              <p className="text-ink/60 font-medium">
                                {r.student.name || r.student.email}
                                <span className="text-xs text-ink/50 ml-1">
                                  {new Date(r.submittedAt).toLocaleString()}
                                </span>
                              </p>
                            )}
                            <p className="whitespace-pre-wrap text-ink/80 mt-0.5">{r.response || "—"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(item);
                        setEditingAttachments(parseAttachments(item));
                      }}
                      className="btn-secondary text-sm"
                    >
                      Edit
                    </button>
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
