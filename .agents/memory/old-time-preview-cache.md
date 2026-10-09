---
name: Old Time preview cache
description: How stale service-worker assets affected Old Time on the mobile development preview.
---

When Old Time shows an older screen on a mobile `.replit.dev` preview while the Vite host serves the current source, check the service worker before editing the screen. Its cache-first shell uses stable asset URLs, so it can keep old JavaScript and CSS after workspace changes. Keep the development preview free of persistent service-worker caches and version the production shell cache when its assets change.

**Why:** On 2026-10-06, the mobile preview showed the previous Settings and profile editor while the development host served the updated source; the cached shell explained the mismatch.

**How to apply:** Confirm the URL and compare its served bundle with the workspace build. If only the mobile preview is stale, clear the Old Time shell cache and avoid changing navigation or page components to compensate.
