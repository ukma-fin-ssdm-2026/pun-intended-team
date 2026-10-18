export function canApply(statuses: string[]): boolean {
  const blockingStatuses = ['in_pool', 'paused', 'paired'];
  for (const status of blockingStatuses) {
    if (statuses.includes(status)) {
      return false;
    }
  }
  if (statuses[0] === 'withdrawn') {
    return true;
  }
  return statuses.length === 0;
}
