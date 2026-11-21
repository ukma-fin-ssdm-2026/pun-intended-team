// Written with the help of Claude
// AI Usage: participant card from the Figma "05 Запропонований метч" frame; reviewed by Daryna Halytska.
import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { ApiPicture } from '@/components/pictures/picture';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon, type IconName } from '@/components/ui/icon';
import { formatEventDate } from '@/dates';
import { plural } from '@/plural';
import type { Match } from '@/state/matches';
import { colors, shadows } from '@/styles/tokens';

type Partner = Match['partner'];

const lookingFor: Record<Partner['desiredCompany'], string> = {
  company: 'компанію на вечір',
  friends: 'нових друзів',
  dating: 'побачення',
};

// Shown in place of what the partner left empty, so the card keeps its look.
const placeholders = {
  occupation: 'Чим займається – поки загадка',
  description: 'Тут мав би бути якийсь прикольний опис',
  interests: 'Інтересів поки немає, тож буде про що розпитати',
};

const planLabels: Record<Partner['afterEventPlans'][number], string> = {
  walk: 'прогулянка',
  coffee: 'кава',
  dinner: 'вечеря',
};

// Interest chips shown before "Ще".
const SHOWN_INTERESTS = 5;
// The chips come and go as the prototype's other transitions do: Smart Animate, 300 ms, ease in and out.
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
const CHIP_MS = 300;
const chipFadeIn = FadeIn.duration(CHIP_MS).easing(EASE_IN_OUT);
const chipFadeOut = FadeOut.duration(CHIP_MS).easing(EASE_IN_OUT);
const chipMove = LinearTransition.duration(CHIP_MS).easing(EASE_IN_OUT);

type Props = {
  match: Match;
  // The caller's own interests, so the shared ones stand out.
  ownInterestIds: string[];
  // Shown when the partner has no cover of their own.
  cover?: ImageSource | number;
};

export function ProposalCard({ match, ownInterestIds, cover }: Props) {
  const { partner } = match;
  const own = new Set(ownInterestIds);
  const common = partner.interests.filter(({ id }) => own.has(id)).length;
  const meetingRows: { icon: IconName; label: string; value: string }[] = [
    { icon: 'ticket', label: 'Шукає', value: lookingFor[partner.desiredCompany] },
    {
      icon: 'cup',
      label: 'Після події',
      value: partner.afterEventPlans.map((plan) => planLabels[plan]).join(', ') || 'поки без планів',
    },
    { icon: 'clock', label: 'Пропозиція діє до', value: formatEventDate(match.validUntil) },
  ];

  return (
    // The card fills the space it is given, whatever the profile holds; a long profile scrolls inside it.
    <View className="flex-1 rounded-[28px] bg-surface-card" style={{ boxShadow: shadows.medium }}>
      <ScrollView
        className="flex-1 overflow-hidden rounded-[28px]"
        contentContainerClassName="grow px-2.5 pb-7 pt-2.5"
        showsVerticalScrollIndicator={false}
      >
        {/* The avatar overlaps the bottom 44 px of the cover. The cover takes the room a short profile leaves, so it is
            often taller than the area the partner picked, and shows more of their picture. */}
        <View className="min-h-[118px] grow overflow-hidden rounded-[20px]" style={{ marginBottom: -44 }}>
          {partner.cover ? (
            <View className="absolute inset-0 bg-border-default">
              <ApiPicture image={partner.cover} />
            </View>
          ) : cover ? (
            <Image source={cover} contentFit="cover" style={{ width: '100%', height: '100%' }} />
          ) : (
            <CoralGradient preset="cover" />
          )}
        </View>

        <View className="gap-3.5 px-2.5">
          <View className="size-[88px] items-center justify-center overflow-hidden rounded-full border-4 border-surface-card bg-surface-background">
            {partner.photo ? (
              <ApiPicture image={partner.photo} />
            ) : (
              <Text className="font-inter-bold text-display text-text-secondary">
                {partner.displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          <View className="gap-0.5">
            <Text className="font-inter-bold text-h1 text-text-primary">
              {partner.displayName}, {partner.age}
            </Text>
            <Text className="font-inter text-caption text-text-secondary">
              {partner.occupation || placeholders.occupation}
            </Text>
          </View>

          <View className="rounded-2xl bg-surface-background px-3.5 py-1">
            {meetingRows.map((row, index) => (
              <View key={row.label}>
                {index > 0 && <View className="h-px bg-border-default" />}
                <View className="flex-row items-center gap-2.5 py-2.5">
                  <Icon name={row.icon} size={18} color={colors.brand.coral} />
                  <Text className="font-inter text-caption text-text-secondary">{row.label}</Text>
                  <Text className="flex-1 text-right font-inter-medium text-label text-text-primary">{row.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <View className="h-px bg-border-default" />
          <Text className="font-inter text-caption leading-5 text-text-secondary">
            {partner.description || placeholders.description}
          </Text>

          <View className="flex-row items-center gap-1.5">
            <Text className="font-inter-medium text-label text-text-primary">Інтереси</Text>
            {common > 0 && (
              <Text className="font-inter text-caption text-brand-coral">
                · {common} {plural(common, ['спільний', 'спільних', 'спільних'])}
              </Text>
            )}
          </View>

          {partner.interests.length === 0 && (
            <Text className="font-inter text-caption text-text-secondary">{placeholders.interests}</Text>
          )}
          <InterestChips interests={partner.interests} own={own} />
        </View>
      </ScrollView>
    </View>
  );
}

type Interest = Partner['interests'][number];

// The shared interests first and dark, then the others; past five, "Ще N" opens the rest and "Згорнути" closes them.
function InterestChips({ interests, own }: { interests: Interest[]; own: Set<string> }) {
  const [open, setOpen] = useState(false);
  const sorted = [...interests].sort((a, b) => Number(own.has(b.id)) - Number(own.has(a.id)));
  const hidden = sorted.length - SHOWN_INTERESTS;
  const shown = open || hidden <= 0 ? sorted : sorted.slice(0, SHOWN_INTERESTS);

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {shown.map((interest, index) => {
        const shared = own.has(interest.id);
        return (
          // NativeWind styles only React Native's own views, so the animated one wraps the chip.
          <Animated.View
            key={interest.id}
            // Only the chips past the first five come and go.
            entering={index >= SHOWN_INTERESTS ? chipFadeIn : undefined}
            exiting={index >= SHOWN_INTERESTS ? chipFadeOut : undefined}
          >
            <View className={`rounded-[14px] px-3 py-1.5 ${shared ? 'bg-brand-ink' : 'bg-surface-background'}`}>
              <Text className={`font-inter-semibold text-tag ${shared ? 'text-text-on-dark' : 'text-text-secondary'}`}>
                {interest.name}
              </Text>
            </View>
          </Animated.View>
        );
      })}
      {hidden > 0 && (
        <Animated.View layout={chipMove}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={open ? 'Згорнути інтереси' : 'Показати всі інтереси'}
            onPress={() => setOpen(!open)}
            hitSlop={6}
            // The border sits inside the chip, so it is as tall as the others.
            className="flex-row items-center gap-0.5 rounded-[14px] border border-brand-coral/40 py-[5px] pl-[11px] pr-[7px] active:opacity-60"
          >
            <Text className="font-inter-semibold text-tag text-brand-coral">{open ? 'Згорнути' : `Ще ${hidden}`}</Text>
            <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
              <Icon name="field-chevron" size={14} color={colors.brand.coral} />
            </View>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}
