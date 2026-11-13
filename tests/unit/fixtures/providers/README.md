# Provider Fixtures

Real responses saved on 2026-11-03, and Karabas pages saved on 2026-11-07 (their names carry the date), for the event import adapters. Unit tests read these files, so CI never calls the live sites or the ArtWizard API. Keep the samples as saved; do not reformat them. The public `push-key` on the Karabas pages, which gitleaks reads as an API key, is replaced with `REDACTED`; so are the CSRF tokens, and tracking parameters are removed. The adapter reads none of them. The ArtWizard API key is never saved: it is sent in the request URL only, and the responses were checked not to contain it.

| File | Source | Contents |
|---|---|---|
| `artwizard/events-page-1.json` | `GET https://api.artwizard.io/events?apiKey=REDACTED&city=kyiv&filter[event_occurrences_data.date_from:lt]=date:2026-12-01&page_size=20&page=1` | Page 1 of 4: 20 of 74 Kyiv events, from exhibitions running since August to events on 5 November |
| `artwizard/events-page-2.json` | The same request with `page=2` | Page 2 of 4: the next 20 events, 5–8 November |
| `karabas/kyiv-concerts.html` | https://kyiv.karabas.com/concerts/ | 20 events (`MusicEvent`, `TheaterEvent`, `ScreeningEvent`) |
| `karabas/kyiv-clubs.html` | https://kyiv.karabas.com/clubs/ | 20 events (`MusicEvent`, `Event`) |
| `karabas/kyiv-sport.html` | https://kyiv.karabas.com/sport/ | 1 event (`SportsEvent`) |
| `karabas/kyiv-concerts-2026-11-07-page-1.html` | https://kyiv.karabas.com/concerts/ on 2026-11-07 | 20 events, 7–8 November; its "load more" link is `/concerts/?time=1794150000&page=2` |
| `karabas/kyiv-concerts-2026-11-07-page-2.html` | `/concerts/?time=1794150000&page=2&per-page=20`, the same day | 20 events, 8–13 November; links to page 3, which was not saved |
| `karabas/kyiv-sport-2026-11-07.html` | https://kyiv.karabas.com/sport/ on 2026-11-07 | 1 event, no "load more" link: a section of one page |
| `nominatim/search.json` | https://nominatim.openstreetmap.org/search for "Володимирський узвіз, 2, Київ" | One result: Національна філармонія України; the e2e tests' local server answers every geocoder request with it |

## AI Usage Note

Pages saved by Daryna Halytska from the browser; the sitemap slice and this README were prepared with Claude and checked against the live pages.
