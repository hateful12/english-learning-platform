import { NextResponse } from "next/server";
import { clearTeacherSession } from "@/lib/auth";

export async function POST() {
  await clearTeacherSession();
  return NextResponse.json({ success: true });
}
