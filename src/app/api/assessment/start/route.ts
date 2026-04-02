import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";
import { isAssessmentSkill } from "@/lib/assessment-skills";
import {
  createAssessmentOpenAI,
  getOpenAiApiKey,
  isOpenAiAuthFailure,
  openAiInvalidKeyMessage,
  openAiNotConfiguredMessage,
} from "@/lib/openai-key";

function buildMcqPrompt(skill: "reading" | "listening", level: string): string {
  const skillLabel = skill === "reading" ? "reading comprehension" : "listening comprehension";
  const listeningNote =
    skill === "listening"
      ? `Each question MUST include a short script (2–5 sentences) that simulates something the student would *hear* (dialogue or monologue). Start the question text with a line like "Listen to this:" then the script, then the comprehension question.`
      : `Use 2 short reading passages (about 4–6 sentences each). The first passage should have 4–5 questions, the second passage 4–5 questions. Each question must clearly refer to its passage.`;

  return `You are an English language assessment expert. Generate exactly 10 multiple-choice ${skillLabel} questions for a student at CEFR level ${level}.

${listeningNote}

Difficulty mix (follow exactly):
- 2 questions slightly below ${level} (consolidation)
- 6 questions squarely at ${level}
- 2 questions slightly above ${level} (stretch)

Return ONLY a valid JSON array with exactly 10 objects. No markdown, no extra text. Each object must have:
{
  "type": "mcq",
  "question": "The full question text (include passage/script in the question as needed)",
  "options": ["option A text", "option B text", "option C text", "option D text"],
  "correctAnswer": "the full text of the correct option (must match exactly one of the options)"
}`;
}

function buildOpenPrompt(skill: "writing" | "speaking", level: string): string {
  const focus =
    skill === "writing"
      ? `Tasks should cover different writing purposes at ${level}: for example a short email or message, a brief opinion or argument (80–120 words suggested), and describing or summarising a situation.`
      : `Prompts should be realistic spoken scenarios at ${level}: for example giving directions, agreeing/disagreeing politely, making a request, or handling a simple service situation. Ask the student to type what they would *say* aloud (not essay-style).`;

  return `You are an English language assessment expert. Generate exactly 3 open-ended ${skill} tasks for a CEFR ${level} student.

${focus}

Difficulty mix across the 3 tasks: one slightly below ${level}, one at ${level}, one slightly above ${level}.

Return ONLY a valid JSON array with exactly 3 objects. No markdown, no extra text. Each object must have:
{
  "type": "open",
  "question": "The full task instructions for the student"
}`;
}

interface RawMcq {
  type: "mcq";
  question: string;
  options: string[];
  correctAnswer: string;
}

interface RawOpen {
  type: "open";
  question: string;
}

function normalizeMcq(raw: unknown): RawMcq | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.type === "open") return null;
  const q = typeof o.question === "string" ? o.question : "";
  const options = Array.isArray(o.options) ? o.options.filter((x): x is string => typeof x === "string") : [];
  const correctAnswer = typeof o.correctAnswer === "string" ? o.correctAnswer : "";
  if (q.length < 5 || options.length !== 4 || !correctAnswer) return null;
  if (!options.includes(correctAnswer)) return null;
  return { type: "mcq", question: q, options, correctAnswer };
}

function normalizeOpen(raw: unknown): RawOpen | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const q = typeof o.question === "string" ? o.question : "";
  if (q.length < 10) return null;
  return { type: "open", question: q };
}

