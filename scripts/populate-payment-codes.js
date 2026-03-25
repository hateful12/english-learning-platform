const { PrismaClient } = require('../node_modules/@prisma/client');
const { randomUUID } = require('crypto');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({ where: { paymentCode: null } });
  console.log('Students without paymentCode:', students.length);
  for (const s of students) {
    const code = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    await prisma.student.update({ where: { id: s.id }, data: { paymentCode: code } });
    console.log('Updated', s.email, '->', code);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
