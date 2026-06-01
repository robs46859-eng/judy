# Handoff — Build-Prompt #1: Hardcode & Mock Data Removal (Web App)

> **Status**: 🟢 COMPLETED — live web-app sweep built and ready to push  
> **Target**: Web app (React + Express)  
> **Date**: 2026-06-01  

---

## Objective

Strip **all hardcoded data, mock/seed data, and stub surfaces** from the web app so every piece of content is either entered by the user at runtime, fetched from a real backend/API, or arrives empty until populated. Buttons and fields that currently sit on top of stubs must be wired to real flows or clearly surfaced as "coming soon" with disabled states.

---

## Inventory of Hardcoded / Mock / Stub Items

### 1. Server Seed Data — [server.ts](file:///Users/robert/Desktop/hello-judy/server.ts)

All of these are in-memory arrays initialized with fake seed records at server start. They serve as the "database".

| Lines | Variable | What's hardcoded | Proposed action |
|-------|----------|-----------------|-----------------|
| L43–92 | `flightsData` | 4 fake flights (PV-101, PV-255, PV-711, PV-880) with invented airlines | **Empty array `[]`**. UI should show an "Add Flight" form or empty state. Random status mutation on `/api/flights` also removed. |
| L94–170 | `safetyZones` | 3 pre-seeded safety zones with fake reviews, avatars from Unsplash | **Empty array `[]`**. UI empty state: "No zones yet — contribute the first!" |
| L172–209 | `localGuides` | 3 invented guides with Unsplash avatars, bios, ratings | **Empty array `[]`**. UI empty state: "No guides available." |
| L211–233 | `chatMessages` | 3 fake chat messages between user and guide "g1" | **Empty array `[]`**. Chat starts blank. |
| L235–268 | `memberPosts` | 2 fake social feed posts with Unsplash images | **Empty array `[]`**. Feed shows "Be the first to post a moment!" |
| L270–313 | `itemsDatabase` | 5 marketplace catalog items (tours, tickets, postcards, souvenirs) with Unsplash images | **Empty array `[]`**. Shop shows "No items listed yet." Admin CRUD endpoint to be added later. |
| L315–323 | `userBookings` | 1 pre-existing booking stub | **Empty array `[]`**. |
| L325–329 | `userBucketList` | 3 pre-seeded bucket list items | **Empty array `[]`**. |

> [!IMPORTANT]
> The Gemini fallback itinerary in `/api/gemini/suggest-itinerary` (L394–445) is an **offline graceful degradation**, not a stub. It fires only when no API key is configured. **Keep it** but label it clearly in the response JSON (`"source": "fallback"`).

### 2. Server-side Random Mutation Stub

| Lines | Endpoint | Issue | Action |
|-------|----------|-------|--------|
| L336–348 | `GET /api/flights` | Randomly mutates flight status/gates on every call to simulate "real-time" | Remove random mutations. Return flights as-is. |
| L598–609 | `POST /api/chats` auto-reply | Auto-generates a canned guide reply after 1.5s | Remove auto-reply. Guides should reply through a real mechanism or be absent. |
| L559 | `POST /api/safety-map/:id/review` | Hardcodes user as `"Robert G."` | Use the `user` field from the request body (already passed). |

### 3. Client-side Hardcoded Strings — [App.tsx](file:///Users/robert/Desktop/hello-judy/src/App.tsx)

