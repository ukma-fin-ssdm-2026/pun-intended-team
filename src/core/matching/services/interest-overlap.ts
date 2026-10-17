// Written with the help of Claude
export function interestOverlap(a: string[], b: string[]): number {
  const shared = a.filter((interest) => b.includes(interest)).length;
  return shared / (a.length + b.length - shared);
}
