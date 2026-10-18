export function canApply(statuses: string[]): boolean {
  const blockingStatuses = ['in_pool', 'paused', 'paired'];
  for (const status of blockingStatuses) {
    if (statuses.includes(status)) {
      return false;
    }
  }
  return true;
}
