# Nutrition Notes
## Product Requirements Specification (FitNotes 2–inspired nutrition tracker)

**Version:** 0.1  
**Primary platform:** iPhone-installed Progressive Web App (PWA)  
**Reference application:** FitNotes 2  
**Product principle:** A repetitive diet should be loggable by applying a full-day template and changing only what differed.

---

# 1. Product summary

Nutrition Notes is a local-first nutrition tracker for people who usually eat the same base diet.

The app should borrow the **interaction philosophy, information density, navigation pattern, and speed** of FitNotes 2 while using original branding, icons, and visual assets.

The central workflow is:

1. Open today.
2. Apply a complete day template, or copy the previous day.
3. Add, remove, replace, reorder, or change quantities for the foods that differed.
4. Mark foods as consumed.
5. See calories and macros update immediately.
6. Export all data without an account or subscription.

The app must not behave like a conventional calorie tracker that makes the user rebuild breakfast, lunch, and dinner separately every day.

---

# 2. Product goals

## 2.1 Primary goals

- Make a repeated full-day diet loggable in one action.
- Make daily deviations extremely quick to record.
- Match the low-friction, list-based feel of FitNotes 2.
- Work fully offline after installation.
- Store data locally on the device.
- Require no user account.
- Require no subscription.
- Support complete JSON backup/restore and CSV export.
- Be installable on an iPhone as a PWA.
- Preserve historical nutrition values even when a food is edited later.

## 2.2 Non-goals for the first release

The MVP must not include:

- User accounts
- Cloud storage
- Subscriptions or payments
- Social features
- Coaching
- AI meal recommendations
- A large external food database
- Barcode scanning
- Restaurant-menu integration
- Advertisements
- Apple Health integration
- Android-native or iOS-native applications
- Multi-user support

These may be considered later, but must not complicate the first implementation.

---

# 3. Terminology and FitNotes 2 mapping

| FitNotes 2 concept | Nutrition Notes concept |
|---|---|
| Workout | Day log |
| Workout template | Full-day diet template |
| Exercise | Food |
| Exercise card | Food card |
| Exercise set | Serving entry |
| Weight and repetitions | Quantity/unit and nutrition |
| Exercise category | Food or meal category |
| Start new workout | Start new day |
| Copy previous workout | Copy previous day |
| Log template | Apply full-day template |
| Complete exercise | Mark food as consumed |
| Convert to template | Convert day to template |
| Workout notes | Day notes |
| Body | Weight/body tracking |
| Calendar | Nutrition history calendar |
| Charts | Nutrition and weight charts |

---

# 4. Design principles

## 4.1 FitNotes 2 feel

The app should feel:

- Fast
- Dense but readable
- Native-like
- Mostly list based
- One-handed
- Dark-first
- Low-animation
- Free of onboarding screens and unnecessary prompts
- Predictable: tapping text edits it, tapping a completion circle completes it, long-pressing a card enters edit/reorder mode

## 4.2 Original implementation

Use the supplied FitNotes 2 screenshots as interaction and layout references, but do not copy:

- The FitNotes name
- The FitNotes logo
- Proprietary icons
- Exact artwork
- App-store assets
- Any copyrighted text that is not functionally necessary

Use original branding and standard/open-source icons.

## 4.3 Mobile layout

Design first for:

- iPhone portrait orientation
- Approximately 390–430 CSS pixels wide
- iOS safe areas
- Standalone PWA mode
- Touch targets at least 44 × 44 CSS pixels
- Smooth vertical scrolling
- No hover-dependent controls

Desktop support may be responsive, but mobile is the priority.

---

# 5. Information architecture

Use a persistent bottom navigation bar inspired by FitNotes 2:

1. **Body**
2. **Calendar**
3. **Add / Start**
4. **Charts**
5. **Settings**

When viewing an active day, the centre item may be labelled **Food** rather than **Start**.

---

# 6. Core user flows

## 6.1 Opening an empty day

When a selected day has no entries, show two large actions:

### Start New Day
Opens the Choose Food screen so the user can build a day manually.

