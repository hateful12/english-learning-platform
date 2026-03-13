"use client";

import { useState } from "react";

type Student = { id: string; email: string; name: string | null };
export type Group = {
  id: string;
  name: string;
  createdAt: string;
  students: Student[];
};

function studentDisplay(s: Student) {
  return s.name || s.email;
}

function GroupCard({
  group,
  allStudents,
  onSaved,
  onDeleted,
}: {
  group: Group;
  allStudents: Student[];
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(group.students.map((s) => s.id))
  );
  const [saving, setSaving] = useState(false);

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancelEdit() {
    setEditing(false);
    setName(group.name);
    setSelectedIds(new Set(group.students.map((s) => s.id)));
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), studentIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to save group");
        return;
      }
      onSaved();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete group "${group.name}"? Homework assigned to this group will become unassigned.`)) return;
    const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to delete group");
      return;
    }
    onDeleted();
  }

  return (
    <li className="rounded-lg border border-ink/10 bg-white p-4 space-y-3">
      {editing ? (
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full font-medium"
            placeholder="Group name"
          />
          <div>
            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-2">Members</p>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {allStudents.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-ink/5 rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleStudent(s.id)}
                      className="rounded"
                    />
                    <span className="text-sm text-ink">{studentDisplay(s)}</span>
                  </label>
                </li>
              ))}
            </ul>
            {allStudents.length === 0 && (
              <p className="text-sm text-ink/40">No students available.</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="btn-secondary text-sm py-1 px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-ink">{group.name}</p>
            {group.students.length > 0 ? (
              <p className="mt-1 text-sm text-ink/60">
                {group.students.map(studentDisplay).join(", ")}
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink/40 italic">No members yet</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-secondary text-sm"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="text-sm text-red-600 hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function GroupEditor({
  groups,
  allStudents,
  onAdd,
  onUpdate,
  onDelete,
}: {
  groups: Group[];
  allStudents: Student[];
  onAdd: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), studentIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to create group");
        return;
      }
      setName("");
      setSelectedIds(new Set());
      setFormOpen(false);
      onAdd();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* New group form */}
      {!formOpen ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="btn-primary"
        >
          + New group
        </button>
      ) : (
        <form onSubmit={handleCreate} className="rounded-lg border border-accent/20 bg-accent/5 p-4 space-y-3">
          <p className="text-sm font-semibold text-ink">New group</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            className="input w-full"
            autoFocus
          />
          <div>
            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-2">Add students</p>
            {allStudents.length > 0 ? (
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {allStudents.map((s) => (
                  <li key={s.id}>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-ink/10 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="rounded"
                      />
                      <span className="text-sm text-ink">{studentDisplay(s)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/40">No students yet.</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create group"}
            </button>
            <button
              type="button"
              onClick={() => { setFormOpen(false); setName(""); setSelectedIds(new Set()); }}
              className="btn-secondary text-sm py-1 px-3"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Groups list */}
      {groups.length === 0 ? (
        <p className="text-sm text-ink/40">No groups yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              allStudents={allStudents}
              onSaved={onUpdate}
              onDeleted={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
