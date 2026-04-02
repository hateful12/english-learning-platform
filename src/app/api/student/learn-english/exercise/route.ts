import { NextRequest, NextResponse } from "next/server";
import { getStudentId } from "@/lib/auth";
import {
  createAssessmentOpenAI,
  getOpenAiApiKey,
  isOpenAiAuthFailure,
  openAiInvalidKeyMessage,
  openAiNotConfiguredMessage,
} from "@/lib/openai-key";

const CEFR_RE = /^(A1|A2|B1|B2|C1|C2)$/i;

function normalizeLevel(raw: string | null | undefined): string {
  const t = (raw ?? "").trim().toUpperCase();
  return CEFR_RE.test(t) ? t : "B1";
}

function stripJsonFence(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

type Task = { id: string; question: string };

function parseGeneratedExercise(content: string): { title: string; introduction: string; tasks: Task[] } | null {
  const raw = stripJsonFence(content);
  try {
    const o = JSON.parse(raw) as {
      title?: unknown;
      introduction?: unknown;
      tasks?: unknown;
    };
    if (typeof o.title !== "string" || typeof o.introduction !== "string" || !Array.isArray(o.tasks)) {
      return null;
    }
    const tasks: Task[] = [];
    for (const item of o.tasks) {
      if (!item || typeof item !== "object") continue;
      const id = (item as { id?: unknown }).id;
      const question = (item as { question?: unknown }).question;
      if (typeof id !== "string" || typeof question !== "string") continue;
      const tid = id.trim();
      const q = question.trim();
      if (tid && q) tasks.push({ id: tid, question: q });
    }
    if (tasks.length < 3 || tasks.length > 6) return null;
    return {
      title: o.title.trim(),
      introduction: o.introduction.trim(),
      tasks,
    };
  } catch {
    return null;
  }
}

function buildGenerateUserMessage(level: string, exerciseFocus: string, focusNote: string | undefined): string {
  return `Create short English practice for one student at CEFR ${level}.

Exercise type / focus: ${exerciseFocus}
${focusNote?.trim() ? `Student note (honour if sensible): ${focusNote.trim()}\n` : ""}

Rules:
- Exactly 4 tasks (not 3, not 5).
- Each task completable in about 1 minute; keep questions self-contained (no long passages).
- Difficulty and instructions must match ${level}.
- Mix task styles where appropriate (short answer, transform a sentence, choose between two options in the question text, fill-in style described in words, etc.).

Return ONLY valid JSON (no markdown code fences), shape:
{"title":"string","introduction":"one short paragraph for the student","tasks":[{"id":"t1","question":"..."},{"id":"t2","question":"..."},{"id":"t3","question":"..."},{"id":"t4","question":"..."}]}`;
}

export async function POST(request: NextRequest) {
  let resolvedKey: string | undefined;
  try {
    const studentId = await getStudentId();
    if (!studentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    resolvedKey = getOpenAiApiKey();
    if (!resolvedKey) {
      return NextResponse.json({ error: openAiNotConfiguredMessage() }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const phase = body?.phase;
    const openai = createAssessmentOpenAI(resolvedKey);

    if (phase === "generate") {
      const exerciseId = typeof body?.exerciseId === "string" ? body.exerciseId.trim() : "";
      const level = normalizeLevel(typeof body?.level === "string" ? body.level : null);
      const focusNote = typeof body?.focusNote === "string" ? body.focusNote.slice(0, 500) : "";
      const exerciseFocus =
        typeof body?.exerciseFocus === "string" && body.exerciseFocus.trim()
          ? body.exerciseFocus.trim().slice(0, 800)
          : "mixed grammar, vocabulary, and short production";

      if (!exerciseId) {
        return NextResponse.json({ error: "Missing exerciseId" }, { status: 400 });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You write concise English learning exercises. Output only valid JSON as requested. No markdown.",
          },
          { role: "user", content: buildGenerateUserMessage(level, exerciseFocus, focusNote || undefined) },
        ],
        temperature: 0.75,
        max_tokens: 1400,
      });

      const content = completion.choices[0]?.message?.content?.trim() ?? "";
      const parsed = parseGeneratedExercise(content);
      if (!parsed) {
        console.error("learn-english exercise generate parse failed:", content.slice(0, 400));
        return NextResponse.json(
          { error: "Could not build an exercise. Tap “New exercise” to try again." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        level,
        exerciseId,
        title: parsed.title,
        introduction: parsed.introduction,
        tasks: parsed.tasks,
      });
    }

    if (phase === "feedback") {
      const level = normalizeLevel(typeof body?.level === "string" ? body.level : null);
      const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
      const introduction =
        typeof body?.introduction === "string" ? body.introduction.trim().slice(0, 2000) : "";
      const tasks = body?.tasks;
      const answers = body?.answers;

      if (!title || !introduction || !Array.isArray(tasks) || !answers || typeof answers !== "object") {
        return NextResponse.json({ error: "Invalid exercise payload" }, { status: 400 });
      }

      const payload: { id: string; question: string; answer: string }[] = [];
      for (const item of tasks) {
        if (!item || typeof item !== "object") continue;
        const id = (item as { id?: unknown }).id;
        const question = (item as { question?: unknown }).question;
        if (typeof id !== "string" || typeof question !== "string") continue;
        const aid = id.trim();
        if (!aid) continue;
        const ansRaw = (answers as Record<string, unknown>)[aid];
        const answer = typeof ansRaw === "string" ? ansRaw.trim().slice(0, 8000) : "";
        payload.push({ id: aid, question: question.trim(), answer: answer || "(no answer)" });
      }

      if (payload.length === 0) {
        return NextResponse.json({ error: "No tasks to review" }, { status: 400 });
      }

      const userContent = `You are a supportive English teacher. Student level: CEFR ${level}.

Exercise title: ${title}
Introduction you gave the student: ${introduction}

For EACH task, use this format:

**Task [id]**  
- Feedback: (what worked, what to improve)  
- If useful, a **corrected or stronger version** (use **bold** only for changed words or phrases)  
- Tip: (one short tip)

End with a short encouraging summary (2–3 sentences).

Tasks and student answers as JSON:
${JSON.stringify(payload)}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You give clear, kind feedback on learner English. Follow the user’s format. Be specific and level-appropriate.",
          },
          { role: "user", content: userContent },
        ],
        temperature: 0.35,
        max_tokens: 3000,
      });

      const feedback = completion.choices[0]?.message?.content?.trim();
      if (!feedback) {
        return NextResponse.json({ error: "No feedback returned. Try again." }, { status: 502 });
      }

      return NextResponse.json({ feedback });
    }

    return NextResponse.json({ error: "Invalid phase. Use generate or feedback." }, { status: 400 });
  } catch (err) {
    if (isOpenAiAuthFailure(err)) {
      return NextResponse.json({ error: openAiInvalidKeyMessage(resolvedKey) }, { status: 502 });
    }
    console.error("learn-english exercise", err);
    return NextResponse.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
  }
}
