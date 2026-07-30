# Nutri Notes

A local-first, dark-mode nutrition tracking PWA designed for fast daily logging on iPhone. Logs stay in IndexedDB on the device; there is no account or analytics. Ordinary logging works offline. An optional stateless restaurant-search worker can retrieve Australian FatSecret menu data without receiving or storing anyone's nutrition log.

> The included starter nutrition values are editable placeholders for development and convenience, not authoritative nutritional advice. Check product labels and trusted sources.

## Setup and development

Requires a current Node.js LTS release and npm.

```bash
npm install
npm run dev
```

Open the URL shown by Vite. For an on-device LAN test, run `npm run dev -- --host`.

## Testing and production

```bash
npm test
npm run test:a11y
npm run typecheck
npm run build
npm run dev -- --host
```

The production output is in `dist/`. Vite uses a relative base path, so the static output is compatible with GitHub Pages project sites. The generated service worker and web app manifest make the built app installable and cache the app shell for offline use.

## Beta deployment with GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`. Every push to
`main` runs the unit tests, strict TypeScript check, production build, browser
checks, and then publishes the generated `dist/` directory.

For the first deployment:

1. Initialise this folder as a Git repository and commit it.
2. Create an empty GitHub repository without an added README or `.gitignore`.
3. Add that repository as `origin` and push the `main` branch.
4. In the GitHub repository, open **Settings → Pages** and choose
   **GitHub Actions** as the build and deployment source.
5. Open the **Actions** tab and wait for **Test and deploy PWA** to complete.

The deployed URL appears in the workflow summary and in **Settings → Pages**.
On iPhone, open that HTTPS URL in Safari and use **Share → Add to Home Screen**.

This beta has no account system. Each browser/device owns a separate
IndexedDB database, so testers should periodically download a JSON backup from
Settings. Clearing site data or deleting the installed PWA can remove its local
records. The Pages URL is not access-controlled; use a public repository for the
simplest free deployment, or confirm private Pages availability for the GitHub
plan in use.

## Architecture

- `src/domain/` contains framework-independent types, nutrition calculations, immutable snapshot creation, totals, and day-copy logic.
- `scripts/import-*.mjs` regenerate bundled Australian restaurant catalogues from the chains' official published nutrition PDFs; generated files retain source/version metadata.
- `src/data/` contains the versioned Dexie schema, transactions, persistence services, categories, and editable seed foods.
- `src/App.tsx` contains the current mobile screen flows and accessible interaction controls.
- `src/styles.css` defines the safe-area-aware, token-driven, iPhone-first visual system.
- `worker/` contains the optional stateless FatSecret proxy used only for live Australian restaurant searches; credentials remain in Cloudflare Worker secrets.
- `vite-plugin-pwa` generates the manifest and Workbox service worker at build time.
- Vite emits stable framework, storage, date, interaction, icon, validation, recipe, and import chunks; Workbox precaches all of them for offline navigation.

Food entries store calculated nutrition snapshots rather than reading live values from the saved food database. Historical logs therefore remain stable after a food is edited. Days and templates each own ordered snapshot collections, so applying, editing, or reordering one cannot mutate its source.

Recipes use the same boundary. Saved recipes reference current foods and define a normal yield; logging freezes scaled ingredient snapshots inside the day entry. Toggling or resizing an ingredient changes only that logged meal.

### Live Australian restaurant search

The PWA never embeds FatSecret credentials. Follow [worker/README.md](worker/README.md) to deploy the Worker, then create the GitHub Actions repository variable `VITE_RESTAURANT_API_URL` containing its HTTPS URL. The Pages workflow injects only that public Worker URL into the production bundle. Search responses are not cached; a reviewed selection becomes an ordinary independent local food snapshot.

### Refreshing bundled restaurant menus

The McDonald's, Hungry Jack's, Subway and Guzman y Gomez importers require `curl` and Poppler's `pdftotext`. Each importer downloads the current official document and prints deterministic TypeScript data. To verify that checked-in data still matches its source:

