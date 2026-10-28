// Written with the help of Claude
// AI Usage: participant card from the Figma "05 Запропонований метч" frame; reviewed by Daryna Halytska.
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { mockProposal } from '@/mocks/matching';
import { colors, shadows } from '@/styles/tokens';

const meetingRows: { icon: IconName; label: string; value: string }[] = [
  { icon: 'ticket', label: 'Шукає', value: mockProposal.lookingFor },
  { icon: 'cup', label: 'Після події', value: mockProposal.afterEvent },
  { icon: 'clock', label: 'Пропозиція діє до', value: mockProposal.validUntil },
];

export function ProposalCard() {
  return (
    <View className="rounded-[28px] bg-surface-card px-2.5 pb-[18px] pt-2.5" style={{ boxShadow: shadows.medium }}>
      {/* The avatar overlaps the bottom 44 px of the cover. */}
      <View className="h-[118px] overflow-hidden rounded-[20px]" style={{ marginBottom: -44 }}>
        <Image source={mockProposal.cover} contentFit="cover" style={{ width: '100%', height: '100%' }} />
      </View>

      <View className="gap-3.5 px-2.5">
        <View className="size-[88px] items-center justify-center rounded-full border-4 border-surface-card bg-surface-background">
          <Text className="font-inter-bold text-display text-text-secondary">{mockProposal.initial}</Text>
        </View>

        <View className="gap-0.5">
          <Text className="font-inter-bold text-h1 text-text-primary">{mockProposal.nameAge}</Text>
          <Text className="font-inter text-caption text-text-secondary">{mockProposal.occupation}</Text>
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

        <Text className="font-inter text-caption leading-5 text-text-secondary">{mockProposal.about}</Text>

        <View className="flex-row items-center gap-1.5">
          <Text className="font-inter-medium text-label text-text-primary">Інтереси</Text>
          <Text className="font-inter text-caption text-brand-coral">{mockProposal.commonLabel}</Text>
        </View>

        <View className="flex-row flex-wrap gap-1.5">
          {mockProposal.interests.map((interest) => (
            <View
              key={interest.label}
              className={`rounded-[14px] px-3 py-1.5 ${interest.common ? 'bg-brand-ink' : 'bg-surface-background'}`}
            >
              <Text
                className={`font-inter-semibold text-tag ${interest.common ? 'text-text-on-dark' : 'text-text-secondary'}`}
              >
                {interest.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