### Copy Previous Day
Copies the most recent earlier day containing entries into the selected date.

Copying must create independent day entries. Later edits to the copied day must not change the source day.

## 6.2 Applying a full-day template

From the empty-day screen or Add screen:

1. Open the **Templates** tab.
2. Show saved full-day templates in a simple list.
3. Show a blue **Log** action on the right of each template.
4. Tapping **Log** copies every template item into the selected day.
5. The selected day opens immediately.
6. The user can add, delete, replace, reorder, or edit individual foods without altering the original template.

Example templates:

- Cutting Day
- Maintenance Day
- High-Calorie Day
- Rest Day
- Meal Prep A

## 6.3 Copying the previous day

The copied day should include:

- Food order
- Food quantities
- Meal/category assignment
- Notes attached to individual food entries
- Consumed/unconsumed state, with a configurable default

Default behaviour for MVP:

- Copy the foods and quantities.
- Reset every copied food to **not consumed**.

## 6.4 Converting a day to a template

From the three-dot day menu:

1. Choose **Convert to Template**.
2. Enter a template name.
3. Confirm.
4. Save the current ordered food list and quantities as a reusable template.
5. Do not link the template to the source day after creation.

If a template name already exists, ask whether to replace it or save a copy.

---

# 7. Day screen

## 7.1 Header

The day screen must contain:

- App title
- Three-dot overflow menu
- Selected date label such as **Today**, **Yesterday**, or a formatted date
- Previous-day arrow
- Next-day arrow
- Optional swipe-left/swipe-right date navigation
- Running daily totals visible near the header or in a sticky summary

Recommended totals:

- Consumed calories
- Planned calories
- Protein
- Carbohydrates
- Fat

## 7.2 Food cards

Each food is represented by a card analogous to an exercise card.

A card contains:

### Header
- Food name
- Completion circle on the right
- Optional category colour indicator

### Body
At minimum:

- Quantity
- Unit
- Calories
- Protein

Expanded or secondary information:

- Carbohydrates
- Fat
- Meal/category
- Notes

Example:

```text
Oats                                      ✓
45 g                         171 kcal
Protein 5.8 g   Carbs 30.0 g   Fat 3.1 g
```

## 7.3 Serving entries

A food card may contain one or more serving entries, analogous to sets in FitNotes 2.

Examples:

```text
Sourdough
1 slice                       125 kcal
1 slice                       125 kcal
```

or:

```text
Chicken breast
150 g                         248 kcal
```

MVP simplification is permitted:

- Start with one serving entry per food card.
- Architect the data model so multiple serving entries can be added later without migration difficulty.

## 7.4 Consumed state

Tapping the completion circle toggles the food between:

- Planned/not yet consumed
- Consumed

Requirements:

- Update consumed totals immediately.
- Preserve planned totals.
- Clearly distinguish consumed and unconsumed cards without making text unreadable.
- Do not require opening the card.
- Provide undo by tapping the circle again.

## 7.5 Editing a food

Tapping a card opens a food-entry editor.

Editable fields:

- Food
- Quantity
- Unit/serving
- Calories
- Protein
- Carbohydrates
- Fat
- Category/meal
- Entry note
- Consumed state

Changes apply only to that day entry unless the user explicitly chooses **Update saved food**.

## 7.6 Adding a food

The centre bottom action opens **Choose Food**.

After selecting a food:

1. Show a compact quantity editor.
2. Default to the food's preferred serving.
3. Add it to the end of the current day.
4. Return to the day screen.
5. Scroll the new card into view.

Provide an option to keep adding foods without returning after every selection.

---

# 8. Long-press edit and reorder mode

This behaviour is a core requirement.

## 8.1 Entering edit mode

- Long-press any food card for approximately 300–450 ms.
- Cancel the long-press when the finger moves enough to indicate normal scrolling.
- On activation:
  - Attempt haptic feedback when the browser/device supports it.
  - Give immediate visual confirmation even when haptics are unavailable.
  - Add a bright accent outline around the selected card.
  - Show reorder handles on all cards.
  - Replace the standard bottom navigation with an edit toolbar.