```bash
diff -u src/domain/mcdonaldsMenu.generated.ts <(node scripts/import-mcdonalds.mjs)
diff -u src/domain/hungryJacksMenu.generated.ts <(node scripts/import-hungry-jacks.mjs)
diff -u src/domain/subwayMenu.generated.ts <(node scripts/import-subway.mjs)
diff -u src/domain/gygMenu.generated.ts <(node scripts/import-gyg.mjs)
```

## Implemented

- Five-item app shell with Body, Calendar, Food, Charts, and Settings navigation
- Date paging, Today/Yesterday labels, empty-day actions, and independent previous-day copying
- Dense ordered food cards, completion controls, live planned/consumed totals, and macro summary
- One-tap persistent kcal/kJ switching from the daily summary with global energy-display updates, haptic feedback and a reduced-motion-safe border pulse
- Local food search, category filters, usage metadata, custom food creation and saved-food editing
- Offline FSANZ AUSNUT 2023 catalogue search with 3,741 Australian foods, source/derivation metadata and useful source-derived household measures
- Optional Open Food Facts branded search and barcode lookup with community-source labelling
- Restaurant-first Australian fast-food flow across 50 major chains, including verified kJ-only entry without fabricated macros and source-labelled offline catalogues: 60 McDonald's core items, 118 KFC menu items, 179 Hungry Jack's items, 179 Subway items, 287 Guzman y Gomez items, plus smaller Oporto and Nando's imports
- Reproducible official-document importers for McDonald's Australia, Hungry Jack's, Subway Australia and Guzman y Gomez; generated menu data keeps the source document and revision attached to saved foods
- Camera barcode capture using native detection or the bundled open-source ZXing fallback, with manual barcode entry as a final fallback
- Nutrition-label photo intake, on-device text detection where available, iPhone Live Text/manual fallback, and parsed Australian nutrition panels
- Mandatory review confirmation before barcode, branded, or label-derived nutrition is saved
- Per-serving and per-100-g/mL nutrition, entry quantity editing, deletion, and non-blocking undo
- Eight editable seed foods and nine colour-coded categories
- Loading, validation, empty-result, deferred-feature, and database-error states
- Versioned IndexedDB storage and offline-first PWA packaging
- Full-day template conversion, duplicate-name handling, application, editing and deletion
- Touch-safe long-press entry selection and persistent drag reordering for days and templates
- Monday-first nutrition-history calendar with category dots, month navigation and read-only day previews
- Local body-weight logging with notes, editing, undoable deletion, trends and seven-day averages
- Local analytics with category/macro breakdowns, nutrition and weight trends, date filters and food rankings
- Validated versioned JSON backup/restore and spreadsheet-compatible CSV exports
- Native share-sheet backups for saving JSON to Files, iCloud Drive, Google Drive, Dropbox, AirDrop, or another compatible app, with a direct-download fallback
- Optional per-user Dropbox App Folder connection with PKCE, debounced automatic backups, offline retry, dated versions, manual backup, reviewed restore, status reporting, and token revocation on disconnect
- Optional per-user Google Drive App Data Folder connection with queued automatic backups while authorised, dated versions, manual backup, reviewed restore, clear token-renewal state, and consent revocation on disconnect
- Persisted appearance, accent, targets, week-start, copy behavior and editable food categories
- Entry replacement that preserves order, consumed state and notes, plus accessible move-up/down controls
- Individual entry move/copy between dates with independent snapshots and non-blocking undo
- iOS home-screen metadata and dedicated 180, 192 and 512 pixel install icons
- Kilogram/pound body-weight display and input with canonical kilogram persistence
- Category ordering and guarded deletion with food, day-snapshot and template reassignment
- Saved recipes and meal combos assembled from searchable food-database ingredients
- Per-log recipe ingredient snapshots with quantity editing and optional-ingredient toggles
- Per-log ingredient addition from saved foods or a new inline food
- Fractional recipe-serving logging with automatic ingredient scaling
- Logged-recipe serving rescaling, meal-only ingredient removal, and explicit save destinations
- Update-original and save-as-new recipe workflows built from enabled meal ingredients
- Long-press drag handles for ingredient ordering in saved recipes and individual logged meals
- One-tap saved-recipe duplication and recipe badges in daily food cards
- Optional ingredient groups and ordered preparation steps, frozen into logged recipe snapshots
- Fully local pasted-text recipe import with parsing, food matching, quantity review, inline creation of missing foods, and explicit save
- Inline custom ingredient creation inside the recipe builder
- Editable default Beef Rice Bowl example recipe
- Refresh-safe primary screen and selected-date restoration using GitHub Pages-compatible URL hashes
- Multi-week template scheduling with selectable weekdays, date-range preview, safe populated-day skipping, and explicit replacement
- Persistent scheduled-plan management with future-only editing and safe cancellation choices
- Calendar schedule markers, named plan previews, and preflight overlap/conflict handling
- Per-date schedule exceptions for skipped days and one-off template substitutions
- Calendar projections for normal, skipped, substituted, and conflicted schedule dates, including empty skipped dates
- Production chunking that keeps the main application bundle below 100 kB while preserving fully offline lazy recipe flows

