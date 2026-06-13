import { NextResponse } from "next/server";
import { getTeacherSession } from "@/lib/auth";

export async function GET() {
  const teacher = await getTeacherSession();
  return NextResponse.json({
    loggedIn: teacher !== null,
    teacher,
  });
}
