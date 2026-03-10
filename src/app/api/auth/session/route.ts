import { NextResponse } from "next/server";
import { isTeacherLoggedIn } from "@/lib/auth";

export async function GET() {
  const loggedIn = await isTeacherLoggedIn();
  return NextResponse.json({ loggedIn });
}
