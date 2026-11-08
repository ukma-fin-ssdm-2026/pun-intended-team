// Written with the help of Claude

// The Ukrainian noun form for a count: "1 подія", "2 події", "5 подій"; 11 to 14 take the last form.
export function plural(count: number, [one, few, many]: [string, string, string]): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo < 11 || lastTwo > 14) {
    if (last === 1) return one;
    if (last >= 2 && last <= 4) return few;
  }
  return many;
}
