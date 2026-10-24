// Written with the help of Claude
// Creates or resets the development accounts (npm run db:seed). Not for production: they share a known password.
import { isProduction } from '../api/common/config.ts';
import { personalDataCipher } from '../infra/infra.module.ts';
import { PrismaService } from '../infra/prisma/prisma.service.ts';
import { accounts } from '../infra/stubs/data.ts';

/** Every account signs in with the password `nearby-dev-password`. The ids match the stubs in data.ts. */
const devAccounts = [
  {
    id: accounts.olena,
    phone: '+380501110001',
    role: 'user',
    dateOfBirth: '2001-04-12',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$LnG7K0R7BJ6TF1NOl/kiUA$OobkKSuS8xyXPey6bgtmsmsDwx3BMrZ/rUXrfCqlIAM',
  },
  {
    id: accounts.taras,
    phone: '+380501110002',
    role: 'user',
    dateOfBirth: '1998-11-03',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$oYWbgSv7qBSiEAktpWqTKw$7MS6NJ8lW91UtWCr1Th15mBnCNh7wF1lC0l/o3qWO9I',
  },
  {
    id: accounts.filmClub,
    phone: '+380501110003',
    role: 'user',
    dateOfBirth: '1990-06-21',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$mbsR20JBtHrDaHifqHOiPg$rtm+NwVRQqNJrn0W7iwtXK4qWmp+scuJjig6IDoWW2c',
  },
  {
    id: accounts.newGallery,
    phone: '+380501110004',
    role: 'user',
    dateOfBirth: '1995-02-08',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$DYsNhEfFW/Et/WHp53hi3A$9dMgfT/ns9lcZkWOrCnjCnIX8Ko/Bej6VWdMvojgjQQ',
  },
  {
    id: accounts.admin,
    phone: '+380501110005',
    role: 'admin',
    dateOfBirth: '1988-09-15',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$q/i5tKWroyaTrMl2KrIbqw$p3fWgp18FPlZRLMH11s+ska1YYY3M8i1Sm1pPsqQTaw',
  },
] as const;

if (isProduction) {
  throw new Error('db:seed creates accounts with a known password; it does not run with NODE_ENV=production');
}

const prisma = new PrismaService();
const cipher = personalDataCipher();
try {
  for (const { id, phone, role, dateOfBirth, passwordHash } of devAccounts) {
    // Written again on every run, so the phone is encrypted and hashed with the current keys.
    const account = {
      role,
      status: 'active',
      contactIdentifier: cipher.encrypt(phone),
      contactHash: cipher.hash(phone),
      dateOfBirth: cipher.encrypt(dateOfBirth),
      failedSignins: 0,
      failedSigninsSince: null,
      lockedUntil: null,
    } as const;
    await prisma.account.upsert({ where: { id }, create: { id, ...account }, update: account });
    await prisma.authMethod.upsert({
      where: { accountId_type: { accountId: id, type: 'password' } },
      create: { accountId: id, type: 'password', secret: passwordHash },
      update: { secret: passwordHash },
    });
  }
  console.log(`Seeded ${devAccounts.length} development accounts`);
} finally {
  await prisma.$disconnect();
}
