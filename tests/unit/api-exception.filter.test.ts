// Written with the help of Claude
import assert from 'node:assert/strict';
import { afterEach, describe, mock, test } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Logger,
  MethodNotAllowedException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
  type ArgumentsHost,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';
import { ApiExceptionFilter } from '../../dist/api/common/api-exception.filter.js';
import { ApiException } from '../../dist/api/common/api-exception.js';
import { DomainError, type DomainErrorCode } from '../../dist/core/common/domain-error.js';
import type { ErrorCode, ErrorResponse, ValidationIssue } from '../../src/api/common/schemas/errors.ts';

const UNEXPECTED_MESSAGE = 'Something went wrong';

afterEach(() => {
  mock.restoreAll();
});

/** The body the filter hands to the adapter; `details` is a key with no value when there is none. */
function anError(code: ErrorCode, message: string, details?: ValidationIssue[]): ErrorResponse {
  return { error: { code, message, details } };
}

/** Runs the filter against a fake HTTP adapter and returns the one reply it wrote and what it logged. */
function runFilter(exception: unknown) {
  const logError = mock.method(Logger.prototype, 'error', () => {});
  const response = { id: 'the response of the request' };
  const replies: { response: unknown; body: ErrorResponse; status: number }[] = [];
  const adapterHost = {
    httpAdapter: {
      reply: (target: unknown, body: ErrorResponse, status: number) => {
        replies.push({ response: target, body, status });
      },
    },
  } as unknown as HttpAdapterHost;
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;

  new ApiExceptionFilter(adapterHost).catch(exception, host);

  assert.equal(replies.length, 1);
  const [reply] = replies;
  assert.ok(reply);
  assert.equal(reply.response, response);
  return { status: reply.status, body: reply.body, logged: logError.mock.calls.map((call) => call.arguments) };
}

