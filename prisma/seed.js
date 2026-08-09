/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Admin account seeder.
 * Creates (or updates) the server-verified admin user used to sign in at /admin.
 *
 *   npm run db:seed
 *
 * Credentials come from env (with safe defaults):
 *   ADMIN_USERNAME   (default: admin)
 *   ADMIN_PASSWORD   (default: Admin@1234)
 *   ADMIN_EMAIL      (default: vixalyze.contact@gmail.com)
 *
 * The admin username must also be listed in ADMIN_USERNAMES (default "admin")
 * for the /admin APIs to accept the account.
 */
const { PrismaClient } = require('@prisma/client');
const { scryptSync, randomBytes, timingSafeEqual } = require('crypto');

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

async function main() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const email = (process.env.ADMIN_EMAIL || 'vixalyze.contact@gmail.com').trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    if (existing.passwordHash && verifyPassword(password, existing.passwordHash)) {
      console.log(`[seed] Admin "${username}" already exists with the expected password.`);
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash: hashPassword(password),
          email: email || existing.email,
          avatar: existing.avatar || '🦊',
        },
      });
      console.log(`[seed] Admin "${username}" password updated.`);
    }
    return;
  }

  await prisma.user.create({
    data: {
      username,
      displayName: 'Game Master',
      passwordHash: hashPassword(password),
      email: email || null,
      avatar: '🦊',
      characterId: 'red',
      level: 10,
      xp: 2500,
    },
  });
  console.log(`[seed] Admin account created: "${username}"`);
}

main()
  .catch((e) => {
    console.error('[seed] Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
