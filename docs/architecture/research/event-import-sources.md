# Event Import Sources — Research (#364)

Research done on 2026-11-03 for issue #364 (import real events). Basis for ADR-006.

## Sources

| Source | Decision | Access | Main reason |
|---|---|---|---|
| ArtWizard (artwizard.io) | In | `sitemaps/events.xml` → event pages → JSON-LD `Event` | Has coordinates; lectures, exhibitions, workshops not sold by ticket operators |
| Karabas (kyiv.karabas.com) | In | Kyiv section pages (`/concerts/`, `/exhibitions/`, …) → JSON-LD of all events on the page | All fields for ~20 events in one request; has exhibitions and sport |
| Concert.ua | Out | `/uk/catalog/kyiv/<section>` + one event page per event | Sells the same concerts as Karabas, so importing both would duplicate events and split applicants; needs 1 + N requests (address and description only on the event page); `@type` unusable for category |
| Kontramarka | Out | — | No schema.org Event data; `Crawl-delay: 10`; `/api/`, `/storage/` disallowed |

Only one ticket operator is imported, because the same event from two providers becomes two catalog events and applicants to each copy never meet in matching. FR-008 names Concert.ua only as an example ("e.g."); `ConcertUaEventProvider` and its sample feed are removed.

## robots.txt

- **ArtWizard:** disallows `/api/`, `/internal/`, `/cdn-cgi/imagedelivery/` (images), `/*/e/*/buy`. Event pages allowed.
- **Karabas:** `Allow: /`, `Crawl-delay: 1`, disallows `/ajax.php*`. Public offer is a ticket-sale contract with no clause on automated access.
- **Concert.ua:** disallows only login, `/o/`, `?style=`. Closed the connection once (flaky).
- **Kontramarka:** `Crawl-delay: 10`; disallows `/api/`, `/storage/`, search and genre filters.

## Mapping notes

### ArtWizard
- Event URLs: `/<city>/e/<slug>-YYYYMMDD` — filter `/kyiv/` and the date before fetching; `<lastmod>` gives `since`.
- `description` is a Quill Delta JSON string — join the `insert` values.
- `startDate` is Kyiv wall-clock time wrongly marked `Z` (page shows 19:00, JSON `19:00:00.000Z`) — reinterpret in Europe/Kyiv. `endDate == startDate` means no end → end of day.
- `location.geo` present. `image[0]` is under the disallowed `/cdn-cgi/imagedelivery/` — store the URL only.
- Category from the page's `type` tags (not in JSON-LD).
- An unknown or broken page returns a Next.js error shell (`html id="__next_error__"`) instead of 404 — skip and log.

### Karabas
- Section page JSON-LD has name, full description, street address, image (`image.url`), dates (20 events on `/concerts/`).
- Dates are shifted +2 h: page shows 19:00, JSON `21:00+02:00`. Take the UTC digits as Kyiv wall-clock time. `endDate` is always next-day midnight → end of day.
- No coordinates → geocoding.
- `@type` is meaningful (`MusicEvent`, `TheaterEvent`, `ScreeningEvent`, `SportsEvent`), but category comes from the section.
- Sitemap (`events_sitemap_*.xml`, 50,000 URLs each) is mostly past events — not used.

### Concert.ua (for reference)
- Correct offsets (`+02:00`). `@type` is `MusicEvent` for everything incl. stand-up and kids shows — not usable for category.
- Event pages carry several JSON-LD blocks (the same tour in other cities) — the right one has `url` equal to the page.
- No coordinates; list pages have empty `streetAddress`. Image URLs on list pages end with `:31-catalog-event_item-desktop`.

## Decisions

- Sources: ArtWizard and Karabas.
- Images: store the source URL only (`image_url`, nullable). Also store `source_url` for attribution and the ticket link.
- Coordinates missing → `Geocoder` port, Nominatim implementation (1 req/s, ODbL attribution), reuse coordinates of an existing venue with the same name and address; not found → skip and log (FR-015).
- Cross-provider merging of duplicate events is out of scope.
- Sport from football sites: considered, deferred to a separate issue; Karabas `/sport/` covers matches for now.
- Test fixtures: real pages saved in `tests/unit/fixtures/providers/{artwizard,karabas}/`.

## Categories (agreed)

Concerts, Exhibitions, Talks (lectures + discussions), Workshops, Cinema, Theatre, Stand-up, Sports, Festivals (incl. fairs), Parties, Volunteering (renamed from Toloka, listings only), Open days (kept, listings only).

| Category | ArtWizard tag | Karabas section |
|---|---|---|
| Concerts | Музика | `/concerts/` |
| Exhibitions | Виставки | `/exhibitions/` |
| Talks | Дискусії та лекції, Література | — |
| Workshops | Майстер-класи | — |
| Cinema | Кіно | `/cinema/` |
| Theatre | Театр | `/theatres/` |
| Stand-up | Гумор | — |
| Sports | — | `/sport/` |
| Festivals | Фестивалі | `/festivals/` |
| Parties | Вечірки | `/clubs/` |
| skipped | Дітям, Інше | `/child/`, `/excursions/`, `/circus/` |

## AI Usage Note

Research done by Daryna Halytska with Claude: Claude read the robots.txt files, sitemaps and page sources and summarised them; Daryna checked the pages in the browser and made the decisions.
