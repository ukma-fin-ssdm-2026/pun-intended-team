// Written with the help of Claude
// AI Usage: Оголошення tab from the Figma "Т3 Оголошення", "Т3.1 · порожньо" and "Д2 · новий допис" frames, on mock
// data; reviewed by Daryna Halytska.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '@/components/announcements/post-card';
import { PostComposer } from '@/components/announcements/post-composer';
import { ReportFlow, type ReportStep } from '@/components/matching/report-flow';
import { MAP_SEARCH_ICON } from '@/components/map-background';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Glass } from '@/components/ui/glass';
import { Icon } from '@/components/ui/icon';
import { SearchField } from '@/components/ui/search-field';
import { Snackbar } from '@/components/ui/snackbar';
import { BAR_HEIGHT, tabBarSafeArea } from '@/components/ui/tab-bar-shape';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { mockPosts, type Author } from '@/mocks/announcements';
import { mockProfile } from '@/mocks/profile';
import { usePostRequests } from '@/state/post-requests';
import { useSession } from '@/state/session';
import { colors } from '@/styles/tokens';

// "01 Шапка": top padding 60 in the iPhone 14 frame (13 px below its status bar). The feed keeps 120 px under it for the
// tab bar (72 + 22 + 26).
const HEADER_TOP = 60;
const GAP_BELOW_STATUS_BAR = 13;
const LIST_BOTTOM_GAP = 26;

const feedTabs = ['Для тебе', 'Поруч', 'Мої'];
// Т3.3 Пошук оголошень: the tabs switch only visually; every tab shows the matching posts.
const searchTabs = ['Популярне', 'Нове', 'Люди', 'Події'];
// Figma's query on Т3.3.
const SEARCH_QUERY = 'настолки';

function HeaderTabs({
  tabs,
  selected,
  onSelect,
}: {
  tabs: string[];
  selected: string;
  onSelect: (tab: string) => void;
}) {
  return (
    <View accessibilityRole="tablist" className="flex-row">
      {tabs.map((tab) => {
        const isSelected = tab === selected;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(tab)}
            className="flex-1 items-center gap-2.5"
          >
            <Text
              className={`font-inter-medium text-label ${isSelected ? 'text-text-on-dark' : 'text-text-on-dark-muted'}`}
            >
              {tab}
            </Text>
            <View className={`h-[3px] rounded-sm ${isSelected ? 'w-12 bg-brand-coral' : 'w-px bg-transparent'}`} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AnnouncementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // 04 "Створити оголошення" opens the tab with the editor (Д2).
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const { announcementsEmpty } = useSession();
  const { lastPostId } = usePostRequests();
  const requestedPost = mockPosts.find((post) => post.id === lastPostId);
  const [composing, setComposing] = useState(false);
  const [feedTab, setFeedTab] = useState(feedTabs[0]);
  // The search button opens Т3.3 in place of the feed's header; its back button returns to the feed.
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState(SEARCH_QUERY);
  const [searchTab, setSearchTab] = useState(searchTabs[0]);
  const [reported, setReported] = useState<Author>();
  const [report, setReport] = useState<ReportStep>('closed');
  useStatusBarStyle('light');

  const editorOpen = composing || compose === '1';
  const closeEditor = () => {
    setComposing(false);
    router.setParams({ compose: undefined });
  };

  const tabBarSpace = BAR_HEIGHT + tabBarSafeArea(insets.bottom);
  const search = query.trim().toLocaleLowerCase('uk');
  const posts = searching ? mockPosts.filter((post) => post.text.toLocaleLowerCase('uk').includes(search)) : mockPosts;

  return (
    <View className="flex-1 bg-surface-card">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: tabBarSpace + LIST_BOTTOM_GAP }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="gap-[18px] overflow-hidden px-5"
          style={{ paddingTop: Math.max(HEADER_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}
        >
          <View className="absolute inset-0">
            <CoralGradient preset="announcements" />
          </View>
          {searching ? (
            <>
              <View className="flex-row items-center gap-2.5">
                <Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={() => setSearching(false)}>
                  <Glass
                    className="size-10 items-center justify-center"
                    radius={20}
                    fill="rgba(255, 255, 255, 0.22)"
                    border="rgba(255, 255, 255, 0.35)"
                    blur={12}
                    tone="light"
                  >
                    <Icon name="arrow-left" size={20} color={colors.text['on-dark']} />
                  </Glass>
                </Pressable>
                <View className="flex-1">
                  <SearchField
                    placeholder="Пошук оголошень"
                    value={query}
                    onChangeText={setQuery}
                    iconColor={MAP_SEARCH_ICON}
                    autoFocus
                  />
                </View>
              </View>
              <HeaderTabs tabs={searchTabs} selected={searchTab} onSelect={setSearchTab} />
            </>
          ) : (
            <>
              <View className="flex-row items-center justify-between">
                <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-on-dark">
                  Оголошення
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Пошук"
                  onPress={() => setSearching(true)}
                  hitSlop={10}
                >
                  <Icon name="search" size={22} color={colors.text['on-dark']} />
                </Pressable>
              </View>
              <HeaderTabs tabs={feedTabs} selected={feedTab} onSelect={setFeedTab} />
            </>
          )}
        </View>

        {searching ? null : editorOpen ? (
          <PostComposer onPublish={closeEditor} onAddPlace={() => router.push('/post-place')} />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setComposing(true)}
            className="flex-row items-center gap-3 px-5 py-3.5"
          >
            <View className="size-10 items-center justify-center rounded-[20px] bg-brand-ink">
              <Text className="font-inter-semibold text-title text-text-on-dark">{mockProfile.initial}</Text>
            </View>
            <View className="flex-1 rounded-[20px] bg-surface-background px-4 py-[11px]">
              <Text numberOfLines={1} className="font-inter text-body text-text-secondary">
                Що плануєш? Знайди компанію…
              </Text>
            </View>
          </Pressable>
        )}
        {!searching && <View className="h-px bg-border-default" />}

        {announcementsEmpty && !searching ? (
          <View className="flex-1 items-center justify-center" style={{ paddingBottom: 120 - LIST_BOTTOM_GAP }}>
            <View className="w-full items-center gap-3.5 px-8">
              <View className="size-[120px] items-center justify-center rounded-full border border-white/[0.14]">
                <View
                  className="size-[76px] items-center justify-center rounded-full bg-brand-coral"
                  style={{ boxShadow: '0px 0px 30px rgba(223, 84, 74, 0.5)' }}
                >
                  <Icon name="empty-list" size={34} color={colors.text['on-dark']} />
                </View>
              </View>
              <Text className="text-center font-inter-bold text-h1 text-text-primary">Поки тут тихо</Text>
              <Text className="text-center font-inter text-body text-text-secondary">
                Не знайшла подію в каталозі? Напиши, куди хочеш піти, і хтось точно відгукнеться.
              </Text>
            </View>
          </View>
        ) : (
          posts.map((post) => (
            <View key={post.id}>
              <PostCard
                post={post}
                onReport={() => {
                  setReported(post.author);
                  setReport('form');
                }}
                onRequest={() => setSearching(false)}
              />
              <View className="h-px bg-border-default" />
            </View>
          ))
        )}
      </ScrollView>

      {requestedPost && (
        <Snackbar title="Запит надіслано" note={`Дамо знати, щойно ${requestedPost.author.name} відповість.`} />
      )}

      {/* The prototype ends the report on the Метчі tab from a match; from a post it stays on the feed. */}
      <ReportFlow person={reported} step={report} onStepChange={setReport} onDone={() => {}} />
    </View>
  );
}
