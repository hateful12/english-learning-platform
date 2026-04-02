import { NextResponse } from "next/server";
import { isTeacherLoggedIn } from "@/lib/auth";
import { getOpenAiApiKey, openAiNotConfiguredMessage } from "@/lib/openai-key";

/** Teacher-only: check if assessment (OpenAI) is configured. */
export async function GET() {
  const teacher = await isTeacherLoggedIn();
  if (!teacher) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const configured = !!getOpenAiApiKey();
  return NextResponse.json({
    configured,
    hint: configured
      ? "API key is set. If students still see errors, the key may be invalid or expired."
      : openAiNotConfiguredMessage(),
  });
}
