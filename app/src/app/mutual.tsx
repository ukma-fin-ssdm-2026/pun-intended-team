// Written with the help of Claude
// AI Usage: mutual match screen from the Figma "07 Взаємний метч" frame with the 06 safety reminder; reviewed by Daryna
// Halytska.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getMatchContacts } from '@/api/matches';
import { MutualMatch, type MutualContact, type MutualPerson } from '@/components/matching/mutual-match';
import { ReportFlow, reportedUser, type ReportStep } from '@/components/matching/report-flow';
import { SafetySheet } from '@/components/matching/safety-sheet';
import { socialNetworks } from '@/components/profile/network-fields';
import { useApiQuery } from '@/hooks/use-api-query';
import { useEvent } from '@/hooks/use-event';
import { useMatch } from '@/hooks/use-matches';
import { useProfileInitial } from '@/hooks/use-profile';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent } from '@/mocks/events';
import { isMatchPersonId, mockMutual, mockMutualPerson, mockPeople } from '@/mocks/matching';
import { matchHref, type MatchContacts } from '@/state/matches';
import { colors } from '@/styles/tokens';

export default function MutualMatchScreen() {
  // `id` is a match from the API. Without it, the notifications and the join request of an announcement still open
  // the mock people by `person`.
  const params = useLocalSearchParams<{ id?: string; person?: string; safety?: string }>();
  return params.id ? (
    <ApiMutualMatch id={params.id} safety={params.safety === '1'} />
  ) : (
    <MockMutualMatch person={params.person} safety={params.safety === '1'} />
  );
}

function contactsOf({ phone, linkedAccounts }: MatchContacts): MutualContact[] {
  const networks: MutualContact[] = linkedAccounts.map(({ network, username, url }) => ({
    key: network,
    icon: { network },
    label: socialNetworks[network].name,
    value: socialNetworks[network].shown(username),
    url,
  }));
  return phone
    ? [...networks, { key: 'phone', icon: { name: 'phone' }, label: 'Телефон', value: phone, url: `tel:${phone}` }]
    : networks;
}

// After both accepted, "safety" opens the reminder (06) over the contacts (07), as the prototype does from Т5.
function ApiMutualMatch({ id, safety }: { id: string; safety: boolean }) {
  const router = useRouter();
  const [safetyOpen, setSafetyOpen] = useState(safety);
  const [report, setReport] = useState<ReportStep>('closed');
  useStatusBarStyle('light');

  const { match, loaded } = useMatch(id);
  const ownInitial = useProfileInitial();
  const { data: liveEvent } = useEvent(match?.eventId);
  const mutual = match?.status === 'mutual';
  const { data: contacts } = useApiQuery(mutual ? id : null, () => getMatchContacts(id));
  const toMatches = () => router.dismissTo('/matches');

  // A match that is not mutual (yet) shows as a proposal; one that is gone leaves the screen.
  useEffect(() => {
    if (!loaded) return;
    if (!match) router.dismissTo('/matches');
    else if (match.status !== 'mutual') router.replace(matchHref(match));
  }, [loaded, match, router]);

  if (!match || !mutual || !liveEvent || !contacts) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-ink">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.text['on-dark']} />
      </View>
    );
  }

  const { partner } = match;
  const person: MutualPerson = {
    name: partner.displayName,
    initial: partner.displayName.charAt(0).toUpperCase(),
    contacts: contactsOf(contacts),
  };
  // The first day both can go; the two pick theirs.
  const event = {
    id: liveEvent.id,
    title: liveEvent.title,
    startsAt: match.days[0]?.startsAt ?? liveEvent.startsAt,
    startTimeKnown: liveEvent.startTimeKnown,
    cover: findMockEvent(liveEvent.id)?.cover,
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MutualMatch
        title="Це взаємно!"
        person={person}
        ownInitial={ownInitial}
        event={event}
        onBack={toMatches}
        onMore={() => setReport('form')}
        onEventPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      />
      <ReportFlow person={reportedUser(partner)} step={report} onStepChange={setReport} onDone={toMatches} />
      <SafetySheet
        visible={safetyOpen}
        person={person}
        onClose={() => setSafetyOpen(false)}
        onConfirm={() => setSafetyOpen(false)}
      />
    </>
  );
}

function MockMutualMatch({ person: personId, safety }: { person?: string; safety: boolean }) {
  const router = useRouter();
  // The match whose card was tapped on Т2; Т5 "Це взаємно!" also opens the safety reminder (06) on top, whose
  // "Зрозуміло" uncovers this screen, as the prototype goes from 06 to 07.
  const person = mockPeople[isMatchPersonId(personId) ? personId : 'maksym'];
  const [safetyOpen, setSafetyOpen] = useState(safety);
  const [report, setReport] = useState<ReportStep>('closed');
  useStatusBarStyle('light');

  const event = findMockEvent(person.eventId);
  if (!event) return null;
  const toMatches = () => router.dismissTo('/matches');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MutualMatch
        title="Це взаємно!"
        person={mockMutualPerson(person)}
        ownInitial={mockMutual.ownInitial}
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
