# Session 12 — UI Polish, Auth Flow Fixes & Logo Direction
**Date:** 1 May 2026
**Duration:** ~7 hours
**Objective:** Polish all app screens, fix auth flow bugs, make first name and price mandatory, finalise logo direction.

---

## Session Objectives (Achieved)
- Fix 3 critical bugs (red banner, returning user flow, onboarding persistence)
- Restructure tab bar (remove Search, add Add tab)
- Polish all screens: Dashboard, Inventory, SKU Detail, Adjust Inventory, Stock Take, Add SKU, Profile, Get Started, Sign In, Sign Up
- Make first name mandatory in signup
- Make price mandatory in SKU setup
- Finalise app logo direction

---

## Priority 1 — Critical Bugs Fixed

### Bug 1 — RCTStatusBarManager Red Banner
- **Cause:** `expo-status-bar` conflicting with `react-native-edge-to-edge`. Multiple JS-side status bar setters triggering the legacy RCT path.
- **Fix:** Removed `RootSystemBars`/`SystemBars` from `app.tsx` and `Screen.tsx`. Removed `UIViewControllerBasedStatusBarAppearance` from `app.json`. Removed `statusBarTranslucent` from all modals. Status bar now handled entirely by OS + native shell.
- **Rebuild required:** Yes — native files changed.

### Bug 2 — Returning User Landed on Onboarding
- **Cause:** `NavigationContainer` was restoring `initialState` from MMKV cache (often "Welcome"), overriding `initialRouteName`. Zustand store also rehydrating after `initialize()`.
- **Fix:** Auth bootstrap now awaits `useAuthStore.persist.rehydrate()` before `initialize()`. When auth finishes loading with a valid user, `initialState={undefined}` is passed so navigation is driven only by `AppNavigator`'s `initialRouteName`.

### Bug 3 — Onboarding Showing Again on Relaunch
- **Cause:** `syncOnboardingToDatabase` was only upserting `id`, not `has_completed_onboarding`. `fetchOnboardingFromDatabase` was mishandling empty rows.
- **Fix:** `syncOnboardingToDatabase` now upserts `has_completed_onboarding` and `updated_at`. `fetchOnboardingFromDatabase` uses `.maybeSingle()` — no row = false, explicit true = true. Migration added: `ADD COLUMN IF NOT EXISTS has_completed_onboarding boolean DEFAULT false`.
- **Supabase migration required:** `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_completed_onboarding boolean DEFAULT false;`

### Bug 4 — Dev Menu Auto-Opening
- **Cause:** `DevMenu.show()` call inside a Reactotron custom command (`showDevMenu`) in `ReactotronConfig.ts` firing on launch.
- **Fix:** Entire `showDevMenu` command registration removed. Confirmed one-time simulator behaviour on fresh install — does not appear in subsequent launches or production builds.

### Bug 5 — Sign In Button Staying Grey
- **Cause:** `react-hook-form` was using `mode: "onBlur"` — `formState.isValid` did not refresh until a field blurred.
- **Fix:** Changed to `mode: "onChange"` on login form. Applied globally to all forms in the app.

---

## Priority 2 — Structural Changes

### Tab Bar Restructure
- Removed Search tab entirely
- Added Add tab with plus-circle icon
- Tab order: Dashboard · Inventory · Add · Profile
- Add tab navigates directly to Add SKU form (not modal)
- On successful SKU save: auto-navigate to Inventory tab + success toast
- Tab items use `flex: 1` for equal distribution
- Active tab: orange `#F97316` icon and label. Inactive: grey `#9CA3AF`
- Keep orange on white (did not invert)

### Add SKU Screen Header
- Removed back arrow (tab bar handles navigation)
- Header: "Add SKU" centered, greyed Save button on right (activates when required fields filled)

### Onboarding
- Welcome screen (waving hand) removed entirely
- Notifications screen is now the single first-time screen
- Onboarding only shows when `has_completed_onboarding = false`

---

## Priority 3 — Screen by Screen Polish

### Get Started Screen
- Create Account button: black → orange `#F97316` filled
- Sign In button: orange bordered (white background, orange text and border)
- Background: blue gradient → white `#FFFFFF`

