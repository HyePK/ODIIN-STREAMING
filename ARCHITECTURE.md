# ODIIN STREAMING architecture

## Product surfaces

- `/` — responsive viewer home with Live Now, Indie Podcasts, Indie Movies, Show Series, and Artist Music Review rows.
- `/admin` — direct entry to Control Center.
- `/api/events` — durable event and stream-setting records.
- `/api/media/:id` — ODIIN-hosted recorded-video upload and playback.
- `/api/gate` — per-broadcast access-code and viewer-registration gates.
- `/api/account` — ODIIN viewer profiles and saved-video libraries.
- `/api/stream` — read-only adapter that normalizes broadcasts from the configured streaming channel.
- `/watch/:id` — unique shareable ODIIN link for every broadcast.
- `/account` — signed-in ODIIN viewer account.
- `/studio` — paid-subscriber Creator Studio with two explicit publishing modes: pre-recorded upload or live camera/microphone publishing from a phone, tablet, or computer.
- `/api/creator` — subscription-gated broadcast creation and live-session controls.
- `/channel/:slug` — individually branded creator channel page controlled by the owner.
- `/channels` — public directory containing every active paid creator channel.
- `/api/channel/:slug` — public, safe creator-page catalog data.
- `/admin-access` — server-verified administrator code gate that opens `/admin` with a protected session cookie.
- `public/manifest.webmanifest` and `public/service-worker.js` — installable PWA behavior.
- `mobile/` — Capacitor configuration for iOS and Android builds.

## Data

Events, gates, viewer accounts, creator subscriptions, saved videos, and registrations are stored in the platform database. Each viewer's saved-video records populate their personal library and roll up into account statistics in Control Center. Uploaded recordings are stored in private object storage and published through ODIIN playback routes. An empty catalog shows an honest off-air state instead of sample programming.

Each event has an owner-controlled home-row placement. Live status overrides that placement while the event is on air so it appears in Live Now; after the live session ends, it returns to its assigned content row.

## Playback

An event may use a direct HLS/MP4 playback URL or a hosted broadcast identifier. The public player never exposes owner credentials. Channel synchronization is performed server-side through `/api/stream`.

Paid creators can upload a browser-ready recorded video or publish from the browser using device camera/microphone capture and a per-account WHIP ingest endpoint. Every created event receives a unique `/watch/:id` link on the ODIIN site. The corresponding HLS playback URL is exposed to viewers only through the event record. The live-video provider must support WHIP ingest, CORS for the ODIIN origin, and HLS playback.

## Administration

Write operations accept authenticated owner-workspace requests. An optional `ODIIN_ADMIN_KEY` environment variable supports protected edits from a standalone public deployment or native app. The secret is never shipped to the client bundle.

The owner can activate or revoke creator access per account and configure that subscriber's live publishing endpoint, token, and playback URL. Creator Studio validates the signed-in account and active subscription before returning publishing configuration.
