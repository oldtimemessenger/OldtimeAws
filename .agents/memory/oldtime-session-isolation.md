---
name: Oldtime asynchronous session isolation
description: Identity ownership for asynchronous requests, migrations and shared caches.
---

Pin account-scoped work to the session that started it. A later active session must never authorize or receive results from that earlier work.

**Why:** logout/login can overlap network requests, response-body parsing and multi-batch imports. Checking identity only when sending a request is insufficient: a different user can be active before the response is consumed.

**How to apply:** check session identity before requests and after asynchronous boundaries, including immediately before shared-cache mutations. Treat session changes as cancellation. Keep per-operation progress separate, and only let an operation clear loading/promise state that it still owns. An old unauthorized response must not invalidate a newer session. Preserve original user data when cancelling migrations.
