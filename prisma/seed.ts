import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Admin teacher
  const adminEmail = "irenn.boiko@gmail.com";
  const adminPassword = "000Cinnamonbun";
  const adminHash = await bcrypt.hash(adminPassword, 10);

  const existingAdmin = await prisma.teacher.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    await prisma.teacher.update({
      where: { email: adminEmail },
      data: { passwordHash: adminHash, role: "admin" },
    });
    console.log("Updated admin teacher:", adminEmail);
  } else {
    await prisma.teacher.create({
      data: {
        email: adminEmail,
        passwordHash: adminHash,
        role: "admin",
      },
    });
    console.log("Created admin teacher:", adminEmail);
  }

  // Teacher with role "teacher"
  const teacherEmail = "teacher@example.com";
  const teacherPassword = "teacher123";
  const teacherHash = await bcrypt.hash(teacherPassword, 10);

  const existingTeacher = await prisma.teacher.findUnique({
    where: { email: teacherEmail },
  });

  if (existingTeacher) {
    await prisma.teacher.update({
      where: { email: teacherEmail },
      data: { passwordHash: teacherHash, role: "teacher" },
    });
    console.log("Updated teacher:", teacherEmail);
  } else {
    await prisma.teacher.create({
      data: {
        email: teacherEmail,
        passwordHash: teacherHash,
        role: "teacher",
      },
    });
    console.log("Created teacher:", teacherEmail, "(password: teacher123)");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