## 8.2 Reordering

In edit mode:

- Drag cards vertically using the card or reorder handle.
- Neighbouring cards move out of the way in real time.
- Auto-scroll when dragging near the top or bottom edge.
- Preserve a stable drag preview.
- Save the new order immediately on drop.
- Reordering a day must not alter the source template.

## 8.3 Edit toolbar

Display:

1. **Done**
2. **Move**
3. **Replace**
4. **Delete**

### Done
Exit edit mode.

### Move
Move the selected food entry to:

- Another position in the current day
- Another meal/category
- Optionally another date

For MVP, moving within the current day and between categories is sufficient.

### Replace
Open the food picker and replace the selected food while retaining, where sensible:

- Position
- Category
- Consumed state

The replacement food should use its own default serving and nutrition unless the user chooses to preserve quantity.

### Delete
Delete the selected entry.

- Provide a brief undo snackbar.
- Do not show a blocking confirmation for ordinary deletion.
- Require confirmation only when deleting multiple selected entries.

## 8.4 Multi-select

Multi-select is not required for MVP, but the edit-mode architecture should not prevent it later.

---

# 9. Choose Food screen

The screen should closely follow the supplied FitNotes 2 picker structure.

## 9.1 Header

- Close button
- Title: **Choose Food**
- Add custom food button

## 9.2 Segmented control

Two tabs:

- **Foods**
- **Templates**

The Templates tab may also be reached from an empty day.

## 9.3 Search

Search foods by:

- Name
- Brand
- Category
- Notes/aliases

Search must update locally as the user types.

## 9.4 Category chips

Provide colour-coded chips such as:

- Breakfast
- Protein
- Carbohydrate
- Fruit
- Vegetables
- Snack
- Drink
- Condiment
- Other

Category names and colours must be user-editable in Settings.

## 9.5 Food list rows

Each row contains:

- Category colour dot
- Food name
- Optional brand
- Usage summary, for example:
  - `18 logs (2 days ago)`
  - `Never logged`
- Info/edit button

Default sorting:

1. Recently used
2. Frequently used
3. Alphabetical

Allow an alphabetical sort option.

## 9.6 Custom food creation

Fields:

- Name
- Brand, optional
- Category
- Default quantity
- Unit
- Calories
- Protein
- Carbohydrates
- Fat
- Optional fibre
- Optional serving description
- Optional notes

Allow foods to be created using either:

### Per serving
Example: 1 slice = 125 kcal.

### Per 100 g / 100 mL
The app calculates nutrition from the entered quantity.

---

# 10. Templates screen

## 10.1 Template list

Show:

- Template name
- Optional item count
- Optional calorie/protein summary
- Blue **Log** action
- Chevron for nested folders or template details where applicable

## 10.2 Template actions

Support:

- Log
- Rename
- Duplicate
- Edit items
- Reorder items
- Delete
- Export one template
- Organise into optional folders

## 10.3 Template editing

Template editing should use the same card interface and long-press reorder behaviour as a day log.

Changing a template must not retroactively alter old day logs.

---

# 11. Day overflow menu

The three-dot menu should contain:

1. **Day Notes**
2. **Daily Targets**
3. **Convert to Template**
4. **Templates**
5. **Share / Export Day**
6. **Import**
7. **Help**

## 11.1 Day Notes
Free-text notes attached to the selected date.

## 11.2 Daily Targets
Allow per-day overrides for:

- Calories
- Protein
- Carbohydrates
- Fat

Default values come from Settings.

## 11.3 Share / Export Day
Export a readable text summary or CSV for the selected day using the platform share sheet where available.

---

# 12. Calendar and history

## 12.1 Month view

Display:

- Current month
- Monday-first calendar by default for Australia
- Selected date in accent colour
- Small coloured dots under dates

For MVP, the dots represent meal/category groups present on that day.

Alternative target-status indicators may be added later.

## 12.2 Selected-day preview

Below the month grid:

