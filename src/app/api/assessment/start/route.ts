import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

function buildPrompt(level: string): string {
  // One level below and one above for context, most questions at the target level
  return `You are an English language progress-test expert. Generate exactly 25 multiple-choice questions to help a ${level} level English student check their progress.

Question distribution (IMPORTANT — follow exactly):
- 5 questions slightly below ${level} (consolidation — the student should mostly get these right)
- 15 questions squarely at ${level} level
- 5 questions slightly above ${level} (stretch — to show what's next)

Cover these areas proportionally:
- Vocabulary (8 questions)
- Grammar (9 questions)
- Reading comprehension micro-tasks (4 questions)
- Phrasal verbs / idioms (4 questions)

Return ONLY a valid JSON array with exactly 25 objects. No markdown, no extra text. Each object must have:
{
  "question": "The full question text",
  "options": ["option A text", "option B text", "option C text", "option D text"],
  "correctAnswer": "the full text of the correct option (must match exactly one of the options)"
}`;
}

interface RawQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export async function POST() {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Assessment service is not configured. Add OPENAI_API_KEY to .env on the server and run: pm2 restart english-app" },
        { status: 503 }
      );
    }
    const studentId = await getStudentId();
    if (!studentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get student with their assigned level
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

    // Resume existing pending assessment for this level
    const pending = await prisma.assessment.findFirst({
      where: { studentId, status: "pending" },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    if (pending) {
      return NextResponse.json({
        assessmentId: pending.id,
        studentLevel,
        questions: pending.questions.map((q) => ({
          id: q.id,
          order: q.order,
          question: q.question,
          options: JSON.parse(q.options) as string[],
          studentAnswer: q.studentAnswer,
        })),
      });
    }

    // Generate questions tailored to the student's level
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: buildPrompt(studentLevel) }],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const rawContent = completion.choices[0]?.message?.content ?? "[]";
    const raw = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    let parsed: RawQuestion[];
    try {
      parsed = JSON.parse(raw) as RawQuestion[];
    } catch {
      console.error("OpenAI returned invalid JSON:", rawContent);
      return NextResponse.json({ error: "Failed to generate questions. Please try again." }, { status: 502 });
    }

    if (!Array.isArray(parsed) || parsed.length < 20) {
      return NextResponse.json({ error: "Generated questions are invalid. Please try again." }, { status: 502 });
    }

    const questions = parsed.slice(0, 25);

    const assessment = await prisma.assessment.create({
      data: {
        studentId,
        status: "pending",
        level: studentLevel,
        questions: {
          create: questions.map((q, i) => ({
            order: i + 1,
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
      questions: assessment.questions.map((q) => ({
        id: q.id,
        order: q.order,
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
    if (status === 401) {
      return NextResponse.json(
        { error: "Invalid OpenAI API key. The teacher must set OPENAI_API_KEY in .env and restart the app (pm2 restart)." },
        { status: 503 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to start assessment", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