### Sign In Screen
- Sign In button: black → orange `#F97316`
- Forgot Password: grey → orange `#F97316`
- "Don't have an account? Sign Up" — "Sign Up" in orange, rest muted grey
- Removed "Sign in with email code instead" option entirely

### Sign Up / Create Account Screen
- Added First Name field (mandatory — Sign Up button blocked without it)
- Added Last Name field (optional, labelled "Last name (optional)")
- Sign Up button: black → orange `#F97316`
- "Already have an account? Log In" — "Log In" in orange
- All fields save to `profiles` table on account creation
- First name and last name now saved in Supabase on signup

### Dashboard
- Greeting: time-aware — "Good morning" (5am–12pm) / "Good afternoon" (12pm–6pm) / "Good evening" (6pm–5am)
- Greeting includes first name: "Good afternoon, Turjo"
- Greeting: `fontSize: 24, fontWeight: "700"`, left-aligned (matches Inventory/Profile large title style)
- Low stock alerts sorted by deficit descending (largest gap between threshold and quantity appears first)
- Deficit = `safety_stock_threshold - total_quantity`

### Inventory Screen
- Large bold left-aligned title: `fontSize: 28, fontWeight: "700"`
- Search bar added at top, filters by name or SKU code (client-side, real-time)
- Search bar focused state: orange `#F97316` border
- Stock Take button: orange bordered (white background, orange text)
- + button removed from header (Add tab handles this)
- Query: `refetchOnMount: "always"`, `staleTime: 0`

### SKU Detail Screen
- Current Quantity pulled out of field list — orange hero card with large white number
- Field list: 12px muted grey labels (`#6B7280`), darker heavier values
- Adjust Inventory button: black → orange `#F97316`
- Transaction History: compact timeline rows
  - Row 1: TYPE colored badge · QTY · DATE (shortened format: "MMM d · h:mm a")
  - Row 2: NOTE: [reference note value]
  - Header row: TYPE · QTY · DATE column labels in muted uppercase
  - Green badge for Stock Received, red for Sale, grey for Stock Take/Scrap
- White space issue between header and content: **NOT FIXED** — deferred to Session 13

### Adjust Inventory Screen
- Segmented selector replacing two separate buttons: Receive Stock · Record Sale · Scrap
  - Active: orange `#F97316` background, white text
  - Inactive: white background, grey `#6B7280` text
  - Border around full selector
- Quantity input and Reference Note field inline on screen (no modal)
- Single orange Save button at bottom
- Last 3 transactions shown below Save button as compact read-only rows
- SCRAP added as valid adjustment type — **Supabase migration required:**
  ```sql
  ALTER TABLE inventory_adjustments DROP CONSTRAINT IF EXISTS inventory_adjustments_adjustment_type_check;
  ALTER TABLE inventory_adjustments ADD CONSTRAINT inventory_adjustments_adjustment_type_check CHECK (adjustment_type IN ('PURCHASE', 'SALE', 'STOCK_TAKE', 'SCRAP'));
  ```

### Stock Take Screen
- Blind count mode implemented — system quantity hidden during entry
- After submission: system quantity and variance revealed
- Toggle: All SKUs / Select SKUs
  - Active: orange `#F97316` background, white text
  - Inactive: white background, grey text
  - Select SKUs shows search bar — user searches and taps to add individual SKUs to count
- Last Counted date per SKU card — shown in red if never counted or over 30 days ago
- Variance flow:
  - Zero variance → Done button (commits immediately)
  - Non-zero variance → Recount (solid orange) | Cancel Count (red bordered)
  - After recount, zero variance → Done
  - After recount, non-zero variance → Accept Count (solid orange) | Cancel Count (red bordered)
  - Accept Count → confirmation dialog "This will update inventory from X to Y. Are you sure?" → Yes / No
  - Cancel Count at any stage → discard everything, return to Inventory screen
- Stock take reference note: "Stock take adjustment" (replaces UUID)
- Confirm stock take button: black → orange `#F97316`

### Add SKU Screen
- Price field: mandatory, `$` non-editable prefix, numeric keyboard, 2 decimal places on blur
- Unit of Measure: dropdown replacing free text
  - Options: Pieces · Box · Bag · Kg · g · L · mL · Pair · Set · Roll · Pack · Bottle · Other
  - Other: reveals free text "Custom unit" field
