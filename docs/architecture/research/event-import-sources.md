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
- `location` has `name_ua`, `address_ua`, `latitude`, `longitude` and `city.slug` — no geocoding needed. Some `address_ua` already end with the city (5 of 40 on 2026-11-03), so the city is added only when it is missing.
- Paging is by offset and can shift between pages: on 2026-11-07, 83 records in 5 pages held one event twice (pages 1 and 2), 82 distinct events against `total` 83. A list is complete only when its distinct slugs equal `total`.
- `event_occurrences_data` lists the occurrences, unordered, in Kyiv wall-clock time wrongly marked `Z` (page shows 18:00, JSON `18:00:00.000Z`) — reinterpret in Europe/Kyiv. `date_from == date_to` → no end: unknown, stored as the end of the day; a later `date_to` → real end; 00:00 to 23:59:59 → no time given (exhibition runs; "Я бачу, вас цікавить пітьма", which Karabas sells at 18:00) → not importable. An exhibition usually has an opening with a time plus such a run.
- `picture_url` is under the disallowed `/cdn-cgi/imagedelivery/` — store the URL only.

### Karabas
- Section page JSON-LD has name, full description, street address, image (`image.url`), dates (20 events on `/concerts/`).
- **Paging** (checked on 2026-11-07): a section page shows 20 events, about 4–5 days of concerts, and ends with a "load more" link (`<a data-pagination-load-more href="/concerts/?time=<unix>&page=2">`), where `time` is the start of the page's last event. The link alone is not enough: without `per-page=20`, page 2 answers 100 events from two weeks later and skips the days between; the site's own button adds `&per-page=20`, and later pages carry it in their links. Every page is full HTML with the JSON-LD of its 20 events. The next page starts at the time of the previous page's last event, so an event may be listed on both. A section without more events has no link (`/sport/`). `/concerts/` needed 10 pages for the 28 days on 2026-11-07, `/theatres/`, with about 20 shows a day, about 30. The events of a page are in date order, except the first page of `/theatres/` (the same day, out of order) and of `/exhibitions/` (an exhibition running since 2024 first). Allowed by robots.txt (only `/ajax.php` is disallowed, which the button does not use).
- Dates are shifted +2 h: page shows 19:00, JSON `21:00+02:00`. Take the UTC digits as Kyiv wall-clock time. `endDate` midnights are not shifted: the next midnight → no end, so the end is unknown and stored as the end of the day; a later midnight → a run of shows (e.g. "Тигролови" 3–12 Nov), first show only. A time later the same day (clubs page, 19:00–21:00) is a real end, shifted like the start; a time on a later day is a run of days with that end time, first day only. A length in the description ("Тривалість вистави – 1 год 20 хв") gives the end when the `endDate` does not ([start and end times](#start-and-end-times-410)).
- No coordinates → geocoding.
- `@type` is meaningful (`MusicEvent`, `TheaterEvent`, `ScreeningEvent`, `SportsEvent`), but category comes from the section. On `/clubs/` the plain `Event` records are talks, board-game nights, wine tastings and art evenings (5 of 20 on 2026-11-03), so only its `MusicEvent` records are taken as Parties.
- Sitemap (`events_sitemap_*.xml`, 50,000 URLs each) is mostly past events — not used.

### Concert.ua (for reference)
- Correct offsets (`+02:00`). `@type` is `MusicEvent` for everything incl. stand-up and kids shows — not usable for category.
- Event pages carry several JSON-LD blocks (the same tour in other cities) — the right one has `url` equal to the page.
- No coordinates; list pages have empty `streetAddress`. Image URLs on list pages end with `:31-catalog-event_item-desktop`.

## Decisions

- Removed and cancelled events: after a full list, a provider's imported events it no longer lists are cancelled, and published again when they come back; nothing is cancelled after a failed or partial run, or a list that looks broken (no records, under half of the last full list, or a section that had events and is now empty). `/festivals/` was empty on 2026-11-07, so an empty section is possible and is compared with the last full list. See ADR-006, decision 10.
- Venues: a saved venue at the same normalized address with a similar name is reused, so one place from both providers, or listed twice by Karabas, is one venue; ArtWizard's coordinates win when they are in Kyiv. In the live data of 2026-11-08, 10 of the 94 saved venues were such duplicates, and their events moved to the venue that fits; 5 Karabas events whose venue Nominatim could not find now have one. See ADR-006, decision 7.
- Karabas: every page of each section, through the "load more" link with `per-page=20`, until the last event of a page starts after the window; at most 40 pages per section.

- Sources: ArtWizard (through its API, with its permission) and Karabas.
- Images: store the source URL only (`image_url`, nullable). Also store `source_url` for attribution and the ticket link.
- Coordinates missing → `Geocoder` port, Nominatim implementation (1 req/s, ODbL attribution), reuse coordinates of an existing venue with the same name and address; not found → skip and log (FR-015).
- Cross-provider merging of duplicate events is out of scope.
- Sport from football sites: considered, deferred to a separate issue; Karabas `/sport/` covers matches for now.
- Test fixtures: real responses saved in `tests/unit/fixtures/providers/{artwizard,karabas}/`; the ArtWizard key is never saved.

## Start and end times (#410)

Read on 2026-11-14 for the catalog window of that day, 14 November to 12 December, by a throwaway script that is not in the repository: within each site's robots.txt, with the import's User-Agent, at most one request a second per host. Basis for decision 5 of [ADR-006](../decisions/ADR-006.md).

- **Karabas:** the seven Kyiv sections the adapter reads, page after page as the adapter does, from the JSON-LD of the section pages.
- **Concert.ua:** the Kyiv sections that correspond to them, `/uk/catalog/kyiv/concerts`, `/theater`, `/festivals` and `/electronic`, every page through the `rel="next"` link, from the JSON-LD of the section pages. The list is not in date order, so every page is read whatever the window. No event page was requested on either site.
- **ArtWizard:** one read of the Kyiv events through the API, as the adapter does it.

### Ends per site

| Site | Events in the window | With a real end | Without |
|---|---|---|---|
| Karabas | 707 | 3 (`endDate` later the same day: a boxing evening 16:00–23:00 on `/sport/`, two talks 19:00–21:00 on `/clubs/`, which the adapter skips as not parties) | 704: 700 with the next midnight, 4 with a time on a later day (below) |
| Concert.ua | 78 (of 132 listed) | 78 have an `endDate` | 0 |
| ArtWizard | 70 importable (of 107) | 11 (`date_to` after `date_from`) | 59 (`date_to` equal to `date_from`) |

With the lengths and the runs below, the adapter knows the end of 204 of the 700 Karabas events it takes: 1 from a same-day `endDate`, 199 from a length, 4 as the first show of a run.

No Karabas event in the window had a later midnight as its `endDate` on that day (the run of "Тигролови" of 3 November was such a case).

### Concert.ua: how long its events last

| Section | In the window | Exactly start + 2 hours | Another length |
|---|---|---|---|
| `/concerts` | 43 | 28 | 15 |
| `/theater` | 30 | 20 | 10 |
| `/festivals` | 2 | 0 | 2 |
| `/electronic` | 3 | 3 | 0 |
| All | 78 | 51 (65 %) | 27 (35 %) |

The other lengths run from 60 to 300 minutes, most often 90, 150 and 180, plus a two-day festival (31 hours) and a play with an end 15 minutes after its start. Two hours is so common, for plays and concerts alike, that it reads as the site's default when the organizer gives no length; such an end is no more real than a missing one.

### Karabas: a length in the description

Patterns matched, only right after the word "Тривалість" or "тривалість" (with at most a few words in between, such as "вистави" or "концерту"): hours and minutes ("N год M хв", "N година M хвилин", with or without full stops and spaces), tenths of an hour ("1,5 години"), hours alone ("2 год", "2 години") and minutes alone ("90 хв", "110 хвилин"), between 10 minutes and 12 hours. Notes such as "без антракту" or "з антрактом" are ignored.

| Section | Events | Mention "тривалість" | Length read |
|---|---|---|---|
| `/theatres/` | 472 | 178 | 172 |
| `/concerts/` | 200 | 21 | 21 |
| `/exhibitions/` | 24 | 8 | 6 |
| `/cinema/`, `/sport/`, `/clubs/` | 11 | 0 | 0 |
| All | 707 | 207 (29 %) | 199 (28 %) |

Examples read: "Тривалість вистави – 1 год 50 хв", "Тривалість: 1 година 10 хвилин", "Тривалість 1 год. 40 хв.", "тривалість: 90 хв", "тривалість вистави – 1,5 години". The 8 not read: "Тривалість орієнтовна від 1 години", "Тривалість до 60 хвилин", "Тривалість однієї історії до 5 хв" (no exact length) and "Тривалість: 1 дія, 90 хвилин" (another number comes first). The lengths read run from 35 to 210 minutes; none takes its event past midnight.

Whether a length agrees with the `endDate` could not be checked: none of the 3 events with a real end has a length in its description, and all 199 lengths belong to events without an end. The only event with both a Karabas length and a Concert.ua end is "Обережно з бажаннями", 65 minutes on Karabas and the 2 hours on Concert.ua.

### Events both sites sell

Matched as decision 8 of ADR-006 does: the same start instant, a similar title (the same words, or the words of one running on in the other), and a venue name that is similar; neither list gives Concert.ua's street address.

| | Count |
|---|---|
| Events both sites sell | 30: 38 % of Concert.ua's 78, 4 % of Karabas' 707 |
| … whose Concert.ua end is exactly 2 hours | 24 |
| … whose Concert.ua end is another length | 6 |
| … for which Karabas has an end or a length | 1 (the length above) |
| Same start and title under venue names that do not match | 3 more |

Examples: "OTOY" at Stereo Plaza, 14 November 19:00; "Музика Ганса Циммера при свічках" at Будинок архітектора, 15 November 18:00 (85 minutes on Concert.ua); "Олексій Коган та Jazz in Kyiv Band" at Pepper's Club, 24 November 19:00; "Самозванці" at Театр "Особистості", 20 November 18:00; "Номер 13" at the operetta theatre, 16 November 18:00. The three with other venue names: "Палац культури КПІ ім. Ігоря Сікорського" against "Центр культури і мистецтв КПІ", and twice "Центральний будинок збройних сил України" against "Будинок Офіцерів".

So Concert.ua's ends, matched onto Karabas events, would give 6 ends that are not the 2-hour default, for under 1 % of the Karabas events.

### ArtWizard events without a start time

| | Count |
|---|---|
| Events read | 107 |
| Skipped: no start time (00:00) in the window | 27: 19 exhibitions, 8 others |
| Skipped: no occurrence in the window | 7 |
| Skipped: no category | 3 |
| Of the 27, sold by Karabas or Concert.ua with a time | 0 |

The 8 that are not exhibitions: "Oleksandr Mashovets Quartet | Brutalism" (32 Jazz Club), "Відкриття нової Цегли", "Літслей повертається!", "Максим Тощо «Хмельниччина»" and "Сольний концерт гурту «Робаний Йот»" (Mezzanine), "Hardcore Vpadlo Gig: Стіни Падуть" (Реверб), the film cycle "(ĪNFĀNS) — той, хто не мовить" (Жовтень) and "М’яке місто: День інклюзивної культури". Neither ticket site lists any of them, by title or at the same venue on the same day, so the case of "Я бачу, вас цікавить пітьма" on 3 November (00:00 on ArtWizard, 18:00 on Karabas) did not repeat: a start time for these events cannot be taken from the ticket sites.

### Karabas: an end on a later day that is not a midnight

| Event | Section | `startDate` | `endDate` |
|---|---|---|---|
| Київський музей медуз | `/exhibitions/` | 14 November 10:00 | 1 May 2027 14:00 |
| Київський океанаріум «Морська казка» | `/exhibitions/` | 14 November 10:00 | 1 May 2027 14:00 |
| Музей Miniland.UA | `/exhibitions/` | 14 November 11:00 | 31 December 20:00 |
| Світ у горіховій шкаралупі | `/theatres/` | 14 November 17:00 | 29 November 21:00 |

4 of 707. Each is a run of days, not one long event: the page of the museum shows "10:00 - 1 травня 2027, 14:00", and its start is the day the page is read. `/festivals/` lists a fifth, "FANCON 2027", outside the window.

### Requests a full run needs

| Site | Requests on 2026-11-14 | For end times |
|---|---|---|
| Karabas | 46 section pages: 26 `/theatres/`, 11 `/concerts/`, 4 `/clubs/`, 2 `/exhibitions/`, 1 each `/cinema/`, `/sport/`, `/festivals/` | No more: `endDate` and the description are in the JSON-LD of the section pages |
| Concert.ua | 11 section pages: 4 `/concerts`, 5 `/theater`, 1 `/festivals`, 1 `/electronic` | No more for `endDate`, which is in the JSON-LD of the section pages; the address and the description still need one event page each |
| ArtWizard | 6 API pages | — |

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
