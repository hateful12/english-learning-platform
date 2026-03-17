import { NextResponse } from "next/server";
import { isTeacherLoggedIn } from "@/lib/auth";

/** Teacher-only: check if assessment (OpenAI) is configured. */
export async function GET() {
  const teacher = await isTeacherLoggedIn();
  if (!teacher) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const configured = !!process.env.OPENAI_API_KEY?.trim();
  return NextResponse.json({
    configured,
    hint: configured
      ? "API key is set. If students still see errors, the key may be invalid or expired."
      : "Add OPENAI_API_KEY to .env and run: pm2 restart english-app",
  });
}
