"use client";

import { useState, useRef, useEffect } from "react";
import { Group } from "./GroupEditor";

type Student = { id: string; email: string; name: string | null };
export type HomeworkAttachment = { url: string; name: string; type: "image" | "audio" | "archive" };
type ResponseItem = {
  id: string;
  response: string;
  studentResponseAttachments?: string;
  submittedAt: string;
  teacherFeedback?: string | null;
  teacherFeedbackAttachments?: string;
  feedbackAt?: string | null;
  student?: { id: string; email: string; name: string | null };
};
type Item = {
  id: string;
  emoji?: string;
  title: string;
  description: string;
  status?: string;
  studentId?: string | null;
  groupId?: string | null;
  group?: { id: string; name: string } | null;
  attachments?: string;
  updatedAt?: string;
  responses?: ResponseItem[];
  closedForStudents?: string[];
};

function parseAttachmentList(raw: string | undefined): HomeworkAttachment[] {
  try {
    const arr = JSON.parse(typeof raw === "string" ? raw : "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// ---------- Voice Recorder ----------
function VoiceRecorder({
  onRecorded,
}: {
  onRecorded: (blob: Blob, filename: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTimer() {
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const ext = mimeType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onRecorded(blob, `voice-message.${ext}`);
        stopTimer();
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      startTimer();
    } catch {
      alert("Microphone access denied or not available.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  useEffect(() => () => stopTimer(), []);

  const label = recording
    ? `Stop recording (${seconds}s)`
    : "Record voice message";

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        recording
          ? "bg-red-100 text-red-700 hover:bg-red-200"
          : "bg-ink/5 text-ink/80 hover:bg-ink/10"
      }`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${recording ? "animate-pulse bg-red-500" : "bg-ink/40"}`} />
      {label}
    </button>
  );
}

// ---------- Feedback Form ----------
function FeedbackForm({
  responseId,
  initialFeedback,
  initialAttachments,
  onSaved,
}: {
  responseId: string;
  initialFeedback: string | null | undefined;
  initialAttachments: HomeworkAttachment[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [attachments, setAttachments] = useState<HomeworkAttachment[]>(initialAttachments);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFeedback(initialFeedback ?? "");
    setAttachments(initialAttachments);
  }, [initialFeedback, initialAttachments]);

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }
    return res.json() as Promise<{ url: string; name: string; type: "image" | "audio" | "archive" }>;
  }

  async function handleFileChange(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const data = await uploadFile(file).catch((e) => { alert(e.message); return null; });
        if (data) setAttachments((prev) => [...prev, { url: data.url, name: data.name, type: data.type }]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleVoiceRecorded(blob: Blob, filename: string) {
    setUploading(true);
    try {
      const file = new File([blob], filename, { type: blob.type });
      const data = await uploadFile(file).catch((e) => { alert(e.message); return null; });
      if (data) setAttachments((prev) => [...prev, { url: data.url, name: data.name, type: data.type }]);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/homework/response/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherFeedback: feedback.trim(),
          teacherFeedbackAttachments: attachments,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to save feedback");
        return;
      }
      onSaved();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const hasFeedback = !!initialFeedback || initialAttachments.length > 0;

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-accent hover:underline"
        >
          {hasFeedback ? "Edit feedback" : "+ Add feedback"}
        </button>
      ) : (
        <div className="mt-1 rounded-md border border-accent/20 bg-accent/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-accent/80 uppercase tracking-wide">Teacher feedback</p>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Write feedback for the student…"
            className="input min-h-[70px] resize-y w-full text-sm"
            rows={2}
            disabled={saving}
          />

          <div className="flex flex-wrap gap-2 items-center">
            <VoiceRecorder onRecorded={handleVoiceRecorded} />
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-sm text-ink/80 hover:bg-ink/10 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload audio file"}
            </button>
          </div>

          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <li key={a.url} className="flex items-center gap-1 rounded bg-white border border-ink/10 px-2 py-1 text-xs">
                  <span className="text-ink/70 truncate max-w-[140px]">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                    className="text-red-500 hover:text-red-700 ml-0.5"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || uploading}
              className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save feedback"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setFeedback(initialFeedback ?? ""); setAttachments(initialAttachments); }}
              className="btn-secondary text-sm py-1 px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Assignment selector value format ----------
// "" = all students, "s:<id>" = individual student, "g:<id>" = group
function encodeAssignment(studentId: string | null | undefined, groupId: string | null | undefined): string {
  if (groupId) return `g:${groupId}`;
  if (studentId) return `s:${studentId}`;
  return "";
}

function decodeAssignment(value: string): { studentId: string | null; groupId: string | null } {
  if (value.startsWith("g:")) return { studentId: null, groupId: value.slice(2) };
  if (value.startsWith("s:")) return { studentId: value.slice(2), groupId: null };
  return { studentId: null, groupId: null };
}

// ---------- Main Component ----------
export function HomeworkEditor({
  items,
  students = [],
  groups = [],
  onAdd,
  onDelete,
  onUpdate,
}: {
  items: Item[];
  students?: Student[];
  groups?: Group[];
  onAdd: () => void;
  onDelete: () => void;
  onUpdate: () => void;
}) {
  const [closingId, setClosingId] = useState<string | null>(null);

  async function handleStudentClose(homeworkId: string, studentId: string, close: boolean) {
    setClosingId(`${homeworkId}:${studentId}`);
    try {
      const res = await fetch(`/api/homework/${homeworkId}/student-close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, close }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update close status");
        return;
      }
      onUpdate();
    } finally {
      setClosingId(null);
    }
  }

  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [description, setDescription] = useState("");
  const [assignment, setAssignment] = useState<string>("");
  const [attachments, setAttachments] = useState<HomeworkAttachment[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [editingEmoji, setEditingEmoji] = useState("");
  const [editingAttachments, setEditingAttachments] = useState<HomeworkAttachment[]>([]);
  const [editingAssignment, setEditingAssignment] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveGroup, setArchiveGroup] = useState<string>("");
  const [archiveMonth, setArchiveMonth] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Students who are NOT in any group — shown in the individual student section
  const groupedStudentIds = new Set(groups.flatMap((g) => g.students.map((s) => s.id)));
  const ungroupedStudents = students.filter((s) => !groupedStudentIds.has(s.id));

  function parseAttachments(item: Item): HomeworkAttachment[] {
    return parseAttachmentList(item.attachments);
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
    const { studentId, groupId } = decodeAssignment(assignment);
    await fetch("/api/homework", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emoji: emoji.trim(),
        title: title.trim(),
        description: description.trim(),
        studentId,
        groupId,
        attachments,
      }),
    });
    setTitle("");
    setEmoji("");
    setDescription("");
    setAssignment("");
    setAttachments([]);
    onAdd();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this homework?")) return;
    await fetch(`/api/homework/${id}`, { method: "DELETE" });
    onDelete();
  }

  async function handleToggleStatus(item: Item) {
    const newStatus = item.status === "closed" ? "active" : "closed";
    await fetch(`/api/homework/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    onUpdate();
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { studentId, groupId } = decodeAssignment(editingAssignment);
    await fetch(`/api/homework/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emoji: editingEmoji.trim(),
        title: editing.title,
        description: editing.description,
        studentId,
        groupId,
        attachments: editingAttachments,
      }),
    });
    setEditing(null);
    setEditingEmoji("");
    setEditingAttachments([]);
    setEditingAssignment("");
    onUpdate();
  }

  function assignmentLabel(item: Item) {
    if (item.groupId) {
      const g = groups.find((x) => x.id === item.groupId);
      return g ? `Group: ${g.name}` : (item.group ? `Group: ${item.group.name}` : "Group");
    }
    if (!item.studentId) return "All students";
    const s = students.find((x) => x.id === item.studentId);
    return s ? s.name || s.email : item.studentId;
  }

  function AssignmentSelect({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input w-auto max-w-[220px]"
      >
        <option value="">All students</option>
        {groups.length > 0 && (
          <optgroup label="Groups">
            {groups.map((g) => (
              <option key={g.id} value={`g:${g.id}`}>
                {g.name}
              </option>
            ))}
          </optgroup>
        )}
        {ungroupedStudents.length > 0 && (
          <optgroup label="Individual students">
            {ungroupedStudents.map((s) => (
              <option key={s.id} value={`s:${s.id}`}>
                {s.name || s.email}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="😊"
              className="input w-12 text-center"
              maxLength={4}
              title="Emoji (optional)"
            />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Homework title"
              className="input flex-1 min-w-[180px]"
            />
            <AssignmentSelect value={assignment} onChange={setAssignment} />
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
        {items.filter((item) => item.status !== "closed").map((item) => (
          <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-ink/10 bg-white p-3">
            {editing?.id === item.id ? (
              <form onSubmit={handleUpdate} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={editingEmoji}
                    onChange={(e) => setEditingEmoji(e.target.value)}
                    placeholder="😊"
                    className="input w-12 text-center"
                    maxLength={4}
                    title="Emoji"
                  />
                  <input
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    className="input flex-1"
                  />
                </div>
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
                <AssignmentSelect value={editingAssignment} onChange={setEditingAssignment} />
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary">Save</button>
                  <button type="button" onClick={() => { setEditing(null); setEditingEmoji(""); setEditingAttachments([]); setEditingAssignment(""); }} className="btn-secondary">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.emoji && <span>{item.emoji}</span>}
                      <h3 className="font-medium text-ink">{item.title}</h3>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        item.groupId
                          ? "bg-accent/10 text-accent font-medium"
                          : "text-ink/50"
                      }`}>
                        {assignmentLabel(item)}
                      </span>
                    </div>
                    {item.description && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{item.description}</p>
                    )}
                    {parseAttachments(item).length > 0 && (
                      <p className="mt-1 text-xs text-ink/50">
                        Attachments: {parseAttachments(item).map((a) => a.name).join(", ")}
                      </p>
                    )}

                    {(() => {
                      const groupMembers = item.groupId
                        ? (groups.find((g) => g.id === item.groupId)?.students ?? [])
                        : [];

                      if (groupMembers.length > 0) {
                        // Group homework: show ALL members with per-student close buttons
                        return (
                          <div className="mt-3 rounded border border-ink/10 bg-ink/5 p-3 space-y-3">
                            <p className="text-xs font-semibold text-ink/60 uppercase tracking-wide">Group members</p>
                            {groupMembers.map((member) => {
                              const response = item.responses?.find((r) => r.student?.id === member.id);
                              const isClosed = (item.closedForStudents ?? []).includes(member.id);
                              const loadingKey = `${item.id}:${member.id}`;
                              const feedbackAttachments = parseAttachmentList(response?.teacherFeedbackAttachments);
                              return (
                                <div
                                  key={member.id}
                                  className={`rounded-md border p-2.5 space-y-1 transition-opacity ${
                                    isClosed ? "border-green-200 bg-green-50/50 opacity-60" : "border-ink/10 bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <p className="text-sm font-medium text-ink truncate">
                                        {member.name || member.email}
                                      </p>
                                      {isClosed && (
                                        <span className="text-xs text-green-700 font-medium shrink-0">✓ Done</span>
                                      )}
                                      {response && !isClosed && (
                                        <span className="text-xs text-ink/40 shrink-0">
                                          {new Date(response.submittedAt).toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      disabled={closingId === loadingKey}
                                      onClick={() => handleStudentClose(item.id, member.id, !isClosed)}
                                      className={`shrink-0 text-xs rounded px-2 py-0.5 transition-colors disabled:opacity-50 ${
                                        isClosed
                                          ? "text-ink/50 hover:text-ink/80 bg-ink/5 hover:bg-ink/10"
                                          : "text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100"
                                      }`}
                                    >
                                      {closingId === loadingKey ? "…" : isClosed ? "Reopen" : "Close"}
                                    </button>
                                  </div>

                                  {response ? (
                                    <>
                                      <p className="whitespace-pre-wrap text-sm text-ink/80">{response.response || "—"}</p>
                                      {parseAttachmentList(response.studentResponseAttachments).map((a) => (
                                        <div key={a.url} className="mt-1 rounded border border-ink/10 bg-ink/5 p-2">
                                          {a.type === "image" && (
                                            <a href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                                              <img src={a.url} alt={a.name} className="max-h-32 rounded object-contain" />
                                              <span className="mt-1 block text-xs text-ink/60">{a.name}</span>
                                            </a>
                                          )}
                                          {a.type === "audio" && (
                                            <div>
                                              <p className="text-xs text-ink/60 mb-0.5">{a.name}</p>
                                              <audio src={a.url} controls className="h-8 w-full max-w-sm" />
                                            </div>
                                          )}
                                          {(a.type === "archive" || !["image", "audio"].includes(a.type)) && (
                                            <a href={a.url} download={a.name} className="text-accent hover:underline flex items-center gap-1 text-xs">
                                              📎 {a.name}
                                            </a>
                                          )}
                                        </div>
                                      ))}
                                      {(response.teacherFeedback || feedbackAttachments.length > 0) && (
                                        <div className="mt-1 rounded border border-accent/15 bg-accent/5 px-2 py-1.5 space-y-1">
                                          <p className="text-xs font-medium text-accent/70">Your feedback</p>
                                          {response.teacherFeedback && (
                                            <p className="text-xs text-ink/70 whitespace-pre-wrap">{response.teacherFeedback}</p>
                                          )}
                                          {feedbackAttachments.map((a) => (
                                            <div key={a.url} className="mt-1">
                                              {a.type === "audio" && (
                                                <div>
                                                  <p className="text-xs text-ink/50 mb-0.5">{a.name}</p>
                                                  <audio src={a.url} controls className="h-8 w-full max-w-sm" />
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      <FeedbackForm
                                        responseId={response.id}
                                        initialFeedback={response.teacherFeedback}
                                        initialAttachments={feedbackAttachments}
                                        onSaved={onUpdate}
                                      />
                                    </>
                                  ) : (
                                    <p className="text-xs text-ink/40 italic">No response yet</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      if (item.responses && item.responses.length > 0) {
                        // Non-group homework: original responses display
                        return (
                          <div className="mt-3 rounded border border-ink/10 bg-ink/5 p-3 space-y-3">
                            <p className="text-xs font-semibold text-ink/60 uppercase tracking-wide">Student responses</p>
                            {item.responses.map((r) => {
                              const feedbackAttachments = parseAttachmentList(r.teacherFeedbackAttachments);
                              return (
                                <div key={r.id} className="space-y-1">
                                  {r.student && (
                                    <p className="text-sm text-ink/60 font-medium">
                                      {r.student.name || r.student.email}
                                      <span className="text-xs text-ink/40 ml-1">
                                        {new Date(r.submittedAt).toLocaleString()}
                                      </span>
                                    </p>
                                  )}
                                  <p className="whitespace-pre-wrap text-sm text-ink/80">{r.response || "—"}</p>
                                  {parseAttachmentList(r.studentResponseAttachments).map((a) => (
                                    <div key={a.url} className="mt-1 rounded border border-ink/10 bg-ink/5 p-2">
                                      {a.type === "image" && (
                                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                                          <img src={a.url} alt={a.name} className="max-h-32 rounded object-contain" />
                                          <span className="mt-1 block text-xs text-ink/60">{a.name}</span>
                                        </a>
                                      )}
                                      {a.type === "audio" && (
                                        <div>
                                          <p className="text-xs text-ink/60 mb-0.5">{a.name}</p>
                                          <audio src={a.url} controls className="h-8 w-full max-w-sm" />
                                        </div>
                                      )}
                                      {(a.type === "archive" || !["image", "audio"].includes(a.type)) && (
                                        <a href={a.url} download={a.name} className="text-accent hover:underline flex items-center gap-1 text-xs">
                                          📎 {a.name}
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                  {(r.teacherFeedback || feedbackAttachments.length > 0) && (
                                    <div className="mt-1 rounded border border-accent/15 bg-accent/5 px-2 py-1.5 space-y-1">
                                      <p className="text-xs font-medium text-accent/70">Your feedback</p>
                                      {r.teacherFeedback && (
                                        <p className="text-xs text-ink/70 whitespace-pre-wrap">{r.teacherFeedback}</p>
                                      )}
                                      {feedbackAttachments.map((a) => (
                                        <div key={a.url} className="mt-1">
                                          {a.type === "audio" && (
                                            <div>
                                              <p className="text-xs text-ink/50 mb-0.5">{a.name}</p>
                                              <audio src={a.url} controls className="h-8 w-full max-w-sm" />
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <FeedbackForm
                                    responseId={r.id}
                                    initialFeedback={r.teacherFeedback}
                                    initialAttachments={feedbackAttachments}
                                    onSaved={onUpdate}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(item)}
                      title="Mark as done"
                      className="flex items-center gap-1 rounded px-2 py-1 text-sm text-ink/40 hover:text-green-600 hover:bg-green-50 transition-colors"
                    >
                      ☐
                      <span className="hidden sm:inline">Done</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(item);
                        setEditingEmoji(item.emoji ?? "");
                        setEditingAttachments(parseAttachments(item));
                        setEditingAssignment(encodeAssignment(item.studentId, item.groupId));
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

      {(() => {
        const closed = items.filter((i) => i.status === "closed");
        if (closed.length === 0) return null;

        const months = Array.from(
          new Set(closed.map((i) => (i.updatedAt ? i.updatedAt.slice(0, 7) : "")))
        ).filter(Boolean).sort((a, b) => b.localeCompare(a));

        const filtered = closed.filter((item) => {
          const groupOk =
            archiveGroup === "" ||
            (archiveGroup === "__all__" ? !item.studentId && !item.groupId : item.studentId === archiveGroup || item.groupId === archiveGroup);
          const monthOk =
            archiveMonth === "" || (item.updatedAt ?? "").slice(0, 7) === archiveMonth;
          return groupOk && monthOk;
        });

        function monthLabel(ym: string) {
          const [y, m] = ym.split("-");
          return new Date(Number(y), Number(m) - 1).toLocaleString("default", { month: "long", year: "numeric" });
        }

        return (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setArchiveOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-medium text-ink/50 hover:text-ink/70 transition-colors"
            >
              <span className={`inline-block transition-transform ${archiveOpen ? "rotate-90" : ""}`}>▶</span>
              Archive ({closed.length})
            </button>

            {archiveOpen && (
              <div className="mt-3 rounded-lg border border-ink/5 bg-ink/[0.02] p-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={archiveGroup}
                    onChange={(e) => setArchiveGroup(e.target.value)}
                    className="input text-sm py-1 w-auto"
                  >
                    <option value="">All assignments</option>
                    <option value="__all__">All students (unassigned)</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} (group)</option>
                    ))}
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.name || s.email}</option>
                    ))}
                  </select>
                  <select
                    value={archiveMonth}
                    onChange={(e) => setArchiveMonth(e.target.value)}
                    className="input text-sm py-1 w-auto"
                  >
                    <option value="">All dates</option>
                    {months.map((m) => (
                      <option key={m} value={m}>{monthLabel(m)}</option>
                    ))}
                  </select>
                  {(archiveGroup !== "" || archiveMonth !== "") && (
                    <button
                      type="button"
                      onClick={() => { setArchiveGroup(""); setArchiveMonth(""); }}
                      className="text-xs text-ink/40 hover:text-ink/70 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {filtered.length === 0 ? (
                  <p className="text-sm text-ink/40">No archived homework matches the filters.</p>
                ) : (
                  <ul className="space-y-3">
                    {filtered.map((item) => (
                      <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-ink/5 bg-white/60 p-3 opacity-70">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.emoji && <span>{item.emoji}</span>}
                              <h3 className="font-medium text-ink/60 line-through">{item.title}</h3>
                              <span className="text-xs text-ink/40">({assignmentLabel(item)})</span>
                              {item.updatedAt && (
                                <span className="text-xs text-ink/30">
                                  {new Date(item.updatedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="mt-1 whitespace-pre-wrap text-sm text-ink/50">{item.description}</p>
                            )}
                            {item.responses && item.responses.length > 0 && (
                              <div className="mt-2 rounded border border-ink/10 bg-ink/5 p-2 space-y-1">
                                <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">Student responses</p>
                                {item.responses.map((r) => (
                                  <div key={r.id} className="text-sm">
                                    {r.student && (
                                      <p className="text-ink/40 font-medium">
                                        {r.student.name || r.student.email}
                                        <span className="text-xs text-ink/30 ml-1">{new Date(r.submittedAt).toLocaleString()}</span>
                                      </p>
                                    )}
                                    <p className="whitespace-pre-wrap text-ink/50 mt-0.5">{r.response || "—"}</p>
                                    {parseAttachmentList(r.studentResponseAttachments).length > 0 && (
                                      <p className="text-xs text-ink/40 mt-1">
                                        📎 {parseAttachmentList(r.studentResponseAttachments).map((a) => a.name).join(", ")}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(item)}
                              title="Reopen"
                              className="flex items-center gap-1 rounded px-2 py-1 text-sm text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                            >
                              ☑ <span className="hidden sm:inline">Reopen</span>
                            </button>
                            <button type="button" onClick={() => handleDelete(item.id)} className="text-sm text-red-400 hover:text-red-600 hover:underline">Delete</button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
