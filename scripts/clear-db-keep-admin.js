#!/usr/bin/env node
/**
 * Clear all DB data, keeping only the admin teacher (irenn.boiko@gmail.com).
 * Run from project root: node scripts/clear-db-keep-admin.js
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const ADMIN_EMAIL = "irenn.boiko@gmail.com";
const ADMIN_PASSWORD = "000Cinnamonbun";

const prisma = new PrismaClient();

async function main() {
  // Disable FK checks for SQLite so we can delete in any order
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");

  // Delete in dependency order (child tables first)
  await prisma.assessmentQuestion.deleteMany({});
  await prisma.assessment.deleteMany({});
  await prisma.groupLessonPayment.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.scheduledLesson.deleteMany({});
  await prisma.homeworkStudentClose.deleteMany({});
  await prisma.homeworkStudentHide.deleteMany({});
  await prisma.homeworkResponse.deleteMany({});
  await prisma.homework.deleteMany({});
  await prisma.studentGroup.deleteMany({});
  await prisma.invite.deleteMany({});
  await prisma.paymentInfo.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.settings.deleteMany({});

  // Keep only admin teacher
  const deleted = await prisma.teacher.deleteMany({
    where: { email: { not: ADMIN_EMAIL } },
  });
  console.log("Deleted", deleted.count, "non-admin teacher(s)");

  // Re-enable FK checks
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");

  // Ensure admin exists
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const existingAdmin = await prisma.teacher.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existingAdmin) {
    await prisma.teacher.update({
      where: { email: ADMIN_EMAIL },
      data: { passwordHash: adminHash, role: "admin" },
    });
    console.log("Updated admin teacher:", ADMIN_EMAIL);
  } else {
    await prisma.teacher.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash: adminHash,
        role: "admin",
      },
    });
    console.log("Created admin teacher:", ADMIN_EMAIL);
  }

  console.log("DB cleared. Only admin teacher remains.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
