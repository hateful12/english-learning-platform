"use client";

import { useEffect, useRef, useState } from "react";

/** Record from the microphone and deliver a Blob (e.g. upload as homework or feedback audio). */
export function VoiceRecorder({
  onRecorded,
  disabled,
  className,
}: {
  onRecorded: (blob: Blob, filename: string) => void;
  disabled?: boolean;
  className?: string;
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

  const label = recording ? `Stop recording (${seconds}s)` : "Record voice message";
  const base =
    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50";
  const state = recording
    ? "bg-red-100 text-red-700 hover:bg-red-200"
    : "bg-ink/5 text-ink/80 hover:bg-ink/10";
  const merged = recording
    ? [base, state].join(" ")
    : [base, state, className].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      disabled={disabled}
      className={merged}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${recording ? "animate-pulse bg-red-500" : "bg-ink/40"}`} />
      {label}
    </button>
  );
}
