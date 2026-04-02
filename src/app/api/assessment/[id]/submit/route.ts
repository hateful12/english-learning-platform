import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";
import OpenAI from "openai";
import { getOpenAiApiKey, openAiInvalidKeyMessage, openAiNotConfiguredMessage } from "@/lib/openai-key";

function buildEvaluatePrompt(params: {
  level: string;
  skill: string | null;
  hasOpen: boolean;
  hasMcq: boolean;
}): string {
  const { level, skill, hasOpen, hasMcq } = params;
  const skillPhrase = skill
    ? `This was a **${skill}** skills check at CEFR ${level}.`
    : `The student's teacher-assigned level is ${level}.`;

  if (hasOpen && !hasMcq) {
    return `You are an English language progress-test expert. ${skillPhrase}

The student completed open-ended ${skill ?? "production"} tasks. Rate their written responses for appropriateness, range, accuracy, and task achievement at the ${level} level.

Return ONLY valid JSON — no markdown, no extra text:
{
  "score": <integer 0-100>,
  "feedback": "<2-4 sentences: encouraging, specific to their ${skill ?? "English"} performance at ${level}, one clear next step>"
}`;
  }

  if (hasMcq && !hasOpen) {
    return `You are an English language progress-test expert. ${skillPhrase}

The student completed multiple-choice questions. The user message JSON includes each item with isCorrect (already computed). Use it only to inform your feedback — do NOT change the scoring logic: your "score" field MUST equal Math.round(100 * (count of isCorrect true) / (total items)).

Return ONLY valid JSON — no markdown, no extra text:
{
  "score": <integer 0-100, must match the rule above>,
  "feedback": "<2-3 sentences: mention ${skill ?? "this skill"} at ${level}, strengths, one area to improve>"
}`;
  }

  return `You are an English language progress-test expert. ${skillPhrase}

The test mixed multiple-choice and open-ended responses. JSON includes isCorrect for MCQ items and student text for open items.

Compute an overall score 0-100: weight MCQ as 50% (by percent correct) and open tasks as 50% (your holistic judgment of task achievement at ${level}). If only one type is present, use that type only.

Return ONLY valid JSON — no markdown, no extra text:
{
  "score": <integer 0-100>,
  "feedback": "<2-4 sentences, balanced and actionable>"
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
    const apiKey = getOpenAiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: openAiNotConfiguredMessage() }, { status: 503 });
    }
    const openai = new OpenAI({ apiKey });
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
        skill: assessment.skill,
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

    await Promise.all(
      assessment.questions.map((q) =>
        prisma.assessmentQuestion.update({
          where: { id: q.id },
          data: { studentAnswer: answerMap.get(q.id) ?? null },
        })
      )
    );

    const openQuestions = assessment.questions.filter((q) => (q.questionType ?? "mcq") === "open");
    if (openQuestions.length > 0) {
      const tooShort = openQuestions.filter((q) => {
        const t = (answerMap.get(q.id) ?? "").trim();
        return t.length < 15;
      });
      if (tooShort.length > 0) {
        return NextResponse.json(
          { error: "Please write at least a sentence or two for each writing/speaking task (15+ characters each)." },
          { status: 400 }
        );
      }
    }

    const studentLevel = assessment.level ?? "B1";
    const skill = assessment.skill;

    const evaluationInput = assessment.questions.map((q) => {
      const qt = q.questionType === "open" ? "open" : "mcq";
      const studentAns = answerMap.get(q.id) ?? null;
      if (qt === "mcq") {
        const ok = studentAns !== null && studentAns !== "" && studentAns === q.correctAnswer;
        return {
          type: "mcq" as const,
          question: q.question,
          studentAnswer: studentAns,
          correctAnswer: q.correctAnswer,
          isCorrect: ok,
        };
      }
      const trimmed = (studentAns ?? "").trim();
      return {
        type: "open" as const,
        question: q.question,
        studentAnswer: trimmed.length ? trimmed : null,
      };
    });

    const hasOpen = evaluationInput.some((x) => x.type === "open");
    const hasMcq = evaluationInput.some((x) => x.type === "mcq");
    const mcqItems = evaluationInput.filter((x): x is Extract<(typeof evaluationInput)[0], { type: "mcq" }> => x.type === "mcq");
    const mcqCorrect = mcqItems.filter((x) => x.isCorrect).length;
    const mcqScorePct = mcqItems.length ? Math.round((mcqCorrect / mcqItems.length) * 100) : 0;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildEvaluatePrompt({ level: studentLevel, skill, hasOpen, hasMcq }) },
        {
          role: "user",
          content: JSON.stringify({
            mcqStats: hasMcq
              ? { total: mcqItems.length, correct: mcqCorrect, percentCorrect: mcqScorePct }
              : null,
            items: evaluationInput,
          }),
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
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

    let finalScore = typeof result.score === "number" ? Math.round(result.score) : 0;

    if (hasMcq && !hasOpen) {
      finalScore = mcqScorePct;
    } else if (!hasMcq && hasOpen) {
      if (typeof result.score !== "number" || Number.isNaN(result.score)) {
        finalScore = 0;
      }
    }

    finalScore = Math.min(100, Math.max(0, finalScore));

    const updated = await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: "completed",
        score: finalScore,
        feedback: result.feedback ?? "",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      level: updated.level,
      skill: updated.skill,
      score: updated.score,
      feedback: updated.feedback,
      completedAt: updated.completedAt,
    });
  } catch (err) {
    console.error("POST /api/assessment/[id]/submit error:", err);
    const errObj = err as Record<string, unknown>;
    const status = errObj?.status ?? errObj?.statusCode;
    if (status === 429 || errObj?.code === "insufficient_quota") {
      return NextResponse.json(
        { error: "Assessment service is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }
    if (status === 401) {
      return NextResponse.json({ error: openAiInvalidKeyMessage() }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to submit assessment", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
