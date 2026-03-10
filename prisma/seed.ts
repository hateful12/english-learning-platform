import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "irenn.boiko@gmail.com";
  const plainPassword = "000Cinnamonbun";
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const existing = await prisma.teacher.findUnique({
    where: { email },
  });

  if (existing) {
    await prisma.teacher.update({
      where: { email },
      data: { passwordHash, role: "admin" },
    });
    console.log("Updated admin teacher:", email);
  } else {
    await prisma.teacher.create({
      data: {
        email,
        passwordHash,
        role: "admin",
      },
    });
    console.log("Created admin teacher:", email);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
