// Written with the help of Claude
export function interestOverlap(a: string[], b: string[]): number {
  const interestsA = new Set(a);
  const interestsB = new Set(b);
  const allInterests = interestsA.union(interestsB);
  if (allInterests.size === 0) return 0;
  return interestsA.intersection(interestsB).size / allInterests.size;
}
