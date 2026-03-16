import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildEvaluatePrompt(level: string): string {
  return `You are an English language progress-test expert.
A student whose teacher-assigned level is ${level} has just completed a progress test.
The test had 25 questions: some slightly below ${level}, most at ${level}, and a few slightly above.

Evaluate their answers and return:
1. A score from 0 to 100 based on what percentage they answered correctly
2. A short, encouraging feedback paragraph (2-3 sentences) that mentions their performance at the ${level} level specifically, highlights what they're doing well, and suggests one concrete area to focus on next

Return ONLY valid JSON — no markdown, no extra text:
{
  "score": 72,
  "feedback": "Your feedback here."
}`;
}

interface AnswerPayload {
  questionId: string;
  answer: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assessmentId } = await params;
    const studentId = await getStudentId();
    if (!studentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    if (assessment.studentId !== studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (assessment.status === "completed") {
      return NextResponse.json({
        level: assessment.level,
        score: assessment.score,
        feedback: assessment.feedback,
        completedAt: assessment.completedAt,
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { answers } = (body as Record<string, unknown>) ?? {};
    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: "answers must be an array" }, { status: 400 });
    }

    const answerMap = new Map<string, string>(
      (answers as AnswerPayload[]).map((a) => [a.questionId, a.answer])
    );

    // Save student answers
    await Promise.all(
      assessment.questions.map((q) =>
        prisma.assessmentQuestion.update({
          where: { id: q.id },
          data: { studentAnswer: answerMap.get(q.id) ?? null },
        })
      )
    );

    // The level is already stored on the assessment (set when the test was created)
    const studentLevel = assessment.level ?? "B1";

    // Build evaluation input — correct / wrong per question
    const evaluationInput = assessment.questions.map((q) => ({
      question: q.question,
      correctAnswer: q.correctAnswer,
      studentAnswer: answerMap.get(q.id) ?? null,
      isCorrect: (answerMap.get(q.id) ?? null) === q.correctAnswer,
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildEvaluatePrompt(studentLevel) },
        { role: "user", content: JSON.stringify(evaluationInput) },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    const raw = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    let result: { score: number; feedback: string };
    try {
      result = JSON.parse(raw) as { score: number; feedback: string };
    } catch {
      console.error("OpenAI evaluation returned invalid JSON:", rawContent);
      return NextResponse.json({ error: "Failed to evaluate answers. Please try again." }, { status: 502 });
    }

    if (typeof result.score !== "number") {
      // Fallback: calculate score from correct answers
      const correct = evaluationInput.filter((q) => q.isCorrect).length;
      result.score = Math.round((correct / evaluationInput.length) * 100);
    }

    const updated = await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: "completed",
        score: Math.min(100, Math.max(0, Math.round(result.score))),
        feedback: result.feedback ?? "",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      level: updated.level,
      score: updated.score,
      feedback: updated.feedback,
      completedAt: updated.completedAt,
    });
  } catch (err) {
    console.error("POST /api/assessment/[id]/submit error:", err);
    const errObj = err as Record<string, unknown>;
    if (errObj?.status === 429 || errObj?.code === "insufficient_quota") {
      return NextResponse.json(
        { error: "The OpenAI account has run out of credits. Please top up the balance at platform.openai.com and try again." },
        { status: 503 }
      );
    }
    if (errObj?.status === 401) {
      return NextResponse.json(
        { error: "Invalid OpenAI API key. Please check the OPENAI_API_KEY in your environment settings." },
        { status: 503 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to submit assessment", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
