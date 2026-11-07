// Written with the help of Claude
import { Text, View } from 'react-native';

import { listBackups, type BackupRun } from '@/api/admin';
import { Badge, Card, LoadState, PageHeader } from '@/components/admin/admin-ui';
import { formatDateTime } from '@/dates';
import { useApiQuery } from '@/hooks/use-api-query';

const reasonLabels: Record<NonNullable<BackupRun['reason']>, string> = {
  unreachable: 'База даних недоступна',
  auth_failed: 'Помилка автентифікації в базі даних',
  timeout: 'Перевищено ліміт часу (15 хв)',
  locked: 'Таблиці заблоковано, наприклад міграцією',
  unreadable: 'Копія не пройшла перевірку',
  failed: 'Інша помилка, див. журнал сервера',
};

const columns = [
  { label: 'Дата', className: 'flex-1' },
  { label: 'Статус', className: 'w-32' },
  { label: 'Спроби', className: 'w-16' },
  { label: 'Тривалість', className: 'w-24' },
  { label: 'Розмір', className: 'w-24' },
  { label: 'Причина помилки', className: 'flex-[2]' },
];

function formatDuration(seconds: number): string {
  return seconds < 60 ? `${seconds} с` : `${Math.floor(seconds / 60)} хв ${seconds % 60} с`;
}

function formatSize(bytes: number): string {
  const megabytes = bytes / 1024 / 1024;
  return megabytes < 1 ? `${Math.ceil(bytes / 1024)} КБ` : `${megabytes.toFixed(1).replace('.', ',')} МБ`;
}

function BackupRow({ item }: { item: BackupRun }) {
  return (
    <View className="flex-row items-center gap-4 border-t border-border-default px-6 py-4">
      <Text className="flex-1 font-inter text-caption text-text-secondary">{formatDateTime(item.finishedAt)}</Text>
      <View className="w-32">
        <Badge label={item.succeeded ? 'Створено' : 'Помилка'} tone={item.succeeded ? 'green' : 'coral'} />
      </View>
      <Text className="w-16 font-inter text-body text-text-primary">{item.attempts} з 3</Text>
      <Text className="w-24 font-inter text-caption text-text-secondary">{formatDuration(item.durationSeconds)}</Text>
      <Text className="w-24 font-inter text-caption text-text-secondary">
        {item.sizeBytes === null ? '—' : formatSize(item.sizeBytes)}
      </Text>
      <Text className="flex-[2] font-inter text-caption text-text-secondary">
        {item.reason ? reasonLabels[item.reason] : '—'}
      </Text>
    </View>
  );
}

export default function AdminBackups() {
  const backups = useApiQuery('backups', listBackups);
  const status = backups.data?.status;

  return (
    <>
      <PageHeader title="Резервні копії" note="Резервна копія бази даних створюється щодня о 01:00 UTC." />

      {backups.data && (
        <Card className="gap-3 p-6">
          {status ? (
            <>
              <Badge
                label={status.overdue ? 'Потребує уваги' : 'Без помилок'}
                tone={status.overdue ? 'coral' : 'muted'}
              />
              <Text className="font-inter-medium text-body text-text-primary">
                {status.lastSucceededAt
                  ? `Остання резервна копія: ${formatDateTime(status.lastSucceededAt)}`
                  : 'Успішних резервних копій ще немає.'}
              </Text>
              {status.overdue && (
                <Text className="font-inter text-caption text-text-secondary">
                  Останнє резервне копіювання завершилося помилкою або нова копія не створювалася понад 26 годин.
                  Повідомте адміністратора сервера.
                </Text>
              )}
            </>
          ) : (
            <Text className="font-inter text-body text-text-secondary">Резервних копій ще немає.</Text>
          )}
        </Card>
      )}

      <Card>
        <View className="flex-row gap-4 px-6 py-3">
          {columns.map((column) => (
            <Text
              key={column.label}
              className={`font-inter-medium text-caption text-text-secondary ${column.className}`}
            >
              {column.label}
            </Text>
          ))}
        </View>
        {backups.data ? (
          backups.data.items.length === 0 ? (
            <Text className="border-t border-border-default px-6 py-10 text-center font-inter text-body text-text-secondary">
              Записів поки немає.
            </Text>
          ) : (
            backups.data.items.map((item) => <BackupRow key={item.finishedAt} item={item} />)
          )
        ) : (
          <LoadState failure={backups.failure} onRetry={backups.reload} />
        )}
      </Card>
    </>
  );
}
