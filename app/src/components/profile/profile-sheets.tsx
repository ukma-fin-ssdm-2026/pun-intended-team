// Written with the help of Claude
// AI Usage: "Додати соцмережу" and "Інтереси" sheets from the Figma "П1.1" and "П1.2" frames, on mock data; reviewed
// by Daryna Halytska.
import { useState } from 'react';
import { Text, View, type KeyboardTypeOptions } from 'react-native';

import type { components } from '@/api/schema';
import { Button } from '@/components/ui/button';
import { RadioOption } from '@/components/ui/radio-option';
import { SelectChip } from '@/components/ui/select-chip';
import { Sheet } from '@/components/ui/sheet';
import { SocialNetworkIcon } from '@/components/ui/social-network-icon';
import { TextField } from '@/components/ui/text-field';

type SocialNetwork = components['schemas']['SocialNetwork'];

type SocialProps = {
  visible: boolean;
  options: { network: SocialNetwork; name: string; placeholder: string; keyboardType?: KeyboardTypeOptions }[];
  // The nickname already in the form for a social network, so picking it shows what will be replaced.
  usernameOf: (network: SocialNetwork) => string;
  onClose: () => void;
  onAdd: (network: SocialNetwork, username: string) => void;
};

export function AddSocialSheet({ visible, options, usernameOf, onClose, onAdd }: Readonly<SocialProps>) {
  const [network, setNetwork] = useState(options[0].network);
  const [nickname, setNickname] = useState(usernameOf(options[0].network));
  const chosen = options.find((option) => option.network === network) ?? options[0];
  const choose = (next: SocialNetwork) => {
    setNetwork(next);
    setNickname(usernameOf(next));
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
        Додати соцмережу
      </Text>
      <View accessibilityRole="radiogroup" className="gap-2.5">
        {options.map((item) => (
          <RadioOption
            key={item.network}
            icon={(color) => <SocialNetworkIcon network={item.network} size={20} color={color} />}
            title={item.name}
            selected={network === item.network}
            onPress={() => choose(item.network)}
          />
        ))}
      </View>
      <TextField
        label="Нікнейм або посилання"
        placeholder={chosen.placeholder}
        value={nickname}
        onChangeText={setNickname}
        keyboardType={chosen.keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={200}
      />
      <Button label="Додати" disabled={!nickname.trim()} onPress={() => onAdd(network, nickname)} />
    </Sheet>
  );
}

type InterestsProps = {
  visible: boolean;
  options: components['schemas']['Interest'][];
  // The form's choice of interest ids when the sheet opens.
  selected: string[];
  onClose: () => void;
  // "Зберегти" returns to the form with the new choice.
  onSave: (interests: string[]) => void;
};

export function InterestsSheet({ visible, options, selected, onClose, onSave }: Readonly<InterestsProps>) {
  // The parent mounts the sheet on open, so the draft starts from the form's current choice.
  const [draft, setDraft] = useState(selected);
  const toggle = (interest: string) =>
    setDraft((current) =>
      current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest],
    );

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View className="flex-row items-center justify-between">
        <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
          Інтереси
        </Text>
        <Text className="font-inter-medium text-label text-text-secondary">обрано {draft.length}</Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {options.map((interest) => (
          <SelectChip
            key={interest.id}
            label={interest.name}
            selected={draft.includes(interest.id)}
            onPress={() => toggle(interest.id)}
          />
        ))}
      </View>
      <Button label="Зберегти" onPress={() => onSave(draft)} />
    </Sheet>
  );
}
