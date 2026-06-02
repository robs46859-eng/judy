# Judy's — Buildout Sweep
**Date:** 2026-06-02  
**Scope:** Full codebase audit of what is live vs. what needs real implementation  

---

## What Is Fully Live ✅

| Feature | How it works |
|---|---|
| AI Itinerary Generator | Gemini 2.0 Flash, structured JSON schema, graceful offline fallback |
| Gemini Translation Widget | Real Gemini call, 5 language targets, graceful fallback message |
| Local Recommendations (map pins) | Gemini call per destination → real venue names, food & drinks |
| Safety Zone contribution | User submits spot → persisted to `data/safety-zones.json` |
| Safety Zone reviews & upvotes | Stored and persisted per zone |
| Social feed posts | Real image uploads (FileReader), persisted to `data/social-feed.json` |
| Photo Album Editor | Real multi-photo browser uploads, captions, 4 themes, page preview |
| Digital Album Export | Server renders print-ready HTML at `/api/photo-albums/:id/export.html` |
| Physical Album Print Order | Form with recipient + address, persisted, **admin email sent on submit** |
| Contact Form | Wired to `/api/contact`, persisted, **admin email sent on submit** |
| Bucket List | Full CRUD (add, toggle, delete), persisted to `data/bucket-list.json` |
| Marketplace Bookings | Checkout flow, persisted to `data/bookings.json` |
| Dark / Light mode | `localStorage` toggle, works across reload |
| Admin Dashboard | `/admin/orders?key=ADMIN_KEY` — shows print orders, contacts, bookings |
| Data persistence | All collections written to `data/*.json` on every mutation, survive restarts |

---

## Needs Building Out 🔨

### 1. Authentication / User Identity
**Current state:** No login. Every visitor is "Judy's Member" with a blank avatar.  
**Impact:** High — no way to associate bookings, posts, or reviews with a real person. Profile changes are lost on page refresh.  
**Build:** Add an auth system. Options ranked by effort:
- **Low effort:** Supabase Auth or Auth0 (drop-in, free tier) — email/password + Google OAuth
- **Medium effort:** JWT + `POST /api/auth/register` + `POST /api/auth/login` with bcrypt
- **Required after auth:** Replace `"Judy's Member"` / `"Member"` / `""` strings in `App.tsx`, `UserProfileModal.tsx`, and every API mutation handler with the authenticated user's name/email

---

### 2. Real Payment Processing
**Current state:** The checkout modal collects card fields (number, holder, expiry, CVV) but `handlePayCheckout` just calls `/api/marketplace/bookings` directly — **no card is charged**.  
**Files:** `App.tsx` L501–529 (`handlePayCheckout`), checkout modal L1945–2100  
**Impact:** Critical for revenue — users can "book" anything for free right now  
**Build:** Integrate Stripe.js
- Add `@stripe/stripe-js` and `@stripe/react-stripe-js` on the frontend
- Add `stripe` (Node SDK) on the server, create a `POST /api/payments/intent` endpoint
- Replace the card form with Stripe's `<CardElement>` or `<PaymentElement>`
- Only call `/api/marketplace/bookings` after Stripe confirms payment

---

### 3. Marketplace Item Catalog (Admin CRUD)
**Current state:** `itemsDatabase` is an empty array loaded from `data/marketplace.json`. The Shop tab shows nothing.  
**Files:** `server.ts` — `GET /api/marketplace/items` returns `[]`, no POST/PUT/DELETE admin endpoint  
**Impact:** The entire Shop tab is invisible to users until items exist  
**Build:**
- Add `POST /api/admin/marketplace/items` (protected by `ADMIN_KEY`) to create items
- Add `PUT /api/admin/marketplace/items/:id` and `DELETE /api/admin/marketplace/items/:id`
- Add an item form to the admin dashboard at `/admin/orders`
- Fields needed: `title`, `description`, `category` (tours/tickets/postcards/souvenirs), `price`, `imageUrl`

---

### 4. Local Guides Roster
**Current state:** `localGuides` is an empty array. The Chat tab shows "Available local experts" with nothing listed.  
**Files:** `server.ts` — `GET /api/guides` returns `[]`, no admin POST  
**Impact:** Chat tab is completely empty; "Book Curated Experience" button redirects to an empty Shop  
**Build:**
- Add `POST /api/admin/guides` (ADMIN_KEY protected) — fields: `name`, `avatar`, `location`, `languages`, `bio`, `rating`, `online`
- Add guide management section to `/admin/orders` dashboard
- Long term: build a guide-side portal so guides can manage their own availability

