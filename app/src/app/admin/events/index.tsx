// Written with the help of Claude
import { useUrlListState } from '@/components/admin/admin-list';
import { EventsList } from '@/components/admin/admin-tables';
import { PageHeader } from '@/components/admin/admin-ui';

export default function AdminEvents() {
  const control = useUrlListState();
  return (
    <>
      <PageHeader title="Події" />
      <EventsList control={control} />
    </>
  );
}
