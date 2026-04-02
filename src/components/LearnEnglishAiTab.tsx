"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EXERCISE_TYPES } from "@/data/learnEnglishExerciseTypes";
import { ExerciseTypeGlyph } from "@/components/ExerciseTypeGlyph";
import type { StructuredExerciseFeedback, TaskFeedbackBlock } from "@/lib/exercise-feedback";

const CEFR_RE = /^(A1|A2|B1|B2|C1|C2)$/i;

function normalizeLevel(raw: string | null | undefined): string {
  const t = (raw ?? "").trim().toUpperCase();
  return CEFR_RE.test(t) ? t : "B1";
}

/** CEFR level only when the teacher set a valid band; students cannot override. */
function levelFromTeacher(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim().toUpperCase();
  return CEFR_RE.test(t) ? t : null;
}

type Task = { id: string; question: string };

type ActiveExercise = {
  exerciseTypeId: string;
  level: string;
  title: string;
  introduction: string;
  tasks: Task[];
};

type AudioMeta = { url: string; name: string };

type UkrainianPack = {
  titleUk: string;
  introductionUk: string;
  taskQuestionUk: Record<string, string>;
};

function UkrainianPanel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 rounded-md border-l-4 border-sky-500/50 bg-sky-50/70 pl-3 py-2 pr-2 text-sm text-ink/90">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-900/70">Українська</p>
      <div className="mt-1 whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  );
}

