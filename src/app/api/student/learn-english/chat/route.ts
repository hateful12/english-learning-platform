import { NextRequest, NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getStudentId } from "@/lib/auth";
import {
  createAssessmentOpenAI,
  getOpenAiApiKey,
  isOpenAiAuthFailure,
  openAiInvalidKeyMessage,
  openAiNotConfiguredMessage,
} from "@/lib/openai-key";

const SYSTEM_TUTOR = `You are a practical English tutor for adult and teenage learners. Use clear, natural English. Follow the student's chosen activity from their messages. Be concise unless they ask for more depth. Prefer actionable feedback and examples they can reuse.`;

const MAX_MESSAGES = 24;
const MAX_CONTENT_PER_MESSAGE = 12_000;

type Role = "user" | "assistant" | "system";

type ChatMessage = { role: Role; content: string };

function isRole(x: string): x is Role {
  return x === "user" || x === "assistant" || x === "system";
}

function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (typeof role !== "string" || !isRole(role)) continue;
    if (typeof content !== "string") continue;
    const trimmed = content.slice(0, MAX_CONTENT_PER_MESSAGE).trim();
    if (!trimmed) continue;
    if (role === "system") continue;
    out.push({ role, content: trimmed });
  }
  if (out.length === 0) return null;
  return out.slice(-MAX_MESSAGES);
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
    const messages = sanitizeMessages(body?.messages);
    if (!messages) {
      return NextResponse.json(
        { error: "Invalid body: expected messages: { role: 'user'|'assistant', content: string }[]" },
        { status: 400 }
      );
    }

    const openai = createAssessmentOpenAI(resolvedKey);
    const apiMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_TUTOR },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: apiMessages,
      max_tokens: 4096,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return NextResponse.json({ error: "No response from the tutor. Try again." }, { status: 502 });
    }

    return NextResponse.json({ message: text });
  } catch (err) {
    if (isOpenAiAuthFailure(err)) {
      return NextResponse.json({ error: openAiInvalidKeyMessage(resolvedKey) }, { status: 502 });
    }
    console.error("learn-english chat", err);
    return NextResponse.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
  }
}
