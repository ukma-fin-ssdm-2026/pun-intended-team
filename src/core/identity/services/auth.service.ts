// Written with the help of Claude
import { randomInt, randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ageOn } from '../../common/age.ts';
import { DomainError } from '../../common/domain-error.ts';
import { kyivDate } from '../../common/kyiv-time.ts';
import { NotificationsService } from '../../notifications/services/notifications.service.ts';
import { AccessTokens } from '../adapters/access-tokens.ts';
import { CodeHasher } from '../adapters/code-hasher.ts';
import { GoogleIdTokens } from '../adapters/google-id-tokens.ts';
import { PasswordHasher } from '../adapters/password-hasher.ts';
import { AccountsRepository } from '../repositories/accounts.repository.ts';
import { VerificationCodesRepository } from '../repositories/verification-codes.repository.ts';
import { ACCESS_TOKEN_SECONDS, SessionsService } from './sessions.service.ts';
import { afterSignIn, isLocked, NO_LOCKOUT } from './sign-in-lockout.ts';
import type { CodeDelivery } from '../../notifications/types/code-delivery.ts';
import type { AccessToken, PasswordReset, Registration, SessionTokens } from '../types/auth.ts';
import type { Caller } from '../types/caller.ts';
import type { CodePurpose } from '../types/verification-code.ts';

