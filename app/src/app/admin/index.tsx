// Written with the help of Claude
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { getStats, type PlatformStats } from '@/api/admin';
import { Card, LoadState, PageHeader } from '@/components/admin/admin-ui';
import { Icon } from '@/components/ui/icon';
import { formatDateTime } from '@/dates';
import { useApiQuery } from '@/hooks/use-api-query';
import { colors } from '@/styles/tokens';

type CountKey = Exclude<keyof PlatformStats, 'backup'>;

const tiles: { key: CountKey; label: string; note: string }[] = [
  { key: 'users', label: 'Користувачі', note: 'Активні акаунти, без заблокованих' },
  { key: 'events', label: 'Події', note: 'Опубліковані, що ще не завершилися' },
  { key: 'matches', label: 'Метчі', note: 'Запропоновано за весь час' },
  { key: 'openReports', label: 'Відкриті скарги', note: 'Чекають на рішення' },
];

export default function AdminOverview() {
  const router = useRouter();
  const stats = useApiQuery('stats', getStats);

  return (
    <>
      <PageHeader title="Огляд" note="Стан Nearby зараз." />
      {stats.data?.backup?.overdue && <BackupWarning lastSucceededAt={stats.data.backup.lastSucceededAt} />}
      {stats.data ? (
        <View className="flex-row flex-wrap gap-5">
          {tiles.map((tile) => {
            const value = stats.data![tile.key];
            const urgent = tile.key === 'openReports' && value > 0;
            const content = (
              <Card className="min-w-[220px] flex-1 gap-3 p-6">
                <View className="flex-row items-center justify-between">
                  <Text className="font-inter-medium text-label text-text-secondary">{tile.label}</Text>
                  {urgent && <Icon name="arrow-right" size={18} color={colors.brand.coral} />}
                </View>
                <Text
                  className={`font-inter-bold text-[40px] leading-[48px] ${urgent ? 'text-brand-coral' : 'text-text-primary'}`}
                >
                  {value}
                </Text>
                <Text className="font-inter text-caption text-text-secondary">{tile.note}</Text>
              </Card>
            );
            return urgent ? (
              <Pressable
                key={tile.key}
                accessibilityRole="link"
                onPress={() => router.push('/admin/reports')}
                className="min-w-[220px] flex-1"
              >
                {content}
              </Pressable>
            ) : (
              <View key={tile.key} className="min-w-[220px] flex-1">
                {content}
              </View>
            );
          })}
        </View>
      ) : (
        <LoadState failure={stats.failure} onRetry={stats.reload} />
      )}
    </>
  );
}

function BackupWarning({ lastSucceededAt }: { lastSucceededAt: string | null }) {
  const router = useRouter();
  const last = lastSucceededAt ? `Остання копія: ${formatDateTime(lastSucceededAt)}.` : 'Успішних копій ще немає.';
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push('/admin/backups')}
      className="mb-5 flex-row items-center gap-3 rounded-[16px] bg-brand-coral-soft px-5 py-4"
    >
      <Icon name="danger" size={20} color={colors.brand.coral} />
      <Text className="flex-1 font-inter-medium text-label text-brand-coral-dark">
        Резервне копіювання бази даних потребує уваги. {last}
      </Text>
      <Icon name="arrow-right" size={18} color={colors.brand.coral} />
    </Pressable>
  );
}
