// Written with the help of Claude
// AI Usage: mutual match screen from the Figma "07 Взаємний метч" frame with the 06 safety reminder; reviewed by Daryna
// Halytska.
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getMatchContacts } from '@/api/matches';
import { acknowledgeSafetyNotice } from '@/api/profile';
import { failureSnackbar } from '@/auth/messages';
import { MutualMatch, type MutualContact, type MutualPerson } from '@/components/matching/mutual-match';
import { ReportFlow, reportedUser, type ReportStep } from '@/components/matching/report-flow';
import { SafetyRequiredDialog } from '@/components/matching/safety-required-dialog';
import { SafetySheet } from '@/components/matching/safety-sheet';
import { socialNetworks } from '@/components/profile/network-fields';
import { coverOf } from '@/components/ui/event-cover';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { useApiQuery } from '@/hooks/use-api-query';
import { useEvent } from '@/hooks/use-event';
import { useMatch } from '@/hooks/use-matches';
import { useProfile, useProfileInitial } from '@/hooks/use-profile';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { matchHref, type MatchContacts } from '@/state/matches';
import { markSafetyNoticeSeen, useSafetyNoticeSeen } from '@/state/safety-notice';
import { colors } from '@/styles/tokens';

export default function MutualMatchScreen() {
  // `id` is a match from the API; without one there is nothing to show, so the screen leaves for Метчі.
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? <ApiMutualMatch id={id} /> : <Redirect href="/matches" />;
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

// The safety reminder (06) covers the screen (07) on every match until the user ticks "Більше не показувати"; before the
// first acknowledgment the API also holds the contacts back (SAFE-002). Closing it asks to read it; closing that too
// leaves for Метчі.
function ApiMutualMatch({ id }: { id: string }) {
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [report, setReport] = useState<ReportStep>('closed');
  const { snackbar, show } = useSnackbar();
  useStatusBarStyle('light');

  const { match, loaded } = useMatch(id);
  const ownInitial = useProfileInitial();
  const profile = useProfile().data;
  const acknowledged = !!profile && profile.safetyNotice !== 'not_acknowledged';
  const seen = useSafetyNoticeSeen(profile?.username, id);
  const noticeShown = !acknowledged || (profile?.safetyNotice !== 'hidden' && !seen.seen);
  const { data: liveEvent } = useEvent(match?.eventId);
  const mutual = match?.status === 'mutual';
  const { data: contacts } = useApiQuery(mutual && acknowledged ? id : null, () => getMatchContacts(id));
  const toMatches = () => router.dismissTo('/matches');

  const acknowledge = async (dontShowAgain: boolean) => {
    if (!profile) return;
    setAcknowledging(true);
    const result = await acknowledgeSafetyNotice(dontShowAgain);
    setAcknowledging(false);
    if (result.ok) void markSafetyNoticeSeen(profile.username, id);
    else show(failureSnackbar(result));
  };

  // A match that is not mutual (yet) shows as a proposal; one that is gone leaves the screen.
  useEffect(() => {
    if (!loaded) return;
    if (!match) router.dismissTo('/matches');
    else if (match.status !== 'mutual') router.replace(matchHref(match));
  }, [loaded, match, router]);

  if (!match || !mutual || !liveEvent || !profile || !seen.loaded || (acknowledged && !contacts)) {
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
    photo: partner.photo,
    contacts: contacts ? contactsOf(contacts) : [],
  };
  // The first day both can go; the two pick theirs.
  const event = {
    id: liveEvent.id,
    title: liveEvent.title,
    startsAt: match.days[0]?.startsAt ?? liveEvent.startsAt,
    startTimeKnown: liveEvent.startTimeKnown,
    cover: coverOf(liveEvent.imageUrl),
    photo: liveEvent.photo,
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MutualMatch
        title="Це взаємно!"
        person={person}
        ownInitial={ownInitial}
        ownPhoto={profile.photo}
        event={event}
        onBack={toMatches}
        onMore={() => setReport('form')}
        onEventPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      />
      <ReportFlow person={reportedUser(partner)} step={report} onStepChange={setReport} onDone={toMatches} />
      <SafetySheet
        visible={noticeShown && !warning}
        person={person}
        busy={acknowledging}
        onClose={() => setWarning(true)}
        onConfirm={acknowledge}
      />
      <SafetyRequiredDialog visible={warning} onRead={() => setWarning(false)} onClose={toMatches} />
      {snackbar && <Snackbar {...snackbar} />}
    </>
  );
}
