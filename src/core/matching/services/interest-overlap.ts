// Written with the help of Claude
export function interestOverlap(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const distinctA = [...new Set(a)];
  const distinctB = [...new Set(b)];
  const shared = distinctA.filter((interest) => distinctB.includes(interest)).length;
  return shared / (distinctA.length + distinctB.length - shared);
}
