# Luxia Crypto Trade

## Current State
- Full app exists with 12 pages, signal engine, auth system, tracking, news, admin panel, AI dashboard
- Founder page uses old photo path: `/assets/uploads/img_7311-019d2a04-59cb-712a-9586-97d8b6a6dc05-1.jpeg`
- News auto-refreshes every 5 minutes, no image shown in news cards
- AdminPage has its own redundant login form (conflicts with main auth)
- Admin tabs are "signals", "news", "users" — wrong, should be Users/Posts/AI
- Signal cards show entry/TP/SL but no live current price
- Post page lacks image upload
- Tracked trades stored in localStorage (already persistent)

## Requested Changes (Diff)

### Add
- Live price row in every LiveSignalCard (shows current price with color-coded change vs entry)
- Full Admin Panel rebuild: bento-grid home screen + Users/Posts/AI tabs
  - Admin home: stats grid (total users, active sessions, guest count, AI status)
  - Users tab: add/edit/delete users, auto-generate UID, set expiry (1d/1w/1mo/1yr)
  - Posts tab: create with heading, tagline, description, image file upload, promo switch; list & delete existing posts
  - AI tab: live AI status, scan stats, data points, failures, breaker toggle
- Image upload support in Post creation (FileReader → base64 stored in localStorage)
- Tracked trades: confirm permanent localStorage persistence (no expiry unless user deletes)

### Modify
- Founder page: update photo path to `/assets/uploads/img_7311-019d2f63-aa70-77e6-a494-e7256e2b52e4-1.jpeg`
- News page: switch to CryptoCompare as primary source, set auto-refresh to 60 minutes (3600000ms), add news thumbnail images from CryptoCompare API (which provides image URLs), improve AI insight display
- AdminPage: remove redundant login form — admin access is controlled by main auth (isAdmin check); if not admin, show access denied
- Post page: posts now display uploaded image if available; admin creation dialog includes image file upload
- LoginModal: ensure form resets cleanly on close

### Remove
- AdminPage internal login form (was duplicating auth logic and causing confusion)

## Implementation Plan
1. Update FounderPage.tsx: change photo src to new path
2. Update NewsPage.tsx: CryptoCompare primary, hourly refresh, display news images from API
3. Rebuild AdminPage.tsx: use useAuth isAdmin check, bento home, Users/Posts/AI tabs with full CRUD
4. Update PostPage.tsx: add image upload to create dialog, show image in post cards
5. Update LiveSignalCard.tsx: add live price display row between header and entry/TP/SL section
6. Ensure tracked trades in TrackingPage use per-user localStorage key with no auto-expiry
