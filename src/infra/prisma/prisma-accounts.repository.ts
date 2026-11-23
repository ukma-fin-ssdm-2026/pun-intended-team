// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Page, PageRequest } from '../../core/common/page.ts';
import type { Transaction } from '../../core/common/transaction.ts';
import { AccountsRepository } from '../../core/identity/repositories/accounts.repository.ts';
import type {
  Account,
  AccountFilter,
  AccountOverview,
  AccountRecord,
  AccountStatus,
  GoogleLinkResult,
  PasswordCredential,
  SignInLockout,
} from '../../core/identity/types/account.ts';
import type { Account as AccountRow, Prisma } from './generated/client.ts';
import { PersonalDataCipher } from './personal-data-cipher.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';
import { violatedIndex } from './violated-index.ts';

const overviewInclude = {
  authMethods: { select: { type: true }, orderBy: { type: 'asc' } },
} satisfies Prisma.AccountInclude;

type OverviewRow = Prisma.AccountGetPayload<{ include: typeof overviewInclude }>;

@Injectable()
export class PrismaAccountsRepository implements AccountsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: PersonalDataCipher,
  ) {}

  async findById(accountId: string): Promise<Account | undefined> {
    return this.toAccount(await this.prisma.account.findUnique({ where: { id: accountId } }));
  }

  async findOverviews(
    { role, status, ids }: AccountFilter,
    { limit, offset }: PageRequest,
  ): Promise<Page<AccountOverview>> {
    const rows = await this.prisma.account.findMany({
      where: { role, status, id: ids && { in: ids } },
      include: overviewInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: offset,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map((row) => this.toOverview(row)),
      page: { limit, offset, hasMore: rows.length > limit },
    };
  }

  async findOverview(accountId: string): Promise<AccountOverview | undefined> {
    const row = await this.prisma.account.findUnique({ where: { id: accountId }, include: overviewInclude });
    return row ? this.toOverview(row) : undefined;
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

  async findDatesOfBirth(accountIds: string[], tx?: Transaction): Promise<Map<string, string>> {
    const rows = await clientOf(this.prisma, tx).account.findMany({
      where: { id: { in: accountIds }, dateOfBirth: { not: null } },
      select: { id: true, dateOfBirth: true },
    });
    return new Map(rows.map(({ id, dateOfBirth }) => [id, this.cipher.decrypt(dateOfBirth!)]));
  }

  async setStatus(accountId: string, status: AccountStatus): Promise<void> {
    await this.prisma.account.update({ where: { id: accountId }, data: { status } });
  }

  async countByStatus(status: AccountStatus): Promise<number> {
    return this.prisma.account.count({ where: { status } });
  }

  async findIdsWithStatus(accountIds: string[], status: AccountStatus, tx?: Transaction): Promise<string[]> {
    const rows = await clientOf(this.prisma, tx).account.findMany({
      where: { id: { in: accountIds }, status },
      select: { id: true },
    });
    return rows.map(({ id }) => id);
  }

  private findAuthMethod(accountId: string, type: 'password' | 'google') {
    return this.prisma.authMethod.findUnique({ where: { accountId_type: { accountId, type } } });
  }

  private toOverview(row: OverviewRow): AccountOverview {
    return {
      id: row.id,
      role: row.role,
      status: row.status,
      signInMethods: row.authMethods.map(({ type }) => type),
      dateOfBirth: row.dateOfBirth === null ? null : this.cipher.decrypt(row.dateOfBirth),
      createdAt: row.createdAt.toISOString(),
    };
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