## Intentionally deferred

- Multi-serving cards, day overflow actions, swipe navigation, and component-level route tests
- URL recipe fetching

## Australian food data and imports

The bundled reference catalogue is a transformed subset of **AUSNUT 2023**
published by Food Standards Australia New Zealand. It is loaded into a separate
IndexedDB table and is not duplicated into cloud/JSON backups; selecting an
official food materialises only that record into the editable local food
library. Official records retain their FSANZ public food key, dataset version,
derivation and source URL. Editing one creates a clearly identified custom copy
so modified values are not misrepresented as official FSANZ values.

The transformed catalogue is attributed and distributed under the FSANZ Data
User Licence Agreement based on CC BY-SA 3.0 Australia; see
`public/catalog/NOTICE.txt`. Branded results come from Open Food Facts and are
explicitly marked as community-contributed; Open Food Facts database content is
available under the Open Database Licence (ODbL). Branded lookup is optional network
use; saved foods, FSANZ search and ordinary logging remain offline.

Label photos remain in browser memory and are not persisted or uploaded by
Nutri Notes. Native on-device text detection is used when available. Browsers
without it can use iPhone Live Text to paste the panel text before the same
manual review step. Camera frames are not retained; only an explicitly submitted
barcode is sent to the branded-food provider.

## Template and ordering milestone

Populated days can be converted into independent full-day templates from the day menu. Existing names offer Replace or Save Copy. Templates can be applied from the picker, renamed, pruned, deleted, and reordered. A guarded 350–380 ms hold enters card edit mode; cards can then be dragged without rebuilding their database records.

## Calendar/history milestone

The Calendar reads directly from day logs and entry snapshots. It provides Monday-first complete-week grids, month and Today navigation, category dots, previous/next date selection, compact food and macro previews, and a direct handoff to the editable day.

## Body-weight milestone

The Body tab stores dated kilogram measurements and optional notes locally. It supports same-day updates, editing, undoable deletion, a compact recent trend, overall change, and a trailing seven-calendar-day average calculated from raw entries.

## Charts milestone

The Charts tab calculates analytics on demand from immutable day snapshots and weight entries. It includes category and macro calorie breakdowns, daily calorie/macro trends, body-weight trends, food frequency/contribution statistics, and All/Year/Month/Week/Day/custom date ranges.

## Data-portability milestone

Settings provides a versioned, validated full JSON backup containing foods, recipes, categories, templates, day logs, ordered snapshots and body weight. Imports support merge or replace; replace first downloads the current database. Separate UTF-8 CSV exports cover day totals, food entries and weight history, with CRLF rows, spreadsheet-safe text and numeric values left numeric.

On compatible HTTPS browsers, **Share or save backup** passes the JSON file to
the operating system share sheet. This lets iPhone users save into Files,
iCloud Drive, Google Drive, Dropbox, AirDrop, or another installed share target
without granting Nutri Notes access to a cloud account. Unsupported browsers
fall back to a normal JSON download, and the dedicated download action remains
available separately.

Users can also optionally connect their own Dropbox account. Nutri Notes uses
OAuth code flow with PKCE and the public Dropbox App key; no app secret or
Dropbox password is stored by the PWA. Dropbox grants access only to the Nutri
Notes App Folder in that user's account. The refresh token remains in that
browser's local storage and is intentionally excluded from exported backups.