const REGISTRATION_TOKEN_SECONDS = 15 * 60;
// SEC-008
const CODE_DIGITS = 6;
const CODE_LIFETIME_MS = 10 * 60 * 1000;
const CODE_RESEND_INTERVAL_MS = 60 * 1000;
const CODES_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 3;
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
    private readonly sessionsService: SessionsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await this.passwordHasher.hash(randomUUID());
  }

  /**
   * Answers the same whether or not the phone has an account and whether or not it reached a code limit,
   * since reset codes to an account count towards them (SEC-007).
   */
  async register(phone: string): Promise<void> {
    await this.sendCode(phone, 'registration', new Date());
  }

  /** A phone that verified before but never finished registration continues with its pending account. */
  async verify({ phone, code }: Registration): Promise<AccessToken> {
    const now = new Date();
    await this.useCode(phone, 'registration', code, now);
    const existing = await this.accountsRepository.findByPhone(phone);
    if (existing && existing.status !== 'pending') {
      throw new DomainError('CONFLICT', 'This phone number is already registered. Sign in instead');
    }
    const account =
      existing ?? (await this.accountsRepository.create({ phone, role: 'user', status: 'pending', dateOfBirth: null }));
    return this.issue({ kind: 'registrant', accountId: account.id }, REGISTRATION_TOKEN_SECONDS);
  }

  /** An applicant under 18 is refused and the pending account removed, so the number can register again (SAFE-001). */
  async completeRegistration(accountId: string, dateOfBirth: string): Promise<SessionTokens> {
    const account = await this.accountsRepository.findById(accountId);
    if (!account) {
      throw new DomainError('NOT_FOUND', 'No registration in progress. Start again with your phone number');
    }
    if (account.status !== 'pending') {
      throw new DomainError('CONFLICT', 'Registration is already complete. Sign in instead');
    }
    if (ageOn(kyivDate(), dateOfBirth) < MINIMUM_AGE) {
      await this.accountsRepository.delete(accountId);
      throw new DomainError('UNDERAGE', `You must be at least ${MINIMUM_AGE} to use Nearby`);
    }
    await this.accountsRepository.activate(accountId, dateOfBirth);
    return this.sessionsService.start(accountId, account.role);
  }

  /**
   * The current password is required only once the account has one. A wrong one counts like a failed sign-in,
   * so a stolen session cannot be used to guess it (SEC-007). A new password ends every other session.
   */
  async setPassword(accountId: string, sessionId: string, password: string, currentPassword?: string): Promise<void> {
    const currentHash = await this.accountsRepository.findPasswordHash(accountId);
    if (currentHash) {
      if (currentPassword === undefined) {
        throw new DomainError('WRONG_PASSWORD', 'Enter your current password to set a new one');
      }
      const passwordMatches = await this.passwordHasher.verify(currentHash, currentPassword);
      if (!(await this.passesLockout(accountId, passwordMatches))) {
        throw new DomainError(
          'WRONG_PASSWORD',
          'The current password is wrong, or was entered wrong too many times. Wait 15 minutes or reset your password',
        );
      }
    }
    await this.accountsRepository.setPasswordHash(accountId, await this.passwordHasher.hash(password));
    await this.sessionsService.endAll(accountId, sessionId);
  }

  /**
   * Sends a reset code only to an active account, but returns the same way for any phone and without waiting
   * for the provider, so neither the answer nor its timing reveals an account (SEC-007).
   */
  async requestPasswordReset(phone: string): Promise<void> {
    const account = await this.accountsRepository.findByPhone(phone);
    if (account?.status !== 'active') {
      return;
    }
    this.sendCode(phone, 'reset', new Date()).catch((error: unknown) => {
      this.logger.error('A password reset code could not be sent', error instanceof Error ? error.stack : error);
    });
  }

  /** Ends every session, so whoever knew the old password is signed out (TM-01). */
  async resetPassword({ phone, code, password }: PasswordReset): Promise<SessionTokens> {
    const now = new Date();
    await this.useCode(phone, 'reset', code, now);
    const account = await this.accountsRepository.findByPhone(phone);
    if (account?.status !== 'active') {
      throw invalidCode();
    }
    await this.accountsRepository.setPasswordHash(account.id, await this.passwordHasher.hash(password));
    await this.accountsRepository.updateLockout(account.id, () => NO_LOCKOUT);
    await this.sessionsService.endAll(account.id);
    return this.sessionsService.start(account.id, account.role);
  }

  async signIn(phone: string, password: string): Promise<SessionTokens> {
    const credential = await this.accountsRepository.findPasswordCredential(phone);
    // An unknown phone still costs one hash, so the response time does not reveal it (SEC-007).
    const passwordMatches = await this.passwordHasher.verify(
      credential?.passwordHash ?? this.dummyPasswordHash,
      password,
    );
    // A locked account answers like a wrong password, so a lock does not reveal the account (SEC-007).
    if (
      !credential ||
      credential.status !== 'active' ||
      !(await this.passesLockout(credential.accountId, passwordMatches))
    ) {
      throw invalidCredentials();
    }
    return this.sessionsService.start(credential.accountId, credential.role);
  }

  /** Only an account that linked this Google account signs in; the password lockout does not apply (TM-09). */
  async signInWithGoogle(idToken: string): Promise<SessionTokens> {
    const subject = await this.googleIdTokens.verify(idToken);
    if (subject === undefined) {
      throw new DomainError('INVALID_CREDENTIALS', 'Google sign-in did not go through. Try again');
    }
    const account = await this.accountsRepository.findByGoogleSubject(subject);
    if (account?.status !== 'active') {
      throw new DomainError(
        'INVALID_CREDENTIALS',
        'This Google account is not linked to Nearby. Sign in with your phone number, then link it',
      );
    }
    return this.sessionsService.start(account.id, account.role);
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

  /** An account's token is valid only while its session is (SEC-005). */
  async authenticate(accessToken: string): Promise<Caller | undefined> {
    const caller = await this.accessTokens.verify(accessToken);
    if (caller?.kind === 'account' && !(await this.sessionsService.isActive(caller.sessionId, caller.accountId))) {
      return undefined;
    }
    return caller;
  }

  /**
   * Counts a password check on the stored lockout state, after the hash, so parallel guesses cannot get past the
   * lock (SEC-007). True only for the right password on an account that is not locked.
   */
  private async passesLockout(accountId: string, passwordMatches: boolean): Promise<boolean> {
    const now = new Date();
    const lockout = await this.accountsRepository.updateLockout(accountId, (state) =>
      afterSignIn(state, passwordMatches, now),
    );
    return passwordMatches && !isLocked(lockout, now);
  }

  /**
   * Sends nothing if a code of any purpose went to this phone less than a minute ago, or 5 in the last 24 hours
   * (SEC-008). The code is stored before it is sent, so a parallel request sees it, and removed if no channel takes it.
   */
  private async sendCode(phone: string, purpose: CodePurpose, now: Date): Promise<void> {
    const code = randomInt(0, 10 ** CODE_DIGITS)
      .toString()
      .padStart(CODE_DIGITS, '0');
    const stored = await this.verificationCodesRepository.createWithinLimit(
      {
        phone,
        purpose,
        codeHash: this.codeHasher.hash(phone, code),
        sentAt: now,
        expiresAt: new Date(now.getTime() + CODE_LIFETIME_MS),
      },
      {
        noneSentAfter: new Date(now.getTime() - CODE_RESEND_INTERVAL_MS),
        since: new Date(now.getTime() - DAY_MS),
        atMost: CODES_PER_DAY,
      },
    );
    if (!stored) {
      return;
    }
    let delivery: CodeDelivery;
    try {
      delivery = await this.notificationsService.sendCode(phone, code);
    } catch (error) {
      await this.verificationCodesRepository.delete(stored.id);
      throw error;
    }
    await this.verificationCodesRepository.saveDelivery(stored.id, delivery);
  }

  /** Throws INVALID_CODE unless the code is the latest for this purpose and still usable (SEC-008). */
  private async useCode(phone: string, purpose: CodePurpose, code: string, now: Date): Promise<void> {
    const sent = await this.verificationCodesRepository.findLatest(phone, purpose);
    if (!sent || sent.usedAt || sent.expiresAt <= now) {
      throw invalidCode();
    }
    // Counted before the comparison, so parallel guesses cannot get past the limit.
    const attempts = await this.verificationCodesRepository.addAttempt(sent.id);
    if (attempts > MAX_CODE_ATTEMPTS || !this.codeHasher.matches(phone, code, sent.codeHash)) {
      throw invalidCode();
    }
    if (!(await this.verificationCodesRepository.markUsed(sent.id, now))) {
      throw invalidCode();
    }
  }

  private async issue(caller: Caller, lifetimeSeconds = ACCESS_TOKEN_SECONDS): Promise<AccessToken> {
    const accessToken = await this.accessTokens.issue(caller, lifetimeSeconds);
    return { accessToken, expiresIn: lifetimeSeconds };
  }
}

function invalidCredentials(): DomainError {
  return new DomainError('INVALID_CREDENTIALS', 'Wrong phone number or password');
}

function invalidCode(): DomainError {
  return new DomainError('INVALID_CODE', 'The code is wrong, expired or already used. Check it or request a new one');
}
