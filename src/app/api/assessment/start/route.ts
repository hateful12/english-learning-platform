import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";
import { isAssessmentSkill, type AssessmentSkill } from "@/lib/assessment-skills";
import { generateListeningAudioFiles } from "@/lib/assessment-listening-tts";
import { buildProgressTestFrameworkBlock } from "@/lib/progress-test-training-framework";
import {
  createAssessmentOpenAI,
  getOpenAiApiKey,
  isOpenAiAuthFailure,
  openAiInvalidKeyMessage,
  openAiNotConfiguredMessage,
} from "@/lib/openai-key";

function buildReadingMcqPrompt(level: string): string {
  const framework = buildProgressTestFrameworkBlock("reading", level);
  return `You are an English language assessment expert. Generate exactly 10 multiple-choice reading comprehension questions for a student at CEFR level ${level}.

Follow this training framework:
${framework}

Reading structure (STRICT — if you violate this, the batch is unusable):
- Use exactly TWO passages only. Questions 1–5 belong to Passage 1; questions 6–10 belong to Passage 2.
- Each passage must be at least 6 full sentences and roughly 100–220 words at ${level}. Never use a single sentence or a tiny paragraph as a passage.
- Do not attach more than one multiple-choice question to the same sentence. Spread questions across the whole passage (different facts, inferences, vocabulary in context, gist vs detail).
- For questions 1–5: each "question" string must start with the label "Passage 1:" then a newline, then the FULL text of Passage 1 (identical in all five items), then a newline, then "Question:" then the actual MCQ stem.
- For questions 6–10: same pattern with "Passage 2:" and the full text of Passage 2 repeated in each of those five items.
- Each "Question:" line must be a single clear comprehension stem (not another mini-passage).

Difficulty mix (follow exactly):
- 2 questions slightly below ${level} (consolidation)
- 6 questions squarely at ${level}
- 2 questions slightly above ${level} (stretch)

Return ONLY a valid JSON array with exactly 10 objects. No markdown, no extra text. Each object must have:
{
  "type": "mcq",
  "question": "Passage 1:\\n\\n...full passage...\\n\\nQuestion:\\n...",
  "options": ["option A text", "option B text", "option C text", "option D text"],
  "correctAnswer": "the full text of the correct option (must match exactly one of the options)"
}`;
}

function buildListeningMcqPrompt(level: string): string {
  const framework = buildProgressTestFrameworkBlock("listening", level);
  return `You are an English language assessment expert. Generate exactly 10 multiple-choice listening comprehension questions for a student at CEFR level ${level}.

Follow this training framework:
${framework}

Listening structure (STRICT):
- The app will use text-to-speech on "transcript" only. Students hear the audio, then answer — they do not read the script by default.
- Each item MUST include:
  - "transcript": natural dialogue (2–6 speakers possible, use "A:", "B:" lines) OR a single-speaker monologue. This is exactly what will be read aloud. No MCQ stem inside transcript. At least 35 words in "transcript" per item.
  - "question": ONE comprehension stem only (e.g. main idea, detail, inference, next step, speaker attitude). Do not paste the transcript again into "question".
- Scripts should sound like real spoken English at ${level} (contractions, fillers like "well", "I mean" where natural).

Difficulty mix (follow exactly):
- 2 questions slightly below ${level} (consolidation)
- 6 questions squarely at ${level}
- 2 questions slightly above ${level} (stretch)

Return ONLY a valid JSON array with exactly 10 objects. No markdown, no extra text. Each object must have:
{
  "type": "mcq",
  "transcript": "text that will be read aloud by the computer voice",
  "question": "comprehension question only",
  "options": ["option A text", "option B text", "option C text", "option D text"],
  "correctAnswer": "the full text of the correct option (must match exactly one of the options)"
}`;
}

function buildMcqPrompt(skill: "reading" | "listening", level: string): string {
  return skill === "reading" ? buildReadingMcqPrompt(level) : buildListeningMcqPrompt(level);
}

