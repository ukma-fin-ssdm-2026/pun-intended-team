// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';

import { accountHome, accountKind } from '@/hooks/use-account-kind';

jest.mock('@/api/organizations', () => ({ getMyOrganization: jest.fn() }));

describe('accountKind', () => {
  test('is not known while the organization request loads', () => {
    expect(accountKind('admin', { loading: true, hasOrganization: false })).toBeUndefined();
  });

  test('tells an administrator, an organization and a person apart', () => {
    expect(accountKind('admin', { loading: false, hasOrganization: true })).toBe('admin');
    expect(accountKind('user', { loading: false, hasOrganization: true })).toBe('organization');
    expect(accountKind('user', { loading: false, hasOrganization: false })).toBe('person');
  });
});

describe('accountHome', () => {
  test('opens the panels in a browser', () => {
    expect(accountHome('admin', true)).toBe('/admin');
    expect(accountHome('organization', true)).toBe('/organization');
    expect(accountHome('person', true)).toBeNull();
  });

  test('keeps an administrator in the app on a phone and shows an organization its notice', () => {
    expect(accountHome('admin', false)).toBeNull();
    expect(accountHome('organization', false)).toBe('/organization');
    expect(accountHome('person', false)).toBeNull();
  });
});
