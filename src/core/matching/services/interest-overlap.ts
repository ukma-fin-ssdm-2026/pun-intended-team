// Written with the help of Claude
export function interestOverlap(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const shared = a.filter((interest) => b.includes(interest)).length;
  return shared / (a.length + b.length - shared);
}