- No back arrow (Add is a tab destination)
- Save button: greyed until required fields filled, activates on change (`mode: "onChange"`)

### Profile Screen
- Free trial label: calculates days remaining from `profiles.created_at` — "Free Trial — X days remaining"
- When trial expires: orange Subscribe button replaces label
- Delete my account button: deferred color fix to Session 13 (should be `#EF4444`)

---

## Design System Decisions

### Title Hierarchy (standardised)
- **Tab screens** (Dashboard, Inventory, Profile): `fontSize: 28, fontWeight: "700"`, left-aligned
- **Stack/navigation screens** (Add SKU, SKU Detail, Adjust Inventory, Stock Take): `fontSize: 17, fontWeight: "600"`, centered

### Button Hierarchy
- **Solid orange `#F97316`**: primary actions (Save, Sign In, Sign Up, Accept Count, Recount, Receive Stock)
- **Orange bordered**: secondary actions (Stock Take, Sign In on Get Started)
- **Red bordered `#EF4444`**: destructive actions (Cancel Count, Record Sale, Scrap)
- **All CTA buttons**: orange. No black buttons anywhere in the app.

---

## Logo Direction Finalised

### Concept
**Eye watching over inventory** — the eye represents visibility (Vizory's core value), the 3D box inside represents the physical product/inventory being tracked.

### Name Rationale
"Vizory" combines "visibility" and "inventory." The `-ory` suffix also echoes "inventory" itself. Short, memorable, App Store friendly.

### Logo Specification
- **Shape:** Horizontal almond/leaf eye shape with pointed left and right ends (not an oval — pointed ends make it unmistakably an eye, not the letter O)
- **Fill:** Solid white, on orange `#F97316` background
- **Pupil:** Orange `#F97316` circle
- **Inside pupil:** White 3D isometric box (three visible faces with opacity variation to suggest depth)
- **Background:** Orange `#F97316` rounded square (App Store icon format)
- **White background variant:** Also exists for light UI contexts

### Logo SVG
The logo SVG is saved as `vizory_logo.svg` in this session's outputs. See implementation notes below.

### Rejected Directions
- Standalone "V" lettermark — too crowded (Notion, Vercel, Vanta, Venmo all use V)
- Eye with trend line — misleading, implies analytics/forecasting features not in the app
- Eye with clipboard — reads as battery icon at small sizes
- Eye with bar chart — too generic analytics icon

### App Icon Sizes Required (Session 13)
- 1024px (App Store)
- 512px
- 192px
- 64px
- 28px (tab bar / small UI — eye only, box detail omitted)

---

## Deferred to Session 13

### Bugs
- SKU Detail screen white space between navigation header and content — affects all stack/modal screens. Multiple fix attempts failed. Root cause: double safe area inset from Header component. Needs fresh approach.
- Inventory screen spinning wheel intermittently not resolving — `refetchOnMount` fix inconsistent.
- GitHub Actions `preview.yml` workflow failing with "No jobs were run" — branch filter condition issue.

### Features
- Barcode scanning — camera icon inside SKU Code field, triggers scanner on tap
- Photo upload on Add SKU screen
- Biometric authentication (Face ID / Touch ID) on Sign In
- Currency detection — detect device region, display appropriate symbol as non-editable prefix, store in user profile
- Logo implementation — build as vector asset, replace Shipnative splash screen and onboarding icon, set as iOS app icon in `app.json`
- Delete my account button color — change to `#EF4444` to match design system destructive red
- Stock Take variance flow in a separate modal/sheet rather than inline with SKU list
- Select SKUs search-and-add UX improvements

### Product / Strategy
- TestFlight tester recruitment plan — identify 2-3 real users for beta testing
- Android strategy discussion — sister-in-law is Android user, broader tester pool needed
- Early adopter outreach — live commerce seller community, WhatsApp/Facebook groups

---

## Technical Notes
- All form validation: `mode: "onChange"` applied globally
- Supabase `updated_at` column added to `profiles` table
- SCRAP adjustment type added to database constraint
- `yarn typecheck` passing at end of session
- Code committed and pushed: `Session 12 - UI polish, tab bar restructure, auth flow fixes, stock take blind count, adjust inventory scrap action, logo direction finalised`
