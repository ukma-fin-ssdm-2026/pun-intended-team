// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { approveOrganization, listOrganizations, type AdminOrganization } from '@/api/admin';
import AdminOrganizations from '@/app/admin/organizations';

jest.mock('expo-router', () => ({ useRouter: () => ({ setParams: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock('@/api/admin', () => ({
  CASES_PAGE_SIZE: 20,
  listOrganizations: jest.fn(),
  approveOrganization: jest.fn(),
  rejectOrganization: jest.fn(),
}));

const pending: AdminOrganization = {
  accountId: 'f4b6d8e0-2c4a-4e6f-9b1d-5a7c9e1f3b4d',
  account: { id: 'f4b6d8e0-2c4a-4e6f-9b1d-5a7c9e1f3b4d', username: 'riverside', displayName: 'Riverside' },
  name: 'Riverside Stage',
  description: 'Open-air concerts.',
  officialLink: 'https://riverside.example.org',
  verificationStatus: 'pending',
  verifiedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// FR-003
describe('AdminOrganizations', () => {
  test('approves a pending request after the confirmation', async () => {
    jest.mocked(listOrganizations).mockResolvedValue({
      ok: true,
      data: { items: [pending], page: { limit: 20, offset: 0, hasMore: false } },
    });
    jest.mocked(approveOrganization).mockResolvedValue({
      ok: true,
      data: { ...pending, verificationStatus: 'verified', verifiedAt: '2026-11-08T10:00:00.000Z' },
    });
    await render(<AdminOrganizations />);

    expect(await screen.findByText('Riverside Stage')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Підтвердити' }));
    // The dialog's button comes after the row's.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Підтвердити' }).at(-1)!);

    await waitFor(() => expect(approveOrganization).toHaveBeenCalledWith(pending.accountId));
    expect(listOrganizations).toHaveBeenCalledTimes(2);
  });

  test('offers no decision on a verified organization', async () => {
    jest.mocked(listOrganizations).mockResolvedValue({
      ok: true,
      data: {
        items: [{ ...pending, verificationStatus: 'verified', verifiedAt: '2026-11-08T10:00:00.000Z' }],
        page: { limit: 20, offset: 0, hasMore: false },
      },
    });
    await render(<AdminOrganizations />);

    expect(await screen.findByText('Підтверджено')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Підтвердити' })).toBeNull();
  });
});
