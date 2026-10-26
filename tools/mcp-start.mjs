// Written with the help of Claude
// Starts the generated MCP server (src/mcp/) with a guest token from the API and renews the token
// before it expires; the server reads BEARER_TOKEN_BEARERAUTH on every call. A token that is already
// set, e.g. a signed-in account's, is used as is. Writes only to stderr: stdout is the MCP channel.
const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4100';
const RENEW_BEFORE_SECONDS = 60;
const RETRY_SECONDS = 30;

async function keepGuestToken() {
  let nextInSeconds = RETRY_SECONDS;
  try {
    const res = await fetch(`${apiBaseUrl}/api/v1/auth/guest`, { method: 'POST', signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      throw new Error(`POST /api/v1/auth/guest answered ${res.status}`);
    }
    const { accessToken, expiresIn } = await res.json();
    process.env.BEARER_TOKEN_BEARERAUTH = accessToken;
    nextInSeconds = expiresIn - RENEW_BEFORE_SECONDS;
  } catch (error) {
    console.error(
      `No guest token from ${apiBaseUrl} (${error.message}); is the API running? Retrying in ${RETRY_SECONDS} s.`,
    );
  }
  // unref: the timer alone does not keep the process running once the client disconnects.
  setTimeout(keepGuestToken, nextInSeconds * 1000).unref();
}

if (!process.env.BEARER_TOKEN_BEARERAUTH) {
  await keepGuestToken();
}
await import(new URL('../src/mcp/build/index.js', import.meta.url).href);
