import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getStudentId } from "@/lib/auth";
import { parseStructuredFeedback } from "@/lib/exercise-feedback";
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

function resolveHomeworkUploadFilePath(publicUrl: string): string | null {
  if (typeof publicUrl !== "string" || !publicUrl.startsWith("/uploads/homework/")) return null;
  const base = path.basename(publicUrl);
  if (!base || base.includes("..")) return null;
  const dir = path.join(process.cwd(), "public", "uploads", "homework");
  const full = path.resolve(path.join(dir, base));
  if (!full.startsWith(path.resolve(dir))) return null;
  return full;
}

async function transcribeAudioFile(openai: OpenAI, filePath: string): Promise<string> {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
  });
  return (transcription.text ?? "").trim();
}

function parseGeneratedExercise(
  content: string,
  exerciseIdForValidation: string
): { title: string; introduction: string; tasks: Task[] } | null {
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
      if (tid && q) {
        tasks.push({ id: tid, question: q });
      }
    }
    if (exerciseIdForValidation === "reading") {
      if (tasks.length !== 1) return null;
    } else if (tasks.length < 3 || tasks.length > 6) {
      return null;
    }
    return {
      title: o.title.trim(),
      introduction: o.introduction.trim(),
      tasks,
    };
  } catch {
    return null;
  }
}

function parseUkrainianTranslation(content: string): {
  titleUk: string;
  introductionUk: string;
  taskQuestionUk: Record<string, string>;
} | null {
  const raw = stripJsonFence(content);
  try {
    const o = JSON.parse(raw) as {
      titleUk?: unknown;
      introductionUk?: unknown;
      tasks?: unknown;
    };
    if (typeof o.titleUk !== "string" || typeof o.introductionUk !== "string" || !Array.isArray(o.tasks)) {
      return null;
    }
    const taskQuestionUk: Record<string, string> = {};
    for (const item of o.tasks) {
      if (!item || typeof item !== "object") continue;
      const id = (item as { id?: unknown }).id;
      const questionUk = (item as { questionUk?: unknown }).questionUk;
      if (typeof id !== "string" || typeof questionUk !== "string") continue;
      const tid = id.trim();
      if (tid) taskQuestionUk[tid] = questionUk.trim();
    }
    if (Object.keys(taskQuestionUk).length === 0) return null;
    return {
      titleUk: o.titleUk.trim(),
      introductionUk: o.introductionUk.trim(),
      taskQuestionUk,
    };
  } catch {
    return null;
  }
}

function cefrTaskDepthGuidance(level: string): string {
  const L = level.toUpperCase();
  if (L === "A1" || L === "A2") {
    return `CEFR ${L} — keep tasks concrete: very short sentences, basic vocabulary, mostly literal comprehension (who/what/where), and simple gaps.`;
  }
  if (L === "B1") {
    return `CEFR B1 — tasks must feel like solid intermediate practice, NOT like A2.
- Ban "read one sentence and copy the obvious fact" (e.g. if the text says she plays the piano, do NOT ask only "What activity does she enjoy?" — that is too primitive).
- Prefer: 2–3 short sentences OR a tiny dialogue/note; then ask for inference, paraphrase in your own words, a reason or consequence, a quick opinion with one clause of support, comparing two ideas, predicting what happens next, or reformulating (e.g. passive, different tense, conditional) while keeping language B1-appropriate.
- At least 2 tasks should require the student to produce a phrase or short sentence that is not spelled out verbatim in the prompt.
- Vary grammar angles across tasks: present perfect vs past, modals (might/should), linking (although, because, so), comparatives, real conditionals, articles, prepositions — do **not** lean on one favourite pattern for every task.`;
  }
  if (L === "B2") {
    return `CEFR B2 — nuanced short texts or viewpoints; evaluate tone/intention, summarise, counter-argument, precise vocabulary choice, mixed conditionals, passive reporting, hedging language. Avoid trivial one-line factual recall unless it supports a harder follow-up.`;
  }
  if (L === "C1" || L === "C2") {
    return `CEFR ${L} — sophisticated prompts: abstraction, stance-taking, subtle implication, register, cohesion across a short paragraph, precise reformulation, and idiomatic but natural English.`;
  }
  return `Match task depth to CEFR ${level}: stretch the student without going far above the band.`;
}