function TextWithBold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\*\*([^*]+)\*\*$/);
        if (m) {
          return (
            <strong key={i} className="font-semibold text-ink">
              {m[1]}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function ExerciseFeedbackPanel({
  structured,
  plain,
  taskOrder,
  studentAnswers,
}: {
  structured: StructuredExerciseFeedback | null;
  plain: string | null;
  taskOrder: { id: string; question?: string }[];
  /** Answers exactly as sent with this feedback request (stable even if the form state changes later). */
  studentAnswers: Record<string, string> | null;
}) {
  if (structured) {
    const ordered: TaskFeedbackBlock[] = [];
    for (const t of taskOrder) {
      const b = structured.tasks.find((x) => x.id === t.id);
      if (b) ordered.push(b);
    }
    const rest = structured.tasks.filter((b) => !taskOrder.some((t) => t.id === b.id));
    const blocks = [...ordered, ...rest];

    return (
      <div className="space-y-4">
        {blocks.map((block) => {
          const ans = studentAnswers?.[block.id];
          const ansTrim = typeof ans === "string" ? ans.trim() : "";
          return (
          <article
            key={block.id}
            className="rounded-xl border border-ink/10 bg-white/95 p-4 shadow-sm ring-1 ring-ink/5"
          >
            <h5 className="text-sm font-semibold text-ink">
              Task <span className="font-mono text-accent">{block.id}</span>
            </h5>
            <dl className="mt-3 space-y-3 text-sm">
              {ansTrim ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Your answer</dt>
                  <dd className="mt-1 rounded-md border border-ink/8 bg-ink/[0.03] px-3 py-2 text-ink/90 whitespace-pre-wrap">
                    {ansTrim}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Feedback</dt>
                <dd className="mt-1 text-ink/85 leading-relaxed">{block.feedback}</dd>
              </div>
              {block.correctedVersion ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">
                    Corrected version
                  </dt>
                  <dd className="mt-1 text-ink/85 leading-relaxed">
                    <TextWithBold text={block.correctedVersion} />
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Tip</dt>
                <dd className="mt-1 text-ink/85 leading-relaxed">{block.tip}</dd>
              </div>
            </dl>
          </article>
          );
        })}
        <div className="rounded-xl border border-accent/25 bg-accent/[0.07] p-4 text-sm text-ink/85">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent/90 mb-2">Overall</p>
          <p className="leading-relaxed whitespace-pre-wrap">{structured.summary}</p>
        </div>
      </div>
    );
  }
  if (plain) {
    return (
      <div className="space-y-4">
        {studentAnswers && taskOrder.length > 0 ? (
          <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50 mb-2">Your answers (as submitted)</p>
            <ol className="list-decimal list-inside space-y-2 text-ink/90">
              {taskOrder.map((t) => {
                const a = (studentAnswers[t.id] ?? "").trim();
                if (!a) return null;
                return (
                  <li key={t.id} className="whitespace-pre-wrap">
                    <span className="font-mono text-accent">{t.id}</span>: {a}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
        <div className="text-sm text-ink/85 whitespace-pre-wrap border border-ink/8 rounded-lg p-4 bg-ink/[0.02] max-h-[min(60vh,480px)] overflow-y-auto">
          {plain}
        </div>
      </div>
    );
  }
  return null;
}

export function LearnEnglishAiTab({ assignedLevel }: { assignedLevel: string | null }) {
  const [focusNote, setFocusNote] = useState("");
  const [active, setActive] = useState<ActiveExercise | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [audioByTask, setAudioByTask] = useState<Record<string, AudioMeta | null>>({});
  const [feedbackStructured, setFeedbackStructured] = useState<StructuredExerciseFeedback | null>(null);
  const [feedbackPlain, setFeedbackPlain] = useState<string | null>(null);
  const [feedbackAudioUkUrl, setFeedbackAudioUkUrl] = useState<string | null>(null);
  /** Answers copied at submit time so the feedback view cannot show stale text after a new round. */
  const [feedbackAnswersSnapshot, setFeedbackAnswersSnapshot] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recordingTaskId, setRecordingTaskId] = useState<string | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [ukTranslation, setUkTranslation] = useState<UkrainianPack | null>(null);
  const [showUkrainian, setShowUkrainian] = useState(false);
  const [translatingUk, setTranslatingUk] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const filePickTaskIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateRequestIdRef = useRef(0);

  const cefrLevel = levelFromTeacher(assignedLevel);
  const isBeginnerLevel = cefrLevel === "A1" || cefrLevel === "A2";

  useEffect(() => {
    if (!isBeginnerLevel) {
      setUkTranslation(null);
      setShowUkrainian(false);
    }
  }, [isBeginnerLevel]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function resetAll() {
    setActive(null);
    setAnswers({});
    setAudioByTask({});
    setFeedbackStructured(null);
    setFeedbackPlain(null);
    setFeedbackAudioUkUrl(null);
    setFeedbackAnswersSnapshot(null);
    setUkTranslation(null);
    setShowUkrainian(false);
    setError("");
    stopRecording();
  }

  /** Ends capture; chunks are finalized in MediaRecorder `onstop` — do not clear chunks or stop the stream here. */
  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      try {
        if (typeof mr.requestData === "function") mr.requestData();
        mr.stop();
      } catch {
        /* ignore */
      }
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setRecordingTaskId(null);
  }

  async function startRecording(taskId: string) {
    setError("");
    if (recordingTaskId) stopRecording();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        const ext = blob.type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `speaking-${taskId}.${ext}`, { type: blob.type || "audio/webm" });
        if (blob.size < 256) {
          setError("Recording was empty or too short. Try again and speak for at least a second before stopping.");
          setRecordingTaskId(null);
          return;
        }
        void uploadAudioForTask(taskId, file);
        setRecordingTaskId(null);
      };
      mr.start(200);
      mediaRecorderRef.current = mr;
      setRecordingTaskId(taskId);
    } catch {
      setError("Microphone access was blocked or unavailable. Try uploading an audio file instead.");
    }
  }

  async function uploadAudioForTask(taskId: string, file: File) {
    setUploadingTaskId(taskId);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
      }
      if (typeof data.url !== "string" || data.type !== "audio") {
        throw new Error("Please use an audio file (mp3, wav, webm, m4a, ogg).");
      }
      setAudioByTask((prev) => ({
        ...prev,
        [taskId]: { url: data.url, name: typeof data.name === "string" ? data.name : file.name },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingTaskId(null);
    }
  }

  function triggerFilePick(taskId: string) {
    filePickTaskIdRef.current = taskId;
    fileInputRef.current?.click();
  }

  async function onAudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const taskId = filePickTaskIdRef.current;
    filePickTaskIdRef.current = null;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!taskId || !file) return;
    await uploadAudioForTask(taskId, file);
  }

  function removeAudio(taskId: string) {
    setAudioByTask((prev) => ({ ...prev, [taskId]: null }));
  }

  async function startExercise(exerciseTypeId: string) {
    const def = EXERCISE_TYPES.find((e) => e.id === exerciseTypeId);
    if (!def) return;
    const cefr = levelFromTeacher(assignedLevel);
    if (!cefr) {
      setError("Your CEFR level isn’t set yet, so AI practice can’t start.");
      return;
    }
    const requestId = ++generateRequestIdRef.current;
    stopRecording();
    setError("");
    setFeedbackStructured(null);
    setFeedbackPlain(null);
    setFeedbackAudioUkUrl(null);
    setFeedbackAnswersSnapshot(null);
    setUkTranslation(null);
    setShowUkrainian(false);
    setAudioByTask({});
    setAnswers({});
    setLoading(true);
    try {
      const res = await fetch("/api/student/learn-english/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          phase: "generate",
          exerciseId: def.id,
          level: cefr,
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
      if (requestId !== generateRequestIdRef.current) {
        return;
      }
      setActive({
        exerciseTypeId: def.id,
        level: typeof data.level === "string" ? normalizeLevel(data.level) : cefr,
        title: data.title,
        introduction: data.introduction,
        tasks,
      });
      setAnswers(Object.fromEntries(tasks.map((t) => [t.id, ""])));
      setAudioByTask(Object.fromEntries(tasks.map((t) => [t.id, null])));
    } catch (e) {
      if (requestId === generateRequestIdRef.current) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    } finally {
      if (requestId === generateRequestIdRef.current) {
        setLoading(false);
      }
    }
  }

  async function loadUkrainianTranslation() {
    if (!active || !isBeginnerLevel) return;
    setTranslatingUk(true);
    setError("");
    try {
      const res = await fetch("/api/student/learn-english/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          phase: "translateUk",
          level: active.level,
          title: active.title,
          introduction: active.introduction,
          tasks: active.tasks,
        }),
      });
      const rawText = await res.text();
      let data: { error?: unknown; ukrainian?: unknown } = {};
      try {
        data = JSON.parse(rawText) as typeof data;
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
      }
      const u = data.ukrainian as UkrainianPack | undefined;
      if (
        !u ||
        typeof u.titleUk !== "string" ||
        typeof u.introductionUk !== "string" ||
        !u.taskQuestionUk ||
        typeof u.taskQuestionUk !== "object"
      ) {
        throw new Error("Invalid translation from server.");
      }
      setUkTranslation({
        titleUk: u.titleUk,
        introductionUk: u.introductionUk,
        taskQuestionUk: u.taskQuestionUk as Record<string, string>,
      });
      setShowUkrainian(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation failed.");
    } finally {
      setTranslatingUk(false);
    }
  }

  async function submitFeedback() {
    if (!active) return;
    const answersForRequest: Record<string, string> = {};
    for (const t of active.tasks) {
      answersForRequest[t.id] = answers[t.id] ?? "";
    }
    setError("");
    setLoading(true);
    try {
      const audioUrls: Record<string, string> = {};
      for (const t of active.tasks) {
        const a = audioByTask[t.id];
        if (a?.url) audioUrls[t.id] = a.url;
      }

      const res = await fetch("/api/student/learn-english/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          phase: "feedback",
          level: active.level,
          exerciseTypeId: active.exerciseTypeId,
          title: active.title,
          introduction: active.introduction,
          tasks: active.tasks,
          answers: answersForRequest,
          audioUrls: Object.keys(audioUrls).length ? audioUrls : undefined,
        }),
      });
      const rawText = await res.text();
      let data: {
        error?: unknown;
        structured?: unknown;
        feedback?: unknown;
        feedbackAudioUkUrl?: unknown;
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

      const audioUk =
        typeof data.feedbackAudioUkUrl === "string" && data.feedbackAudioUkUrl.startsWith("/uploads/homework/")
          ? data.feedbackAudioUkUrl
          : null;

      if (data.structured && typeof data.structured === "object") {
        const s = data.structured as StructuredExerciseFeedback;
        if (typeof s.summary === "string" && Array.isArray(s.tasks) && s.tasks.length > 0) {
          setFeedbackAnswersSnapshot({ ...answersForRequest });
          setFeedbackStructured(s);
          setFeedbackPlain(null);
          setFeedbackAudioUkUrl(audioUk);
        } else {
          setFeedbackAnswersSnapshot({ ...answersForRequest });
          setFeedbackStructured(null);
          setFeedbackPlain(typeof data.feedback === "string" ? data.feedback : rawText);
          setFeedbackAudioUkUrl(null);
        }
      } else if (typeof data.feedback === "string" && data.feedback.trim()) {
        setFeedbackAnswersSnapshot({ ...answersForRequest });
        setFeedbackStructured(null);
        setFeedbackPlain(data.feedback);
        setFeedbackAudioUkUrl(null);
      } else {
        setFeedbackAnswersSnapshot({ ...answersForRequest });
        setFeedbackStructured(null);
        setFeedbackPlain("Could not load formatted feedback. Try “Check my answers” again.");
        setFeedbackAudioUkUrl(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const isSpeakingPrep = active?.exerciseTypeId === "speaking-prep";
  const isReadingAloud = active?.exerciseTypeId === "reading";
  const usesVoiceUi = isSpeakingPrep || isReadingAloud;

  const allAnswered =
    active &&
    active.tasks.length > 0 &&
    active.tasks.every((t) => {
      const text = (answers[t.id] ?? "").trim();
      if (isReadingAloud) {
        return !!audioByTask[t.id]?.url;
      }
      if (isSpeakingPrep) {
        return text.length > 0 || !!audioByTask[t.id]?.url;
      }
      return text.length > 0;
    });

  const hasFeedback = feedbackStructured !== null || (feedbackPlain !== null && feedbackPlain.length > 0);

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.webm,.m4a,.ogg"
        className="hidden"
        onChange={(e) => void onAudioFileChange(e)}
      />

      <div className="rounded-xl border border-ink/10 bg-ink/[0.02] p-4 md:p-5">
        <h3 className="font-serif text-lg font-semibold text-ink">AI practice exercises</h3>
        <p className="mt-2 text-sm text-ink/70 max-w-2xl">
          Short tasks matched to your level. Do them in a few minutes, then get clear feedback.
        </p>
        {cefrLevel ? (
          <p className="mt-3 rounded-lg border border-ink/10 bg-white/60 px-3 py-2 text-sm text-ink/85">
            <span className="font-medium text-ink">CEFR level: </span>
            <span className="font-semibold text-accent">{cefrLevel}</span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-amber-900 bg-amber-50 border border-amber-200/90 rounded-lg px-3 py-2">
            Your CEFR level isn’t on your profile yet, so AI practice can’t start here.
          </p>
        )}
        <div className="mt-4 max-w-2xl flex flex-col gap-2">
          <label htmlFor="learn-focus" className="text-xs font-medium text-ink/65 leading-tight">
            Optional: what do you want to practise?
          </label>
          <input
            id="learn-focus"
            type="text"
            value={focusNote}
            onChange={(e) => setFocusNote(e.target.value.slice(0, 400))}
            disabled={loading || !!active || !cefrLevel}
            placeholder="e.g. past simple, emails, travel vocabulary"
            className="input text-sm w-full min-h-[2.5rem] py-2"
          />
        </div>
      </div>

      {!active && (
        <div>
          <p className="text-sm font-medium text-ink mb-3">Choose an exercise</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {EXERCISE_TYPES.map((ex) =>
              ex.availableSoon ? (
                <li key={ex.id}>
                  <div
                    className="flex gap-3 items-start w-full text-left rounded-xl border border-dashed border-ink/20 bg-ink/[0.03] p-4 text-ink/55 cursor-not-allowed select-none"
                    aria-label={`${ex.title}, available soon`}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink/[0.08] text-ink/40">
                      <ExerciseTypeGlyph exerciseId={ex.id} className="h-7 w-7" />
                    </span>
                    <span className="min-w-0 flex-1 flex flex-col">
                      <span className="font-medium text-ink/70">{ex.title}</span>
                      <span className="mt-1 text-sm text-ink/50">{ex.description}</span>
                      <span className="mt-2 inline-block text-xs font-semibold uppercase tracking-wide text-ink/45">
                        Available soon
                      </span>
                    </span>
                  </div>
                </li>
              ) : (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => void startExercise(ex.id)}
                    disabled={loading || !cefrLevel}
                    className="flex gap-3 items-start w-full text-left rounded-xl border border-ink/12 bg-white/70 hover:bg-white hover:border-accent/30 p-4 transition-colors disabled:opacity-50"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                      <ExerciseTypeGlyph exerciseId={ex.id} className="h-7 w-7" />
                    </span>
                    <span className="min-w-0 flex-1 flex flex-col items-start">
                      <span className="font-medium text-ink">{ex.title}</span>
                      <span className="mt-1 text-sm text-ink/60">{ex.description}</span>
                      <span className="mt-2 inline-block text-xs font-medium text-accent">Start →</span>
                    </span>
                  </button>
                </li>
              )
            )}
          </ul>
        </div>
      )}

      {active && !hasFeedback && (
        <div className="rounded-xl border border-accent/25 bg-accent/[0.05] p-4 md:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Your exercise</p>
              <div className="mt-1 flex items-center gap-2 min-w-0">
                {active.exerciseTypeId === "speaking-prep" || active.exerciseTypeId === "reading" ? (
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent"
                    title={
                      active.exerciseTypeId === "reading"
                        ? "Read the text aloud, then record"
                        : "Speaking — use your voice or type"
                    }
                  >
                    <ExerciseTypeGlyph
                      exerciseId={active.exerciseTypeId}
                      className="h-5 w-5"
                    />
                  </span>
                ) : null}
                <h4 className="font-serif text-lg font-semibold text-ink min-w-0">{active.title}</h4>
              </div>
              {isBeginnerLevel && showUkrainian && ukTranslation ? (
                <UkrainianPanel>{ukTranslation.titleUk}</UkrainianPanel>
              ) : null}
              <p className="mt-2 text-sm text-ink/75 whitespace-pre-wrap">{active.introduction}</p>
              {isBeginnerLevel && showUkrainian && ukTranslation ? (
                <UkrainianPanel>{ukTranslation.introductionUk}</UkrainianPanel>
              ) : null}

              {isBeginnerLevel ? (
                <>
                  {!ukTranslation ? (
                    <p className="mt-3 text-sm text-ink/70 rounded-lg border border-sky-200/80 bg-sky-50/50 px-3 py-2">
                      <span className="font-medium text-ink">Складно читати англійською?</span> Натисніть «Перекласти
                      опис українською» — зʼявиться допомога українською. Відповіді все одно давайте англійською або
                      записом голосу.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void loadUkrainianTranslation()}
                      disabled={loading || translatingUk || !!ukTranslation}
                      className="btn-secondary text-sm"
                    >
                      {translatingUk
                        ? "Перекладаємо…"
                        : ukTranslation
                          ? "Переклад готовий"
                          : "Перекласти опис українською"}
                    </button>
                    {ukTranslation ? (
                      <label className="flex items-center gap-2 text-sm text-ink/80 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="rounded border-ink/30"
                          checked={showUkrainian}
                          onChange={(e) => setShowUkrainian(e.target.checked)}
                          disabled={loading}
                        />
                        Показати переклад
                      </label>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
            <button type="button" onClick={resetAll} disabled={loading} className="btn-secondary text-sm shrink-0">
              Cancel
            </button>
          </div>
          <ol className="space-y-5 list-decimal list-inside marker:font-semibold marker:text-accent">
            {active.tasks.map((t, index) => (
              <li key={t.id} className="pl-0">
                <div className="inline-block w-[calc(100%-1.5rem)] align-top">
                  <p className="text-sm text-ink font-medium mb-2">
                    <span className="text-ink/50 font-normal mr-1">{index + 1}.</span>
                    {t.question}
                  </p>
                  {isBeginnerLevel && showUkrainian && ukTranslation?.taskQuestionUk[t.id] ? (
                    <UkrainianPanel>{ukTranslation.taskQuestionUk[t.id]}</UkrainianPanel>
                  ) : null}
                  <textarea
                    value={answers[t.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [t.id]: e.target.value,
                      }))
                    }
                    rows={usesVoiceUi ? 2 : 3}
                    disabled={loading}
                    placeholder={
                      isReadingAloud
                        ? "Optional note — your reading must be submitted as a recording below."
                        : isSpeakingPrep
                          ? "Optional if you send audio…"
                          : "Your answer…"
                    }
                    className="input w-full text-sm resize-y min-h-[72px]"
                  />

                  {usesVoiceUi && (
                    <div className="mt-2 rounded-lg border border-ink/10 bg-white/60 p-3 space-y-2">
                      <p className="text-xs text-ink/60">
                        {isReadingAloud ? (
                          <>
                            <span className="font-medium text-ink/75">Your reading (required):</span> read the whole
                            story above aloud, then record here or upload audio. Feedback uses your recording (and
                            optional note).
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-ink/75">Voice answer:</span> record here or upload an
                            audio file. You can use voice only, text only, or both.
                          </>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {recordingTaskId === t.id ? (
                          <button
                            type="button"
                            onClick={stopRecording}
                            disabled={loading}
                            className="rounded-md bg-red-600/90 text-white text-sm px-3 py-1.5 hover:bg-red-700"
                          >
                            Stop recording
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void startRecording(t.id)}
                            disabled={loading || uploadingTaskId === t.id || !!recordingTaskId}
                            className="rounded-md bg-ink/10 text-sm px-3 py-1.5 hover:bg-ink/15 disabled:opacity-50"
                          >
                            {uploadingTaskId === t.id ? "Uploading…" : "Record"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => triggerFilePick(t.id)}
                          disabled={loading || uploadingTaskId === t.id || !!recordingTaskId}
                          className="rounded-md bg-ink/10 text-sm px-3 py-1.5 hover:bg-ink/15 disabled:opacity-50"
                        >
                          Upload audio
                        </button>
                        {audioByTask[t.id]?.url ? (
                          <button
                            type="button"
                            onClick={() => removeAudio(t.id)}
                            disabled={loading}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Remove audio
                          </button>
                        ) : null}
                      </div>
                      {audioByTask[t.id]?.url ? (
                        <div className="pt-1">
                          <p className="text-xs text-ink/50 mb-1 truncate">{audioByTask[t.id]?.name}</p>
                          <audio src={audioByTask[t.id]!.url} controls className="w-full max-w-md h-9" />
                        </div>
                      ) : null}
                    </div>
                  )}
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
              {loading ? "Checking…" : isReadingAloud ? "Get feedback" : "Check my answers"}
            </button>
            {!allAnswered && (
              <span className="text-xs text-ink/50 self-center">
                {isReadingAloud
                  ? "Record yourself reading the whole story aloud."
                  : isSpeakingPrep
                    ? "For each task, add text and/or audio before checking."
                    : "Answer every task to get feedback."}
              </span>
            )}
          </div>
        </div>
      )}

      {active && hasFeedback && (
        <div className="rounded-xl border border-ink/10 bg-white/80 p-4 md:p-5 space-y-4">
          <h4 className="font-serif text-lg font-semibold text-ink">Feedback</h4>
          {feedbackAudioUkUrl ? (
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/60 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/75">
                Голосовий відгук репетитора українською
              </p>
              <p className="text-xs text-ink/65">
                Те саме, що нижче англійською, коротко озвучено для зручності. Текст українською згенеровано автоматично.
              </p>
              <audio src={feedbackAudioUkUrl} controls className="w-full max-w-lg h-10" preload="metadata" />
            </div>
          ) : null}
          <ExerciseFeedbackPanel
            structured={feedbackStructured}
            plain={feedbackPlain}
            taskOrder={active.tasks}
            studentAnswers={feedbackAnswersSnapshot}
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => void startExercise(active.exerciseTypeId)}
              disabled={loading}
              className="btn-primary"
            >
              New round (same type)
            </button>
            <button type="button" onClick={resetAll} disabled={loading} className="btn-secondary">
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
