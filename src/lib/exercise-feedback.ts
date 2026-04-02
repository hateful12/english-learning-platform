export type TaskFeedbackBlock = {
  id: string;
  feedback: string;
  tip: string;
  correctedVersion: string | null;
};

export type StructuredExerciseFeedback = {
  summary: string;
  tasks: TaskFeedbackBlock[];
};

export function stripJsonFence(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseStructuredFeedback(content: string): StructuredExerciseFeedback | null {
  const raw = stripJsonFence(content);
  try {
    const o = JSON.parse(raw) as {
      summary?: unknown;
      tasks?: unknown;
    };
    if (typeof o.summary !== "string" || !Array.isArray(o.tasks)) return null;
    const tasks: TaskFeedbackBlock[] = [];
    for (const item of o.tasks) {
      if (!item || typeof item !== "object") continue;
      const id = (item as { id?: unknown }).id;
      const feedback = (item as { feedback?: unknown }).feedback;
      const tip = (item as { tip?: unknown }).tip;
      const correctedVersion = (item as { correctedVersion?: unknown }).correctedVersion;
      if (typeof id !== "string" || typeof feedback !== "string") continue;
      const tipStr = typeof tip === "string" ? tip.trim() : "";
      const cv =
        correctedVersion === null || correctedVersion === undefined
          ? null
          : typeof correctedVersion === "string"
            ? correctedVersion
            : null;
      tasks.push({
        id: id.trim(),
        feedback: feedback.trim(),
        tip: tipStr || "—",
        correctedVersion: cv?.trim() ? cv.trim() : null,
      });
    }
    if (tasks.length === 0) return null;
    return { summary: o.summary.trim(), tasks };
  } catch {
    return null;
  }
}
