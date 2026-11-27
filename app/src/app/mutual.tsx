// Written with the help of Claude
// AI Usage: mutual match screen from the Figma "07 Взаємний метч" frame with the 06 safety reminder, for a mutual match
// and for an accepted listing join request; reviewed by Daryna Halytska.
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getListingRequest, getListingRequestContacts } from '@/api/listing-requests';
import { getMatchContacts } from '@/api/matches';
import { acknowledgeSafetyNotice } from '@/api/profile';
import { failureSnackbar } from '@/auth/messages';
import {
  MutualMatch,
  type MutualContact,
  type MutualEvent,
  type MutualPerson,
} from '@/components/matching/mutual-match';
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
  // `id` is a match from the API, `request` an accepted listing join request; without either there is nothing to show,
  // so the screen leaves for Метчі.
  const { id, request } = useLocalSearchParams<{ id?: string; request?: string }>();
  if (request) return <ListingRequestMutual id={request} />;
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

// The safety reminder (06) covers 07 every time until the user ticks "Більше не показувати"; before the first
// acknowledgment the API also holds the contacts back (SAFE-002). `key` is what the screen is for, a match or a listing
// request, so the reminder shows once for each.
function useSafetyGate(key: string) {
  const [acknowledging, setAcknowledging] = useState(false);
  const { snackbar, show } = useSnackbar();
  const profile = useProfile().data;
  const acknowledged = !!profile && profile.safetyNotice !== 'not_acknowledged';
  const seen = useSafetyNoticeSeen(profile?.username, key);

  const acknowledge = async (dontShowAgain: boolean) => {
    if (!profile) return;
    setAcknowledging(true);
    const result = await acknowledgeSafetyNotice(dontShowAgain);
    setAcknowledging(false);
    if (result.ok) void markSafetyNoticeSeen(profile.username, key);
    else show(failureSnackbar(result));
  };

  return {
    profile,
    // Contacts can be asked for once the API has the acknowledgment.
    acknowledged,
    ready: !!profile && seen.loaded,
    noticeShown: !acknowledged || (profile?.safetyNotice !== 'hidden' && !seen.seen),
    acknowledging,
    acknowledge,
    snackbar,
  };
}

type SafetyGate = ReturnType<typeof useSafetyGate>;

function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-brand-ink">
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={colors.text['on-dark']} />
    </View>
  );
}

// 07 with the other person's contacts, the 06 reminder over it, and the report flow for that person. Closing 06 asks to
// read it; closing that too leaves.
function MutualScreen({
  gate,
  other,
  contacts,
  event,
  onLeave,
  onEventPress,
}: {
  gate: SafetyGate;
  other: { displayName: string; username: string; photo: MutualPerson['photo'] };
  contacts: MatchContacts | undefined;
  event: MutualEvent;
  onLeave: () => void;
  onEventPress?: () => void;
}) {
  const [warning, setWarning] = useState(false);
  const [report, setReport] = useState<ReportStep>('closed');
  const ownInitial = useProfileInitial();
  const person: MutualPerson = {
    name: other.displayName,
    initial: other.displayName.charAt(0).toUpperCase(),
    photo: other.photo,
    contacts: contacts ? contactsOf(contacts) : [],
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MutualMatch
        title="Це взаємно!"
        person={person}
        ownInitial={ownInitial}
        ownPhoto={gate.profile?.photo}
        event={event}
        onBack={onLeave}
        onMore={() => setReport('form')}
        onEventPress={onEventPress}
      />
      <ReportFlow person={reportedUser(other)} step={report} onStepChange={setReport} onDone={onLeave} />
      <SafetySheet
        visible={gate.noticeShown && !warning}
        person={person}
        busy={gate.acknowledging}
        onClose={() => setWarning(true)}
        onConfirm={gate.acknowledge}
      />
      <SafetyRequiredDialog visible={warning} onRead={() => setWarning(false)} onClose={onLeave} />
      {gate.snackbar && <Snackbar {...gate.snackbar} />}
    </>
  );
}

function ApiMutualMatch({ id }: { id: string }) {
  const router = useRouter();
  useStatusBarStyle('light');

  const { match, loaded } = useMatch(id);
  const gate = useSafetyGate(id);
  const { data: liveEvent } = useEvent(match?.eventId);
  const mutual = match?.status === 'mutual';
  const { data: contacts } = useApiQuery(mutual && gate.acknowledged ? id : null, () => getMatchContacts(id));
  const toMatches = () => router.dismissTo('/matches');

  // A match that is not mutual (yet) shows as a proposal; one that is gone leaves the screen.
  useEffect(() => {
    if (!loaded) return;
    if (!match) router.dismissTo('/matches');
    else if (match.status !== 'mutual') router.replace(matchHref(match));
  }, [loaded, match, router]);

  if (!match || !mutual || !liveEvent || !gate.ready || (gate.acknowledged && !contacts)) return <Loading />;

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
    <MutualScreen
      gate={gate}
      other={match.partner}
      contacts={contacts}
      event={event}
      onLeave={toMatches}
      onEventPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
    />
  );
}

// An accepted listing join request: the other side is the requester for the author and the author for the requester.
// The event block is the listing, with the cover of its catalog event when it has one. A request that is not accepted,
// or that the caller cannot see, leaves the screen.
function ListingRequestMutual({ id }: { id: string }) {
  const router = useRouter();
  useStatusBarStyle('light');

  const gate = useSafetyGate(`listing-request:${id}`);
  const { data: request, failure } = useApiQuery(id, () => getListingRequest(id));
  const accepted = request?.status === 'accepted';
  const { data: contacts, failure: contactsFailure } = useApiQuery(accepted && gate.acknowledged ? id : null, () =>
    getListingRequestContacts(id),
  );
  const { data: catalogEvent } = useEvent(request?.listing.eventId ?? undefined);
  const leave = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/announcements')), [router]);

  useEffect(() => {
    if (failure || contactsFailure || (request && !accepted)) leave();
  }, [failure, contactsFailure, request, accepted, leave]);

  if (!request || !accepted || !gate.ready || (gate.acknowledged && !contacts)) return <Loading />;

  const { listing } = request;
  const other = request.role === 'author' ? request.requester : request.author;
  const event: MutualEvent = {
    id: listing.id,
    title: listing.title,
    // Noon, so the day is the same in Kyiv whatever the offset.
    startsAt: `${listing.date}T12:00:00Z`,
    startTimeKnown: false,
    subtitle: listing.place?.name ?? 'Оголошення',
    cover: catalogEvent ? coverOf(catalogEvent.imageUrl) : undefined,
    photo: catalogEvent?.photo,
  };
  const eventId = listing.eventId;

  return (
    <MutualScreen
      gate={gate}
      other={other}
      contacts={contacts}
      event={event}
      onLeave={leave}
      onEventPress={eventId ? () => router.push({ pathname: '/events/[id]', params: { id: eventId } }) : undefined}
    />
  );
}
