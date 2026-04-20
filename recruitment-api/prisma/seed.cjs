const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('bogdanharpoonn', 10);

  await prisma.user.upsert({
    where: { email: 'bogdanharpoonn@gmail.com' },
    update: {
      passwordHash,
      fullName: 'Admin',
      role: 'admin',
      isActive: true,
    },
    create: {
      email: 'bogdanharpoonn@gmail.com',
      passwordHash,
      fullName: 'Admin',
      role: 'admin',
      isActive: true,
    },
  });

  console.log('Seed OK: bogdanharpoonn@gmail.com / bogdanharpoonn');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
