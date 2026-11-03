# Provider Fixtures

Real responses saved on 2026-11-03 for the event import adapters. Unit tests read these files, so CI never calls the live sites. Keep the samples as saved; do not reformat them. Two public page values that gitleaks reads as API keys are replaced with `REDACTED`: the Cloudflare analytics beacon `token` on the ArtWizard pages and the `push-key` on the Karabas pages; the adapters read neither.

| File | Source | Contents |
|---|---|---|
| `artwizard/event.html` | https://artwizard.io/kyiv/e/vaga-ne-problema--20261111 | Normal event page with an `Event` JSON-LD block |
| `artwizard/event-error.html` | https://artwizard.io/kyiv/e/tom-liuis-u-kyievi-20261110 | Next.js error shell (`html id="__next_error__"`), no event data; the slug differs from the sitemap one (`kiyevi`), so this is what an unknown or broken page returns |
| `artwizard/events-sitemap.xml` | https://artwizard.io/sitemaps/events.xml | 12 of 159 entries: 8 Kyiv, 4 other cities |
| `karabas/kyiv-concerts.html` | https://kyiv.karabas.com/concerts/ | 20 events (`MusicEvent`, `TheaterEvent`, `ScreeningEvent`) |
| `karabas/kyiv-clubs.html` | https://kyiv.karabas.com/clubs/ | 20 events (`MusicEvent`, `Event`) |
| `karabas/kyiv-sport.html` | https://kyiv.karabas.com/sport/ | 1 event (`SportsEvent`) |
| `nominatim/search.json` | https://nominatim.openstreetmap.org/search for "Володимирський узвіз, 2, Київ" | One result: Національна філармонія України; the e2e tests' local server answers every geocoder request with it |

## AI Usage Note

Pages saved by Daryna Halytska from the browser; the sitemap slice and this README were prepared with Claude and checked against the live pages.
