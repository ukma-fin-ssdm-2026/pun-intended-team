// Written with the help of Claude
// AI Usage: mutual match screen from the Figma "07 Взаємний метч" frame, on mock data; reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { MutualMatch } from '@/components/matching/mutual-match';
import { ReportFlow, type ReportStep } from '@/components/matching/report-flow';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent } from '@/mocks/events';
import { mockSearch } from '@/mocks/matching';

export default function MutualMatchScreen() {
  const router = useRouter();
  const [report, setReport] = useState<ReportStep>('closed');
  useStatusBarStyle('light');

  const event = findMockEvent(mockSearch.eventId);
  if (!event) return null;
  const toMatches = () => router.dismissTo('/matches');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {/* The title will depend on the match; for now the main 07 frame's. */}
      <MutualMatch
        title="Це взаємно!"
        event={event}
        onBack={toMatches}
        onMore={() => setReport('form')}
        onEventPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      />
      <ReportFlow step={report} onStepChange={setReport} onDone={toMatches} />
    </>
  );
}
