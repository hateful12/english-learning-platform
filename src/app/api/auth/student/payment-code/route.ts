import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStudentId } from "@/lib/auth";

export async function GET() {
  const studentId = await getStudentId();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { paymentCode: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ paymentCode: student.paymentCode });
}
