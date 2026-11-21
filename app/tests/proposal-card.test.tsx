// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ProposalCard } from '@/components/matching/proposal-card';
import type { Match } from '@/state/matches';

// The real client signs requests through the session, which needs the device's push and secure storage.
jest.mock('@/api/client', () => ({ apiClient: {} }));
jest.mock('@/api/session', () => ({ currentAccessToken: jest.fn(() => Promise.resolve(undefined)) }));

const interest = (n: number) => ({ id: `i${n}`, name: `Інтерес ${n}`, group: 'Культура' });

function aMatch(interestCount: number): Match {
  return {
    id: 'm1',
    eventId: 'e1',
    applicationId: 'a1',
    status: 'proposed',
    days: [{ startsAt: '2026-10-25T17:00:00.000Z', cutoffAt: '2026-10-25T16:00:00.000Z' }],
    validUntil: '2026-10-16T09:00:00.000Z',
    partner: {
      username: 'olena_k',
      displayName: 'Олена',
      description: '',
      occupation: '',
      age: 24,
      interests: Array.from({ length: interestCount }, (_, i) => interest(i + 1)),
      photo: null,
      cover: null,
      desiredCompany: 'company',
      afterEventPlans: [],
    },
    createdAt: '2026-10-15T09:00:00.000Z',
  };
}

describe('ProposalCard', () => {
  test('shows five interests, the shared ones first, and opens and closes the rest', async () => {
    await render(<ProposalCard match={aMatch(8)} ownInterestIds={['i7', 'i8']} />);

    expect(screen.getByText('Інтерес 7')).toBeOnTheScreen();
    expect(screen.getByText('Інтерес 8')).toBeOnTheScreen();
    expect(screen.queryByText('Інтерес 4')).toBeNull();
    expect(screen.getByText('Ще 3')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Показати всі інтереси' }));
    expect(screen.getByText('Інтерес 4')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Згорнути інтереси' }));
    expect(screen.queryByText('Інтерес 4')).toBeNull();
    expect(screen.getByText('Ще 3')).toBeOnTheScreen();
  });

  test('shows five interests or fewer without the button', async () => {
    await render(<ProposalCard match={aMatch(5)} ownInterestIds={[]} />);

    expect(screen.getByText('Інтерес 5')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Показати всі інтереси' })).toBeNull();
  });
});
