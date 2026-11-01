// Written with the help of Claude
import { useState } from 'react';
import { Pressable, Text, View, type KeyboardTypeOptions } from 'react-native';

import type { components } from '@/api/schema';
import { AddSocialSheet } from '@/components/profile/profile-sheets';
import { SocialNetworkIcon } from '@/components/ui/social-network-icon';
import { TextField } from '@/components/ui/text-field';

type SocialNetwork = components['schemas']['SocialNetwork'];
type LinkedAccount = components['schemas']['LinkedAccount'];

// What a field holds; the server cleans it into a bare handle and checks that it fits the social network.
export type NetworkEntry = { network: SocialNetwork; username: string };

// In the order the API returns them. `shown` turns a stored handle back into the form people recognise.
export const socialNetworks: Record<
  SocialNetwork,
  { name: string; placeholder: string; keyboardType?: KeyboardTypeOptions; shown: (handle: string) => string }
> = {
  telegram: { name: 'Telegram', placeholder: '@нікнейм або t.me/…', shown: (handle) => `@${handle}` },
  instagram: { name: 'Instagram', placeholder: '@нікнейм або посилання', shown: (handle) => `@${handle}` },
  whatsapp: {
    name: 'WhatsApp',
    placeholder: '+380 50 123 45 67',
    keyboardType: 'phone-pad',
    shown: (handle) => `+${handle}`,
  },
  tiktok: { name: 'TikTok', placeholder: '@нікнейм або посилання', shown: (handle) => `@${handle}` },
  facebook: { name: 'Facebook', placeholder: 'Нікнейм або посилання', shown: (handle) => handle },
};

const order = Object.keys(socialNetworks) as SocialNetwork[];

// The saved social networks as the fields show them.
export function toEntries(linkedAccounts: LinkedAccount[]): NetworkEntry[] {
  return linkedAccounts.map(({ network, username }) => ({
    network,
    username: socialNetworks[network].shown(username),
  }));
}

// What is sent: trimmed, and an emptied field drops its social network.
export function filledNetworks(entries: NetworkEntry[]): NetworkEntry[] {
  return entries
    .map(({ network, username }) => ({ network, username: username.trim() }))
    .filter((entry) => entry.username);
}

export function sameNetworks(a: NetworkEntry[], b: NetworkEntry[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// INVALID_SOCIAL_HANDLE names the field as `linkedAccounts.<index>.username`, the index into what was sent.
export function networkErrors(sent: NetworkEntry[], fields: string[]): Partial<Record<SocialNetwork, string>> {
  const errors: Partial<Record<SocialNetwork, string>> = {};
  for (const field of fields) {
    const index = /^linkedAccounts\.(\d+)\.username$/.exec(field)?.[1];
    const network = index === undefined ? undefined : sent[Number(index)]?.network;
    if (network) {
      errors[network] =
        network === 'whatsapp'
          ? 'Введи номер з кодом країни, наприклад +380501234567'
          : `Не схоже на нікнейм у ${socialNetworks[network].name}`;
    }
  }
  return errors;
}

function withNetwork(entries: NetworkEntry[], network: SocialNetwork, username: string): NetworkEntry[] {
  return [...entries.filter((entry) => entry.network !== network), { network, username }].sort(
    (a, b) => order.indexOf(a.network) - order.indexOf(b.network),
  );
}

type Props = {
  value: NetworkEntry[];
  onChange: (value: NetworkEntry[]) => void;
  errors?: Partial<Record<SocialNetwork, string>>;
};

// Telegram always has a field; another social network gets one once it is added on П1.1. At least one must be filled:
// a mutual match needs a contact.
export function NetworkFields({ value, onChange, errors = {} }: Readonly<Props>) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const usernameOf = (network: SocialNetwork) => value.find((entry) => entry.network === network)?.username ?? '';
  const shownNetworks: SocialNetwork[] = [
    'telegram',
    ...value.map((entry) => entry.network).filter((network) => network !== 'telegram'),
  ];

  return (
    <View className="gap-3">
      {shownNetworks.map((network) => (
        <TextField
          key={network}
          label={network === 'telegram' ? 'Нікнейм у Telegram' : socialNetworks[network].name}
          placeholder={socialNetworks[network].placeholder}
          value={usernameOf(network)}
          onChangeText={(username) => onChange(withNetwork(value, network, username))}
          keyboardType={socialNetworks[network].keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={200}
          error={errors[network]}
        />
      ))}
      <Pressable accessibilityRole="button" onPress={() => setSheetOpen(true)} className="self-start">
        <Text className="font-inter-medium text-label text-brand-coral">+ Додати соцмережу</Text>
      </Pressable>

      {sheetOpen && (
        <AddSocialSheet
          visible
          options={order
            .filter((network) => network !== 'telegram')
            .map((network) => ({ network, ...socialNetworks[network] }))}
          usernameOf={usernameOf}
          onClose={() => setSheetOpen(false)}
          onAdd={(network, username) => {
            onChange(withNetwork(value, network, username));
            setSheetOpen(false);
          }}
        />
      )}
    </View>
  );
}

// A row of "Контакти для метчів" on Т4; it opens the profile in the social network.
export function NetworkLink({
  network,
  username,
  url,
  onOpen,
}: Readonly<LinkedAccount & { onOpen: (url: string) => void }>) {
  const shown = socialNetworks[network].shown(username);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${socialNetworks[network].name}: ${shown}`}
      onPress={() => onOpen(url)}
      className="flex-row items-center gap-2.5"
    >
      <SocialNetworkIcon network={network} size={18} />
      <Text numberOfLines={1} className="flex-1 font-inter-medium text-body text-text-primary">
        {shown}
      </Text>
    </Pressable>
  );
}
