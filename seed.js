const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing users and resetting ID counter...');
  await prisma.user.deleteMany({});
  await prisma.$executeRawUnsafe('ALTER SEQUENCE "User_id_seq" RESTART WITH 1;');
  
  console.log('Seeding 10,000 users...');
  const start = Date.now();
  
  const batchSize = 1000;
  for (let i = 0; i < 10; i++) {
    const batch = [];
    for (let j = 0; j < batchSize; j++) {
      const idx = i * batchSize + j;
      batch.push({ email: `user${idx}@fusion.com`, name: `User ${idx}` });
    }
    await prisma.user.createMany({ data: batch, skipDuplicates: true });
    console.log(`  Inserted ${(i + 1) * batchSize} / 10000`);
  }
  
  const stats = await prisma.user.aggregate({
    _min: { id: true },
    _max: { id: true },
    _count: true,
  });
  console.log(`✅ Seed complete in ${(Date.now() - start) / 1000}s`);
  console.log(`   Total users: ${stats._count}, ID range: ${stats._min.id} – ${stats._max.id}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());