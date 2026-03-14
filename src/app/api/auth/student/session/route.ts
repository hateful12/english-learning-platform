import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";

export async function GET() {
  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ loggedIn: false, student: null });
  }
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, email: true, name: true, paymentCode: true },
  });
  if (!student) {
    return NextResponse.json({ loggedIn: false, student: null });
  }
  return NextResponse.json({ loggedIn: true, student });
}
