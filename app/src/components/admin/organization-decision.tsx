// Written with the help of Claude
import { useState } from 'react';

import { approveOrganization, rejectOrganization } from '@/api/admin';
import { ConfirmDialog, failureText } from '@/components/admin/admin-ui';

export type Decision = 'approve' | 'reject';

const decisions: Record<Decision, { run: typeof approveOrganization; title: string; text: string; label: string }> = {
  approve: {
    run: approveOrganization,
    title: 'Підтвердити організацію?',
    text: 'Організація зможе публікувати події.',
    label: 'Підтвердити',
  },
  reject: {
    run: rejectOrganization,
    title: 'Відхилити заявку?',
    text: 'Організація зможе надіслати заявку ще раз.',
    label: 'Відхилити',
  },
};

type Pending = { accountId: string; name: string; decision: Decision };

// The confirmation of a decision on an organization request; `onDecided` runs after it is saved or found already made.
export function useOrganizationDecision(onDecided: () => void) {
  const [pending, setPending] = useState<Pending>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const close = () => {
    setPending(undefined);
    setError(undefined);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(undefined);
    const result = await decisions[pending.decision].run(pending.accountId);
    setBusy(false);
    if (result.ok) {
      onDecided();
      close();
    } else if (result.code === 'CANNOT_DECIDE_OWN_REQUEST') {
      setError('Це має розглянути інший адміністратор.');
    } else if (result.status === 409) {
      setError('Цю заявку вже розглянули.');
      onDecided();
    } else {
      setError(failureText(result));
    }
  };

  const dialog = (
    <ConfirmDialog
      visible={!!pending}
      title={pending ? decisions[pending.decision].title : ''}
      text={pending ? `${pending.name}. ${decisions[pending.decision].text}` : ''}
      confirmLabel={pending ? decisions[pending.decision].label : ''}
      busy={busy}
      error={error}
      onConfirm={() => void confirm()}
      onClose={close}
    />
  );

  return { decide: setPending, dialog };
}