| Lines | What | Detail | Action |
|-------|------|--------|--------|
| L84 | `translateText` default | Pre-filled with `"Where is the nearest welcoming gay neighborhood or cafe?"` | **Empty string `""`**. Let user type. |
| L101 | `newPostImgPreset` default | Pre-set to an Unsplash URL | **Empty string `""`**. Require user to choose/upload. |
| L102 | `newPostLocations` default | Pre-set to `"Sitges Beach Club"` | **Empty string `""`**. |
| L110 | `checkoutCardNumber` | Pre-filled fake card `"4111 2222 3333 4444"` | **Empty string `""`**. |
| L111 | `checkoutCardHolder` | Pre-filled `"Robert G. Voyager"` | **Empty string `""`**. |
| L112 | `checkoutExpiry` | Pre-filled `"12/28"` | **Empty string `""`**. |
| L113 | `checkoutCVV` | Pre-filled `"448"` | **Empty string `""`**. |
| L378 | `handleAddSafeSpot` body | Hardcodes `testReview` string | Remove — let review text come from a form field or omit. |
| L425–426 | `handleAddReview` body | Hardcodes `user: "Verified Member Robert G."` | Use a user context/input field. |
| L452 | `handleAddSocialPost` body | Hardcodes `authorName: "Robert G. Voyager"` | Use a user context/input field. |
| L650 | Avatar URL | Hardcoded Unsplash avatar URL (`photo-1534528741775`) repeated ×4 across header tooltip, nav rail, etc. | Extract to a single `USER_AVATAR` constant; make it configurable from profile. |
| L711 | Email `robs46859@gmail.com` | Hardcoded in header tooltip and passed to `UserProfileModal` | Pull from user context / auth. |
| L773 | Weather widget `"BARCELONA"` default | Falls back to hardcoded `"BARCELONA"` when no destination | Show `"—"` or `"SET DESTINATION"` |
| L777–783 | Weather conditions | Hardcoded temperature strings per destination | Replace with `"—"` or a real weather API call. |
| L904 | Map header cities `"SFO · BCN · BER"` | Hardcoded city codes | Derive from `safetyZones` data or show `"—"`. |
| L1917 | Safety patrol text | `"No active crowd-warnings for Barcelona Old Town tonight..."` | Make dynamic based on destination or hide when no data. |
| L2064 | `userEmail` prop | Hardcoded `"robs46859@gmail.com"` | Pull from user context. |

### 4. Client-side Hardcoded Strings — [Onboarding.tsx](file:///Users/robert/Desktop/hello-judy/src/components/Onboarding.tsx)

| Lines | What | Action |
|-------|------|--------|
| L17 | `destination` default `"Barcelona, Spain"` | **Empty string `""`**. |
| L18 | `travelDates` default `"2026-07-15 to 2026-07-22"` | **Empty string `""`**. |
| L21 | `interests` pre-selected `["Historic Milestones", "Beaches", "Queer Art Tours"]` | **Empty array `[]`**. |

### 5. Client-side Hardcoded Strings — [UserProfileModal.tsx](file:///Users/robert/Desktop/hello-judy/src/components/UserProfileModal.tsx)

| Lines | What | Action |
|-------|------|--------|
| L13 | `emergencyPhone` default `"+1 (555) 438-9943"` | **Empty string `""`**. |
| L14 | `travelVibe` default `"Curious & Cozy Wanderer"` | **Empty string `""`**. |
| L39 | Avatar URL | Same hardcoded Unsplash avatar | Use shared `USER_AVATAR` constant. |
| L46 | Name `"Robert G. Voyager"` | Pull from user context. |
| L69 | Stats `6`, `100%`, `$1,480` | These are fake stats | Show `0` / `—` until real data exists or fetch from API. |
| L147 | Security notice names `"Robert"` | Pull from user context. |

### 6. Client-side Hardcoded Strings — [ContactFormModal.tsx](file:///Users/robert/Desktop/hello-judy/src/components/ContactFormModal.tsx)

| Lines | What | Action |
|-------|------|--------|
| L85 | `name` default `"Robert G. Voyager"` | **Empty string `""`**. |
| L86 | `email` default `"robs46859@gmail.com"` | **Empty string `""`**. |
| L94–104 | `handleSubmit` is a **client-side stub** (`setTimeout`) | Wire to a real `POST /api/contact` endpoint, or disable and label "Coming soon". |

### 7. Client-side Hardcoded Data — [ItineraryViewer.tsx](file:///Users/robert/Desktop/hello-judy/src/components/ItineraryViewer.tsx)

