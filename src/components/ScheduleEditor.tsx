"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer, SlotInfo, View } from "react-big-calendar";
import withDragAndDrop, { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});

// Wrap Calendar with drag-and-drop support. Cast to loose type to avoid
// type conflicts between custom CalendarEvent and the DnD wrapper generics.
// eslint-disable-next-line
const DnDCalendar = withDragAndDrop(Calendar as Parameters<typeof withDragAndDrop>[0]) as unknown as React.ComponentType<Record<string, unknown>>;

// ── Calendar event colours ────────────────────────────────────────────────
const COLOR_PALETTE = [
  "#e94560", // rose / app accent
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
  "#a855f7", // purple
  "#14b8a6", // teal
  "#84cc16", // lime
];

const COLOR_PALETTE_LABELS = [
  "Rose", "Blue", "Emerald", "Amber",
  "Violet", "Pink", "Cyan", "Orange",
  "Indigo", "Purple", "Teal", "Lime",
];

const LS_COLOR_KEY = "english-schedule-colors";

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function defaultColorForKey(key: string): string {
  return COLOR_PALETTE[hashStr(key) % COLOR_PALETTE.length];
}

type Student = { id: string; email: string; name: string | null };
type Group = { id: string; name: string; students?: Student[] };

type GroupPayment = {
  studentId: string;
  name: string | null;
  email: string;
  isPaid: boolean;
  paymentId: string | null;
};

type ScheduledLesson = {
  id: string;
  title: string;
  startAt: string;
  durationMin: number;
  zoomUrl: string | null;
  notes: string | null;
  studentId: string | null;
  groupId: string | null;
  isPaid: boolean;
  student: Student | null;
  group: Group | null;
  groupPayments?: GroupPayment[];
};

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ScheduledLesson;
};

const DURATION_OPTIONS = [
  { value: 55, label: "55 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" },
];

type RepeatType = "none" | "week" | "2weeks" | "custom";

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: "none", label: "No repeat" },
  { value: "week", label: "Every week" },
  { value: "2weeks", label: "Every 2 weeks" },
  { value: "custom", label: "Custom (days)" },
];

const emptyForm = {
  title: "",
  startAt: "",
  durationMin: 60,
  zoomUrl: "",
  notes: "",
  studentId: "",
  groupId: "",
  repeatType: "none" as RepeatType,
  customDays: 1,
  repeatCount: 4,
};

type FormState = typeof emptyForm;

interface ScheduleEditorProps {
  students: Student[];
  groups: Group[];
  canManagePayments: boolean;
}

