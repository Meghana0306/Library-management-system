# API & Security Contracts

Reference for the authorization matrix, ownership rules, error envelope, and design conventions enforced by this codebase.

## 1. Authorization matrix

Enforced in `SecurityConfig` (Spring Security filter chain, STATELESS, JWT filter) —
not ad-hoc controller checks. Role names: STUDENT, STAFF, AUTHOR, LIBRARIAN.

| Pattern | Access |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/login/librarian`, `POST /api/auth/login/author` | public (the ONLY public API endpoints) |
| `GET /api/system/ai-status`, `GET /api/system/health` | public |
| `/swagger-ui/**`, `/v3/api-docs/**`, `/swagger-ui.html` | public (springdoc toggleable via `SPRINGDOC_ENABLED`, default on) |
| `/api/auth/profile/**` (GET/PUT student+author profile, POST avatar upload) | authenticated + ownership (path `{userId}` == JWT `userId`); LIBRARIAN bypass |
| `GET /api/books` (approved list), `GET /api/reviews/book/{id}` | any authenticated |
| `GET /api/files/avatar/{userId}` | any authenticated (any avatar readable — needed for reviews/user lists); POST upload owner-only |
| `GET /api/files/cover/{bookId}`, `GET /api/files/preview/{bookId}`, `GET /api/files/download`, `GET /api/files/stream` | authenticated + book-status rule (§2). Covers follow the SAME rule as files. |
| `/api/librarian/**`, `GET /api/books/pending`, `POST /api/books/approve`, `/api/books/manage/**`, `/api/books/downloaded/**`, `GET /api/borrowing-records` (all-records), `GET /api/book-requests` (all), `PUT /api/book-requests/*/status`, `PUT /api/book-requests/*/priority`, `POST /api/book-requests/*/download`, `POST /api/book-requests/*/resolve-with-alternative/**` | LIBRARIAN |
| `POST /api/books/submit`, `/api/books/author/**`, `GET /api/reviews/author/**`, `POST/DELETE /api/reviews/*/reply`, `POST/DELETE /api/reviews/*/flag`, `POST /api/reviews/analyze-sentiment` | AUTHOR (+ ownership per §3) |
| `POST /api/books/generate-summary` | AUTHOR or LIBRARIAN |
| `/api/borrow`, `/api/return/**`, `/api/borrowing-records/user/**`, `/api/notifications/**`, `/api/recommendations/**`, `/api/reading-history/**`, `/api/reading-progress/**`, `POST /api/book-requests`, `/api/book-requests/user/**`, `POST/PUT /api/reviews`, `GET /api/reviews/user/**` | STUDENT or STAFF (+ ownership per §3) |
| anything else | authenticated |

Open registration is intentional: `POST /api/auth/register` accepts
`role` = any of the four enum values, including LIBRARIAN. `SecurityMatrixIT` asserts
this succeeds so the posture is a tested fact. See the Security Note in the README.
Role value is normalized to uppercase and MUST be rejected with 400 `VALIDATION_FAILED`
if not one of the four enum values.

## 2. File/cover access rule

For `preview/{bookId}`, `download?filePath=db://book/{id}`, `stream?filePath=...`,
and `cover/{bookId}`:
- LIBRARIAN: unrestricted.
- AUTHOR: allowed when `book.authorId == principal.userId` (any status), else the status rule below.
- STUDENT/STAFF (and authors on others' books): allowed only when `book.status == APPROVED`; otherwise 403 FORBIDDEN.
File responses add `Cache-Control: private, max-age=3600` + `ETag` (hash of size+updated timestamp is fine).

## 3. Ownership semantics (two mechanisms — do not mix)

**(i) Derive-from-claim (writes where userId travels in body or path):** the server takes
the acting userId from the JWT principal and IGNORES any client-supplied userId.
Applies to: `POST /api/borrow` (body userId ignored), `POST /api/book-requests`,
`POST /api/reviews`, `POST /api/borrowing-records/user/{userId}/auto-return-expired`
(path must equal claim else 403 — it triggers side effects).

**(ii) 403-on-mismatch (path reads + resource-id writes):**
- Path reads (`GET .../user/{userId}` family: borrowing-records, active, active-count,
  notifications, recommendations, reading-history, book-requests/user, reviews/user,
  auth profile GET): if path `{userId}` != claim → 403 FORBIDDEN. LIBRARIAN bypass
  applies only where §1 permits LIBRARIAN on the route (auth profile). The user-scoped
  read families are STUDENT/STAFF-only at the filter chain — librarians use their own
  aggregate endpoints (`GET /api/borrowing-records`, `/api/librarian/**`) instead.
- Resource-id endpoints (load the resource, compare its owner to the claim, 403 on
  mismatch; LIBRARIAN bypass): `POST /api/return/{recordId}`, `POST /api/return/bulk`
  (every id checked), `PUT /api/reading-progress/{recordId}`,
  `PUT/DELETE /api/notifications/{notificationId}` (+ read-all by path userId),
  `PUT /api/reviews/{reviewId}` (review owner), review reply/flag (book's author),
  `PUT/DELETE /api/books/author/{authorId}/{bookId}` + author bulk-delete (authorId ==
  claim AND each book's authorId == claim).

Implemented by `OwnershipGuard` bean (methods like `assertOwner(Long pathUserId, LibraryPrincipal p)`,
`assertRecordOwner(BorrowingRecord r, LibraryPrincipal p)`), called at the top of each
endpoint. Never blanket SpEL.

## 4. Error envelope

All non-2xx from `GlobalExceptionHandler` AND from the security layer:

```json
{ "success": false, "code": "FORBIDDEN", "message": "human readable", "timestamp": "ISO-8601" }
```

`code` enum: `VALIDATION_FAILED, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT,
AI_DISABLED, AI_UNAVAILABLE, INTERNAL_ERROR`. No stack traces; no raw `e.getMessage()`
echoed for unexpected exceptions (catch-all logs a UUID + full trace, client gets the
UUID in `message`).

The exception classes are `exception/ApiError.java`, `exception/ErrorCode.java`,
`exception/AiDisabledException.java`, `exception/ConflictException.java`,
`exception/NotFoundException.java`, consumed by `GlobalExceptionHandler`. Security-layer
401/403 (via `ApiErrorAuthenticationEntryPoint` and `ApiErrorAccessDeniedHandler`, wired
into `SecurityConfig`) never reach `@ControllerAdvice` — these two serialize the same
envelope independently.

## 5. Atomic quantity/status semantics

- All book quantity math via `@Modifying(clearAutomatically = true, flushAutomatically = true)`
  conditional updates. Borrow: `UPDATE Book SET quantity = quantity - 1 WHERE id = :id AND quantity > 0`.
  Return: unconditional `quantity = quantity + 1` but ONLY after a successful status transition.
- Status transition gate: `UPDATE BorrowingRecord SET status='RETURNED', returnDate=:now
  WHERE id=:id AND status='BORROWED'` — increment quantity only when this returns 1 row.
  Applies to: self-return, bulk return, per-user auto-return, scheduled auto-return.
- A 0-row conditional update THROWS `ConflictException` (→ 409 CONFLICT, transaction rolls
  back). Never return a ResponseEntity from the failure path of a @Transactional method —
  that commits partial state (phantom borrowing record).
- Borrow order: (1) auto-return expired for user, (2) validations (APPROVED status,
  no duplicate active borrow of same book, active count < 5), (3) atomic decrement
  (0 rows → ConflictException), (4) save record. No entity `setQuantity` writes anywhere.

## 6. AI capability probe

`GET /api/system/ai-status` → `200 {"aiEnabled": bool, "features": {"summary": bool, "sentiment": bool}}`
(driven by `GeminiService.isEnabled()` = key non-blank). Book-request download is NOT an
AI feature — it works without a key (description falls back to placeholder text); only
its auto-description caption reflects AI availability. Gemini key sent via
`x-goog-api-key` header, never in the URL. Shared `RestTemplate` bean (the shared
`RestTemplateConfig`, bean name `externalRestTemplate`, 10s connect / 30s read) used by
GeminiService AND BookDownloadService.

## 7. SSRF rules for BookDownloadService

Caller-supplied `sourceUrl`: scheme must be `https`; resolve DNS and reject
private/loopback/link-local/metadata ranges (10/8, 172.16/12, 192.168/16, 127/8,
169.254/16, ::1, fc00::/7, fe80::/10); cap downloaded bytes at `file.upload.max-size`
(10MB) with a bounded stream copy (abort past limit, don't trust Content-Length).

## 8. Frontend route table

```
/                → LandingPage
/student/login   → auth page (login default, register link)   /author/login, /librarian/login same
/student         → RequireRole(['STUDENT','STAFF']) → features/student/StudentPortal
/author          → RequireRole(['AUTHOR']) → features/author/AuthorPortal
/librarian       → RequireRole(['LIBRARIAN']) → features/librarian/LibrarianPortal
*                → NotFoundPage
```
`/crash` deleted. `RequireRole` redirects to the matching portal login on missing auth,
and to the CORRECT portal (by role) on role mismatch — no 403 dead-ends.

## 9. Frontend auth + API conventions

- Single localStorage key `library.auth` = `{token, userId, username, fullName, role}`.
  Legacy `token` key migrated then removed on first load. Per-portal session-snapshot
  keys stay as today (minus crash markers).
- `api.js`: base URL `import.meta.env.VITE_API_BASE_URL ?? '/api'`; 15s timeout; request
  interceptor attaches Bearer; response interceptor: 401 → clear auth + redirect to the
  current portal's login; 403 → notification; 503 `AI_DISABLED` → quiet notification;
  network error → notification; unwraps §4 envelope into `ApiError` class.
- `AuthImage`/`useObjectUrl`: separate axios instance WITHOUT the global interceptors;
  404 → quiet placeholder (no toast, no logout); object-URL cache keyed by URL in the
  provider so tab switches don't refetch; revoke on cache eviction.
- Service surface in `services/index.js` unchanged (6 objects, same method names) plus
  `systemService.getAiStatus()`. Dead `authAPI.logout()` removed.
- Lint: flat `eslint.config.js` with `files: ["**/*.{js,jsx}"]`, `ignores: ["dist/**", "node_modules/**"]`;
  package.json script is `eslint .` (NO `--ext` — invalid in flat mode).

## 10. Design conventions (Theme v2) — "warm bookish", light + dark

Identity: a modern reading room — warm paper, deep forest green, amber. Literary but
professional.

**Palettes (`src/theme.js`, all 10-shade).** `forest` = primary (NOT violet/purple),
`primaryShade: { light: 7, dark: 4 }` — shade 7 `#1d5c46` is 7.9:1 on white, shade 4
`#6fa189` is 5.4:1 on the dark surface. `amber` (`#c98a2d` at shade 6) is accent ONLY:
highlights, star ratings, the active-nav marker, unread-count badges — never a second
primary. Mantine's blue-tinted neutrals are replaced wholesale: `gray` → warm parchment
(0 `#faf6ef` paper, 3/4 borders, 6 dimmed text), `dark` → warm charcoal-green (9
`#151a17` page ground, 7 `#1e2420` surface, 4 `#2e372f` border). `green`/`orange`/`red`
are hue-shifted warm but stay on Mantine's luminance ladder so the Badge contrast maths
hold. `autoContrast: true`; `theme.black` is a warm `#221f1a`.

**Colour scheme.** `forceColorScheme` is gone. `MantineProvider` uses
`defaultColorScheme="light"` + `localStorageColorSchemeManager({ key: 'library-color-scheme' })`;
`index.html` stamps the stored scheme onto `<html>` before first paint. Every colour in
`src/` must survive both schemes — hardcoded hex is allowed in exactly three declaration
points (`theme.js` palettes, `index.css` `--app-*` tokens, `chartTheme.js` per-scheme
series palettes); everywhere else routes through Mantine tokens, the `--app-*` variables
or `light-dark()`. Charts re-colour on toggle because `useChartTheme()` resolves the
palette per scheme at render time — recharts writes SVG paint attributes, so
module-level constants and bare `var()` do not re-resolve. The PDF page canvas stays
white in both schemes (it is paper); only the reader surround follows the scheme.

**Surfaces.** Light body = `#faf6ef`, cards/Paper white with a warm `#e2d9c9` border.
Dark body = `#151a17`, surfaces `#1e2420`. Subtle warm shadows are allowed: Card defaults
to `shadow: 'xs'`, Paper stays flat. `defaultRadius: 'md'` (6px).

**Typography.** Two self-hosted variable fonts via `@fontsource-variable/*`, imported in
`main.jsx` — NO CDN or Google Fonts request. Inter Variable = body, UI, tables. Source
Serif 4 Variable = headings, the header wordmark and `PageHeader` titles, weight 600.
Headings h1 26 / h2 21 / h3 17.

**Chrome.** `PortalShell`'s header is the identity anchor: a deep green band
(`#22342c` light, `#1d2a24` dark) with cream text, an amber book mark, a serif wordmark
+ portal name, header actions restyled as cream outlines, a sun/moon `ColorSchemeToggle`
(aria-labelled) and the avatar menu. Focus rings inside the band are amber, forest
everywhere else. Navigation stays a left `NavLink` rail on a tinted strip; the active
item gets the forest light tint plus a 3px amber inset bar. The landing page is
left-anchored with a serif display title, a one-line tagline and three portal cards
(amber spine, hover lift) — not a centered gradient hero.

**Component defaults.** Button size sm, variant default ('filled' = the single primary
action per view); Card withBorder shadow xs radius md; Paper withBorder radius md;
Table dense highlightOnHover withTableBorder; Modal centered radius md overlay blur 0;
Badge variant light; Notification radius md withBorder; inputs size sm.

**Conventions.** Palette stays forest/amber, not purple/violet; gradients are limited to
a subtle tint on a small surface, never a full-viewport hero; no emoji in UI chrome;
radius capped at 8px; at most one filled (primary) button visible per view. Records →
dense Table (card grid only for the student book browser). Status → Badge light
green/orange/red/gray, stars amber (`var(--app-star)`). Icons @tabler/icons-react size 16
stroke 1.5. Loading → Skeleton. Empty → shared `EmptyState`, which renders an inline
line-art shelf glyph using `currentColor`.

## 11. Build/infra facts

- `maven-failsafe-plugin` bound in `<build><plugins>`.
- Spring Boot stays 2.7.18 (terminal OSS release — do NOT bump). Flyway
  `baseline-on-migrate`/`baseline-version` removed from application.yml.
  `application-dev.yml` DELETED (its ddl-auto:update was a schema-drift footgun).
- JWT: `JWT_SECRET` env var required, ≥32 bytes, fail-fast at startup with a helpful
  message. No hardcoded default. HS256. Claims: `userId` (Long), `role` (String).
- CORS: `${CORS_ALLOWED_ORIGINS:http://localhost:3000}` comma-split. All `@CrossOrigin`
  annotations removed.
- docker-compose: postgres:16 on 5433, POSTGRES_USER/PASSWORD=postgres, db library_db,
  new volume `library-pgdata`, healthcheck. Adoption: `docker rm -f library-db &&
  docker volume rm library_db_data && docker compose up -d`.
- V13 migration additionally: backfill `UPDATE books SET quantity=1 WHERE quantity IS NULL`
  then `SET NOT NULL`; `book_change_logs.book_id` → NULLABLE + FK `ON DELETE SET NULL`
  (entity drops `nullable=false`); NULL pre-existing orphans (do not delete); new column
  `book_change_logs.book_title VARCHAR(255)` snapshotted at write time.
- `database/seed/demo-seed.sql` creates four demo accounts (student, staff, author,
  librarian) and a few approved books — metadata only, no file bytes; files are uploaded
  through the UI.
- pdfjs-dist pinned exactly at 4.10.38 in frontend/package.json.
- vite.config.js: keeps the `bypassPdfjsCss` plugin; `preview.proxy` mirrors
  `server.proxy`.