| Lines | What | Action |
|-------|------|--------|
| L27–58 | `getRecommendationSpots()` | Hardcoded recommendation spots per city | Move to server endpoint `GET /api/recommendations?destination=...` or remove. |
| L61–93 | `getStreetviewImage()` | Hardcoded Unsplash images per category/destination | Move to server or remove streetview simulation entirely. |
| L96–117 | `getAiIntel()` | Entirely fabricated "AI Intel" (passcodes, quotes, safety text) | Remove or fetch from Gemini. Label as "AI-generated placeholder" if kept. |
| L141–146 | Budget defaults `$1800`, `$655`, `$240`, `$115`, `$85`, `$180` | Start all at `0` and let user fill. |
| L207–224 | `getCoordinatesForIndex()` / `getTransitTip()` | Fake coordinates and transit tips | Remove or derive from real data. |
| L413–414 | Quickbook prices `$85.00`, `$120.00` | Hardcoded in JSX | Pull from `marketplaceItems` data. |
| L978 | Average Stop Score `"★ 4.9 / 5.0"` | Hardcoded stat | Compute from itinerary `gayFriendlyRating` values. |
| L983 | Host Safety Grade `"A+ Certified"` | Fabricated | Remove or derive. |

### 8. Client-side Hardcoded Data — [PhotoAlbumEditor.tsx](file:///Users/robert/Desktop/hello-judy/src/components/PhotoAlbumEditor.tsx)

| Lines | What | Action |
|-------|------|--------|
| L6–12 | `PRESET_PHOTOS` | 5 hardcoded Unsplash photos with titles/locations | Move to server endpoint or allow user uploads only. |
| L58 | `albumTitle` default `"Robert & Friends Wanderlust '26"` | **Empty string `""`**. |
| L59 | `albumSubtitle` default | **Empty string `""`**. |
| L60 | `creatorName` default `"Robert G. Voyager"` | **Empty string `""`** or pull from user context. |
| L67–73 | `captions` pre-filled | **Empty object `{}`**. |
| L88–106 | `handleGenerateDigital` / `handleOrderPhysical` | Client-side stubs with `setTimeout` | Wire to real API endpoints or disable buttons and label "Coming soon". |

### 9. Unsplash Image URLs Used As Hardcoded Assets

There are **~30+ Unsplash URLs** scattered across server.ts, App.tsx, Onboarding.tsx, ItineraryViewer.tsx, and PhotoAlbumEditor.tsx used as avatars, post images, product images, and streetview simulations. These need to be:
- Removed where they serve as mock content (seed data)
- Replaced with uploaded user assets or fetched from an asset management endpoint
- Any remaining demo/placeholder imagery should use local assets or a proper CDN

---

## Stub Surfaces (Buttons/Fields Wired to Nothing Real)

| Surface | Location | Current Behavior | Action |
|---------|----------|------------------|--------|
| **"Book Curated Experience"** button in chat header | App.tsx L1264 | Immediately opens checkout for `marketplaceItems[1]` (hardcoded index) | Disable when no items; wire to marketplace selection flow. |
| **Contact Form "Send" button** | ContactFormModal.tsx L94 | `setTimeout` stub — no API call | Wire to `POST /api/contact` or show "Coming soon" disabled state. |
| **"Share" buttons** (Copy Link, Twitter) | ItineraryViewer.tsx L267–280 | Sets a `shared` boolean → shows banner. No actual sharing. | Wire to Web Share API / clipboard, or disable. |
| **"Compile Digital Album"** button | PhotoAlbumEditor.tsx L362 | `setTimeout` stub — no real PDF | Wire to real PDF gen endpoint or disable with "Coming soon". |
| **"Order Hardcover Book"** button | PhotoAlbumEditor.tsx L405 | `setTimeout` stub — no real order | Wire to real order endpoint or disable with "Coming soon". |
| **Photo "upload" presets** (accessory photo, social post image) | App.tsx L1612–1630, L1427–1450 | Clicking picks a preset Unsplash URL instead of real file upload | Replace with actual `<input type="file">` or keep presets but label clearly as "Sample photos". |
| **"Apply Updates" button** in UserProfileModal | UserProfileModal.tsx L153 | Calls `onClose()` — no persistence | Wire to a `PUT /api/user/profile` endpoint or show "Not yet available". |
| **Offline Map "Download"** toggle | App.tsx L874 | Toggles boolean. No real download. | Disable or remove — no real offline cache. |

