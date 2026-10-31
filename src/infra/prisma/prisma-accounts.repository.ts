// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { AccountsRepository } from '../../core/identity/repositories/accounts.repository.ts';
import type {
  Account,
  AccountRecord,
  GoogleLinkResult,
  PasswordCredential,
  SignInLockout,
} from '../../core/identity/types/account.ts';
import type { Account as AccountRow } from './generated/client.ts';
import { PersonalDataCipher } from './personal-data-cipher.ts';
import { PrismaService } from './prisma.service.ts';
import { violatedIndex } from './violated-index.ts';

@Injectable()
export class PrismaAccountsRepository implements AccountsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: PersonalDataCipher,
  ) {}

  async findById(accountId: string): Promise<Account | undefined> {
    return this.toAccount(await this.prisma.account.findUnique({ where: { id: accountId } }));
  }

  async findByPhone(phone: string): Promise<Account | undefined> {
    return this.toAccount(await this.prisma.account.findUnique({ where: { contactHash: this.cipher.hash(phone) } }));
  }

  async findPasswordCredential(phone: string): Promise<PasswordCredential | undefined> {
    const account = await this.prisma.account.findUnique({
      where: { contactHash: this.cipher.hash(phone) },
      include: { authMethods: { where: { type: 'password' } } },
    });
    const [password] = account?.authMethods ?? [];
    if (!account || !password) {
      return undefined;
    }
    return { accountId: account.id, role: account.role, status: account.status, passwordHash: password.secret };
  }

  async create({ phone, role, status, dateOfBirth }: AccountRecord): Promise<Account> {
    const account = await this.prisma.account.create({
      data: {
        contactIdentifier: phone === null ? null : this.cipher.encrypt(phone),
        contactHash: phone === null ? null : this.cipher.hash(phone),
        dateOfBirth: dateOfBirth === null ? null : this.cipher.encrypt(dateOfBirth),
        role,
        status,
      },
    });
    return { id: account.id, phone, role, status, dateOfBirth };
  }

  async createWithGoogle(subject: string): Promise<Account> {
    try {
      const account = await this.prisma.account.create({
        data: { role: 'user', status: 'pending', authMethods: { create: { type: 'google', secret: subject } } },
      });
      return { id: account.id, phone: null, role: account.role, status: account.status, dateOfBirth: null };
    } catch (error) {
      const existing =
        violatedIndex(error) === 'auth_methods_type_secret_key' ? await this.findByGoogleSubject(subject) : undefined;
      if (!existing) {
        throw error;
      }
      return existing;
    }
  }

  async activate(accountId: string, dateOfBirth: string): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId },
      data: { dateOfBirth: this.cipher.encrypt(dateOfBirth), status: 'active' },
    });
  }

  async delete(accountId: string): Promise<void> {
    await this.prisma.account.deleteMany({ where: { id: accountId } });
  }

  async findPasswordHash(accountId: string): Promise<string | undefined> {
    return (await this.findAuthMethod(accountId, 'password'))?.secret;
  }

  async setPasswordHash(accountId: string, passwordHash: string): Promise<void> {
    await this.prisma.authMethod.upsert({
      where: { accountId_type: { accountId, type: 'password' } },
      create: { accountId, type: 'password', secret: passwordHash },
      update: { secret: passwordHash },
    });
  }

  async findByGoogleSubject(subject: string): Promise<Account | undefined> {
    const method = await this.prisma.authMethod.findUnique({
      where: { type_secret: { type: 'google', secret: subject } },
      include: { account: true },
    });
    return this.toAccount(method?.account);
  }

  async findGoogleSubject(accountId: string): Promise<string | undefined> {
    return (await this.findAuthMethod(accountId, 'google'))?.secret;
  }

  // AuthService checks both rules first; the unique indexes stop two requests that pass the checks together.
  async linkGoogle(accountId: string, subject: string): Promise<GoogleLinkResult> {
    try {
      await this.prisma.authMethod.create({ data: { accountId, type: 'google', secret: subject } });
      return 'linked';
    } catch (error) {
      const index = violatedIndex(error);
      if (index === 'auth_methods_type_secret_key') {
        return 'subject-taken';
      }
      if (index === 'auth_methods_account_id_type_key') {
        return 'account-has-google';
      }
      throw error;
    }
  }

  async updateLockout(accountId: string, change: (lockout: SignInLockout) => SignInLockout): Promise<SignInLockout> {
    return this.prisma.$transaction(async (tx) => {
      // Locks the row until the transaction ends, so concurrent sign-ins apply their changes one after another.
      await tx.$queryRaw`SELECT 1 FROM accounts WHERE id = ${accountId}::uuid FOR UPDATE`;
      const current = await tx.account.findUniqueOrThrow({
        where: { id: accountId },
        select: { failedSignins: true, failedSigninsSince: true, lockedUntil: true },
      });
      const next = change(current);
      await tx.account.update({ where: { id: accountId }, data: next });
      return next;
    });
  }

  async findDateOfBirth(accountId: string): Promise<string | undefined> {
    return (await this.findById(accountId))?.dateOfBirth ?? undefined;
  }

  private findAuthMethod(accountId: string, type: 'password' | 'google') {
    return this.prisma.authMethod.findUnique({ where: { accountId_type: { accountId, type } } });
  }

  private toAccount(row: AccountRow | null | undefined): Account | undefined {
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      phone: row.contactIdentifier === null ? null : this.cipher.decrypt(row.contactIdentifier),
      role: row.role,
      status: row.status,
      dateOfBirth: row.dateOfBirth === null ? null : this.cipher.decrypt(row.dateOfBirth),
    };
  }
}