- Selected date label
- Previous/next date arrows
- Read-only summary of food cards and quantities
- Daily totals
- Tap to open full editable day

## 12.3 Calendar navigation

Support:

- Previous/next month
- Jump to today
- Month/year picker

---

# 13. Charts

Use a Charts section inspired by FitNotes 2.

## 13.1 Shared controls

Every chart screen should support:

- All
- Year
- Month
- Week
- Day
- Custom date range

## 13.2 Breakdown tab

Interactive donut chart options:

- Calories by meal category
- Calories by food category
- Macro calorie split
- Protein contribution by food

Selecting a segment displays:

- Name
- Value
- Percentage

Show a detailed list below the chart.

## 13.3 Trends tab

Line or bar charts for:

- Daily calories
- Daily protein
- Daily carbohydrates
- Daily fat
- Body weight
- Seven-day rolling average for weight
- Optional calories versus weight overlay

Each chart must be readable on a phone without horizontal scrolling.

## 13.4 Foods tab

Show:

- Most frequently logged foods
- Highest calorie contributors
- Highest protein contributors
- Average serving quantity
- Last logged date

---

# 14. Body and weight tracking

The Body tab should support:

- Date
- Body weight
- Optional note
- Weight history
- Seven-day rolling average
- Export to CSV

Weight unit:

- kg by default
- lb optional

The app must not claim to measure body-fat percentage or lean mass unless the user enters those values manually.

---

# 15. Totals and calculations

## 15.1 Nutrition calculation

For a per-100 g food:

```text
logged nutrient = nutrient per 100 g × quantity in g / 100
```

For a per-serving food:

```text
logged nutrient = nutrient per serving × number of servings
```

## 15.2 Historical snapshots

When a food is added to a day, store a snapshot containing:

- Food name
- Brand
- Quantity and unit
- Calories
- Protein
- Carbohydrates
- Fat
- Category

If the saved food is edited later, old logs must retain their original values.

## 15.3 Rounding

Display:

- Calories: nearest whole kcal
- Protein/carbohydrates/fat: one decimal place
- Weight: one decimal place by default

Store greater precision internally.

---

# 16. Data model

Suggested TypeScript domain model:

```ts
type ID = string;
type ISODate = string; // YYYY-MM-DD

interface Food {
  id: ID;
  name: string;
  brand?: string;
  categoryId: ID;
  calculationMode: "per100" | "perServing";
  baseQuantity: number;
  baseUnit: "g" | "ml" | "serving" | "slice" | "item" | "scoop";
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fibre?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface FoodSnapshot {
  foodId?: ID;
  name: string;
  brand?: string;
  categoryId: ID;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fibre?: number;
}

interface DayFoodEntry {
  id: ID;
  dayId: ID;
  snapshot: FoodSnapshot;
  sortIndex: number;
  consumed: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

interface DayLog {
  id: ID;
  date: ISODate;
  note?: string;
  targetOverride?: NutritionTargets;
  createdAt: string;
  updatedAt: string;
}

interface DietTemplate {
  id: ID;
  name: string;
  folderId?: ID;
  items: TemplateItem[];
  createdAt: string;
  updatedAt: string;
}

interface TemplateItem {
  id: ID;
  foodId?: ID;
  snapshot: FoodSnapshot;
  sortIndex: number;
  categoryId: ID;
}

interface FoodCategory {
  id: ID;
  name: string;
  colour: string;
  sortIndex: number;
}

interface WeightEntry {
  id: ID;
  date: ISODate;
  weightKg: number;
  note?: string;
}

interface NutritionTargets {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
}
```

Use UUIDs or another collision-resistant local ID strategy.

---

# 17. Local storage and offline behaviour

## 17.1 Storage

Use IndexedDB rather than localStorage for primary application data.

Recommended implementation:

- Dexie or a thin typed IndexedDB wrapper
- Explicit schema versions and migrations
- Transactional writes for template/day operations

## 17.2 Offline PWA

Requirements:

- Installable from Safari using Add to Home Screen
- Standalone display mode
- App manifest
- Service worker
- App shell cached after first load
- All logging, editing, templates, calendar, charts, import, and export work offline
- No network dependency after installation

