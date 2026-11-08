// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { reportListing, reportUser } from '@/api/reports';
import { ReportFlow } from '@/components/matching/report-flow';

// The default person of the sheet; its mock module loads images that Jest cannot resolve.
jest.mock('@/mocks/matching', () => ({ mockPerson: { name: 'Олена', accusative: 'Олену', instrumental: 'Оленою' } }));
jest.mock('@/api/reports', () => ({
  reportListing: jest.fn(() => Promise.resolve({ ok: true, data: undefined })),
  reportUser: jest.fn(() => Promise.resolve({ ok: true, data: undefined })),
}));

const author = { name: 'Ірина', accusative: 'Ірину', instrumental: 'Іриною', username: 'iryna' };

beforeEach(() => {
  jest.clearAllMocks();
});

async function sendReport(person: typeof author & { listingId?: string }, onStepChange = jest.fn()) {
  await render(<ReportFlow person={person} step="form" onStepChange={onStepChange} onDone={() => {}} />);
  await fireEvent.press(screen.getByRole('radio', { name: 'Інше' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Надіслати скаргу' }));
  return onStepChange;
}

describe('ReportFlow', () => {
  // FR-028
  test('reports the listing, not its author, from a post', async () => {
    const onStepChange = await sendReport({ ...author, listingId: 'listing-1' });

    await waitFor(() => expect(onStepChange).toHaveBeenCalledWith('sent'));
    expect(reportListing).toHaveBeenCalledWith({ listingId: 'listing-1', reason: 'other' });
    expect(reportUser).not.toHaveBeenCalled();
  });

  test('reports the person by username from a match', async () => {
    const onStepChange = await sendReport(author);

    await waitFor(() => expect(onStepChange).toHaveBeenCalledWith('sent'));
    expect(reportUser).toHaveBeenCalledWith({ username: 'iryna', reason: 'other' });
    expect(reportListing).not.toHaveBeenCalled();
  });
});
