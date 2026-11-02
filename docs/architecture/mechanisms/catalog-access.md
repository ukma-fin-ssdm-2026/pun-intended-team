# Catalog Access

## Decision

Browsing needs no account (FR-006), but the catalog is not an open API. A public endpoint cannot be restricted to the app, so the goal is to make **bulk copying expensive, not impossible**.

## Rules

1. **Minimal responses** — only what a screen shows; no organizer contacts, attendee or applicant counts.
2. **No bulk access** — page size capped at 20, no "list all" endpoint, catalog window limited to the coming weeks.
3. **Guest token** — issued anonymously at first launch (`/auth/guest`) and required for catalog reads, so limits and anomaly detection work per token, not only per IP.
4. **Rate limits protect real users first** — limits are per token; the per-IP limit is only a generous backstop, because a campus Wi-Fi or a carrier's shared IP puts hundreds of real users behind one address. Starting values are 100 requests/min per token and 1000 per IP (SEC-007), tuned from measured usage; a `429` carries `Retry-After` and is shown as a normal "try again in a moment" state (REL-002, INTC-004). Not built yet: so far only the auth endpoints have a limit, per IP (`AUTH_RATE_LIMIT_PER_MINUTE`, 20 a minute, with `@nestjs/throttler`).

## Planned

5. **App attestation** — if scraping is observed, the guest token is issued only after Apple App Attest / Google Play Integrity succeeds. The web build has no equivalent and falls back to a challenge (e.g. Cloudflare Turnstile).

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
