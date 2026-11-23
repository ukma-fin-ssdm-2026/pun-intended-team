// Written with the help of Claude
import { useUrlListState } from '@/components/admin/admin-list';
import { AccountsList } from '@/components/admin/admin-tables';
import { PageHeader } from '@/components/admin/admin-ui';

export default function AdminUsers() {
  const control = useUrlListState();
  return (
    <>
      <PageHeader title="Користувачі" />
      <AccountsList control={control} />
    </>
  );
}
