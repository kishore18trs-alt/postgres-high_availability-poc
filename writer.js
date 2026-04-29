// writer.js
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

setInterval(async () => {
  try {
    const r = await db.user.create({
      data: {
        email: `test${Date.now()}@x.com`,
        name: 'test',
      },
    });
    console.log(new Date().toISOString(), 'WRITE OK', r.id);
  } catch (e) {
    console.log(new Date().toISOString(), 'WRITE FAIL');
  }
}, 1000);