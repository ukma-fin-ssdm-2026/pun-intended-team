// Written with the help of Claude
import { Link, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { CASES_PAGE_SIZE } from '@/api/admin';
import type { ApiResult } from '@/api/public-client';
import { Card, LoadState } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

type Failure = Extract<ApiResult<unknown>, { ok: false }>;

// A list's filters, search and offset as strings; a page keeps them in the URL, a list inside a details page in state.
export type ListState = Record<string, string | undefined>;
export type ListControl = [ListState, (changes: ListState) => void];

// A change of a filter starts again from the first page.
const withOffset = (changes: ListState): ListState => ({ offset: '0', ...changes });

export function useUrlListState(): ListControl {
  const router = useRouter();
  const params = useLocalSearchParams() as ListState;
  const set = useCallback((changes: ListState) => router.setParams(withOffset(changes)), [router]);
  return [params, set];
}

export function useLocalListState(): ListControl {
  const [state, setState] = useState<ListState>({});
  const set = useCallback((changes: ListState) => setState((current) => ({ ...current, ...withOffset(changes) })), []);
  return [state, set];
}

export const offsetOf = (state: ListState) => Math.max(0, Number(state.offset) || 0);

// An empty string means no filter; the API gets undefined.
export const filterOf = <T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined =>
  allowed.find((option) => option === value);

export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T | ''; label: string }[];
  value: T | undefined;
  onChange: (value: T | '') => void;
}) {
  return (
    <View accessibilityRole="tablist" className="flex-row flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value || 'all'}
          label={option.label}
          size="sm"
          variant={option.value === (value ?? '') ? 'dark' : 'light'}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

// Searches when Enter is pressed, so typing does not send a request per letter.
export function SearchBox({
  value,
  placeholder,
  onSearch,
}: {
  value: string | undefined;
  placeholder: string;
  onSearch: (value: string | undefined) => void;
}) {
  const [text, setText] = useState(value ?? '');
  const submit = () => onSearch(text.trim() || undefined);
  return (
    <View className="h-10 min-w-[280px] flex-row items-center gap-2 rounded-xl border-[1.5px] border-border-default bg-surface-card px-3">
      <Icon name="search" size={18} color={colors.text.secondary} />
      <TextInput
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.text.secondary}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        maxLength={100}
        className="flex-1 font-inter text-body text-text-primary"
        style={{ outlineWidth: 0 }}
      />
      {text !== '' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Очистити пошук"
          onPress={() => {
            setText('');
            onSearch(undefined);
          }}
        >
          <Icon name="close" size={16} color={colors.text.secondary} />
        </Pressable>
      )}
    </View>
  );
}

export type Column = { label: string; className: string };

type Page<T> = { items: T[]; page: { hasMore: boolean } };

// A table of one page with the pager under it; `row` draws one item.
export function Table<T>({
  columns,
  query,
  offset,
  onOffset,
  row,
}: {
  columns: Column[];
  query: { data?: Page<T>; failure?: Failure; reload: () => void };
  offset: number;
  onOffset: (offset: number) => void;
  row: (item: T) => ReactNode;
}) {
  const data = query.data;
  return (
    <>
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
        {data ? (
          data.items.length === 0 ? (
            <Text className="border-t border-border-default px-6 py-10 text-center font-inter text-body text-text-secondary">
              Нічого не знайдено.
            </Text>
          ) : (
            data.items.map(row)
          )
        ) : (
          <LoadState failure={query.failure} onRetry={query.reload} />
        )}
      </Card>
      {data && (offset > 0 || data.page.hasMore) && (
        <View className="flex-row items-center justify-end gap-3">
          <Button
            label="Назад"
            size="sm"
            variant="light"
            disabled={offset === 0}
            onPress={() => onOffset(Math.max(0, offset - CASES_PAGE_SIZE))}
          />
          <Button
            label="Далі"
            size="sm"
            variant="light"
            disabled={!data.page.hasMore}
            onPress={() => onOffset(offset + CASES_PAGE_SIZE)}
          />
        </View>
      )}
    </>
  );
}

export function RowLink({ href, children }: { href: Href; children: ReactNode }) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        className="flex-row items-center gap-4 border-t border-border-default px-6 py-4 hover:bg-surface-background"
      >
        {children}
      </Pressable>
    </Link>
  );
}

// Two lines in a table cell: the main text and a note under it.
export function Cell({ title, note, className }: { title: string; note?: string | null; className: string }) {
  return (
    <View className={`gap-0.5 ${className}`}>
      <Text numberOfLines={1} className="font-inter-medium text-body text-text-primary">
        {title}
      </Text>
      {note ? (
        <Text numberOfLines={1} className="font-inter text-caption text-text-secondary">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

export function BackLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" className="flex-row items-center gap-2 self-start">
        <Icon name="arrow-left" size={18} color={colors.text.secondary} />
        <Text className="font-inter-medium text-label text-text-secondary">{label}</Text>
      </Pressable>
    </Link>
  );
}

// A label over its value, as in a details card.
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="min-w-[140px] gap-1.5">
      <Text className="font-inter text-caption text-text-secondary">{label}</Text>
      {typeof children === 'string' ? (
        <Text className="font-inter text-body text-text-primary">{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export function FactLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Text accessibilityRole="link" className="font-inter-medium text-body text-brand-coral">
        {label}
      </Text>
    </Link>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text accessibilityRole="header" className="font-inter-semibold text-h2 text-text-primary">
        {title}
      </Text>
      {children}
    </View>
  );
}
