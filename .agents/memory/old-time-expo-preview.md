---
name: Old Time Expo preview startup
description: Distinguishing transient Expo preview startup blanks from route or render failures.
---

A just-restarted Expo web preview can capture as blank before its bundle and asynchronous saved-session check settle. A later capture rendered the sign-in screen without a functional code change.

**Why:** A blank first capture did not reproduce after the app and session-loading state finished settling.

**How to apply:** After restarting Expo, wait for the web bundle and sign-in state to settle, then recapture before changing routes based on one blank image.
