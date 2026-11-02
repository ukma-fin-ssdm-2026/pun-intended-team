// Written with the help of Claude
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { createCategory, deleteCategory, listAdminCategories, updateCategory, type AdminCategory } from '@/api/admin';
import type { ApiResult } from '@/api/public-client';
import { Card, ConfirmDialog, failureText, LoadState, PageHeader } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { useApiQuery } from '@/hooks/use-api-query';
import { colors } from '@/styles/tokens';

const NAME_MAX = 60;

function nameError(result: Extract<ApiResult<unknown>, { ok: false }>): string {
  if (result.status === 409) return 'Категорія з такою назвою вже є.';
  if (result.status === 400) return `Назва від 1 до ${NAME_MAX} символів.`;
  return failureText(result);
}

function NameInput({
  value,
  onChange,
  onSubmit,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  label: string;
}) {
  return (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor={colors.text.secondary}
      value={value}
      onChangeText={onChange}
      onSubmitEditing={onSubmit}
      maxLength={NAME_MAX}
      className="h-10 flex-1 rounded-xl border-[1.5px] border-border-default bg-surface-card px-3 font-inter text-body text-text-primary focus:border-brand-ink"
      style={{ outlineWidth: 0 }}
    />
  );
}

function CategoryRow({
  category,
  onChanged,
  onDelete,
}: {
  category: AdminCategory;
  onChanged: (category: AdminCategory) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const save = async (body: { name?: string; isActive?: boolean }) => {
    setBusy(true);
    setError(undefined);
    const result = await updateCategory(category.id, body);
    setBusy(false);
    if (result.ok) {
      onChanged(result.data);
      setEditing(false);
    } else {
      setError(nameError(result));
    }
  };

  return (
    <View className="gap-1.5 border-t border-border-default px-6 py-3.5">
      <View className="min-h-10 flex-row items-center gap-4">
        {editing ? (
          <View className="flex-1 flex-row items-center gap-2">
            <NameInput
              label="Назва"
              value={name}
              onChange={setName}
              onSubmit={() => void save({ name: name.trim() })}
            />
            <Button
              label="Зберегти"
              size="sm"
              variant="dark"
              loading={busy}
              onPress={() => void save({ name: name.trim() })}
            />
            <Button
              label="Скасувати"
              size="sm"
              variant="light"
              onPress={() => {
                setEditing(false);
                setName(category.name);
                setError(undefined);
              }}
            />
          </View>
        ) : (
          <Text
            className={`flex-1 font-inter-medium text-body ${category.isActive ? 'text-text-primary' : 'text-text-secondary'}`}
          >
            {category.name}
          </Text>
        )}
        <View className="w-32 flex-row items-center gap-2.5">
          <Toggle
            accessibilityLabel={`${category.name}: активна`}
            value={category.isActive}
            onValueChange={(isActive) => void save({ isActive })}
          />
          <Text className="font-inter text-caption text-text-secondary">
            {category.isActive ? 'Активна' : 'Прихована'}
          </Text>
        </View>
        <View className="w-48 flex-row justify-end gap-4">
          {!editing && (
            <Pressable accessibilityRole="button" onPress={() => setEditing(true)} hitSlop={6}>
              <Text className="font-inter-medium text-label text-text-primary">Перейменувати</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={onDelete} hitSlop={6}>
            <Text className="font-inter-medium text-label text-brand-coral">Видалити</Text>
          </Pressable>
        </View>
      </View>
      {error && <Text className="font-inter text-caption text-brand-coral">{error}</Text>}
    </View>
  );
}

export default function AdminCategories() {
  const categories = useApiQuery('categories', listAdminCategories);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string>();
  const [deleting, setDeleting] = useState<AdminCategory>();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const items = categories.data?.items;

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setAddError(undefined);
    const result = await createCategory(name);
    setAdding(false);
    if (result.ok && items) {
      categories.setData({ items: [...items, result.data] });
      setNewName('');
    } else if (!result.ok) {
      setAddError(nameError(result));
    }
  };

  const replace = (changed: AdminCategory) =>
    items && categories.setData({ items: items.map((item) => (item.id === changed.id ? changed : item)) });

  const closeDelete = () => {
    setDeleting(undefined);
    setDeleteError(undefined);
  };

  const confirmDelete = async () => {
    if (!deleting || !items) return;
    setDeleteBusy(true);
    setDeleteError(undefined);
    const result = await deleteCategory(deleting.id);
    setDeleteBusy(false);
    if (result.ok) {
      categories.setData({ items: items.filter((item) => item.id !== deleting.id) });
      closeDelete();
    } else if (result.status === 409) {
      setDeleteError('Категорію використовують події або оголошення. Її можна лише приховати.');
    } else {
      setDeleteError(failureText(result));
    }
  };

  return (
    <>
      <PageHeader title="Категорії" note="Приховані категорії не видно у фільтрах, і їх не можна обрати." />

      <Card className="gap-2 px-6 py-5">
        <Text className="font-inter-medium text-label text-text-primary">Нова категорія</Text>
        <View className="flex-row items-center gap-3">
          <NameInput label="Назва категорії" value={newName} onChange={setNewName} onSubmit={() => void add()} />
          <Button
            label="Додати"
            size="sm"
            variant="dark"
            disabled={!newName.trim()}
            loading={adding}
            onPress={() => void add()}
          />
        </View>
        {addError && <Text className="font-inter text-caption text-brand-coral">{addError}</Text>}
      </Card>

      <Card>
        <View className="flex-row gap-4 px-6 py-3">
          <Text className="flex-1 font-inter-medium text-caption text-text-secondary">Назва</Text>
          <Text className="w-32 font-inter-medium text-caption text-text-secondary">Видимість</Text>
          <View className="w-48" />
        </View>
        {items ? (
          items.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              onChanged={replace}
              onDelete={() => setDeleting(category)}
            />
          ))
        ) : (
          <LoadState failure={categories.failure} onRetry={categories.reload} />
        )}
      </Card>

      <ConfirmDialog
        visible={!!deleting}
        title={`Видалити «${deleting?.name ?? ''}»?`}
        text="Категорію можна видалити, лише поки її не використовує жодна подія чи оголошення."
        confirmLabel="Видалити"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onClose={closeDelete}
      />
    </>
  );
}