describe('ApiExceptionFilter', () => {
  describe('ApiException', () => {
    const statusByCode: { code: ErrorCode; status: number }[] = [
      { code: 'VALIDATION_ERROR', status: 400 },
      { code: 'UNAUTHENTICATED', status: 401 },
      { code: 'NOT_FOUND', status: 404 },
      { code: 'CONFLICT', status: 409 },
      { code: 'PAYLOAD_TOO_LARGE', status: 413 },
      { code: 'ORGANIZATION_NOT_VERIFIED', status: 422 },
      { code: 'RATE_LIMITED', status: 429 },
      { code: 'PHONE_CODES_UNAVAILABLE', status: 503 },
    ];

    for (const { code, status } of statusByCode) {
      test(`answers ${code} with ${status} and its own message`, () => {
        const reply = runFilter(new ApiException(code, 'A message of its own'));

        assert.deepEqual(reply, { status, body: anError(code, 'A message of its own'), logged: [] });
      });
    }

    test('passes its details on', () => {
      const details: ValidationIssue[] = [
        { location: 'query', field: 'from', message: 'Invalid date' },
        { location: 'params', field: 'id', message: 'Invalid UUID' },
      ];

      const reply = runFilter(new ApiException('VALIDATION_ERROR', 'The request is invalid', details));

      assert.deepEqual(reply, {
        status: 400,
        body: anError('VALIDATION_ERROR', 'The request is invalid', details),
        logged: [],
      });
    });

    test('keeps the message and logs nothing when it stands for INTERNAL_ERROR', () => {
      const reply = runFilter(new ApiException('INTERNAL_ERROR', 'Raised on purpose'));

      assert.deepEqual(reply, { status: 500, body: anError('INTERNAL_ERROR', 'Raised on purpose'), logged: [] });
    });
  });

  describe('DomainError', () => {
    const statusByCode: { code: DomainErrorCode; status: number }[] = [
      { code: 'INVALID_CREDENTIALS', status: 401 },
      { code: 'NOT_FOUND', status: 404 },
      { code: 'CONFLICT', status: 409 },
      { code: 'UNDERAGE', status: 422 },
      { code: 'PHONE_CODES_UNAVAILABLE', status: 503 },
    ];

    for (const { code, status } of statusByCode) {
      test(`answers ${code} with ${status} and no details`, () => {
        const reply = runFilter(new DomainError(code, 'The rule says no'));

        assert.deepEqual(reply, { status, body: anError(code, 'The rule says no'), logged: [] });
      });
    }

    test('leaves details out of the JSON when the error names no field', () => {
      const { body } = runFilter(new DomainError('CONFLICT', 'The rule says no'));

      assert.equal(JSON.stringify(body), '{"error":{"code":"CONFLICT","message":"The rule says no"}}');
    });

    test('points details at the body field it names, with the message of the error', () => {
      const reply = runFilter(
        new DomainError('INVALID_SOCIAL_HANDLE', 'This is not a valid handle', 'linkedAccounts.1.username'),
      );

      assert.deepEqual(reply, {
        status: 422,
        body: anError('INVALID_SOCIAL_HANDLE', 'This is not a valid handle', [
          { location: 'body', field: 'linkedAccounts.1.username', message: 'This is not a valid handle' },
        ]),
        logged: [],
      });
    });

    // Odd: an empty field name is falsy, so the error is treated as naming no field.
    test('gives no details for an empty field name', () => {
      const reply = runFilter(new DomainError('UNDERAGE', 'You must be 18', ''));

      assert.deepEqual(reply, { status: 422, body: anError('UNDERAGE', 'You must be 18'), logged: [] });
    });
  });

  describe('HttpException with a status in the table', () => {
    const tableCases: { status: number; code: ErrorCode; message: string }[] = [
      { status: 400, code: 'VALIDATION_ERROR', message: 'The request is invalid' },
      { status: 401, code: 'UNAUTHENTICATED', message: 'A valid access token is required' },
      { status: 404, code: 'NOT_FOUND', message: 'Not found' },
      { status: 409, code: 'CONFLICT', message: 'The request conflicts with the current state' },
      { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large' },
      { status: 429, code: 'RATE_LIMITED', message: 'Too many requests' },
    ];

    for (const { status, code, message } of tableCases) {
      test(`answers ${status} with ${code} and our message instead of Nest's`, () => {
        const reply = runFilter(new HttpException("Nest's own message", status));

        assert.deepEqual(reply, { status, body: anError(code, message), logged: [] });
      });
    }

    test('replaces the router message that names the path', () => {
      const { body } = runFilter(new NotFoundException('Cannot GET /api/v1/nowhere'));

      assert.equal(body.error.message, 'Not found');
    });

    const subclassCases = [
      { title: 'BadRequestException', exception: new BadRequestException(), status: 400, code: 'VALIDATION_ERROR' },
      { title: 'UnauthorizedException', exception: new UnauthorizedException(), status: 401, code: 'UNAUTHENTICATED' },
      { title: 'NotFoundException', exception: new NotFoundException(), status: 404, code: 'NOT_FOUND' },
      { title: 'ConflictException', exception: new ConflictException(), status: 409, code: 'CONFLICT' },
      {
        title: 'PayloadTooLargeException',
        exception: new PayloadTooLargeException(),
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
      },
      { title: 'ThrottlerException', exception: new ThrottlerException(), status: 429, code: 'RATE_LIMITED' },
    ] as const;

    for (const { title, exception, status, code } of subclassCases) {
      test(`maps ${title} like its status`, () => {
        const reply = runFilter(exception);

        assert.equal(reply.status, status);
        assert.equal(reply.body.error.code, code);
        assert.deepEqual(reply.logged, []);
      });
    }
  });

  // SEC-001: the API never answers 403, so it does not reveal that a resource exists (api-design.md, No 403).
  describe('HttpException with status 403', () => {
    const forbiddenCases = [
      { title: 'a plain HttpException', exception: new HttpException('Forbidden', 403) },
      { title: 'a ForbiddenException', exception: new ForbiddenException() },
      {
        title: 'the ForbiddenException of a guard that returns false',
        exception: new ForbiddenException('Forbidden resource'),
      },
    ];

    for (const { title, exception } of forbiddenCases) {
      test(`answers ${title} with 404 NOT_FOUND`, () => {
        const reply = runFilter(exception);

        assert.deepEqual(reply, { status: 404, body: anError('NOT_FOUND', 'Not found'), logged: [] });
      });
    }
  });

  // Odd: only the statuses of the table are mapped; any other Nest status is reported as a server error.
  describe('HttpException with a status outside the table', () => {
    const outsideCases = [
      { title: '405 from MethodNotAllowedException', exception: new MethodNotAllowedException() },
      { title: '418 from a plain HttpException', exception: new HttpException('I am a teapot', 418) },
      { title: '422 from UnprocessableEntityException', exception: new UnprocessableEntityException() },
      { title: '500 from a plain HttpException', exception: new HttpException('Broken', 500) },
      { title: '503 from ServiceUnavailableException', exception: new ServiceUnavailableException() },
    ];

    for (const { title, exception } of outsideCases) {
      test(`answers ${title} with 500 INTERNAL_ERROR and logs it`, () => {
        const reply = runFilter(exception);

        assert.deepEqual(reply, {
          status: 500,
          body: anError('INTERNAL_ERROR', UNEXPECTED_MESSAGE),
          logged: [[exception.message, exception.stack]],
        });
      });
    }
  });

  describe('anything else', () => {
    const errorCases = [
      { title: 'an Error', error: new Error('database is down') },
      { title: 'a TypeError', error: new TypeError('x is not a function') },
    ];

    for (const { title, error } of errorCases) {
      test(`answers ${title} with 500 INTERNAL_ERROR and logs its message and stack`, () => {
        const reply = runFilter(error);

        assert.deepEqual(reply, {
          status: 500,
          body: anError('INTERNAL_ERROR', UNEXPECTED_MESSAGE),
          logged: [[error.message, error.stack]],
        });
      });
    }

    // Odd: only real Error instances are logged with a message and stack; an object that looks like one is not.
    const notErrorCases = [
      { title: 'a string', thrown: 'boom' },
      { title: 'a number', thrown: 42 },
      { title: 'null', thrown: null },
      { title: 'undefined', thrown: undefined },
      { title: 'an object that only looks like an Error', thrown: { message: 'looks like an error', stack: 'no' } },
    ];

    for (const { title, thrown } of notErrorCases) {
      test(`answers ${title} with 500 INTERNAL_ERROR and logs the value itself`, () => {
        const reply = runFilter(thrown);

        assert.deepEqual(reply, {
          status: 500,
          body: anError('INTERNAL_ERROR', UNEXPECTED_MESSAGE),
          logged: [[thrown]],
        });
      });
    }
  });
});
