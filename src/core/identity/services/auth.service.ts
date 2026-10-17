// Written with the help of Claude
import { randomInt, randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import { kyivDate } from '../../common/kyiv-time.ts';
import { NotificationsService } from '../../notifications/services/notifications.service.ts';
import { AccessTokens } from '../adapters/access-tokens.ts';
import { CodeHasher } from '../adapters/code-hasher.ts';
import { GoogleIdTokens } from '../adapters/google-id-tokens.ts';
import { PasswordHasher } from '../adapters/password-hasher.ts';
import { AccountsRepository } from '../repositories/accounts.repository.ts';
import { VerificationCodesRepository } from '../repositories/verification-codes.repository.ts';
import { afterFailedSignIn, isLocked, NO_LOCKOUT } from './sign-in-lockout.ts';
import type { AccessToken, PasswordReset, Registration } from '../types/auth.ts';
import type { Caller } from '../types/caller.ts';
import type { CodePurpose } from '../types/verification-code.ts';

const ACCESS_TOKEN_SECONDS = 60 * 60; // SEC-005
// SEC-008
const CODE_DIGITS = 6;
const CODE_LIFETIME_MS = 10 * 60 * 1000;
const CODE_RESEND_INTERVAL_MS = 60 * 1000;
const MAX_FAILED_ATTEMPTS = 3;
const MINIMUM_AGE = 18; // SAFE-001

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private dummyPasswordHash!: string;

  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly verificationCodesRepository: VerificationCodesRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly codeHasher: CodeHasher,
    private readonly accessTokens: AccessTokens,
    private readonly googleIdTokens: GoogleIdTokens,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await this.passwordHasher.hash(randomUUID());
  }

  /** Answers the same whether or not the phone already has an account (SEC-007). */
  async register(phone: string): Promise<void> {
    const now = new Date();
    if (!(await this.canSendCode(phone, now))) {
      throw new DomainError('CODE_RESEND_TOO_SOON', 'A code was sent less than a minute ago. Wait, then try again');
    }
    await this.sendCode(phone, 'registration', now);
  }

  async verify({ phone, code, dateOfBirth }: Registration): Promise<AccessToken> {
    const now = new Date();
    // Used before the age check, so one code cannot try several dates of birth.
    await this.useCode(phone, 'registration', code, now);
    if (!isAtLeast(MINIMUM_AGE, dateOfBirth, now)) {
      throw new DomainError('UNDERAGE', `You must be at least ${MINIMUM_AGE} to use Nearby`);
    }
    if (await this.accountsRepository.existsByPhone(phone)) {
      throw new DomainError('CONFLICT', 'This phone number is already registered. Sign in instead');
    }
    const account = await this.accountsRepository.create({ phone, role: 'user', status: 'active', dateOfBirth });
    return this.issue({ kind: 'account', accountId: account.id, role: account.role, sessionId: randomUUID() });
  }

  /** The current password is required only once the account has one. */
  async setPassword(accountId: string, password: string, currentPassword?: string): Promise<void> {
    const currentHash = await this.accountsRepository.findPasswordHash(accountId);
    if (currentHash && !(currentPassword && (await this.passwordHasher.verify(currentHash, currentPassword)))) {
      throw new DomainError('WRONG_PASSWORD', 'The current password is missing or wrong. Enter it to set a new one');
    }
    await this.accountsRepository.setPasswordHash(accountId, await this.passwordHasher.hash(password));
  }

  /**
   * Sends a reset code only to an active account, but returns the same way for any phone and without waiting
   * for the provider, so neither the answer nor its timing reveals an account (SEC-007).
   */
  async requestPasswordReset(phone: string): Promise<void> {
    const now = new Date();
    const account = await this.accountsRepository.findByPhone(phone);
    if (account?.status !== 'active' || !(await this.canSendCode(phone, now))) {
      return;
    }
    this.sendCode(phone, 'reset', now).catch((error: unknown) => {
      this.logger.error('A password reset code could not be sent', error instanceof Error ? error.stack : error);
    });
  }

  async resetPassword({ phone, code, password }: PasswordReset): Promise<AccessToken> {
    const now = new Date();
    await this.useCode(phone, 'reset', code, now);
    const account = await this.accountsRepository.findByPhone(phone);
    if (account?.status !== 'active') {
      throw invalidCode();
    }
    await this.accountsRepository.setPasswordHash(account.id, await this.passwordHasher.hash(password));
    await this.accountsRepository.saveLockout(account.id, NO_LOCKOUT);
    return this.issue({ kind: 'account', accountId: account.id, role: account.role, sessionId: randomUUID() });
  }

  async signIn(phone: string, password: string): Promise<AccessToken> {
    const credential = await this.accountsRepository.findPasswordCredential(phone);
    // An unknown phone still costs one hash, so the response time does not reveal it (SEC-007).
    const passwordMatches = await this.passwordHasher.verify(
      credential?.passwordHash ?? this.dummyPasswordHash,
      password,
    );
    if (!credential || credential.status !== 'active') {
      throw invalidCredentials();
    }
    // A locked account answers like a wrong password, so a lock does not reveal the account (SEC-007).
    const now = new Date();
    if (isLocked(credential.lockout, now)) {
      throw invalidCredentials();
    }
    if (!passwordMatches) {
      await this.accountsRepository.saveLockout(credential.accountId, afterFailedSignIn(credential.lockout, now));
      throw invalidCredentials();
    }
    if (credential.lockout.failedSignins > 0) {
      await this.accountsRepository.saveLockout(credential.accountId, NO_LOCKOUT);
    }
    return this.issue({
      kind: 'account',
      accountId: credential.accountId,
      role: credential.role,
      sessionId: randomUUID(),
    });
  }

  /** Only an account that linked this Google account signs in; the password lockout does not apply (TM-09). */
  async signInWithGoogle(idToken: string): Promise<AccessToken> {
    const subject = await this.googleIdTokens.verify(idToken);
    const account = subject === undefined ? undefined : await this.accountsRepository.findByGoogleSubject(subject);
    if (account?.status !== 'active') {
      throw new DomainError(
        'INVALID_CREDENTIALS',
        'This Google account is not linked to Nearby. Sign in with your phone number, then link it',
      );
    }
    return this.issue({ kind: 'account', accountId: account.id, role: account.role, sessionId: randomUUID() });
  }

  /** Only from a signed-in session, never by matching email (TM-12). Linking the same Google account again is a no-op. */
  async linkGoogle(accountId: string, idToken: string): Promise<void> {
    const subject = await this.googleIdTokens.verify(idToken);
    if (subject === undefined) {
      throw new DomainError('INVALID_GOOGLE_TOKEN', 'Google sign-in did not go through. Try again');
    }
    const owner = await this.accountsRepository.findByGoogleSubject(subject);
    if (owner?.id === accountId) {
      return;
    }
    if (owner) {
      throw new DomainError('GOOGLE_ACCOUNT_TAKEN', 'This Google account is linked to another Nearby account');
    }
    if ((await this.accountsRepository.findGoogleSubject(accountId)) !== undefined) {
      throw new DomainError('GOOGLE_ALREADY_LINKED', 'Your account already has a Google account linked');
    }
    await this.accountsRepository.linkGoogle(accountId, subject);
  }

  async issueGuestToken(): Promise<AccessToken> {
    return this.issue({ kind: 'guest', guestId: randomUUID() });
  }

  async authenticate(accessToken: string): Promise<Caller | undefined> {
    return this.accessTokens.verify(accessToken);
  }

  private async canSendCode(phone: string, now: Date): Promise<boolean> {
    const lastSentAt = await this.verificationCodesRepository.findLastSentAt(phone);
    return !lastSentAt || now.getTime() - lastSentAt.getTime() >= CODE_RESEND_INTERVAL_MS;
  }

  /** Stored only once sent, with the channel it went through. */
  private async sendCode(phone: string, purpose: CodePurpose, now: Date): Promise<void> {
    const code = randomInt(0, 10 ** CODE_DIGITS)
      .toString()
      .padStart(CODE_DIGITS, '0');
    const delivery = await this.notificationsService.sendCode(phone, code);
    await this.verificationCodesRepository.create({
      phone,
      purpose,
      codeHash: this.codeHasher.hash(phone, code),
      ...delivery,
      sentAt: now,
      expiresAt: new Date(now.getTime() + CODE_LIFETIME_MS),
    });
  }

  /** Throws INVALID_CODE unless the code is the latest for this purpose and still usable (SEC-008). */
  private async useCode(phone: string, purpose: CodePurpose, code: string, now: Date): Promise<void> {
    const sent = await this.verificationCodesRepository.findLatest(phone, purpose);
    if (!sent || sent.usedAt || sent.expiresAt <= now || sent.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      throw invalidCode();
    }
    if (!this.codeHasher.matches(phone, code, sent.codeHash)) {
      await this.verificationCodesRepository.addFailedAttempt(sent.id);
      throw invalidCode();
    }
    if (!(await this.verificationCodesRepository.markUsed(sent.id, now))) {
      throw invalidCode();
    }
  }

  private async issue(caller: Caller): Promise<AccessToken> {
    const accessToken = await this.accessTokens.issue(caller, ACCESS_TOKEN_SECONDS);
    return { accessToken, expiresIn: ACCESS_TOKEN_SECONDS };
  }
}

function invalidCredentials(): DomainError {
  return new DomainError('INVALID_CREDENTIALS', 'Wrong phone number or password');
}

function invalidCode(): DomainError {
  return new DomainError('INVALID_CODE', 'The code is wrong, expired or already used. Check it or request a new one');
}

/** Compares Kyiv dates, so the age changes at midnight in Kyiv; a 29 February birthday counts from 1 March. */
function isAtLeast(age: number, dateOfBirth: string, now: Date): boolean {
  const birthday = `${Number(dateOfBirth.slice(0, 4)) + age}${dateOfBirth.slice(4)}`;
  return kyivDate(now) >= birthday;
}