## 17.3 Data ownership

- No account
- No telemetry by default
- No third-party analytics
- No remote database
- Data remains on the user's device unless explicitly exported or shared

---

# 18. Import, export, and backup

## 18.1 Full JSON backup

Export one versioned JSON file containing:

- Foods
- Categories
- Templates
- Day logs
- Day food entries
- Weight entries
- Settings
- Schema version
- Export timestamp

Import modes:

- Replace all data
- Merge data

Before replacement:

- Show a clear warning
- Automatically create a downloadable backup of existing data where possible

## 18.2 CSV export

Provide separate CSV files or one ZIP containing:

### day_totals.csv
- Date
- Planned calories
- Consumed calories
- Protein
- Carbohydrates
- Fat
- Target values
- Day note

### food_entries.csv
- Date
- Food
- Brand
- Quantity
- Unit
- Calories
- Protein
- Carbohydrates
- Fat
- Category
- Consumed
- Entry note
- Sort order

### weight.csv
- Date
- Weight kg
- Note

## 18.3 Template sharing

Allow one template to be exported/imported as a small versioned JSON file.

---

# 19. Settings

Settings must include:

- Appearance: system, light, dark
- Accent colour
- Energy unit: kcal initially
- Weight unit: kg/lb
- Week starts Monday/Sunday
- Default nutrition targets
- Food categories and colours
- Copy-previous-day consumed-state behaviour
- Export all data
- Import data
- Reset all data
- About/privacy information

Dark mode should be the visual reference priority.

---

# 20. Accessibility and interaction quality

Requirements:

- Semantic buttons and form labels
- VoiceOver-accessible names for icons
- Do not communicate state by colour alone
- Support reduced motion
- Visible keyboard focus for desktop use
- Respect safe-area insets
- Avoid accidental long-press activation during scrolling
- Numeric keyboards for quantity and nutrition inputs
- Undo after destructive single-item actions

---

# 21. Technical recommendation

Suggested stack:

- React
- TypeScript
- Vite
- PWA plugin/service worker
- IndexedDB with Dexie
- dnd-kit for touch drag-and-drop
- date-fns for date handling
- Recharts or Chart.js for charts
- Zod for import-file validation
- Vitest and React Testing Library
- Playwright for end-to-end tests

Keep business logic independent of React components so calculations and import/export can be tested directly.

---

# 22. Testing requirements

## 22.1 Unit tests

Test:

- Per-100 g calculations
- Per-serving calculations
- Rounding
- Planned versus consumed totals
- Copy previous day
- Apply template
- Convert day to template
- Historical snapshots
- CSV generation
- JSON schema validation and migration
- Seven-day weight average

## 22.2 End-to-end tests

At minimum:

1. Create a custom food.
2. Create a day with several foods.
3. Convert it to a template.
4. Apply the template to another day.
5. Add two slices of sourdough.
6. Delete one template-derived food.
7. Long-press and reorder cards.
8. Mark foods consumed.
9. Copy the day to tomorrow.
10. Confirm the source day and template are unchanged.
11. Export JSON.
12. Clear the local database.
13. Import JSON.
14. Confirm data is restored.
15. Export CSV and verify expected rows.

## 22.3 Mobile interaction checks

Manually verify on iPhone Safari/PWA:

- Safe areas
- Long-press versus scroll
- Drag auto-scroll
- Add to Home Screen
- Offline launch
- File export
- File import
- Share sheet
- Numeric keyboard
- Bottom toolbar not hidden by browser or home indicator

---

# 23. MVP acceptance criteria

The MVP is complete when all of the following are true:

