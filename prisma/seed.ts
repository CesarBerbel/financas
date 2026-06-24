import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.currency.upsert({ where: { code: 'BRL' }, update: {}, create: { code: 'BRL', name: 'Real brasileiro', symbol: 'R$' } });
  await prisma.currency.upsert({ where: { code: 'EUR' }, update: {}, create: { code: 'EUR', name: 'Euro', symbol: '€' } });
}

main().finally(async () => prisma.$disconnect());