/** Quoted read-aloud story must match this CEFR band — not harder, not markedly below. */
function readingStoryLevelGuidance(level: string): string {
  const L = level.trim().toUpperCase();
  if (L === "A1") {
    return `Story must be **CEFR A1**:
- **Vocabulary:** only very common everyday words; **no** idioms, phrasal verbs, or rare words.
- **Grammar:** mainly present simple and **be**; can use **can** for ability; avoid perfect tenses, passive, conditionals, relative clauses.
- **Form:** **about 35–60 words**, **5–9 very short sentences** (often 3–8 words); one simple concrete situation (e.g. daily routine, shopping, family).
- **Hard rule:** if a word or structure is typical of A2+, replace it with a simpler A1 choice.`;
  }
  if (L === "A2") {
    return `Story must be **CEFR A2**:
- **Vocabulary:** common concrete topics; simple phrases only; idioms **very rare** and transparent.
- **Grammar:** past simple, future with **will/going to**, **because/so**, simple comparisons; limited use of **when/if** clauses.
- **Form:** **about 60–100 words**, **7–12 short sentences**; simple narrative or dialogue.
- **Hard rule:** do **not** use B1+ patterns (present perfect narratives, passive voice, unreal conditionals, complex relatives) unless a single light example fits natural A2 coursebooks — prefer simple.`;
  }
  if (L === "B1") {
    return `Story must be **CEFR B1**:
- **Vocabulary:** intermediate, everyday + light abstraction; avoid literary or specialised advanced lexis.
- **Grammar:** present perfect for experience/recent past, **must/should**, simple relative clauses (**who/which/that**), first conditional; some longer sentences OK.
- **Form:** **about 100–150 words**, one coherent mini-story (can include 1–4 short paragraphs).
- **Hard rule:** do **not** write at B2+ density (heavy passives, mixed conditionals, subtle irony, dense nominalisation).`;
  }
  if (L === "B2") {
    return `Story must be **CEFR B2**:
- **Vocabulary:** upper-intermediate; natural collocation; still **no** specialised academic/professional jargon unless glossed in context (avoid glossing — keep plain).
- **Grammar:** varied tenses and aspects, passive where natural, second conditional, wider linking; complex sentences allowed but stay clear.
- **Form:** **about 140–200 words**; nuanced but still a short story.
- **Hard rule:** do **not** target C1 literary voice or low-frequency imagery throughout.`;
  }
  if (L === "C1") {
    return `Story must be **CEFR C1**:
- **Vocabulary & grammar:** advanced, precise; natural idioms and nuanced connectors OK; subordination and stance-taking acceptable.
- **Form:** **about 180–260 words**; one polished short narrative or scene.
- **Hard rule:** avoid sounding like **C2** exam rhetoric or highly literary register unless one phrase fits naturally — stay **solid C1**.`;
  }
  if (L === "C2") {
    return `Story must be **CEFR C2**:
- **Vocabulary & grammar:** full productive range where natural; subtle register choices OK.
- **Form:** **about 200–300 words** maximum for this activity — still one short story, not a full essay.
- **Hard rule:** do **not** simplify to B2; the student expects near-native complexity appropriate to C2.`;
  }
  return `Story language must align strictly with CEFR ${level}; prefer level-appropriate wording over generic “plain English”.`;
}

function grammarInUseVarietyNote(exerciseId: string, focusNote: string | undefined): string {
  if (exerciseId !== "grammar") return "";
  const note = focusNote?.trim() ?? "";
  const wantsReported = /reported|indirect speech|indirect style/i.test(note);
  return `
Grammar-in-use (follow closely):
- Each of the 4 tasks must practise a **different** grammar point suited to this level (examples by level, pick diverse types: tense/aspect, modals, passive vs active, conditionals, relative clauses, prepositions, gerund vs infinitive, comparatives/superlatives, articles, word order, question tags, etc.).
- **Do not** reuse the same template for every task. In particular, do **not** end most tasks with "rewrite in reported speech", "how would you say this in reported style?", or anything that makes reported/indirect speech the default drill.
${wantsReported ? `- Student note mentions reported/indirect speech: you may use **up to two** tasks on that topic; the other tasks must still use different grammar points.` : "- At most **one** task may focus on reported or indirect speech (unless the student note above clearly asks for reported/indirect speech — then follow the line above)."}
`;
}