---

## Proposed Execution Plan

### Phase 1 — Server data cleanup
1. Empty all seed arrays in `server.ts`
2. Remove random flight mutation logic
3. Remove auto-reply chat stub
4. Clean up hardcoded user names in review/post creation endpoints

### Phase 2 — Client default values cleanup  
1. Clear all pre-filled `useState` defaults (card numbers, names, emails, destinations, dates, etc.)
2. Add empty state UI for each tab when data arrays are empty

### Phase 3 — Hardcoded display strings
1. Replace hardcoded weather, city codes, safety patrol text with dynamic or empty states
2. Extract repeated avatar URL to a single constant
3. Extract repeated user name/email to a user context pattern

### Phase 4 — Stub surface handling
1. Wire Contact Form to a real endpoint (`POST /api/contact`) or disable
2. Replace photo presets with `<input type="file">` upload (real `FileReader`)
3. Add disabled + "Coming soon" states for: Share, Digital Album, Physical Album, Apply Updates
4. Remove the `Book Curated Experience` hardcoded marketplace index; use dynamic selection

### Phase 5 — ItineraryViewer mock intelligence
1. Move `getRecommendationSpots`, `getStreetviewImage`, `getAiIntel` to server or remove
2. Zero-out budget defaults
3. Compute stats from real data instead of hardcoding `4.9 / 5.0` and `A+ Certified`

### Phase 6 — PhotoAlbumEditor
1. Remove `PRESET_PHOTOS` and default captions
2. Clear default title/subtitle/creator
3. Disable or wire publish/order buttons

### Phase 7 — Verification & cleanup
1. Verify all tabs render clean empty states
2. Verify forms submit to real endpoints or show disabled states
3. Run `npm run build` to confirm no build errors
4. No orphan Unsplash URLs left in non-fallback code paths

---

## Out of Scope (This Sprint)

- Android / iOS app changes
- Authentication / user context system (we'll use inline patterns for now)
- Real payment gateway integration
- Real PDF generation
- Real weather API integration
- Database migration (keeping in-memory arrays, just emptied)

---

## 2026-06-01 Resume Note

Resuming after the prior agent stopped at `PhotoAlbumEditor.tsx` due to usage limits. The user clarified that remaining surfaces must be live, not disabled as "Coming soon". Current focus:

- Preserve and inspect the prior unstaged edits.
- Finish real Contact form submission via `/api/contact`.
- Replace photo presets and mock upload language with actual browser file uploads.
- Wire photo album digital generation and physical book ordering to real API endpoints that persist orders/artifacts in the app process.
- Sweep the app for user-facing stubs, mock defaults, hardcoded fake content, and inert buttons.
- Build, deploy the final web app, then commit and push.

> [!NOTE]
> This handoff is now the active recovery log for the final web-app sweep.

## 2026-06-01 Completion Note

Completed the live web-app sweep:

- Added real `/api/contact` intake and wired `ContactFormModal` to submit to it.
- Added photo album backend routes for digital album compilation, printable HTML export, physical order submission, and order listing.
- Rebuilt `PhotoAlbumEditor` around real multi-photo browser uploads, editable uploaded photo metadata, captions, digital export, and physical order submission.
- Replaced social-feed image presets with real browser image uploads.
- Replaced marketplace accessory photo presets with real browser image uploads.
- Removed the hardcoded guide checkout index and now routes guide booking through available marketplace tour data.
- Removed remaining hardcoded profile/default form values from the touched user-facing flows.
- Verified `origin` is `https://github.com/robs46859-eng/judy.git`.
- Verification passed: `npm run lint` and `npm run build`.

## Progress

- [x] Phase 1 — Server data cleanup
- [x] Phase 2 — Client default values cleanup
- [x] Phase 3 — Hardcoded display strings
- [x] Phase 4 — Stub surface handling
- [x] Phase 5 — ItineraryViewer mock intelligence
- [x] Phase 6 — PhotoAlbumEditor
- [x] Phase 7 — Verification & cleanup
