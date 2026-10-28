// Written with the help of Claude
// AI Usage: mutual match screen from the Figma "07 Взаємний метч" frame with the 06 safety reminder, on mock data;
// reviewed by Daryna Halytska.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { MutualMatch } from '@/components/matching/mutual-match';
import { ReportFlow, type ReportStep } from '@/components/matching/report-flow';
import { SafetySheet } from '@/components/matching/safety-sheet';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent } from '@/mocks/events';
import { isMatchPersonId, mockPeople } from '@/mocks/matching';

export default function MutualMatchScreen() {
  const router = useRouter();
  // The match whose card was tapped on Т2; Т5 "Це взаємно!" also opens the safety reminder (06) on top, whose
  // "Зрозуміло" uncovers this screen, as the prototype goes from 06 to 07.
  const params = useLocalSearchParams<{ person?: string; safety?: string }>();
  const person = mockPeople[isMatchPersonId(params.person) ? params.person : 'maksym'];
  const [safetyOpen, setSafetyOpen] = useState(params.safety === '1');
  const [report, setReport] = useState<ReportStep>('closed');
  useStatusBarStyle('light');

  const event = findMockEvent(person.eventId);
  if (!event) return null;
  const toMatches = () => router.dismissTo('/matches');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {/* The title will depend on the match; for now the main 07 frame's. */}
      <MutualMatch
        title="Це взаємно!"
        person={person}
        event={event}
        onBack={toMatches}
        onMore={() => setReport('form')}
        onEventPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      />
      <ReportFlow person={person} step={report} onStepChange={setReport} onDone={toMatches} />
      <SafetySheet
        visible={safetyOpen}
        person={person}
        onClose={() => router.back()}
        onConfirm={() => setSafetyOpen(false)}
      />
    </>
  );
}
