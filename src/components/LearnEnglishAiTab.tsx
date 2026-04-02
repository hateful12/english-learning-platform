"use client";

import { useState } from "react";
import { EXERCISE_TYPES } from "@/data/learnEnglishExerciseTypes";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const CEFR_RE = /^(A1|A2|B1|B2|C1|C2)$/i;

function normalizeLevel(raw: string | null | undefined): string {
  const t = (raw ?? "").trim().toUpperCase();
  return CEFR_RE.test(t) ? t : "B1";
}

type Task = { id: string; question: string };

type ActiveExercise = {
  exerciseTypeId: string;
  level: string;
  title: string;
  introduction: string;
  tasks: Task[];
};

export function LearnEnglishAiTab({ assignedLevel }: { assignedLevel: string | null }) {
  /** When set, overrides teacher / default level for generated exercises. */
  const [manualLevel, setManualLevel] = useState<string | null>(null);
  const [focusNote, setFocusNote] = useState("");
  const [active, setActive] = useState<ActiveExercise | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const teacherLevel = normalizeLevel(assignedLevel);
  const levelInUse = manualLevel ?? teacherLevel;

  const teacherLabel =
    assignedLevel && CEFR_RE.test(assignedLevel.trim()) ? assignedLevel.trim().toUpperCase() : null;

  function resetAll() {
    setActive(null);
    setAnswers({});
    setFeedback(null);
    setError("");
  }

  async function startExercise(exerciseTypeId: string) {
    const def = EXERCISE_TYPES.find((e) => e.id === exerciseTypeId);
    if (!def) return;
    setError("");
    setFeedback(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/learn-english/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          phase: "generate",
          exerciseId: def.id,
          level: levelInUse,
          exerciseFocus: def.focus,
          focusNote: focusNote.trim() || undefined,
        }),
      });
      const rawText = await res.text();
      let data: {
        error?: unknown;
        title?: unknown;
        introduction?: unknown;
        tasks?: unknown;
        level?: unknown;
      } = {};
      try {
        data = JSON.parse(rawText) as typeof data;
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : `Request failed (${res.status})`
        );
      }
      if (
        typeof data.title !== "string" ||
        typeof data.introduction !== "string" ||
        !Array.isArray(data.tasks)
      ) {
        throw new Error("Invalid exercise from server.");
      }
      const tasks: Task[] = [];
      for (const item of data.tasks) {
        if (!item || typeof item !== "object") continue;
        const id = (item as { id?: unknown }).id;
        const question = (item as { question?: unknown }).question;
        if (typeof id === "string" && typeof question === "string" && id.trim() && question.trim()) {
          tasks.push({ id: id.trim(), question: question.trim() });
        }
      }
      if (tasks.length === 0) {
        throw new Error("No tasks in this exercise. Try again.");
      }
      setActive({
        exerciseTypeId: def.id,
        level: typeof data.level === "string" ? normalizeLevel(data.level) : levelInUse,
        title: data.title,
        introduction: data.introduction,
        tasks,
      });
      setAnswers(Object.fromEntries(tasks.map((t) => [t.id, ""])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback() {
    if (!active) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/student/learn-english/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          phase: "feedback",
          level: active.level,
          title: active.title,
          introduction: active.introduction,
          tasks: active.tasks,
          answers,
        }),
      });
      const rawText = await res.text();
      let data: { error?: unknown; feedback?: unknown } = {};
      try {
        data = JSON.parse(rawText) as typeof data;
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : `Request failed (${res.status})`
        );
      }
      if (typeof data.feedback !== "string") {
        throw new Error("No feedback returned.");
      }
      setFeedback(data.feedback);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const allAnswered =
    active &&
    active.tasks.length > 0 &&
    active.tasks.every((t) => (answers[t.id] ?? "").trim().length > 0);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-ink/10 bg-ink/[0.02] p-4 md:p-5">
        <h3 className="font-serif text-lg font-semibold text-ink">AI practice exercises</h3>
        <p className="mt-2 text-sm text-ink/70 max-w-2xl">
          Short tasks matched to your level. Do them in a few minutes, then get feedback. Your teacher can set your
          level; you can adjust it here if you like.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
          <div>
            <label htmlFor="learn-level" className="block text-xs font-medium text-ink/60 mb-1">
              Level for exercises
            </label>
            <select
              id="learn-level"
              value={levelInUse}
              onChange={(e) => setManualLevel(e.target.value)}
              disabled={loading}
              className="input text-sm py-2 min-w-[140px]"
            >
              {LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                  {teacherLabel === lv ? " (teacher)" : ""}
                </option>
              ))}
            </select>
            {teacherLabel && (
              <button
                type="button"
                onClick={() => setManualLevel(null)}
                disabled={loading || manualLevel === null}
                className="mt-1.5 text-xs text-accent hover:underline disabled:opacity-40 disabled:no-underline"
              >
                Use teacher level ({teacherLabel})
              </button>
            )}
          </div>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="learn-focus" className="block text-xs font-medium text-ink/60 mb-1">
              Optional: what do you want to practise?
            </label>
            <input
              id="learn-focus"
              type="text"
              value={focusNote}
              onChange={(e) => setFocusNote(e.target.value.slice(0, 400))}
              disabled={loading || !!active}
              placeholder="e.g. past simple, emails, travel vocabulary"
              className="input text-sm w-full"
            />
          </div>
        </div>
      </div>

      {!active && (
        <div>
          <p className="text-sm font-medium text-ink mb-3">Choose an exercise</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {EXERCISE_TYPES.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => void startExercise(ex.id)}
                  disabled={loading}
                  className="w-full text-left rounded-xl border border-ink/12 bg-white/70 hover:bg-white hover:border-accent/30 p-4 transition-colors disabled:opacity-50"
                >
                  <span className="font-medium text-ink">{ex.title}</span>
                  <span className="mt-1 block text-sm text-ink/60">{ex.description}</span>
                  <span className="mt-2 inline-block text-xs font-medium text-accent">Start →</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {active && !feedback && (
        <div className="rounded-xl border border-accent/25 bg-accent/[0.05] p-4 md:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Your exercise</p>
              <h4 className="mt-1 font-serif text-lg font-semibold text-ink">{active.title}</h4>
              <p className="mt-2 text-sm text-ink/75 whitespace-pre-wrap">{active.introduction}</p>
            </div>
            <button
              type="button"
              onClick={resetAll}
              disabled={loading}
              className="btn-secondary text-sm shrink-0"
            >
              Cancel
            </button>
          </div>
          <ol className="space-y-4 list-decimal list-inside marker:font-semibold marker:text-accent">
            {active.tasks.map((t, index) => (
              <li key={t.id} className="pl-0">
                <div className="inline-block w-[calc(100%-1.5rem)] align-top">
                  <p className="text-sm text-ink font-medium mb-2">
                    <span className="text-ink/50 font-normal mr-1">{index + 1}.</span>
                    {t.question}
                  </p>
                  <textarea
                    value={answers[t.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [t.id]: e.target.value,
                      }))
                    }
                    rows={3}
                    disabled={loading}
                    placeholder="Your answer…"
                    className="input w-full text-sm resize-y min-h-[72px]"
                  />
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => void submitFeedback()}
              disabled={loading || !allAnswered}
              className="btn-primary"
            >
              {loading ? "Checking…" : "Check my answers"}
            </button>
            {!allAnswered && (
              <span className="text-xs text-ink/50 self-center">Answer every task to get feedback.</span>
            )}
          </div>
        </div>
      )}

      {active && feedback && (
        <div className="rounded-xl border border-ink/10 bg-white/80 p-4 md:p-5 space-y-4">
          <h4 className="font-serif text-lg font-semibold text-ink">Feedback</h4>
          <div className="text-sm text-ink/85 whitespace-pre-wrap border border-ink/8 rounded-lg p-4 bg-ink/[0.02] max-h-[min(60vh,480px)] overflow-y-auto">
            {feedback}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void startExercise(active.exerciseTypeId)}
              disabled={loading}
              className="btn-primary"
            >
              New round (same type)
            </button>
            <button
              type="button"
              onClick={resetAll}
              disabled={loading}
              className="btn-secondary"
            >
              Pick another exercise
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}
