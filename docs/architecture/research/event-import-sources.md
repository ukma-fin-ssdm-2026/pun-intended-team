# Event Import Sources — Research (#364)

Research done on 2026-11-03 for issue #364 (import real events). Basis for [ADR-006](../decisions/ADR-006.md).

## Sources

| Source | Decision | Access | Main reason |
|---|---|---|---|
| ArtWizard (artwizard.io) | In, with ArtWizard's permission | Events API `api.artwizard.io/events` with a key, 20 events per page | Has coordinates; lectures, exhibitions, workshops not sold by ticket operators |
| Karabas (kyiv.karabas.com) | In | Kyiv section pages (`/concerts/`, `/exhibitions/`, …) → JSON-LD of all events on the page | All fields for ~20 events in one request; has exhibitions and sport |
| Concert.ua | Out | `/uk/catalog/kyiv/<section>` + one event page per event | Sells the same concerts as Karabas, so importing both would duplicate events and split applicants; needs 1 + N requests (address and description only on the event page); `@type` unusable for category |
| Kontramarka | Out | — | No schema.org Event data; `Crawl-delay: 10`; `/api/`, `/storage/` disallowed |

Only one ticket operator is imported, because the same event from two providers becomes two catalog events and applicants to each copy never meet in matching. FR-008 names Concert.ua only as an example ("e.g."); `ConcertUaEventProvider` and its sample feed are removed.

## robots.txt

- **ArtWizard:** disallows `/api/`, `/internal/`, `/cdn-cgi/imagedelivery/` (images), `/*/e/*/buy`. Event pages allowed. No longer crawled: the import uses the API ArtWizard gave access to.
- **Karabas:** `Allow: /`, `Crawl-delay: 1`, disallows `/ajax.php*`. Public offer is a ticket-sale contract with no clause on automated access.
- **Concert.ua:** disallows only login, `/o/`, `?style=`. Closed the connection once (flaky).
- **Kontramarka:** `Crawl-delay: 10`; disallows `/api/`, `/storage/`, search and genre filters.

## Terms of use

