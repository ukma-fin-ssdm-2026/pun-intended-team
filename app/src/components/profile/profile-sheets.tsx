// Written with the help of Claude
// AI Usage: "Додати соцмережу" and "Інтереси" sheets from the Figma "П1.1" and "П1.2" frames, on mock data; reviewed
// by Daryna Halytska.
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { type IconName } from '@/components/ui/icon';
import { RadioOption } from '@/components/ui/radio-option';
import { SelectChip } from '@/components/ui/select-chip';
import { Sheet } from '@/components/ui/sheet';
import { TextField } from '@/components/ui/text-field';
import { mockProfile } from '@/mocks/profile';

const networks: { name: string; icon: IconName }[] = [
  { name: 'Instagram', icon: 'camera' },
  { name: 'WhatsApp', icon: 'send' },
  { name: 'TikTok', icon: 'share' },
  { name: 'Facebook', icon: 'user' },
];

type SocialProps = {
  visible: boolean;
  // "Додати" and the backdrop return to П1; nothing is saved yet.
  onClose: () => void;
};

export function AddSocialSheet({ visible, onClose }: SocialProps) {
  const [network, setNetwork] = useState(networks[0].name);
  const [nickname, setNickname] = useState(mockProfile.socialNickname);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
        Додати соцмережу
      </Text>
      <View accessibilityRole="radiogroup" className="gap-2.5">
        {networks.map((item) => (
          <RadioOption
            key={item.name}
            icon={item.icon}
            title={item.name}
            selected={network === item.name}
            onPress={() => setNetwork(item.name)}
          />
        ))}
      </View>
      <TextField label="Нікнейм або посилання" value={nickname} onChangeText={setNickname} autoCapitalize="none" />
      <Button label="Додати" onPress={onClose} />
    </Sheet>
  );
}

type InterestsProps = {
  visible: boolean;
  // П1's choice when the sheet opens.
  selected: string[];
  onClose: () => void;
  // "Зберегти" returns to П1 with the new choice.
  onSave: (interests: string[]) => void;
};

export function InterestsSheet({ visible, selected, onClose, onSave }: InterestsProps) {
  // The parent mounts the sheet on open, so the draft starts from П1's current choice.
  const [draft, setDraft] = useState(selected);
  // An interest chosen on П1 that the full list lacks stays first, so it can still be cleared here.
  const options = [
    ...selected.filter((interest) => !mockProfile.allInterests.includes(interest)),
    ...mockProfile.allInterests,
  ];
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
            key={interest}
            label={interest}
            selected={draft.includes(interest)}
            onPress={() => toggle(interest)}
          />
        ))}
      </View>
      <Button label="Зберегти" onPress={() => onSave(draft)} />
    </Sheet>
  );
}
