"use client";

import { useEffect, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, isSameDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { "en-US": enUS },
});

type ScheduledLesson = {
  id: string;
  title: string;
  startAt: string;
  durationMin: number;
  zoomUrl: string | null;
  notes: string | null;
  isPaid: boolean;
  group: { id: string; name: string } | null;
};

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ScheduledLesson;
};

type DetailLesson = ScheduledLesson | null;

export function ScheduleViewer() {
  const [lessons, setLessons] = useState<ScheduledLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>("week");
  const [detail, setDetail] = useState<DetailLesson>(null);

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

  function DayHeader({ date }: { date: Date }) {
    const today = isSameDay(date, new Date());
    return (
      <div className="flex flex-col items-center py-2.5 gap-0.5">
        <span
          className="text-2xl font-bold leading-none"
          style={{ color: today ? "var(--accent)" : "var(--ink)" }}
        >
          {format(date, "d")}
        </span>
        <span
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: today ? "rgba(233,69,96,0.7)" : "rgba(26,26,46,0.45)" }}
        >
          {format(date, "EEE")}
        </span>
      </div>
    );
  }

  function EventComponent({ event }: { event: CalendarEvent }) {
    const l = event.resource;
    return (
      <div className="flex flex-col h-full overflow-hidden px-0.5">
        <span className="font-semibold text-xs leading-tight truncate">{l.title}</span>
        <div className="flex items-center gap-1 mt-auto">
          {l.zoomUrl && (
            <span className="text-[10px] opacity-80">🔗</span>
          )}
          {l.isPaid ? (
            <span className="text-[10px] opacity-90">✓ paid</span>
          ) : (
            <span className="text-[10px] opacity-70">unpaid</span>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-ink/40">
        Loading schedule...
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-ink/40 gap-2">
        <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm">No lessons scheduled yet</span>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .rbc-calendar { font-family: inherit; color: var(--ink); }
        .rbc-header { background: #f8f5f0; border-color: rgba(26,26,46,0.1); padding: 0; }
        .rbc-header + .rbc-header { border-left: 1px solid rgba(26,26,46,0.1); }
        .rbc-today { background-color: rgba(233,69,96,0.05) !important; }
        .rbc-event { background-color: var(--accent) !important; border: none !important; border-radius: 6px !important; padding: 2px 6px !important; cursor: pointer; }
        .rbc-event.rbc-selected { background-color: #c73050 !important; }
        .rbc-time-slot { border-color: rgba(26,26,46,0.05); }
        .rbc-timeslot-group { border-color: rgba(26,26,46,0.1); }
        .rbc-time-content { border-color: rgba(26,26,46,0.1); }
        .rbc-time-header-content { border-color: rgba(26,26,46,0.1); }
        .rbc-time-view { border-color: rgba(26,26,46,0.1); border-radius: 12px; overflow: hidden; }
        .rbc-off-range-bg { background: rgba(26,26,46,0.03); }
        .rbc-toolbar { padding: 8px 12px; }
        .rbc-toolbar button { color: var(--ink); border-color: rgba(26,26,46,0.2); border-radius: 8px; font-size: 0.875rem; padding: 5px 14px; }
        .rbc-toolbar button:hover { background: rgba(26,26,46,0.06); }
        .rbc-toolbar button.rbc-active { background: var(--accent) !important; color: white !important; border-color: var(--accent) !important; }
        .rbc-toolbar-label { font-weight: 700; font-size: 1.05rem; letter-spacing: -0.01em; }
        .rbc-current-time-indicator { background-color: var(--accent); height: 2px; }
        .rbc-show-more { color: var(--accent); }
        .rbc-time-gutter .rbc-timeslot-group { border-color: rgba(26,26,46,0.08); }
        .rbc-time-gutter .rbc-label { font-size: 0.72rem; color: rgba(26,26,46,0.4); padding-right: 8px; }
        .rbc-allday-cell { display: none; }
        .rbc-time-header-content > .rbc-row.rbc-row-resource { display: none; }
      `}</style>

      <div className="card overflow-hidden p-0" style={{ height: "calc(100vh - 230px)", minHeight: 520 }}>
        <Calendar
          localizer={localizer}
          events={events}
          view={view}
          onView={setView}
          date={currentDate}
          onNavigate={setCurrentDate}
          onSelectEvent={(event) => setDetail(event.resource)}
          components={{ event: EventComponent, header: DayHeader }}
          step={30}
          timeslots={2}
          min={new Date(1970, 1, 1, 7, 0, 0)}
          max={new Date(1970, 1, 1, 22, 0, 0)}
          scrollToTime={new Date(1970, 1, 1, 8, 0, 0)}
        />
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setDetail(null)}
          />
          <div className="relative card w-full max-w-sm p-6 shadow-xl bg-white">
            <h3 className="text-base font-semibold text-ink mb-3">{detail.title}</h3>

            <div className="space-y-2 text-sm text-ink/70">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>
                  {new Date(detail.startAt).toLocaleDateString("en-US", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {new Date(detail.startAt).toLocaleTimeString("en-US", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                  {" · "}{detail.durationMin} min
                </span>
              </div>
              {detail.group && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{detail.group.name}</span>
                </div>
              )}
              {detail.notes && (
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{detail.notes}</span>
                </div>
              )}
            </div>

            {/* Payment status badge */}
            <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              detail.isPaid
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}>
              <span>{detail.isPaid ? "✓ Paid" : "⏳ Awaiting payment"}</span>
            </div>

            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => setDetail(null)}
                className="btn-secondary text-sm"
              >
                Close
              </button>
              {detail.zoomUrl ? (
                <a
                  href={detail.zoomUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-sm flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Join Zoom
                </a>
              ) : detail.isPaid ? (
                <span className="text-xs text-ink/40 italic">No Zoom link added yet</span>
              ) : (
                <span className="text-xs text-amber-600 italic">Pay to unlock Zoom link</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
