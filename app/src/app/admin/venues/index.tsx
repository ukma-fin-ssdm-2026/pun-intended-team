// Written with the help of Claude
import { useUrlListState } from '@/components/admin/admin-list';
import { VenuesList } from '@/components/admin/admin-tables';
import { PageHeader } from '@/components/admin/admin-ui';

export default function AdminVenues() {
  const control = useUrlListState();
  return (
    <>
      <PageHeader title="Місця" />
      <VenuesList control={control} />
    </>
  );
}