function buildOpenPrompt(skill: "writing" | "speaking", level: string): string {
  const focus =
    skill === "writing"
      ? `Tasks should cover different writing purposes at ${level}: for example a short email or message, a brief opinion or argument (80–120 words suggested), and describing or summarising a situation.`
      : `Prompts should be realistic spoken scenarios at ${level}: for example giving directions, agreeing/disagreeing politely, making a request, or handling a simple service situation. Ask the student to type what they would *say* aloud (not essay-style).`;

  const framework = buildProgressTestFrameworkBlock(skill as AssessmentSkill, level);

  return `You are an English language assessment expert. Generate exactly 3 open-ended ${skill} tasks for a CEFR ${level} student.

Follow this training framework:
${framework}

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

interface RawListeningMcq extends RawMcq {
  transcript: string;
}

interface RawOpen {
  type: "open";
  question: string;
}

function roughSentenceCount(text: string): number {
  return text.split(/[.!?…]+/).filter((s) => s.trim().length > 14).length;
}

/** Passage body for reading: text before "Question:" (or whole string if no delimiter). */
function readingPassageBody(full: string): string {
  const parts = full.split(/\n\s*Question\s*:/i);
  if (parts.length >= 2) {
    const head = parts[0].replace(/^Passage\s*[12]\s*:\s*/i, "").trim();
    return head;
  }
  return full.trim();
}

function isValidReadingMcq(questionText: string): boolean {
  if (questionText.length < 380) return false;
  const body = readingPassageBody(questionText);
  if (body.length < 320) return false;
  return roughSentenceCount(body) >= 5;
}

function normalizeReadingMcq(raw: unknown): RawMcq | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.type === "open") return null;
  const q = typeof o.question === "string" ? o.question : "";
  const options = Array.isArray(o.options) ? o.options.filter((x): x is string => typeof x === "string") : [];
  const correctAnswer = typeof o.correctAnswer === "string" ? o.correctAnswer : "";
  if (q.length < 5 || options.length !== 4 || !correctAnswer) return null;
  if (!options.includes(correctAnswer)) return null;
  if (!isValidReadingMcq(q)) return null;
  return { type: "mcq", question: q, options, correctAnswer };
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeListeningMcq(raw: unknown): RawListeningMcq | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.type === "open") return null;
  const transcript = typeof o.transcript === "string" ? o.transcript.trim() : "";
  const q = typeof o.question === "string" ? o.question.trim() : "";
  const options = Array.isArray(o.options) ? o.options.filter((x): x is string => typeof x === "string") : [];
  const correctAnswer = typeof o.correctAnswer === "string" ? o.correctAnswer : "";
  if (transcript.length < 40 || q.length < 12 || options.length !== 4 || !correctAnswer) return null;
  if (!options.includes(correctAnswer)) return null;
  if (wordCount(transcript) < 28) return null;
  return { type: "mcq", question: q, transcript, options, correctAnswer };
}

function normalizeOpen(raw: unknown): RawOpen | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const q = typeof o.question === "string" ? o.question : "";
  if (q.length < 10) return null;
  return { type: "open", question: q };
}

type NormalizedRow = {
  questionType: "mcq" | "open";
  question: string;
  options: string[];
  correctAnswer: string;
  listeningTranscript: string | null;
};

function mapQuestionToJson(q: {
  id: string;
  order: number;
  questionType: string;
  question: string;
  options: string;
  studentAnswer: string | null;
  listeningTranscript: string | null;
  audioUrl: string | null;
}) {
  return {
    id: q.id,
    order: q.order,
    questionType: q.questionType as "mcq" | "open",
    question: q.question,
    options: JSON.parse(q.options) as string[],
    studentAnswer: q.studentAnswer,
    listeningTranscript: q.listeningTranscript,
    audioUrl: q.audioUrl,
  };
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
        questions: pending.questions.map((q) => mapQuestionToJson(q)),
      });
    }

    const userPrompt =
      skill === "reading" || skill === "listening"
        ? buildMcqPrompt(skill, studentLevel)
        : buildOpenPrompt(skill, studentLevel);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.65,
      max_tokens: skill === "reading" || skill === "listening" ? 8000 : 2500,
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
    const minMcq = 10;

    const normalized: NormalizedRow[] = [];

    for (const item of parsed) {
      if (normalized.length >= (mcqExpected ? 10 : 3)) break;
      if (mcqExpected) {
        if (skill === "reading") {
          const m = normalizeReadingMcq(item);
          if (m) {
            normalized.push({
              questionType: "mcq",
              question: m.question,
              options: m.options,
              correctAnswer: m.correctAnswer,
              listeningTranscript: null,
            });
          }
        } else {
          const m = normalizeListeningMcq(item);
          if (m) {
            normalized.push({
              questionType: "mcq",
              question: m.question,
              options: m.options,
              correctAnswer: m.correctAnswer,
              listeningTranscript: m.transcript,
            });
          }
        }
      } else {
        const op = normalizeOpen(item);
        if (op) {
          normalized.push({
            questionType: "open",
            question: op.question,
            options: [],
            correctAnswer: "",
            listeningTranscript: null,
          });
        }
      }
    }

    if (normalized.length < (mcqExpected ? minMcq : 3)) {
      return NextResponse.json(
        { error: "Generated questions did not meet quality checks. Please try again." },
        { status: 502 }
      );
    }

    const questions = mcqExpected ? normalized.slice(0, 10) : normalized.slice(0, 3);

    let assessment = await prisma.assessment.create({
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
            listeningTranscript: q.listeningTranscript,
          })),
        },
      },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    if (skill === "listening") {
      const urlMap = await generateListeningAudioFiles(openai, assessment.questions);
      await Promise.all(
        assessment.questions.map((row) => {
          const url = urlMap.get(row.id);
          if (!url) return Promise.resolve();
          return prisma.assessmentQuestion.update({
            where: { id: row.id },
            data: { audioUrl: url },
          });
        })
      );
      assessment = await prisma.assessment.findUniqueOrThrow({
        where: { id: assessment.id },
        include: { questions: { orderBy: { order: "asc" } } },
      });
    }

    return NextResponse.json({
      assessmentId: assessment.id,
      studentLevel,
      skill,
      questions: assessment.questions.map((q) => mapQuestionToJson(q)),
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
