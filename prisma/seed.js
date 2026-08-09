/* eslint-disable @typescript-eslint/no-require-imports */
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

const BUILTIN_PHRASES = [
  // Hindi
  { id: 'hi-chalo', text: 'चलो!', language: 'hi', category: 'GREETING', icon: '🇮🇳', sortOrder: 0, isActive: true },
  { id: 'hi-wah', text: 'अरे वाह!', language: 'hi', category: 'REACTION', icon: '🇮🇳', sortOrder: 1, isActive: true },
  { id: 'hi-kya-chal', text: 'क्या चाल चली!', language: 'hi', category: 'REACTION', icon: '🇮🇳', sortOrder: 2, isActive: true },
  { id: 'hi-ruko', text: 'रुको!', language: 'hi', category: 'REACTION', icon: '🇮🇳', sortOrder: 3, isActive: true },
  { id: 'hi-bach', text: 'बच गया!', language: 'hi', category: 'REACTION', icon: '🇮🇳', sortOrder: 4, isActive: true },
  { id: 'hi-badhiya', text: 'बहुत बढ़िया!', language: 'hi', category: 'CELEBRATION', icon: '🇮🇳', sortOrder: 5, isActive: true },
  { id: 'hi-yar', text: 'अरे यार!', language: 'hi', category: 'FUN', icon: '🇮🇳', sortOrder: 6, isActive: true },
  { id: 'hi-jeet', text: 'जीत गया!', language: 'hi', category: 'VICTORY', icon: '🏆', sortOrder: 7, isActive: true },
  { id: 'hi-chal-bhai', text: 'चल भाई!', language: 'hi', category: 'GREETING', icon: '🇮🇳', sortOrder: 8, isActive: true },
  { id: 'hi-shabash', text: 'शाबाश!', language: 'hi', category: 'CELEBRATION', icon: '🇮🇳', sortOrder: 9, isActive: true },
  { id: 'hi-kya-baat', text: 'क्या बात है!', language: 'hi', category: 'CELEBRATION', icon: '🎉', sortOrder: 10, isActive: true },
  { id: 'hi-ek-aur', text: 'एक और!', language: 'hi', category: 'FUN', icon: '🇮🇳', sortOrder: 11, isActive: true },
  { id: 'hi-acchi-chal', text: 'अच्छी चाल!', language: 'hi', category: 'SPORTSMANSHIP', icon: '👏', sortOrder: 12, isActive: true },
  { id: 'hi-oho', text: 'ओहो!', language: 'hi', category: 'REACTION', icon: '🇮🇳', sortOrder: 13, isActive: true },
  { id: 'hi-kya', text: 'क्या हुआ?', language: 'hi', category: 'REACTION', icon: '🤔', sortOrder: 14, isActive: true },
  { id: 'hi-pakda', text: 'पकड़ लिया!', language: 'hi', category: 'CAPTURE', icon: '🎯', sortOrder: 15, isActive: true },
  { id: 'hi-dekh', text: 'देख लेंगे!', language: 'hi', category: 'ATTACK', icon: '😏', sortOrder: 16, isActive: true },
  { id: 'hi-gg-hi', text: 'GG!', language: 'hi', category: 'SPORTSMANSHIP', icon: '👍', sortOrder: 17, isActive: true },

  // English
  { id: 'en-nice', text: 'Nice!', language: 'en', category: 'REACTION', icon: '🇬🇧', sortOrder: 30, isActive: true },
  { id: 'en-good', text: 'Good move!', language: 'en', category: 'SPORTSMANSHIP', icon: '🇬🇧', sortOrder: 31, isActive: true },
  { id: 'en-oops', text: 'Oops!', language: 'en', category: 'REACTION', icon: '🇬🇧', sortOrder: 32, isActive: true },
  { id: 'en-lgo', text: "Let's go!", language: 'en', category: 'GREETING', icon: '🇬🇧', sortOrder: 33, isActive: true },
  { id: 'en-gg', text: 'GG!', language: 'en', category: 'SPORTSMANSHIP', icon: '🇬🇧', sortOrder: 34, isActive: true },
  { id: 'en-wow', text: 'Wow!', language: 'en', category: 'REACTION', icon: '🇬🇧', sortOrder: 35, isActive: true },
];

async function main() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const email = (process.env.ADMIN_EMAIL || 'vixalyze.contact@gmail.com').trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    if (existing.passwordHash && verifyPassword(password, existing.passwordHash)) {
      console.log(`[seed] Admin "${username}" already exists with expected password.`);
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
  } else {
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

  const phraseCount = await prisma.voicePhrase.count();
  if (phraseCount === 0) {
    console.log('[seed] Seeding initial admin voice phrases...');
    for (const p of BUILTIN_PHRASES) {
      await prisma.voicePhrase.upsert({
        where: { id: p.id },
        update: {},
        create: p,
      });
    }
    console.log(`[seed] Seeded ${BUILTIN_PHRASES.length} admin voice phrases into database.`);
  }
}

main()
  .catch((e) => {
    console.error('[seed] Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

