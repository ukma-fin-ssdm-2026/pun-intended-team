# Traceability Matrix — Nearby

Мета: показати відповідність функціональних вимог компонентам архітектури.
Правило перевірки: жодної вимоги без компонента, жодного компонента без вимоги.
Компоненти за high-level-design.md.

**Легенда:**
CMP-01 — Client (Expo) · CMP-02 — Main server (NestJS, incl. matching) ·
CMP-03 — Notification service · CMP-04 — Event import service · CMP-05 — PostgreSQL ·
EXT-01 — Зовнішні афіш-сервіси · EXT-02 — Expo Push · EXT-03 — SMS/Telegram provider

| Вимога | Компонент | Коментар |
|--------|-----------|----------|
| FR-001 | CMP-01, CMP-02, CMP-05 | Форма на клієнті; автентифікація й видача JWT — на сервері; користувач зберігається в БД. |
| FR-002 | CMP-01, CMP-02, CMP-05 | Форма профілю на клієнті, збереження через сервер у БД. |
| FR-006 | CMP-01, CMP-02, CMP-05 | Каталог рендериться на клієнті, дані читаються через сервер з БД. |
| FR-007 | CMP-01, CMP-02 | Фільтри — параметри запиту від клієнта до сервера. |
| FR-008 | CMP-04, EXT-01 | Event import service періодично тягне події із зовнішніх провайдерів. |
| FR-016 | CMP-01, CMP-02, CMP-05 | Клієнт обирає подію; сервер додає користувача в пул матчингу (зберігається в БД). |
| FR-017 | CMP-02, CMP-05 | Уся логіка ранжування кандидатів — на сервері (не в окремому worker'і); дані пулу в БД. |
| FR-019 | CMP-02, CMP-05 | Розкриття контактів після взаємного підтвердження — перевіряється й виконується виключно на сервері. |
| FR-023 | CMP-02, CMP-05, CMP-03, EXT-02 | Сервер пише подію матчу і повідомлення в один transactional outbox; Notification service забирає й шле через Expo Push. |
| FR-024 | CMP-03, CMP-05, EXT-02 | Заплановане завдання нагадування виконує Notification service, доставка через Expo Push. |
| FR-027 | CMP-02, CMP-05 | Бан користувача — дія адміністратора через сервер, статус у БД. |
| SEC-001 | CMP-02 | Правило взаємного підтвердження перевіряється виключно на сервері — інваріант архітектури, не можна обійти прямим викликом API. |
| FR-003 | | |
| FR-004 | | |
| FR-005 | | |
| FR-009 | | |
| FR-010 | | |
| FR-011 | | |
| FR-012 | | |
| FR-013 | | |
| FR-014 | | |
| FR-015 | | |
| FR-018 | | |
| FR-020 | | |
| FR-021 | | |
| FR-022 | | |
| FR-025 | | |
| FR-026 | | |
| FR-028 | | |
| FR-029 | | |
| FR-030 | | |
| FR-031 | | |
| FR-032 | | |
| FR-033 | | |

## Сценарії атрибутів якості

## AI Usage Note
Claude helped formalize the idea, structure the mapping, and prepare several possible component assignments and comments based on requirements.md and high-level-design.md. I reviewed all the proposed variants and verified the final mapping.