---

### 5. Real-Time Flight Data
**Current state:** `flightsData` is empty. The Live Flight Tracker sidebar shows nothing. The app polls `/api/flights` every 10 seconds but gets `[]` every time.  
**Files:** `App.tsx` L177–209, `server.ts` — `GET /api/flights`  
**Build:** Connect a real flight API:
- **AviationStack** (free tier: 500 req/month) — `GET /flights?access_key=KEY&flight_iata=...`
- **OpenSky Network** (free, no key required) — real-time flight positions
- Cache results in `flightsData` for 60 seconds server-side to avoid rate limits
- Allow users to add their own flight number during onboarding so the tracker is personalized

---

### 6. Real Weather Data
**Current state:** The header weather widget shows `"☀️ Checking..."` indefinitely for any destination. There is no weather API call.  
**Files:** `App.tsx` L779–790  
**Build:** Call a weather API when `onboardingAnswers.destination` is set:
- **Open-Meteo** (completely free, no key) — geocode destination name → get current temp + condition
- **OpenWeatherMap** (free tier 60 calls/min) — simpler, direct city name lookup
- Display real temperature + condition icon in the header widget

---

### 7. User Profile Persistence
**Current state:** "Apply Updates" in `UserProfileModal` calls `onClose()` only — safety tier, travel vibe, and emergency phone are lost on page close.  
**Files:** `UserProfileModal.tsx` L153–158  
**Build:**
- Add `PUT /api/user/profile` endpoint — store profile in `data/user-profile.json`
- Load on app mount (`GET /api/user/profile`), pass down as prop
- After auth (item #1) this ties to a specific user record

---

### 8. Social Post Comments
**Current state:** Every post shows a `commentsCount` field (always 0) but there is no comment form or comment thread UI.  
**Files:** `App.tsx` L1519–1521 (counter display only)  
**Build:**
- Add `GET /api/social-feed/:id/comments` and `POST /api/social-feed/:id/comments`
- Add a comment input under each post card, expandable on click
- Persist comments in `data/social-feed.json` alongside the post

---

### 9. Share Buttons (Itinerary)
**Current state:** The Copy Link and Twitter share buttons in `ItineraryViewer` set a `shared` boolean and show a "Itinerary link shared!" banner. Nothing is copied or opened.  
**Files:** `ItineraryViewer.tsx` L131–134 (`handleShare`)  
**Build:**
- Copy Link: use `navigator.clipboard.writeText(window.location.href)`
- Twitter: open `https://twitter.com/intent/tweet?text=...&url=...` in a new tab
- Add a server endpoint `POST /api/itineraries/share` that saves the itinerary snapshot and returns a shareable permalink (e.g. `/shared/it_abc123`)

---

### 10. Offline Map Download
**Current state:** The "Download Map" toggle in the Safety tab sets `isOfflineMapDownloaded` to true and shows "● Activated (24MB Cached)" — no actual caching occurs.  
**Files:** `App.tsx` L879–888  
**Build:** Either:
- Implement a real Service Worker with the safety zone GeoJSON cached via Cache API
- Or remove the toggle entirely and replace with a "Export as PDF" function that generates a static safety map PDF

---

### 11. Real Streetview Images
**Current state:** The "📸 Street" tab in the itinerary panel shows a gradient placeholder because `getStreetviewImage()` returns `""` for all inputs.  
**Files:** `ItineraryViewer.tsx` L36–38  
**Build options:**
- **Google Street View Static API** — `https://maps.googleapis.com/maps/api/streetview?location=LOCATION&key=KEY` — charges per request
- **Mapillary** (free) — open-source street-level imagery API
- **Fallback:** Use Gemini to generate a descriptive scene text instead of an image, shown as an atmospheric paragraph in the panel

---

### 12. Physical Print Fulfillment
**Current state:** Orders land in `data/album-orders.json` and the admin gets an email. But there is no actual print service connected — someone manually has to process each order.  
**Build:**
- Integrate a print-on-demand API: **Printful**, **Prodigi**, or **Lulu Direct** all offer book/album printing APIs
- On `POST /api/photo-albums/physical-orders`, forward the order (photos + metadata) to the print API
- Store the print service's order ID alongside the local order record
- Update order status via webhook from the print service

---

### 13. Safety Patrol Warning — Real Data
**Current state:** The warning widget shows `"No active crowd-warnings for [destination] tonight"` — hardcoded, never changes regardless of destination or time.  
**Files:** `App.tsx` L1901–1906  
**Build:** Options:
- Feed from community safety zone data already in the app (e.g., flag zones with recent low-rating reviews)
- Connect to a real safety data source (e.g., Ushahidi, local police APIs if available)
- At minimum: derive the message from the actual safety zones in the database (e.g., count zones rated below 7.0)

---

### 14. Chat — Guide-Side Messaging
**Current state:** Users can send messages to a guide, but there is no guide-side interface to receive or reply. Guides have no portal, no notifications, no way to respond.  
**Files:** `server.ts` — `POST /api/chats` stores message, `GET /api/chats` returns all  
**Build:**
- Create a guide portal (separate route or protected tab): `/guide/inbox?key=GUIDE_KEY`
- Show unread messages per conversation
- Allow guides to reply via a form
- Long term: WebSocket (`ws` or `socket.io`) for real-time delivery instead of polling

---

### 15. Postcard Mailing in Marketplace Checkout
**Current state:** The marketplace checkout modal has fields for postal address (recipient, street, city/zip, country, message) for `isPhysicalPostcard` items, and the booking is stored. But there is no fulfillment pipeline.  
**Files:** `App.tsx` L501–529 (`handlePayCheckout`), `server.ts` `POST /api/marketplace/bookings`  
**Build:** Same as item #12 — connect a print/mail API (Postsnap, Touchnote API, or a direct print-on-demand provider) to actually print and mail the postcards.

---

## Environment Variables Needed

Add these to Hostinger's Node.js env panel:

| Variable | Purpose | Required |
|---|---|---|
| `GEMINI_API_KEY` | All AI features | ✅ Already set |
| `NODE_ENV` | Must be `production` | ✅ Already set |
| `ADMIN_KEY` | Protects `/admin/orders` | 🔨 Set this now |
| `SMTP_HOST` | Email notifications | 🔨 For order/contact emails |
| `SMTP_PORT` | Usually `587` (TLS) or `465` (SSL) | 🔨 |
| `SMTP_USER` | Your email address | 🔨 |
| `SMTP_PASS` | Email password or app password | 🔨 |
| `ADMIN_EMAIL` | Where admin emails go (default: robcofamily@gmail.com) | Optional |
| `STRIPE_SECRET_KEY` | Payment processing | 🔨 When ready |
| `STRIPE_PUBLISHABLE_KEY` | Stripe frontend | 🔨 When ready |

> **Hostinger SMTP:** Your Hostinger plan includes email hosting. Use `mail.judy.lgbt` as `SMTP_HOST`, port `587`, with your Hostinger email credentials. Create a mailbox like `hello@judy.lgbt` in hPanel → Email → Email Accounts first.

---

## Priority Order

| Priority | Item | Effort | Revenue Impact |
|---|---|---|---|
| 🔴 P0 | Real payment (Stripe) | Medium | Directly blocks revenue |
| 🔴 P0 | Marketplace items (admin CRUD) | Low | Shop tab is empty |
| 🔴 P0 | Set `ADMIN_KEY` env var | Minutes | Admin dashboard locked |
| 🔴 P0 | Configure SMTP | Minutes | No order/contact emails arriving |
| 🟠 P1 | Authentication | High | Needed for personalization |
| 🟠 P1 | Local guides roster | Low | Chat tab is empty |
| 🟠 P1 | Physical print fulfillment | Medium | Orders arrive but can't ship |
| 🟡 P2 | Flight tracker | Low | Nice-to-have widget |
| 🟡 P2 | Weather widget | Low | Header cosmetic |
| 🟡 P2 | User profile persistence | Low | Quality-of-life |
| 🟡 P2 | Share buttons | Low | Social growth |
| 🟢 P3 | Comments on posts | Medium | Community depth |
| 🟢 P3 | Streetview images | Low-Medium | Visual polish |
| 🟢 P3 | Offline map | High | Niche use case |
| 🟢 P3 | Guide-side chat portal | High | Full two-way messaging |
| 🟢 P3 | Safety patrol real data | Medium | Trust signal |