export async function POST(request: NextRequest) {
  let resolvedKey: string | undefined;
  try {
    resolvedKey = getOpenAiApiKey();
    if (!resolvedKey) {
      return NextResponse.json({ error: openAiNotConfiguredMessage() }, { status: 503 });
    }
    const openai = createAssessmentOpenAI(resolvedKey);
    const studentId = await getStudentId();
    if (!studentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let skillRaw: string | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      skillRaw = typeof (body as { skill?: unknown })?.skill === "string" ? (body as { skill: string }).skill : undefined;
    } catch {
      skillRaw = undefined;
    }

    if (!skillRaw || !isAssessmentSkill(skillRaw)) {
      return NextResponse.json(
        { error: "Choose a skill: reading, writing, listening, or speaking." },
        { status: 400 }
      );
    }
    const skill = skillRaw;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { level: true },
    });

    if (!student?.level) {
      return NextResponse.json(
        { error: "Your teacher hasn't assigned your English level yet. Please ask them to set it in the Students tab." },
        { status: 400 }
      );
    }

    const studentLevel = student.level;

    const pendingOther = await prisma.assessment.findFirst({
      where: { studentId, status: "pending" },
    });
    if (pendingOther && pendingOther.skill !== skill) {
      await prisma.assessment.delete({ where: { id: pendingOther.id } });
    }

    const pending = await prisma.assessment.findFirst({
      where: { studentId, status: "pending", skill },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    if (pending) {
      return NextResponse.json({
        assessmentId: pending.id,
        studentLevel,
        skill,
        questions: pending.questions.map((q) => ({
          id: q.id,
          order: q.order,
          questionType: q.questionType as "mcq" | "open",
          question: q.question,
          options: JSON.parse(q.options) as string[],
          studentAnswer: q.studentAnswer,
        })),
      });
    }

    const userPrompt =
      skill === "reading" || skill === "listening"
        ? buildMcqPrompt(skill, studentLevel)
        : buildOpenPrompt(skill, studentLevel);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.7,
      max_tokens: skill === "reading" || skill === "listening" ? 4500 : 2500,
    });

    const rawContent = completion.choices[0]?.message?.content ?? "[]";
    const raw = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    let parsed: unknown[];
    try {
      const j = JSON.parse(raw) as unknown;
      parsed = Array.isArray(j) ? j : [];
    } catch {
      console.error("OpenAI returned invalid JSON:", rawContent);
      return NextResponse.json({ error: "Failed to generate questions. Please try again." }, { status: 502 });
    }

    const mcqExpected = skill === "reading" || skill === "listening";
    const minLen = mcqExpected ? 8 : 3;

    const normalized: { questionType: "mcq" | "open"; question: string; options: string[]; correctAnswer: string }[] =
      [];

    for (const item of parsed) {
      if (normalized.length >= (mcqExpected ? 10 : 3)) break;
      if (mcqExpected) {
        const m = normalizeMcq(item);
        if (m) {
          normalized.push({
            questionType: "mcq",
            question: m.question,
            options: m.options,
            correctAnswer: m.correctAnswer,
          });
        }
      } else {
        const op = normalizeOpen(item);
        if (op) {
          normalized.push({
            questionType: "open",
            question: op.question,
            options: [],
            correctAnswer: "",
          });
        }
      }
    }

    if (normalized.length < minLen) {
      return NextResponse.json({ error: "Generated questions are invalid. Please try again." }, { status: 502 });
    }

    const questions = mcqExpected ? normalized.slice(0, 10) : normalized.slice(0, 3);

    const assessment = await prisma.assessment.create({
      data: {
        studentId,
        status: "pending",
        level: studentLevel,
        skill,
        questions: {
          create: questions.map((q, i) => ({
            order: i + 1,
            questionType: q.questionType,
            question: q.question,
            options: JSON.stringify(q.options),
            correctAnswer: q.correctAnswer,
          })),
        },
      },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({
      assessmentId: assessment.id,
      studentLevel,
      skill,
      questions: assessment.questions.map((q) => ({
        id: q.id,
        order: q.order,
        questionType: q.questionType as "mcq" | "open",
        question: q.question,
        options: JSON.parse(q.options) as string[],
        studentAnswer: null,
      })),
    });
  } catch (err) {
    console.error("POST /api/assessment/start error:", err);
    const errObj = err as Record<string, unknown>;
    const status = errObj?.status ?? errObj?.statusCode;
    if (status === 429 || errObj?.code === "insufficient_quota") {
      return NextResponse.json(
        { error: "Assessment service is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }
    if (isOpenAiAuthFailure(err)) {
      return NextResponse.json({ error: openAiInvalidKeyMessage(resolvedKey) }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to start assessment", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