function buildGenerateUserMessage(
  level: string,
  exerciseFocus: string,
  focusNote: string | undefined,
  exerciseId: string
): string {
  const speakingNote =
    exerciseId === "speaking-prep"
      ? "\nThis is speaking practice: use prompts the student can answer in 20–40 seconds of speech (opinion, describe, role-play cue). They may answer by voice recording or typing.\n"
      : "";

  const readingNote =
    exerciseId === "reading"
      ? `
Read-aloud mode (critical) — **one exercise, one story**:
- Student level is **CEFR ${level}**. The **quoted story must match this level exactly**: not written for a higher band, and not oversimplified to a lower band (unless ${level} is A1).
- Return **exactly 1 task** (not 2, not 4). The whole activity is a **single short story** the student reads aloud in one go.
- Put the **complete story inside 'single' or "double" quotes** in that one task’s question. Add a short instruction line before/after the quotes: read aloud clearly and **record your voice** reading the whole story (optional tiny written note only).
- One coherent narrative or scene; no comprehension quiz as the main ask — the ask is always: read this story aloud and submit the recording.
- The introduction must explain they have **one** short story at **their level (${level})** to read aloud once and record for feedback.
`
      : "";

  const depth =
    exerciseId === "reading"
      ? readingStoryLevelGuidance(level)
      : cefrTaskDepthGuidance(level);
  const grammarNote = grammarInUseVarietyNote(exerciseId, focusNote);

  const taskStyleRules =
    exerciseId === "reading"
      ? `- Single task only: the quoted text is the full story; recording will be transcribed and compared to that wording.`
      : `- Mix task styles: short answer, grammar transforms, MCQ in text, etc. Text only — do not ask the student to look at a picture or photo.
- English example sentences in tasks must stay inside 'single' or "double" quotes when you give a sentence for the student to read or analyse.`;

  const taskCountRules =
    exerciseId === "reading"
      ? `- Exactly **1** task with \`"id":"t1"\`. The question contains one short story in quotes plus read-aloud + record instructions.
- **Every sentence in the quoted story** must be appropriate for **CEFR ${level}** (see Task depth). Proofread the story against a level-${level} coursebook mental model.`
      : `- Exactly 4 tasks (not 3, not 5).
- Each task completable in about 1 minute; keep questions self-contained (no long passages).
- Difficulty and instructions must match ${level}.`;

  const jsonShape =
    exerciseId === "reading"
      ? `{"title":"string","introduction":"one short paragraph for the student","tasks":[{"id":"t1","question":"instruction + full short story in quotes + record reminder"}]}`
      : `{"title":"string","introduction":"one short paragraph for the student","tasks":[{"id":"t1","question":"..."},{"id":"t2","question":"..."},{"id":"t3","question":"..."},{"id":"t4","question":"..."}]}`;

  return `Create short English practice for one student at CEFR ${level}.

Exercise type / focus: ${exerciseFocus}
${speakingNote}${readingNote}${focusNote?.trim() ? `Student note (honour if sensible): ${focusNote.trim()}\n` : ""}
${grammarNote}
Task depth (follow closely):
${depth}

Rules:
${taskCountRules}
${taskStyleRules}

Return ONLY valid JSON (no markdown code fences), shape:
${jsonShape}`;
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

      const systemGenerate =
        exerciseId === "reading"
          ? "You write concise English learning exercises. For read-aloud activities, the quoted story must strictly match the student's CEFR band in vocabulary and grammar — do not level up or level down. Output only valid JSON as requested. No markdown."
          : "You write concise English learning exercises. Calibrate cognitive demand to the CEFR level: B1 and above must not collapse into single-sentence literal recall. For grammar exercises, vary the grammar focus across tasks — do not default every item to reported speech. Output only valid JSON as requested. No markdown.";

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemGenerate,
          },
          {
            role: "user",
            content: buildGenerateUserMessage(level, exerciseFocus, focusNote || undefined, exerciseId),
          },
        ],
        temperature: 0.75,
        max_tokens: 1800,
      });

      const content = completion.choices[0]?.message?.content?.trim() ?? "";
      const parsed = parseGeneratedExercise(content, exerciseId);
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
      const audioUrlsRaw = body?.audioUrls;
      const exerciseTypeIdFb =
        typeof body?.exerciseTypeId === "string" ? body.exerciseTypeId.trim().slice(0, 64) : "";

      if (!title || !introduction || !Array.isArray(tasks) || !answers || typeof answers !== "object") {
        return NextResponse.json({ error: "Invalid exercise payload" }, { status: 400 });
      }

      const audioUrls: Record<string, string> = {};
      if (audioUrlsRaw && typeof audioUrlsRaw === "object" && !Array.isArray(audioUrlsRaw)) {
        for (const [k, v] of Object.entries(audioUrlsRaw as Record<string, unknown>)) {
          const key = k.trim();
          if (typeof v === "string" && v.startsWith("/uploads/homework/")) {
            audioUrls[key] = v;
          }
        }
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
        let answer = typeof ansRaw === "string" ? ansRaw.trim().slice(0, 8000) : "";

        const audioPath = audioUrls[aid] ? resolveHomeworkUploadFilePath(audioUrls[aid]) : null;
        if (audioPath) {
          try {
            await fs.promises.access(audioPath, fs.constants.R_OK);
            const tx = await transcribeAudioFile(openai, audioPath);
            if (tx) {
              answer = answer
                ? `[Voice answer, transcribed]\n${tx}\n\n[Written note]\n${answer}`
                : `[Voice answer, transcribed]\n${tx}`;
            } else if (!answer) {
              answer =
                "(Voice recording had no clear speech — please record again or type your answer.)";
            }
          } catch (e) {
            console.error("learn-english exercise transcribe", e);
            answer = answer
              ? `${answer}\n\n(Voice file could not be transcribed — feedback uses your text only.)`
              : "(Voice file could not be transcribed — please type your answer or try another recording.)";
          }
        }

        payload.push({ id: aid, question: question.trim(), answer: answer || "(no answer)" });
      }

      if (payload.length === 0) {
        return NextResponse.json({ error: "No tasks to review" }, { status: 400 });
      }

      const idsInOrder = payload.map((p) => p.id).join(", ");

      const readAloudFeedbackBlock =
        exerciseTypeIdFb === "reading"
          ? `

Read-aloud exercise: the student was asked to read **one short story** aloud (the full quoted text in the single task), written for **CEFR ${level}**. Their submission is a voice recording transcribed by Whisper and appears under [Voice answer, transcribed] (and optional written notes). Extract or infer the **target story** from the task question (text in quotes). Expect language appropriate to **${level}** — judge accuracy and substitutions against that level, not against advanced native norms. In feedback and tips:
- Compare transcription to the target: missed words, extra words, substitutions, word order slips.
- Comment on likely clarity/fluency only from what the transcript suggests (do not claim to have heard audio).
- For correctedVersion when useful, show the target wording or a clean read-through, with **double-asterisk bold** only on parts they should fix.
`
          : "";

      const userContent = `You are a supportive English teacher. Student level: CEFR ${level}.

Exercise title: ${title}
Introduction you gave the student: ${introduction}

Tasks and student answers (JSON). Voice answers are already transcribed into the answer text where applicable.
${JSON.stringify(payload)}${readAloudFeedbackBlock}

Return ONLY valid JSON (no markdown code fences), exactly this shape:
{
  "summary": "2-3 sentences of overall encouragement, plain text only",
  "tasks": [
    {
      "id": "t1",
      "feedback": "what worked and what to improve — plain text, no markdown",
      "tip": "one short practical tip",
      "correctedVersion": "optional: show an improved version with **double-asterisk bold** only around changed words; use null if not applicable"
    }
  ]
}

Rules:
- Include exactly one object in "tasks" per task above, in this order: ${idsInOrder}.
- Each "id" must match exactly (e.g. t1, t2).
- Use null for correctedVersion when there is nothing to rewrite.
- Base all feedback only on the questions and answer strings in the JSON above. Do not quote, summarise, or discuss answers that were not provided in that JSON (no invented or remembered text from other sessions).`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You give clear, kind feedback on learner English. Output only valid JSON as requested. Be specific and level-appropriate.",
          },
          { role: "user", content: userContent },
        ],
        temperature: 0.35,
        max_tokens: 3500,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!raw) {
        return NextResponse.json({ error: "No feedback returned. Try again." }, { status: 502 });
      }

      const structured = parseStructuredFeedback(raw);
      if (structured) {
        return NextResponse.json({ structured, feedback: null });
      }

      console.error("learn-english exercise feedback JSON parse failed:", raw.slice(0, 500));
      return NextResponse.json({ structured: null, feedback: raw });
    }

    if (phase === "translateUk") {
      const levelUk = normalizeLevel(typeof body?.level === "string" ? body.level : null);
      if (levelUk !== "A1" && levelUk !== "A2") {
        return NextResponse.json(
          { error: "Ukrainian instructions are only available for CEFR A1 and A2." },
          { status: 403 }
        );
      }

      const title = typeof body?.title === "string" ? body.title.trim().slice(0, 300) : "";
      const introduction =
        typeof body?.introduction === "string" ? body.introduction.trim().slice(0, 4000) : "";
      const tasks = body?.tasks;
      if (!title || !introduction || !Array.isArray(tasks)) {
        return NextResponse.json({ error: "Invalid translate payload" }, { status: 400 });
      }
      const slim: { id: string; question: string }[] = [];
      for (const item of tasks) {
        if (!item || typeof item !== "object") continue;
        const id = (item as { id?: unknown }).id;
        const question = (item as { question?: unknown }).question;
        if (typeof id !== "string" || typeof question !== "string") continue;
        const tid = id.trim();
        const q = question.trim();
        if (tid && q) slim.push({ id: tid, question: q.slice(0, 4000) });
      }
      if (slim.length === 0) {
        return NextResponse.json({ error: "No tasks to translate" }, { status: 400 });
      }

      const userContent = `You help Ukrainian-speaking students (CEFR A1–A2) understand exercise INSTRUCTIONS. They still read and answer in English.

PARTIAL translation rules (critical):
1) titleUk: translate the exercise title into natural Ukrainian (or keep short English titles if they are level labels only).
2) introductionUk: translate only rubric and instructions. Keep every English example sentence, quoted phrase, and vocabulary the student must read exactly as in the source — same spelling, same ' or " quotes.
3) For each questionUk: translate ONLY instructional phrases (e.g. "Read this sentence:", "Choose the best option:", "Write your answer.", "Complete the gap:").
   - Never translate text inside 'single quotes' or "double quotes" — copy it exactly in place.
   - Never translate standalone English sentences or clauses that are the language being practised.
   - Keep English multiple-choice options if they are the answers to choose.
Example:
  English question: Read this sentence: 'Anna likes apples and oranges.' What two fruits does Anna like? Write your answer.
  questionUk: Прочитайте це речення: 'Anna likes apples and oranges.' Які два фрукти любить Анна? Напишіть свою відповідь.

English JSON:
${JSON.stringify({ title, introduction, tasks: slim })}

Return ONLY valid JSON (no markdown code fences), shape:
{
  "titleUk": "...",
  "introductionUk": "...",
  "tasks": [ { "id": "t1", "questionUk": "..." } ]
}

Include one tasks[] entry per input task, same "id" values, same order.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You output only valid JSON. Ukrainian must follow partial-translation rules: instructions in Ukrainian, quoted English and practice text unchanged.",
          },
          { role: "user", content: userContent },
        ],
        temperature: 0.25,
        max_tokens: 2500,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!raw) {
        return NextResponse.json({ error: "No translation returned." }, { status: 502 });
      }
      const parsed = parseUkrainianTranslation(raw);
      if (!parsed) {
        console.error("translateUk parse failed:", raw.slice(0, 400));
        return NextResponse.json({ error: "Could not parse translation. Try again." }, { status: 502 });
      }
      return NextResponse.json({ ukrainian: parsed });
    }

    return NextResponse.json({ error: "Invalid phase. Use generate, feedback, or translateUk." }, { status: 400 });
  } catch (err) {
    if (isOpenAiAuthFailure(err)) {
      return NextResponse.json({ error: openAiInvalidKeyMessage(resolvedKey) }, { status: 502 });
    }
    console.error("learn-english exercise", err);
    return NextResponse.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
  }
}
