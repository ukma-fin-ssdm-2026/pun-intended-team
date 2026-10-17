// Written with the help of Claude
export function interestOverlap(a: string[], b: string[]): number {
  return a.some((interest) => b.includes(interest)) ? 1 : 0;
}
