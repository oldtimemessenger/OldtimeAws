---
name: Old Time mockup preview ports
description: Prevent stale canvas frames caused by mockup-sandbox Vite port drift.
---

The mockup-sandbox artifact is routed through port 8081. If Vite reports that 8081 is occupied and switches to 8082, it can serve on 8082 while the artifact router still sends previews to 8081, where an older process may answer.

**Why:** On 2026-10-06, a duplicate Vite process held 8081, so the restarted server moved to 8082 and the proxy continued to reach the stale process.

**How to apply:** Compare the configured artifact port, workflow log, and exact listening process. Clean up only the stale duplicate, keep Vite pinned to the injected port with `strictPort`, restart the managed workflow once, and confirm the preview responds on that port. Do not change artifact routing to hide the mismatch.
