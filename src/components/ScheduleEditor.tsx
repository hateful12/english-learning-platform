"use client";

import { useEffect, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer, SlotInfo, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});

type Student = { id: string; email: string; name: string | null };
type Group = { id: string; name: string };

type ScheduledLesson = {
  id: string;
  title: string;
  startAt: string;
  durationMin: number;
  zoomUrl: string | null;
  notes: string | null;
  studentId: string | null;
  groupId: string | null;
  student: Student | null;
  group: Group | null;
};

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ScheduledLesson;
};

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

const emptyForm = {
  title: "",
  startAt: "",
  durationMin: 60,
  zoomUrl: "",
  notes: "",
  studentId: "",
  groupId: "",
};

type FormState = typeof emptyForm;

interface ScheduleEditorProps {
  students: Student[];
  groups: Group[];
}

export function ScheduleEditor({ students, groups }: ScheduleEditorProps) {
  const [lessons, setLessons] = useState<ScheduledLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>("week");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchLessons = useCallback(async () => {
    const res = await fetch("/api/schedule");
    if (res.ok) {
      const data = await res.json();
      setLessons(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const events: CalendarEvent[] = lessons.map((l) => {
    const start = new Date(l.startAt);
    const end = new Date(start.getTime() + l.durationMin * 60 * 1000);
    return { id: l.id, title: l.title, start, end, resource: l };
  });

  function openCreateModal(slotInfo?: SlotInfo) {
    const defaultStart = slotInfo?.start ?? new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const localISO = `${defaultStart.getFullYear()}-${pad(defaultStart.getMonth() + 1)}-${pad(defaultStart.getDate())}T${pad(defaultStart.getHours())}:${pad(defaultStart.getMinutes())}`;
    setForm({ ...emptyForm, startAt: localISO });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEditModal(event: CalendarEvent) {
    const l = event.resource;
    const d = new Date(l.startAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    const localISO = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setForm({
      title: l.title,
      startAt: localISO,
      durationMin: l.durationMin,
      zoomUrl: l.zoomUrl ?? "",
      notes: l.notes ?? "",
      studentId: l.studentId ?? "",
      groupId: l.groupId ?? "",
    });
    setEditingId(l.id);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.startAt) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      startAt: new Date(form.startAt).toISOString(),
      durationMin: form.durationMin,
      zoomUrl: form.zoomUrl.trim() || null,
      notes: form.notes.trim() || null,
      studentId: form.studentId || null,
      groupId: form.groupId || null,
    };

    const url = editingId ? `/api/schedule/${editingId}` : "/api/schedule";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await fetchLessons();
      closeModal();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!editingId) return;
    setDeleting(true);
    const res = await fetch(`/api/schedule/${editingId}`, { method: "DELETE" });
    if (res.ok) {
      await fetchLessons();
      closeModal();
    }
    setDeleting(false);
  }

  const assigneeLabel = (l: ScheduledLesson) => {
    if (l.student) return l.student.name || l.student.email;
    if (l.group) return `Group: ${l.group.name}`;
    return "All";
  };

  function EventComponent({ event }: { event: CalendarEvent }) {
    const l = event.resource;
    return (
      <div className="flex flex-col h-full overflow-hidden px-0.5">
        <span className="font-semibold text-xs leading-tight truncate">{l.title}</span>
        <span className="text-[10px] opacity-80 truncate">{assigneeLabel(l)}</span>
        {l.zoomUrl && (
          <span className="text-[10px] opacity-70 mt-auto">🔗 Zoom</span>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-ink/40">
        Loading schedule...
      </div>
    );
  }

  return (
    <>
      <style>{`
        .rbc-calendar { font-family: inherit; color: var(--ink); }
        .rbc-header { background: #f8f5f0; border-color: rgba(26,26,46,0.1); padding: 6px 0; font-size: 0.8rem; font-weight: 600; color: var(--ink); }
        .rbc-today { background-color: rgba(233,69,96,0.05) !important; }
        .rbc-event { background-color: var(--accent) !important; border: none !important; border-radius: 6px !important; padding: 2px 6px !important; }
        .rbc-event.rbc-selected { background-color: #c73050 !important; }
        .rbc-slot-selection { background: rgba(233,69,96,0.15) !important; }
        .rbc-time-slot { border-color: rgba(26,26,46,0.05); }
        .rbc-timeslot-group { border-color: rgba(26,26,46,0.1); }
        .rbc-time-content { border-color: rgba(26,26,46,0.1); }
        .rbc-time-header-content { border-color: rgba(26,26,46,0.1); }
        .rbc-time-view { border-color: rgba(26,26,46,0.1); border-radius: 12px; overflow: hidden; }
        .rbc-off-range-bg { background: rgba(26,26,46,0.03); }
        .rbc-toolbar button { color: var(--ink); border-color: rgba(26,26,46,0.2); border-radius: 8px; font-size: 0.875rem; padding: 4px 12px; }
        .rbc-toolbar button:hover { background: rgba(26,26,46,0.06); }
        .rbc-toolbar button.rbc-active { background: var(--accent) !important; color: white !important; border-color: var(--accent) !important; }
        .rbc-toolbar-label { font-weight: 600; font-size: 1rem; }
        .rbc-current-time-indicator { background-color: var(--accent); }
        .rbc-show-more { color: var(--accent); }
      `}</style>

      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-ink">Schedule</h2>
          <button
            onClick={() => openCreateModal()}
            className="btn-primary text-sm px-3 py-1.5"
          >
            + New lesson
          </button>
        </div>

        <div className="card p-1" style={{ height: 600 }}>
          <Calendar
            localizer={localizer}
            events={events}
            view={view}
            onView={setView}
            date={currentDate}
            onNavigate={setCurrentDate}
            selectable
            onSelectSlot={openCreateModal}
            onSelectEvent={openEditModal}
            components={{ event: EventComponent }}
            step={30}
            timeslots={2}
            scrollToTime={new Date(1970, 1, 1, 8, 0, 0)}
          />
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative card w-full max-w-md p-6 shadow-xl bg-white">
            <h3 className="text-base font-semibold text-ink mb-4">
              {editingId ? "Edit lesson" : "New lesson"}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Title *</label>
                <input
                  className="input"
                  placeholder="e.g. Grammar session"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink/60 mb-1">Date & time *</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.startAt}
                    onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink/60 mb-1">Duration (min)</label>
                  <select
                    className="input"
                    value={form.durationMin}
                    onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Zoom link</label>
                <input
                  className="input"
                  placeholder="https://zoom.us/j/..."
                  value={form.zoomUrl}
                  onChange={(e) => setForm({ ...form, zoomUrl: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink/60 mb-1">Student</label>
                  <select
                    className="input"
                    value={form.studentId}
                    onChange={(e) =>
                      setForm({ ...form, studentId: e.target.value, groupId: "" })
                    }
                  >
                    <option value="">— none —</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink/60 mb-1">Group</label>
                  <select
                    className="input"
                    value={form.groupId}
                    onChange={(e) =>
                      setForm({ ...form, groupId: e.target.value, studentId: "" })
                    }
                  >
                    <option value="">— none —</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink/60 mb-1">Notes</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="Optional notes..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-between mt-5">
              {editingId ? (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn text-sm text-red-500 hover:bg-red-50 focus:ring-red-200"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button onClick={closeModal} className="btn-secondary text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title.trim() || !form.startAt}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Save changes" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
