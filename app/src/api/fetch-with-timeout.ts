// Written with the help of Claude
// React Native on Android sets no timeout of its own, so a stalled request would never settle.
const REQUEST_TIMEOUT_MS = 15 * 1000;

// React Native's AbortSignal has no `timeout()`. The timer is not cleared when fetch resolves: in a browser the body
// is read after that, and the abort covers it too.
export function fetchWithTimeout(request: Request): Promise<Response> {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(request, { signal: controller.signal });
}