- **ArtWizard:** the public offer ([offer.pdf](https://artwizard.io/files/offer.pdf)) says the platform's databases may not be used without its permission (§11.1); event materials come from the organizers (§11.2). Permission requested on 2026-11-03 and granted the same day by Vlad Lisovyk, ArtWizard's founder, by email, with access to the API, within the scope of the request, on three conditions: Nearby stays a non-commercial study project (no ads, no paid features, no passing the data to third parties); the permission lasts for the study project, which ends by 2026-12-10, and the team asks again before then; ArtWizard is told in advance before the import changes how often it collects. Commercial use needs a separate agreement. See [ADR-006](../decisions/ADR-006.md), decision 9.
- **Karabas:** the public offer has no such clause.

## Mapping notes

### ArtWizard
First read from the sitemap and the event pages' JSON-LD; since the permission, from the events API. The API's documentation is outside the repository.
- Request: `GET https://api.artwizard.io/events?apiKey=<key>&city=kyiv&filter[event_occurrences_data.date_from:lte]=date:<today + 27 days>&filter[event_occurrences_data.date_to:gte]=date:<today>&page_size=20&page=<n>`: the coming 4 weeks the permission covers, one day less than the catalog window. Answer: `{ total, page, page_size, total_pages, data: [...] }`; 74 Kyiv events in 4 pages on 2026-11-03. A `date:` filter covers the whole day.
- `slug` is the same as in the page URLs (`<slug>-YYYYMMDD`), so it stays the external id. `details_url` is empty or another site's ticket page — the source link is `https://artwizard.io/<city>/e/<slug>`.
- `description` is a Quill Delta JSON string — join the `insert` values. `type` is the list of type tags; `status` is `published` for a public event.
- `location` has `name_ua`, `address_ua`, `latitude`, `longitude` and `city.slug` — no geocoding needed.
- `event_occurrences_data` lists the occurrences, unordered, in Kyiv wall-clock time wrongly marked `Z` (page shows 18:00, JSON `18:00:00.000Z`) — reinterpret in Europe/Kyiv. `date_from == date_to` → no end, end of day; a later `date_to` → real end; 00:00 to 23:59:59 → no time given (exhibition runs; "Я бачу, вас цікавить пітьма", which Karabas sells at 18:00) → not importable. An exhibition usually has an opening with a time plus such a run.
- `picture_url` is under the disallowed `/cdn-cgi/imagedelivery/` — store the URL only.

### Karabas
- Section page JSON-LD has name, full description, street address, image (`image.url`), dates (20 events on `/concerts/`).
- **Paging** (checked on 2026-11-07): a section page shows 20 events, about 4–5 days of concerts, and ends with a "load more" link (`<a data-pagination-load-more href="/concerts/?time=<unix>&page=2">`), where `time` is the start of the page's last event. The link alone is not enough: without `per-page=20`, page 2 answers 100 events from two weeks later and skips the days between; the site's own button adds `&per-page=20`, and later pages carry it in their links. Every page is full HTML with the JSON-LD of its 20 events. The next page starts at the time of the previous page's last event, so an event may be listed on both. A section without more events has no link (`/sport/`). `/concerts/` needed 10 pages for the 28 days on 2026-11-07, `/theatres/`, with about 20 shows a day, about 30. The events of a page are in date order, except the first page of `/theatres/` (the same day, out of order) and of `/exhibitions/` (an exhibition running since 2024 first). Allowed by robots.txt (only `/ajax.php` is disallowed, which the button does not use).
- Dates are shifted +2 h: page shows 19:00, JSON `21:00+02:00`. Take the UTC digits as Kyiv wall-clock time. `endDate` midnights are not shifted: the next midnight → no end, end of day; a later midnight → a run of shows (e.g. "Тигролови" 3–12 Nov), first show only. A time later the same day (clubs page, 19:00–21:00) is a real end, shifted like the start.
- No coordinates → geocoding.
- `@type` is meaningful (`MusicEvent`, `TheaterEvent`, `ScreeningEvent`, `SportsEvent`), but category comes from the section. On `/clubs/` the plain `Event` records are talks, board-game nights, wine tastings and art evenings (5 of 20 on 2026-11-03), so only its `MusicEvent` records are taken as Parties.
- Sitemap (`events_sitemap_*.xml`, 50,000 URLs each) is mostly past events — not used.

### Concert.ua (for reference)
- Correct offsets (`+02:00`). `@type` is `MusicEvent` for everything incl. stand-up and kids shows — not usable for category.
- Event pages carry several JSON-LD blocks (the same tour in other cities) — the right one has `url` equal to the page.
- No coordinates; list pages have empty `streetAddress`. Image URLs on list pages end with `:31-catalog-event_item-desktop`.

## Decisions

- Removed and cancelled events: after a full list, a provider's imported events it no longer lists are cancelled, and published again when they come back; nothing is cancelled after a failed or partial run, or a list that looks broken (no records, under half of the last full list, or a section that had events and is now empty). `/festivals/` was empty on 2026-11-07, so an empty section is possible and is compared with the last full list. See ADR-006, decision 10.
- Karabas: every page of each section, through the "load more" link with `per-page=20`, until the last event of a page starts after the window; at most 40 pages per section.

- Sources: ArtWizard (through its API, with its permission) and Karabas.
- Images: store the source URL only (`image_url`, nullable). Also store `source_url` for attribution and the ticket link.
- Coordinates missing → `Geocoder` port, Nominatim implementation (1 req/s, ODbL attribution), reuse coordinates of an existing venue with the same name and address; not found → skip and log (FR-015).
- Cross-provider merging of duplicate events is out of scope.
- Sport from football sites: considered, deferred to a separate issue; Karabas `/sport/` covers matches for now.
- Test fixtures: real responses saved in `tests/unit/fixtures/providers/{artwizard,karabas}/`; the ArtWizard key is never saved.

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
| Parties | Вечірки | `/clubs/`, `MusicEvent` only |
| skipped | Дітям, Інше | `/child/`, `/excursions/`, `/circus/` |

## AI Usage Note

Research done by Daryna Halytska with Claude: Claude read the robots.txt files, sitemaps and page sources and summarised them; Daryna checked the pages in the browser and made the decisions.
