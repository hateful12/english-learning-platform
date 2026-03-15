import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are an English language assessment expert. Generate exactly 25 multiple-choice questions to assess a student's English proficiency level across the full CEFR range (A1 to C2).

Cover the following areas proportionally:
- Vocabulary (8 questions)
- Grammar (9 questions)
- Reading comprehension micro-tasks (4 questions)
- Phrasal verbs / idioms (4 questions)

Distribute difficulty: ~4 A1/A2, ~5 A2/B1, ~6 B1, ~5 B1/B2, ~5 B2, ~4 C1/C2.

Return ONLY a valid JSON array with exactly 25 objects. No markdown, no extra text. Each object must have:
{
  "question": "The full question text",
  "options": ["option A text", "option B text", "option C text", "option D text"],
  "correctAnswer": "the full text of the correct option (must match exactly one of the options)",
  "targetLevel": "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
}`;

interface RawQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  targetLevel: string;
}

export async function POST() {
  try {
    const studentId = await getStudentId();
    if (!studentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if student already has a pending (incomplete) assessment
    const pending = await prisma.assessment.findFirst({
      where: { studentId, status: "pending" },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    if (pending) {
      // Resume the existing pending test
      return NextResponse.json({
        assessmentId: pending.id,
        questions: pending.questions.map((q) => ({
          id: q.id,
          order: q.order,
          question: q.question,
          options: JSON.parse(q.options) as string[],
          studentAnswer: q.studentAnswer,
        })),
      });
    }

    // Generate questions via OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: SYSTEM_PROMPT }],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";
    let parsed: RawQuestion[];
    try {
      parsed = JSON.parse(raw) as RawQuestion[];
    } catch {
      console.error("OpenAI returned invalid JSON:", raw);
      return NextResponse.json({ error: "Failed to generate questions. Please try again." }, { status: 502 });
    }

    if (!Array.isArray(parsed) || parsed.length < 20) {
      return NextResponse.json({ error: "Generated questions are invalid. Please try again." }, { status: 502 });
    }

    // Take up to 25 questions
    const questions = parsed.slice(0, 25);

    // Save assessment + questions to DB
    const assessment = await prisma.assessment.create({
      data: {
        studentId,
        status: "pending",
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to start assessment", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