After a database mutation, the app records a persistent dirty flag and queues a
debounced upload while it is open and online. It maintains
`nutri-notes-latest.json` plus one overwritten snapshot per calendar date. A
queued backup retries on the next app launch or network reconnection. iOS does
not guarantee PWA execution while the app is fully closed, so uploads are not
described as closed-app background sync.

Google Drive uses the non-sensitive `drive.appdata` scope and Google Identity
Services' browser token model. Files are hidden in each user's Drive App Data
Folder and cannot be accessed by other Drive applications. Google browser
tokens are intentionally short-lived and do not include refresh tokens; after
expiration the UI requests a user-driven reconnection, then immediately uploads
the persistent queue. This avoids introducing a token-holding backend or
embedding a client secret. Google tokens are stored only in that browser and
are excluded from Nutri Notes JSON backups.

## Preferences milestone

Settings schema version 3 stores appearance (dark/light/system), accent colour, week start, copy-consumed behavior and daily nutrition targets. These preferences alter the live UI, calendar, copy workflow and daily summary. Category names and colours are editable and new categories can be added without changing historical snapshot IDs.

## PWA and accessibility hardening

The install package now includes standard PNG icons and Apple home-screen metadata alongside the maskable SVG. Long-press drag ordering has equivalent move-up/down buttons, and food replacement retains the entry record, position, completion state and note while creating a new immutable nutrition snapshot.

## Entry transfer milestone

An entry can be moved or copied to another date from its editor. Moves retain the original record, state and source position for undo; copies receive an independent ID and snapshot and default to not consumed. Destination ordering remains contiguous.

## Units and category management milestone

Body weight remains stored in kilograms and is converted only at the input/display boundary, preventing preference changes from degrading historical precision. Categories can be moved, renamed, recoloured, or deleted after choosing a replacement; deletion updates saved foods and historical/template category references transactionally.

## Recipes and meal combos milestone

The food picker includes a Recipes tab. Recipes can be created, edited, duplicated, deleted, categorised, assigned a serving yield, reordered, and assembled from saved foods. Logged recipes open an ingredient-level editor where items can be unchecked, resized, removed, added, or reordered for that meal without changing the saved recipe. Recipe data participates in JSON backup/restore, copied days, full-day templates, and IndexedDB schema version 5.

Schema version 6 adds an editable Beef Rice Bowl example recipe for new and existing installations that do not already contain recipes. Logging accepts decimal serving counts and scales every ingredient snapshot. New per-100-g/mL foods can also be created without leaving the recipe builder.

Schema version 7 adds optional ingredient group labels and preparation steps. Existing recipes remain valid; the editable Beef Rice Bowl example is upgraded with a group and sample directions. Both are copied into logged meals so later edits to the saved recipe do not rewrite history.

Schema version 8 stores reusable template schedules and tags generated day logs with their originating plan. Editing a plan rebuilds only future tagged days; cancelling can retain all generated logs or remove future generated days while always preserving today and historical logs. Schedule definitions are included in full JSON backup and restore.

Schema version 9 adds persisted date exceptions to scheduled plans. An exception can omit a scheduled date or substitute another saved full-day template for that date. Existing schema-v8 plans are upgraded with an empty exception list, and backup validation remains compatible with older exports.

Recipes can also be imported from pasted plain text. The parser recognises recipe name, serving yield, Ingredients/Instructions headings, group headings, common metric units, ordinary and Unicode fractions, ranges, parenthetical or comma-separated preparation notes, “to taste” amounts, and numbered directions. A review screen requires every imported ingredient to be matched to an existing saved food, displays the final quantity in that food's native unit, and highlights quantities that need human review. Missing foods can be created in place with explicit nutrition values and are immediately matched. Parsing and matching run entirely on-device; the app does not fetch URLs or guess nutritional values.

The recipe editor and pasted-text importer are loaded as separate production chunks. Both chunks are included in the generated service-worker precache, preserving offline installation while keeping the ordinary startup bundle smaller.

The next milestone should focus on automated component-level accessibility checks and production deployment documentation.
