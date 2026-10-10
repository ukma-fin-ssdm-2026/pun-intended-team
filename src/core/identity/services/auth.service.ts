// Written with the help of Claude
import { randomInt, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import { kyivDate } from '../../common/kyiv-time.ts';
import { NotificationsService } from '../../notifications/services/notifications.service.ts';
import { AccessTokens } from '../adapters/access-tokens.ts';
import { CodeHasher } from '../adapters/code-hasher.ts';
import { PasswordHasher } from '../adapters/password-hasher.ts';
import { AccountsRepository } from '../repositories/accounts.repository.ts';
import { SessionsRepository } from '../repositories/sessions.repository.ts';
import { VerificationCodesRepository } from '../repositories/verification-codes.repository.ts';
import type { AccessToken, Registration } from '../types/auth.ts';
import type { Caller } from '../types/caller.ts';

const ACCESS_TOKEN_SECONDS = 60 * 60; // SEC-005
// SEC-008
const CODE_DIGITS = 6;
const CODE_LIFETIME_MS = 10 * 60 * 1000;
const CODE_RESEND_INTERVAL_MS = 60 * 1000;
const MAX_FAILED_ATTEMPTS = 3;
const MINIMUM_AGE = 18; // SAFE-001

@Injectable()
export class AuthService {
  private dummyPasswordHash: Promise<string> | undefined;

  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly verificationCodesRepository: VerificationCodesRepository,
    private readonly sessionsRepository: SessionsRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly codeHasher: CodeHasher,
    private readonly accessTokens: AccessTokens,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Answers the same whether or not the phone already has an account (SEC-007). */
  async register(phone: string): Promise<void> {
    const now = new Date();
    const latest = await this.verificationCodesRepository.findLatest(phone, 'registration');
    if (latest && now.getTime() - latest.sentAt.getTime() < CODE_RESEND_INTERVAL_MS) {
      throw new DomainError('CODE_RESEND_TOO_SOON', 'A code was sent less than a minute ago. Wait, then try again');
    }
    const code = randomInt(0, 10 ** CODE_DIGITS)
      .toString()
      .padStart(CODE_DIGITS, '0');
    await this.verificationCodesRepository.create({
      phone,
      purpose: 'registration',
      codeHash: this.codeHasher.hash(phone, code),
      sentAt: now,
      expiresAt: new Date(now.getTime() + CODE_LIFETIME_MS),
    });
    await this.notificationsService.sendCode(phone, code);
  }

  async verify({ phone, code, password, dateOfBirth }: Registration): Promise<AccessToken> {
    const now = new Date();
    const sent = await this.verificationCodesRepository.findLatest(phone, 'registration');
    if (!sent || sent.usedAt || sent.expiresAt <= now || sent.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      throw invalidCode();
    }
    if (!this.codeHasher.matches(phone, code, sent.codeHash)) {
      await this.verificationCodesRepository.addFailedAttempt(sent.id);
      throw invalidCode();
    }
    // Used before the age check, so one code cannot try several dates of birth.
    if (!(await this.verificationCodesRepository.markUsed(sent.id, now))) {
      throw invalidCode();
    }
    if (!isAtLeast(MINIMUM_AGE, dateOfBirth, now)) {
      throw new DomainError('UNDERAGE', `You must be at least ${MINIMUM_AGE} to use Nearby`);
    }
    if (await this.accountsRepository.existsByPhone(phone)) {
      throw new DomainError('CONFLICT', 'This phone number is already registered. Sign in instead');
    }
    const account = await this.accountsRepository.create(
      { phone, role: 'user', status: 'active', dateOfBirth },
      await this.passwordHasher.hash(password),
    );
    return this.issue({ kind: 'account', accountId: account.id, role: account.role, sessionId: randomUUID() });
  }

  async signIn(phone: string, password: string): Promise<AccessToken> {
    const credential = await this.accountsRepository.findPasswordCredential(phone);
    // An unknown phone still costs one hash, so the response time does not reveal it (SEC-007).
    const passwordMatches = await this.passwordHasher.verify(
      credential?.passwordHash ?? (await this.dummyHash()),
      password,
    );
    if (!credential || !passwordMatches || credential.status !== 'active') {
      throw new DomainError('INVALID_CREDENTIALS', 'Wrong phone number or password');
    }
    return this.issue({
      kind: 'account',
      accountId: credential.accountId,
      role: credential.role,
      sessionId: randomUUID(),
    });
  }

  async issueGuestToken(): Promise<AccessToken> {
    return this.issue({ kind: 'guest', guestId: randomUUID() });
  }

  // The stub tokens keep working until the e2e tests sign in for real.
  async authenticate(accessToken: string): Promise<Caller | undefined> {
    return (await this.accessTokens.verify(accessToken)) ?? this.sessionsRepository.findCaller(accessToken);
  }

  private async issue(caller: Caller): Promise<AccessToken> {
    const accessToken = await this.accessTokens.issue(caller, ACCESS_TOKEN_SECONDS);
    return { accessToken, expiresIn: ACCESS_TOKEN_SECONDS };
  }

  private dummyHash(): Promise<string> {
    this.dummyPasswordHash ??= this.passwordHasher.hash(randomUUID());
    return this.dummyPasswordHash;
  }
}

function invalidCode(): DomainError {
  return new DomainError('INVALID_CODE', 'The code is wrong, expired or already used. Check it or request a new one');
}

/** Compares Kyiv dates, so the age changes at midnight in Kyiv; a 29 February birthday counts from 1 March. */
function isAtLeast(age: number, dateOfBirth: string, now: Date): boolean {
  const birthday = `${Number(dateOfBirth.slice(0, 4)) + age}${dateOfBirth.slice(4)}`;
  return kyivDate(now) >= birthday;
}
