const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      passwordHash,
      fullName: 'Admin',
      role: 'admin',
      isActive: true,
    },
    create: {
      email: 'admin@example.com',
      passwordHash,
      fullName: 'Admin',
      role: 'admin',
      isActive: true,
    },
  });

  console.log('Seed OK: admin@example.com / admin123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
