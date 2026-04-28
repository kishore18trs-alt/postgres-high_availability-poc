const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing CRUD through PgBouncer...\n');

  const user = await prisma.user.create({
    data: { email: 'test@fusion.com', name: 'Fusion Test' },
  });
  console.log('✅ CREATE:', user);

  const all = await prisma.user.findMany();
  console.log('✅ READ:', all);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: 'Fusion Updated' },
  });
  console.log('✅ UPDATE:', updated);

  const deleted = await prisma.user.delete({ where: { id: user.id } });
  console.log('✅ DELETE:', deleted);

  console.log('\n🎉 All CRUD operations succeeded through PgBouncer!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());