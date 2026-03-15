import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EVALUATE_SYSTEM_PROMPT = `You are an English language assessment expert. 
Evaluate the student's answers to the CEFR test and determine their English proficiency level.

You will receive a JSON array of answered questions. Each entry has:
- question: the question text
- targetLevel: the intended CEFR level of the question
- correctAnswer: the correct answer
- studentAnswer: what the student selected (may be null if not answered)

Based on the pattern of correct and incorrect answers, determine:
1. The student's CEFR level: A1, A2, B1, B2, C1, or C2
2. A score from 0 to 100 (percentage of correct answers, but also consider which levels were mastered)
3. A short encouraging feedback paragraph (2-3 sentences) describing their strengths and what to work on next

Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "level": "B1",
  "score": 64,
  "feedback": "Your feedback text here."
}`;

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

    // Save student answers to each question
    const answerMap = new Map<string, string>(
      (answers as AnswerPayload[]).map((a) => [a.questionId, a.answer])
    );

    await Promise.all(
      assessment.questions.map((q) => {
        const studentAnswer = answerMap.get(q.id) ?? null;
        return prisma.assessmentQuestion.update({
          where: { id: q.id },
          data: { studentAnswer },
        });
      })
    );

    // Build evaluation payload for OpenAI
    const evaluationInput = assessment.questions.map((q) => ({
      question: q.question,
      targetLevel: "B1", // stored in DB if needed; use placeholder for now
      correctAnswer: q.correctAnswer,
      studentAnswer: answerMap.get(q.id) ?? null,
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: EVALUATE_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(evaluationInput) },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let result: { level: string; score: number; feedback: string };
    try {
      result = JSON.parse(raw) as { level: string; score: number; feedback: string };
    } catch {
      console.error("OpenAI evaluation returned invalid JSON:", raw);
      return NextResponse.json({ error: "Failed to evaluate answers. Please try again." }, { status: 502 });
    }

    const validLevels = ["A1", "A2", "B1", "B2", "C1", "C2"];
    if (!validLevels.includes(result.level)) {
      result.level = "B1";
    }
    if (typeof result.score !== "number") {
      result.score = 0;
    }

    // Update assessment as completed
    const updated = await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: "completed",
        level: result.level,
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to submit assessment", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