export function ScheduleEditor({ students, groups, canManagePayments }: ScheduleEditorProps) {
  const [lessons, setLessons] = useState<ScheduledLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>("week");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingPaid, setTogglingPaid] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPaidAmount, setMarkPaidAmount] = useState("");
  const [markPaidDate, setMarkPaidDate] = useState("");
  const [markPaidStudentId, setMarkPaidStudentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [filterStudentId, setFilterStudentId] = useState("");

  // ── Drag-drop confirmation state ──────────────────────────────────────────
  type DragConfirm = {
    lesson: ScheduledLesson;
    newStart: Date;
    newEnd: Date;
  };
  const [dragConfirm, setDragConfirm] = useState<DragConfirm | null>(null);
  const [dragSaving, setDragSaving] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  function handleEventDrop({ event, start, end }: EventInteractionArgs<CalendarEvent>) {
    const lesson = (event as CalendarEvent).resource;
    if (!lesson) return;
    setDragConfirm({ lesson, newStart: start as Date, newEnd: end as Date });
    setDragError(null);
  }

  async function confirmDragMove(mode: "once" | "all") {
    if (!dragConfirm) return;
    setDragSaving(true);
    setDragError(null);
    const { lesson, newStart } = dragConfirm;

    try {
      if (mode === "once") {
        // Just PATCH this single lesson
        const res = await fetch(`/api/schedule/${lesson.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startAt: newStart.toISOString() }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setDragError(d.error ?? "Failed to save");
          setDragSaving(false);
          return;
        }
      } else {
        // Reschedule only future lessons on the SAME WEEKDAY as the dragged lesson.
        // A student/group can have multiple series (e.g. Tue + Thu); each weekday
        // is treated as its own independent recurring series (always 7-day interval).
        const oldDate = new Date(lesson.startAt);
        const originalWeekday = oldDate.getDay(); // 0=Sun … 6=Sat

        const nowIso = new Date().toISOString();

        // Count future unpaid lessons on the SAME weekday only
        const futureSameDay = lessons.filter((l) => {
          if (lesson.studentId && l.studentId !== lesson.studentId) return false;
          if (lesson.groupId && l.groupId !== lesson.groupId) return false;
          if (l.startAt < nowIso || l.isPaid) return false;
          return new Date(l.startAt).getDay() === originalWeekday;
        });
        const repeatCount = Math.max(1, futureSameDay.length);

        const res = await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reschedule",
            studentId: lesson.studentId ?? null,
            groupId: lesson.groupId ?? null,
            deleteFrom: nowIso,
            // Pass the original weekday so the API deletes only that weekday's lessons
            weekday: originalWeekday,
            startAt: newStart.toISOString(),
            title: lesson.title,
            durationMin: lesson.durationMin,
            zoomUrl: lesson.zoomUrl ?? null,
            notes: lesson.notes ?? null,
            repeatDays: 7, // strictly weekly per-series
            repeatCount,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setDragError(d.error ?? "Failed to reschedule");
          setDragSaving(false);
          return;
        }
      }

      await fetchLessons();
      setDragConfirm(null);
    } catch {
      setDragError("Network error — please try again");
    }
    setDragSaving(false);
  }

  // ── Reschedule state ───────────────────────────────────────────────────────
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rsForm, setRsForm] = useState({
    studentId: "",
    groupId: "",
    deleteFrom: new Date().toISOString().slice(0, 10),
    startAt: "",
    title: "",
    durationMin: 60,
    zoomUrl: "",
    notes: "",
    repeatType: "week" as RepeatType,
    customDays: 7,
    repeatCount: 10,
  });
  const [rsSaving, setRsSaving] = useState(false);
  const [rsError, setRsError] = useState<string | null>(null);
  const [rsResult, setRsResult] = useState<{ deleted: number; created: number } | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_COLOR_KEY) ?? "{}");
      if (stored && typeof stored === "object") setColorMap(stored as Record<string, string>);
    } catch {}
  }, []);

  function getEventColor(key: string | null): string {
    if (!key) return "#94a3b8";
    return colorMap[key] ?? defaultColorForKey(key);
  }

  function setEntityColor(key: string, color: string) {
    setColorMap((prev) => {
      const next = { ...prev, [key]: color };
      try { localStorage.setItem(LS_COLOR_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const l = event.resource;
    const key = l.studentId ? `student:${l.studentId}` : l.groupId ? `group:${l.groupId}` : null;
    const color = getEventColor(key);
    return { style: { backgroundColor: color, borderColor: color } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorMap]);

  const fetchLessons = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule?view=teacher");
      if (res.ok) {
        const data = await res.json();
        setLessons(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail on fetch
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const filteredLessons = useMemo(() => {
    if (!filterStudentId) return lessons;
    return lessons.filter((l) => {
      if (l.studentId === filterStudentId) return true;
      if (l.groupPayments?.some((gp) => gp.studentId === filterStudentId)) return true;
      if (l.groupId) {
        const group = groups.find((g) => g.id === l.groupId);
        if (group?.students?.some((s) => s.id === filterStudentId)) return true;
      }
      return false;
    });
  }, [lessons, filterStudentId, groups]);

  const events: CalendarEvent[] = filteredLessons.map((l) => {
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
    setError(null);
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
      repeatType: "none",
      customDays: 1,
      repeatCount: 4,
    });
    setEditingId(l.id);
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setMarkPaidOpen(false);
    setMarkPaidAmount("");
    setMarkPaidDate("");
    setMarkPaidStudentId(null);
  }

  function repeatDays(): number {
    if (form.repeatType === "week") return 7;
    if (form.repeatType === "2weeks") return 14;
    if (form.repeatType === "custom") return Math.max(1, form.customDays);
    return 0;
  }

  function rsRepeatDays(): number {
    if (rsForm.repeatType === "week") return 7;
    if (rsForm.repeatType === "2weeks") return 14;
    if (rsForm.repeatType === "custom") return Math.max(1, rsForm.customDays);
    return 7;
  }

  function openReschedule() {
    // Pre-fill title from the most recent lesson for the first student if available
    const lastLesson = lessons
      .filter((l) => l.studentId)
      .sort((a, b) => b.startAt.localeCompare(a.startAt))[0];
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
    const defaultStart = `${nextMonday.getFullYear()}-${pad(nextMonday.getMonth() + 1)}-${pad(nextMonday.getDate())}T10:00`;
    setRsForm((f) => ({
      ...f,
      title: lastLesson?.title ?? "Lesson",
      startAt: defaultStart,
      deleteFrom: today.toISOString().slice(0, 10),
      studentId: "",
      groupId: "",
    }));
    setRsError(null);
    setRsResult(null);
    setRescheduleOpen(true);
  }

  async function handleReschedule() {
    if (!rsForm.startAt || !rsForm.title.trim()) {
      setRsError("Title and start date/time are required");
      return;
    }
    if (!rsForm.studentId && !rsForm.groupId) {
      setRsError("Select a student or group");
      return;
    }
    setRsSaving(true);
    setRsError(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          studentId: rsForm.studentId || null,
          groupId: rsForm.groupId || null,
          deleteFrom: new Date(rsForm.deleteFrom).toISOString(),
          startAt: new Date(rsForm.startAt).toISOString(),
          title: rsForm.title.trim(),
          durationMin: rsForm.durationMin,
          zoomUrl: rsForm.zoomUrl.trim() || null,
          notes: rsForm.notes.trim() || null,
          repeatDays: rsRepeatDays(),
          repeatCount: rsForm.repeatCount,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRsResult({ deleted: data.deleted ?? 0, created: data.created ?? 0 });
        await fetchLessons();
      } else {
        setRsError(data.error ?? "Something went wrong");
      }
    } catch {
      setRsError("Network error — please try again");
    }
    setRsSaving(false);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.startAt) return;
    setSaving(true);
    setError(null);

    const isRepeating = form.repeatType !== "none";
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      startAt: new Date(form.startAt).toISOString(),
      durationMin: form.durationMin,
      zoomUrl: form.zoomUrl.trim() || null,
      notes: form.notes.trim() || null,
      studentId: form.studentId || null,
      groupId: form.groupId || null,
    };

    if (isRepeating && !editingId) {
      payload.repeatDays = repeatDays();
      payload.repeatCount = form.repeatCount;
    }

    const url = editingId ? `/api/schedule/${editingId}` : "/api/schedule";
    const method = editingId ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchLessons();
        closeModal();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Something went wrong");
      }
    } catch {
      setError("Network error — please try again");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!editingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/schedule/${editingId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchLessons();
        closeModal();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Delete failed");
      }
    } catch {
      setError("Network error");
    }
    setDeleting(false);
  }

  function openMarkPaidForm() {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setMarkPaidDate(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
    setMarkPaidAmount("");
    setMarkPaidOpen(true);
  }

  async function handleTogglePaid(
    lessonId: string,
    currentlyPaid: boolean,
    opts?: { amount?: number; date?: string; studentId?: string }
  ) {
    setTogglingPaid(true);
    try {
      await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: currentlyPaid ? "markUnpaid" : "markPaid",
          lessonId,
          studentId: opts?.studentId ?? null,
          amount: opts?.amount ?? null,
          paidAt: opts?.date ?? null,
        }),
      });
      await fetchLessons();
      setMarkPaidOpen(false);
      setMarkPaidStudentId(null);
    } finally {
      setTogglingPaid(false);
    }
  }

  const assigneeLabel = (l: ScheduledLesson) => {
    if (l.student) return l.student.name || l.student.email;
    if (l.group) return `Group: ${l.group.name}`;
    return "All";
  };

  function EventComponent({ event }: { event: CalendarEvent }) {
    const l = event.resource;

    const paidEmoji = (() => {
      if (!canManagePayments) return null;
      if (l.studentId) {
        return l.isPaid ? "✅" : "🔴";
      }
      if (l.groupId && l.groupPayments && l.groupPayments.length > 0) {
        const paidCount = l.groupPayments.filter((g) => g.isPaid).length;
        const total = l.groupPayments.length;
        return paidCount === total ? "✅" : paidCount === 0 ? "🔴" : "🟡";
      }
      return null;
    })();

    return (
      <div className="w-full h-full overflow-hidden" style={{ minWidth: 0, position: "relative" }}>
        {paidEmoji && (
          <span
            style={{ position: "absolute", top: 0, right: 0, fontSize: 10, lineHeight: 1 }}
            title={
              l.studentId
                ? l.isPaid ? "Paid" : "Unpaid"
                : (() => {
                    const pc = (l.groupPayments ?? []).filter((g) => g.isPaid).length;
                    return `${pc}/${(l.groupPayments ?? []).length} paid`;
                  })()
            }
          >
            {paidEmoji}
          </span>
        )}
        {l.zoomUrl && (
          <span style={{ position: "absolute", bottom: 0, right: 0, fontSize: 10, lineHeight: 1 }}>
            🔗
          </span>
        )}
        <p
          className="font-semibold leading-tight overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ fontSize: 11, paddingRight: paidEmoji ? 14 : 0 }}
        >
          {l.title}
        </p>
        <p
          className="opacity-85 overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ fontSize: 10 }}
        >
          {assigneeLabel(l)}
        </p>
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
        .rbc-event { border: none !important; border-radius: 6px !important; padding: 4px 8px !important; min-width: 0; overflow: hidden; }
        .rbc-event .rbc-event-content { width: 100%; min-width: 0; overflow: hidden; display: flex; flex-direction: column; height: 100%; }
        .rbc-event.rbc-selected { filter: brightness(0.85); }
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
        .rbc-event-label { display: none; }
      `}</style>

      <div className="p-4">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold text-ink">Schedule</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterStudentId}
              onChange={(e) => setFilterStudentId(e.target.value)}
              className="input text-sm py-1.5 min-w-[160px]"
              title="Filter calendar by student"
            >
              <option value="">All students</option>
              {[...students]
                .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.email}
                  </option>
                ))}
            </select>
            {filterStudentId && (
              <span className="text-xs text-ink/40">
                {filteredLessons.length} lesson{filteredLessons.length === 1 ? "" : "s"}
              </span>
            )}
            <button
              onClick={openReschedule}
              className="btn-secondary text-sm px-3 py-1.5"
            >
              🔄 Reschedule
            </button>
            <button
              onClick={() => openCreateModal()}
              className="btn-primary text-sm px-3 py-1.5"
            >
              + New lesson
            </button>
          </div>
        </div>

        <div className="card p-1" style={{ height: 600 }}>
          <DnDCalendar
            localizer={localizer}
            events={events}
            view={view}
            onView={setView}
            date={currentDate}
            onNavigate={setCurrentDate}
            selectable
            onSelectSlot={openCreateModal}
            onSelectEvent={(e: unknown) => openEditModal(e as CalendarEvent)}
            components={{ event: EventComponent }}
            eventPropGetter={eventPropGetter}
            step={30}
            timeslots={2}
            scrollToTime={new Date(1970, 1, 1, 8, 0, 0)}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventDrop}
            resizable
            draggableAccessor={() => true}
          />
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative card w-full max-w-md p-6 shadow-xl bg-white overflow-y-auto max-h-[90vh]">
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
                  <label className="block text-xs font-medium text-ink/60 mb-1">Duration</label>
                  <select
                    className="input"
                    value={form.durationMin}
                    onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
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

              {/* Event colour — shown when student or group is selected */}
              {(form.studentId || form.groupId) && (() => {
                const key = form.studentId ? `student:${form.studentId}` : `group:${form.groupId}`;
                const currentColor = getEventColor(key);
                return (
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1.5">Event colour</label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PALETTE.map((c, i) => (
                        <button
                          key={c}
                          type="button"
                          title={COLOR_PALETTE_LABELS[i]}
                          onClick={() => setEntityColor(key, c)}
                          className="w-6 h-6 rounded-full transition-all hover:scale-110 focus:outline-none"
                          style={{
                            backgroundColor: c,
                            boxShadow: currentColor === c
                              ? `0 0 0 2px #fff, 0 0 0 4px ${c}`
                              : undefined,
                            transform: currentColor === c ? "scale(1.15)" : undefined,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Repeat section — only for new lessons */}
              {!editingId && (
                <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3 space-y-2.5">
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1">Repeat every</label>
                    <select
                      className="input"
                      value={form.repeatType}
                      onChange={(e) =>
                        setForm({ ...form, repeatType: e.target.value as RepeatType })
                      }
                    >
                      {REPEAT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {form.repeatType === "custom" && (
                    <div>
                      <label className="block text-xs font-medium text-ink/60 mb-1">
                        Every how many days?
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        className="input"
                        value={form.customDays}
                        onChange={(e) =>
                          setForm({ ...form, customDays: Math.max(1, Number(e.target.value)) })
                        }
                      />
                    </div>
                  )}

                  {form.repeatType !== "none" && (
                    <div>
                      <label className="block text-xs font-medium text-ink/60 mb-1">
                        Number of occurrences
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={52}
                        className="input"
                        value={form.repeatCount}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            repeatCount: Math.min(52, Math.max(2, Number(e.target.value))),
                          })
                        }
                      />
                      <p className="mt-1 text-[11px] text-ink/40">
                        Will create {form.repeatCount} lessons (
                        {form.repeatType === "week"
                          ? `every week for ${form.repeatCount} weeks`
                          : form.repeatType === "2weeks"
                          ? `every 2 weeks for ${form.repeatCount * 2} weeks`
                          : `every ${form.customDays} day${form.customDays > 1 ? "s" : ""}`}
                        )
                      </p>
                    </div>
                  )}
                </div>
              )}

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

            {canManagePayments && editingId && (() => {
              const lesson = lessons.find((l) => l.id === editingId);
              if (!lesson?.studentId && !lesson?.groupId) return null;

              // ── Individual lesson payment section ──────────────────────────
              if (lesson.studentId) {
                return (
                  <div className="mt-4 space-y-2">
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      lesson.isPaid
                        ? "bg-green-50 border border-green-200"
                        : "bg-amber-50 border border-amber-200"
                    }`}>
                      <span className={lesson.isPaid ? "text-green-700 font-medium" : "text-amber-700 font-medium"}>
                        {lesson.isPaid ? "✓ Paid" : "⏳ Awaiting payment"}
                      </span>
                      {lesson.isPaid ? (
                        <button
                          type="button"
                          disabled={togglingPaid}
                          onClick={() => handleTogglePaid(lesson.id, true)}
                          className="text-xs px-2.5 py-1 rounded-md font-medium transition-colors disabled:opacity-50 bg-white border border-green-300 text-green-700 hover:bg-green-50"
                        >
                          {togglingPaid ? "…" : "Mark unpaid"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMarkPaidOpen((o) => { if (!o) openMarkPaidForm(); return !o; })}
                          className="text-xs px-2.5 py-1 rounded-md font-medium transition-colors bg-white border border-amber-300 text-amber-700 hover:bg-amber-50"
                        >
                          Mark as paid
                        </button>
                      )}
                    </div>

                    {!lesson.isPaid && markPaidOpen && (
                      <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3 space-y-2.5">
                        <p className="text-xs font-medium text-ink/60">Record payment details</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-ink/50 mb-1">Amount (UAH)</label>
                            <input
                              type="number"
                              min="0"
                              step="50"
                              placeholder="e.g. 500"
                              value={markPaidAmount}
                              onChange={(e) => setMarkPaidAmount(e.target.value)}
                              className="input text-sm py-1.5"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ink/50 mb-1">Date paid</label>
                            <input
                              type="date"
                              value={markPaidDate}
                              onChange={(e) => setMarkPaidDate(e.target.value)}
                              className="input text-sm py-1.5"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setMarkPaidOpen(false)}
                            className="btn-secondary text-xs py-1 px-2"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={togglingPaid}
                            onClick={() => handleTogglePaid(lesson.id, false, {
                              amount: markPaidAmount ? Number(markPaidAmount) : undefined,
                              date: markPaidDate || undefined,
                            })}
                            className="btn-primary text-xs py-1 px-2 disabled:opacity-50"
                          >
                            {togglingPaid ? "Saving…" : "Confirm paid"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // ── Group lesson payment section (per student) ─────────────────
              const gps = lesson.groupPayments ?? [];
              if (gps.length === 0) return null;
              const paidTotal = gps.filter((g) => g.isPaid).length;
              return (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide">Payment per student</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      paidTotal === gps.length ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {paidTotal}/{gps.length} paid
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {gps.map((gp) => (
                      <li key={gp.studentId} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                        gp.isPaid ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"
                      }`}>
                        <span className={`font-medium truncate max-w-[140px] ${gp.isPaid ? "text-green-700" : "text-amber-700"}`}>
                          {gp.isPaid ? "✓ " : "⏳ "}{gp.name || gp.email}
                        </span>
                        {gp.isPaid ? (
                          <button
                            type="button"
                            disabled={togglingPaid}
                            onClick={() => handleTogglePaid(lesson.id, true, { studentId: gp.studentId })}
                            className="text-xs px-2 py-0.5 rounded font-medium bg-white border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50"
                          >
                            {togglingPaid && markPaidStudentId === gp.studentId ? "…" : "Unpaid"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setMarkPaidStudentId(gp.studentId);
                              setMarkPaidOpen(true);
                              openMarkPaidForm();
                            }}
                            className="text-xs px-2 py-0.5 rounded font-medium bg-white border border-amber-300 text-amber-700 hover:bg-amber-50"
                          >
                            Mark paid
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>

                  {markPaidOpen && markPaidStudentId && (() => {
                    const targetStudent = gps.find((g) => g.studentId === markPaidStudentId);
                    if (!targetStudent || targetStudent.isPaid) return null;
                    return (
                      <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3 space-y-2.5">
                        <p className="text-xs font-medium text-ink/60">
                          Record payment for {targetStudent.name || targetStudent.email}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-ink/50 mb-1">Amount (UAH)</label>
                            <input
                              type="number"
                              min="0"
                              step="50"
                              placeholder="e.g. 500"
                              value={markPaidAmount}
                              onChange={(e) => setMarkPaidAmount(e.target.value)}
                              className="input text-sm py-1.5"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ink/50 mb-1">Date paid</label>
                            <input
                              type="date"
                              value={markPaidDate}
                              onChange={(e) => setMarkPaidDate(e.target.value)}
                              className="input text-sm py-1.5"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => { setMarkPaidOpen(false); setMarkPaidStudentId(null); }}
                            className="btn-secondary text-xs py-1 px-2"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={togglingPaid}
                            onClick={() => handleTogglePaid(lesson.id, false, {
                              studentId: markPaidStudentId,
                              amount: markPaidAmount ? Number(markPaidAmount) : undefined,
                              date: markPaidDate || undefined,
                            })}
                            className="btn-primary text-xs py-1 px-2 disabled:opacity-50"
                          >
                            {togglingPaid ? "Saving…" : "Confirm paid"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {error && (
              <p className="mt-3 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

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
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Save changes"
                    : form.repeatType !== "none"
                    ? `Create ${form.repeatCount} lessons`
                    : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Drag-drop Confirmation Modal ─────────────────────────────────── */}
      {dragConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
          <div className="relative card w-full max-w-sm p-6 shadow-xl bg-white space-y-4">
            <h3 className="text-base font-semibold text-ink">Зберегти новий розклад?</h3>
            <div className="rounded-lg bg-ink/5 border border-ink/10 px-4 py-3 text-sm space-y-1">
              <p className="text-ink/60">
                <span className="font-medium text-ink">{dragConfirm.lesson.title}</span>
                {(dragConfirm.lesson.student?.name || dragConfirm.lesson.student?.email) && (
                  <span className="ml-1 text-ink/40">· {dragConfirm.lesson.student.name || dragConfirm.lesson.student.email}</span>
                )}
              </p>
              <p className="text-ink/50 text-xs">
                {new Date(dragConfirm.lesson.startAt).toLocaleString("uk-UA", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                {" → "}
                <span className="font-medium text-ink">
                  {dragConfirm.newStart.toLocaleString("uk-UA", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>
            </div>

            {dragError && <p className="text-sm text-red-600">{dragError}</p>}

            <div className="space-y-2">
              <button
                onClick={() => confirmDragMove("all")}
                disabled={dragSaving}
                className="btn-primary w-full text-sm disabled:opacity-50"
              >
                {dragSaving ? "Збереження…" : "Так — оновити всі майбутні заняття"}
              </button>
              <button
                onClick={() => confirmDragMove("once")}
                disabled={dragSaving}
                className="btn-secondary w-full text-sm disabled:opacity-50"
              >
                Тільки це заняття
              </button>
              <button
                onClick={() => setDragConfirm(null)}
                disabled={dragSaving}
                className="w-full text-sm text-ink/40 hover:text-ink/70 underline"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reschedule Modal ─────────────────────────────────────────────── */}
      {rescheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => { if (!rsSaving) setRescheduleOpen(false); }}
          />
          <div className="relative card w-full max-w-md p-6 shadow-xl bg-white overflow-y-auto max-h-[90vh] space-y-4">
            <h3 className="text-base font-semibold text-ink">🔄 Reschedule</h3>
            <p className="text-xs text-ink/50">
              Deletes all future <strong>unpaid</strong> lessons from the chosen date, then creates a new series.
            </p>

            {rsResult ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm space-y-1">
                <p className="font-semibold text-green-700">Done!</p>
                <p className="text-green-600">Deleted: <strong>{rsResult.deleted}</strong> unpaid lesson{rsResult.deleted !== 1 ? "s" : ""}</p>
                <p className="text-green-600">Created: <strong>{rsResult.created}</strong> new lesson{rsResult.created !== 1 ? "s" : ""}</p>
                <button
                  className="mt-2 btn-primary text-sm"
                  onClick={() => setRescheduleOpen(false)}
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Student or Group */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1">Student</label>
                    <select
                      className="input text-sm"
                      value={rsForm.studentId}
                      onChange={(e) => setRsForm({ ...rsForm, studentId: e.target.value, groupId: "" })}
                    >
                      <option value="">— none —</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>{s.name || s.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1">Group</label>
                    <select
                      className="input text-sm"
                      value={rsForm.groupId}
                      onChange={(e) => setRsForm({ ...rsForm, groupId: e.target.value, studentId: "" })}
                    >
                      <option value="">— none —</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Delete from */}
                <div>
                  <label className="block text-xs font-medium text-ink/60 mb-1">Delete unpaid lessons from</label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={rsForm.deleteFrom}
                    onChange={(e) => setRsForm({ ...rsForm, deleteFrom: e.target.value })}
                  />
                  <p className="text-xs text-ink/40 mt-0.5">Paid lessons are never touched.</p>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-ink/60 mb-1">Lesson title *</label>
                  <input
                    className="input text-sm"
                    placeholder="e.g. English lesson"
                    value={rsForm.title}
                    onChange={(e) => setRsForm({ ...rsForm, title: e.target.value })}
                  />
                </div>

                {/* New start date/time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1">First new lesson *</label>
                    <input
                      type="datetime-local"
                      className="input text-sm"
                      value={rsForm.startAt}
                      onChange={(e) => setRsForm({ ...rsForm, startAt: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1">Duration</label>
                    <select
                      className="input text-sm"
                      value={rsForm.durationMin}
                      onChange={(e) => setRsForm({ ...rsForm, durationMin: Number(e.target.value) })}
                    >
                      {DURATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Repeat */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1">Repeat</label>
                    <select
                      className="input text-sm"
                      value={rsForm.repeatType}
                      onChange={(e) => setRsForm({ ...rsForm, repeatType: e.target.value as RepeatType })}
                    >
                      {REPEAT_OPTIONS.filter((o) => o.value !== "none").map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1">Number of lessons</label>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      className="input text-sm"
                      value={rsForm.repeatCount}
                      onChange={(e) => setRsForm({ ...rsForm, repeatCount: Math.min(52, Math.max(1, Number(e.target.value))) })}
                    />
                  </div>
                </div>
                {rsForm.repeatType === "custom" && (
                  <div>
                    <label className="block text-xs font-medium text-ink/60 mb-1">Interval (days)</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      className="input text-sm"
                      value={rsForm.customDays}
                      onChange={(e) => setRsForm({ ...rsForm, customDays: Math.max(1, Number(e.target.value)) })}
                    />
                  </div>
                )}

                {/* Optional zoom / notes */}
                <div>
                  <label className="block text-xs font-medium text-ink/60 mb-1">Zoom link (optional)</label>
                  <input
                    className="input text-sm"
                    placeholder="https://zoom.us/j/..."
                    value={rsForm.zoomUrl}
                    onChange={(e) => setRsForm({ ...rsForm, zoomUrl: e.target.value })}
                  />
                </div>

                {/* Preview */}
                {rsForm.startAt && rsForm.repeatCount > 0 && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 space-y-0.5">
                    <p>Will create <strong>{rsForm.repeatCount}</strong> lesson{rsForm.repeatCount !== 1 ? "s" : ""} every <strong>{rsRepeatDays()} day{rsRepeatDays() !== 1 ? "s" : ""}</strong></p>
                    <p>From <strong>{new Date(rsForm.startAt).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></p>
                    <p className="text-orange-600">All unpaid lessons from <strong>{new Date(rsForm.deleteFrom + "T00:00").toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" })}</strong> will be removed for the selected student/group.</p>
                  </div>
                )}

                {rsError && <p className="text-sm text-red-600">{rsError}</p>}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setRescheduleOpen(false)}
                    className="btn-secondary text-sm"
                    disabled={rsSaving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReschedule}
                    disabled={rsSaving || !rsForm.startAt || !rsForm.title.trim() || (!rsForm.studentId && !rsForm.groupId)}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {rsSaving ? "Working…" : `Delete old & create ${rsForm.repeatCount} lessons`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
