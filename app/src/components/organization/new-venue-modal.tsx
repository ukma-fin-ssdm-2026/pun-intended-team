// Written with the help of Claude
// "Нове місце" has no Figma frame: a desktop dialog with the map of Д2.1 "Місце на мапі" and the fields of DО2.
import { useState } from 'react';
import { Text, View } from 'react-native';

import type { ApiResult } from '@/api/public-client';
import { createVenue, type Venue } from '@/api/venues';
import { failureMessage } from '@/auth/messages';
import { KYIV_CENTER, type MapPoint } from '@/components/map/kyiv';
import { PointPickerMap } from '@/components/map/point-picker-map';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { TextField } from '@/components/ui/text-field';
import { colors } from '@/styles/tokens';

// The API's limits.
const NAME_MAX = 100;
const ADDRESS_MAX = 200;
// Д2.1 "Мітка / Обране місце": a 48 px pin.
const PIN_SIZE = 48;
const DROP_PIN_SHADOW = '0px 6px 12px rgba(0, 0, 0, 0.25)';
// As the DО3 dialog.
const DIALOG_SHADOW = '0px 24px 32px rgba(0, 0, 0, 0.25)';

function venueFailure(failure: Extract<ApiResult<unknown>, { ok: false }>): string {
  switch (failure.code) {
    case 'ORGANIZATION_NOT_VERIFIED':
      return 'Місця додає лише підтверджена організація. Твій акаунт ще не підтверджено.';
    case 'VENUE_OUTSIDE_CITY':
      return 'Місце має бути в Києві. Перетягни мапу до потрібної будівлі.';
    case 'VALIDATION_ERROR':
      return `Перевір поля: назва до ${NAME_MAX} символів, адреса до ${ADDRESS_MAX}.`;
    default:
      return failureMessage(failure);
  }
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (venue: Venue) => void;
};

export function NewVenueModal({ visible, onClose, onCreated }: Props) {
  return (
    <Overlay visible={visible} onClose={onClose} placement="center">
      {/* A new form each time it opens. */}
      {visible && <NewVenueForm onClose={onClose} onCreated={onCreated} />}
    </Overlay>
  );
}

function NewVenueForm({ onClose, onCreated }: Omit<Props, 'visible'>) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<MapPoint>(KYIV_CENTER);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>();

  const trimmedName = name.trim();
  const trimmedAddress = address.trim();
  const errors = {
    name: !trimmedName ? 'Додай назву' : trimmedName.length > NAME_MAX ? `До ${NAME_MAX} символів` : undefined,
    address: !trimmedAddress
      ? 'Додай адресу'
      : trimmedAddress.length > ADDRESS_MAX
        ? `До ${ADDRESS_MAX} символів`
        : undefined,
  };

  // createVenue never rejects: a failure comes back as a result and is shown above the button.
  const submit = async () => {
    setSubmitted(true);
    setFormError(undefined);
    if (errors.name || errors.address) return;
    setSaving(true);
    const result = await createVenue({ name: trimmedName, address: trimmedAddress, location: point });
    setSaving(false);
    if (result.ok) {
      onCreated(result.data);
    } else {
      setFormError(venueFailure(result));
    }
  };

  return (
    <View
      accessibilityViewIsModal
      className="h-[560px] w-full max-w-[880px] flex-row self-center overflow-hidden rounded-[28px] bg-surface-card"
      style={{ boxShadow: DIALOG_SHADOW }}
    >
      <View className="flex-1 overflow-hidden bg-[#ECECE7]">
        <PointPickerMap onMove={setPoint} />
        {/* The map's centre is the venue's point: the pin stands over it and the map moves underneath. */}
        <View
          className="absolute items-center justify-center rounded-3xl border-[3px] border-surface-card bg-brand-coral"
          style={{
            width: PIN_SIZE,
            height: PIN_SIZE,
            left: '50%',
            top: '50%',
            marginLeft: -PIN_SIZE / 2,
            marginTop: -PIN_SIZE / 2,
            boxShadow: DROP_PIN_SHADOW,
            pointerEvents: 'none',
          }}
        >
          <Icon name="pin" size={22} color={colors.text['on-dark']} />
        </View>
      </View>

      <View className="w-[360px] gap-4 p-6">
        <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
          Нове місце
        </Text>
        <TextField
          label="Назва"
          required
          value={name}
          onChangeText={setName}
          placeholder="Галявина в парку Наталка"
          error={submitted ? errors.name : undefined}
        />
        <TextField
          label="Адреса"
          required
          value={address}
          onChangeText={setAddress}
          placeholder="вул. Набережно-Лугова, Київ"
          error={submitted ? errors.address : undefined}
        />
        <Text className="font-inter text-caption text-text-secondary">
          Перетягни мапу, щоб мітка стояла на вході до місця
        </Text>
        <View className="flex-1" />
        {formError && (
          <Text accessibilityRole="alert" className="text-center font-inter text-caption text-brand-coral">
            {formError}
          </Text>
        )}
        <Button
          label="Додати місце"
          variant="dark"
          loading={saving}
          // The promise comes from `submit`, which shows its own failures.
          onPress={() => void submit()}
        />
        <Button label="Скасувати" variant="light" disabled={saving} onPress={onClose} />
      </View>
    </View>
  );
}
