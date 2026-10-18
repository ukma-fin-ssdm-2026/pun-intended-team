export function canApply(statuses: string[]): boolean {
  if (statuses.includes('in_pool')) {
    return false;
  }
  if (statuses[0] === 'withdrawn') {
    return true;
  }
  return statuses.length === 0;
}
