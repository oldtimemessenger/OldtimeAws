---
name: Old Time real-time communications
description: User-approved public Live scope, WebRTC delivery, and media retention.
---

Preserve existing one-to-one voice/video calls. Do not ship a public Live broadcast implementation unless it meets the user's complete Old Time Rooms requirements without a hosted third-party media provider. If the app cannot provide the required SFU/TURN architecture, remove public Live rather than leaving a six-viewer peer-to-peer substitute. Never automatically record or store call or broadcast media. Group video conferences remain limited to private group conversations, restricted to friends who belong to that conversation.

**Why:** the user requires six active speakers with a potentially large listener audience, prohibits LiveKit and other third-party media providers, and explicitly prefers removing Live over shipping an inadequate version.

**How to apply:** keep one-to-one voice/video call behavior intact; do not add a hosted media SDK/provider. If an owned, scalable SFU/TURN design is unavailable, keep public broadcast routes and UI out of the app. Enforce group-call membership server-side against authenticated account and conversation membership; do not rely on client-supplied friend lists or local storage for authorization.