- The app installs as a PWA and launches offline.
- No account or backend is required.
- A user can create custom foods.
- A user can build and save a complete day template.
- A user can apply that template to any date in one action.
- Template items become independent day entries.
- A user can copy the previous day.
- A user can add, edit, replace, delete, and reorder food cards.
- Long-press enters a clear reorder/edit mode.
- The app attempts haptic feedback where supported and always provides visual feedback.
- A user can mark foods consumed.
- Planned and consumed totals update correctly.
- Calendar history is available.
- Basic calorie, macro, and weight charts work.
- Full JSON backup/restore works.
- CSV export works.
- Old day logs are not changed when saved foods or templates are edited.
- The interface is usable one-handed on an iPhone.
- The interface uses original branding while visibly following the supplied FitNotes 2 interaction references.

---

# 24. Implementation phases

## Phase 1 — Foundation
- React/TypeScript/PWA setup
- IndexedDB schema
- App shell and bottom navigation
- Date navigation
- Dark theme
- Seed data for testing

## Phase 2 — Foods and daily logging
- Food database
- Choose Food screen
- Food cards
- Quantity editing
- Consumed state
- Daily totals

## Phase 3 — Templates and copying
- Template list
- Apply template
- Convert day to template
- Copy previous day
- Template editor

## Phase 4 — FitNotes 2 interaction polish
- Long-press activation
- Best-effort haptics
- Drag reorder
- Edit toolbar
- Move, replace, delete, and undo
- Swipe date navigation

## Phase 5 — History and analytics
- Calendar
- Body-weight entries
- Breakdown charts
- Trend charts
- Date filters

## Phase 6 — Portability and hardening
- JSON backup/restore
- CSV export
- Import validation
- Schema migrations
- Automated tests
- iPhone PWA testing
- Accessibility pass

---

# 25. Reference screenshot mapping

Place the supplied screenshots in:

```text
docs/reference/fitnotes2/
```

Suggested names:

```text
01-day-overflow-and-convert-template.png
02-empty-day-start-or-copy.png
03-exercise-picker-reference.png
04-template-picker-reference.png
05-day-card-list-reference.png
06-long-press-edit-and-reorder-mode.png
07-calendar-history-reference.png
08-chart-breakdown-reference.png
```

Add a `README.md` beside them explaining:

- They are visual and interaction references.
- Exercise cards map to food cards.
- Workouts map to day logs.
- Templates map to full-day diet templates.
- Do not copy FitNotes branding or proprietary assets.
- The long-press reorder interaction is a core requirement.

---

# 26. Initial Codex prompt

Use this after placing this requirements file and the screenshots in the repository:

```text
Read docs/NUTRITION_NOTES_REQUIREMENTS.md completely and inspect every image in
docs/reference/fitnotes2/.

Build Phase 1 and Phase 2 of the Nutrition Notes PWA.

The product must use the interaction philosophy and compact mobile layout shown
in the FitNotes 2 reference screenshots, but it must use original branding,
icons, and assets.

Important constraints:
- React + TypeScript.
- Installable, offline-first PWA.
- IndexedDB for all persistent application data.
- No backend, login, analytics, account, payment, or subscription.
- iPhone portrait layout is the primary target.
- Historical food entries must store nutrition snapshots.
- Implement the empty-day screen, date navigation, bottom navigation, custom
  foods, Choose Food screen, ordered food cards, consumed toggles, and daily
  planned/consumed totals.
- Do not begin templates, charts, or import/export yet except for interfaces and
  data structures needed to avoid rework.
- Add unit tests for nutrition calculations and historical snapshots.
- Add a small realistic seed dataset including oats, protein powder, rice,
  barramundi, lean beef mince, broccolini, orange, and sourdough.
- Run all tests and the production build.
- Use the browser to inspect the result at an iPhone-sized viewport and iterate
  until it is visually coherent and touch-friendly.
- Document setup and development commands in README.md.

Before editing files, briefly summarise your implementation plan. After
completion, report the files changed, tests run, known limitations, and the
next recommended milestone.
```

---

# 27. Definition of the key experience

The app succeeds when this interaction feels effortless:

```text
Open Today
→ Log “Cutting Day”
→ Add “Sourdough”
→ Set quantity to 2 slices
→ Remove one food that was not eaten
→ Mark the consumed foods
→ Done
```

That flow should require only a few deliberate taps and no rebuilding of separate meals.
