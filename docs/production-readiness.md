# Oldtime production-readiness audit — in progress

## Launch verdict

**Not ready for real-user launch.** Passing builds and rendering screens are not evidence that all social features work between independent accounts.

This is an initial repository-backed assessment and repair record, not a completed whole-application certification. Work is being done in manageable changes while preserving the existing design, creative tools and users' data.

## Five highest-risk blockers

1. **Shared data and access control:** much of the profile, relationship, audience, media-post, story and community state is browser-local. Server-backed text posts do not complete the social model. The server must enforce friendship, restricted audiences, blocking and source revocation across every read/write path.
2. **Account lifecycle:** current database-backed email/password authentication works. Portable Cognito integration exists but remains disabled pending the replacement pool's new web app client ID and live testing. Verification, recovery and complete server account deletion are not certified. Do not replace working authentication or migrate accounts without a tested transition.
3. **Media infrastructure:** the S3 adapter exists, but live uploads, IAM permissions, versioning, private delivery and cleanup have not been verified against the owner's AWS environment.
4. **Cross-device delivery:** messages, notification state and default call signaling still depend on local browser state/channels. Local “sent” status is not remote delivery.
5. **Safety and operations:** reports do not reach a complete moderation queue. Administrative access, abuse handling, age protections, legal/support information, monitoring and production recovery procedures need completion.

Security dependencies and HTTP-boundary issues discovered during this assessment were repaired immediately rather than deferred until the broader social migration.

## Feature inventory

| Area | Current evidence | Classification |
| --- | --- | --- |
| Navigation and existing design | Mobile browser rendering regression passes; public entry correctly says Oldtime | Implemented; physical-device coverage incomplete |
| Registration and account sessions | Real API registration exercised by the browser tester; server password hashing, token hashing, expiration and protected endpoints exist | Backend-connected; lifecycle partially implemented |
| Sign-in failure behavior | Regression verifies failed API sign-in cannot use a cached password or silently register | Repaired; valid-login/logout/expiration journeys need broader integration coverage |
| Cognito, email verification, recovery | Portable PKCE/token-verification integration exists; replacement pool discovery and public signing keys verified; new app client ID still missing | Disabled pending client configuration and live authentication/recovery testing |
| Profiles and settings | Backend profile lookup and professional-account endpoints exist; numerous ordinary profile settings remain local | Partially connected |
| Following, Friends, Close Friends, blocking | Client relationship/privacy rules have regression coverage; not a complete shared server relationship model | Browser-local / partially implemented |
| Feed and discovery | Authenticated, paginated public text-post feed and user search exist; media feed/discovery and relationship-aware access need completion | Partially connected |
| Posts and interactions | Server public text-post create/import/delete and likes exist; comment endpoints exist; several visible flows still use local state | Partially connected; not end-to-end certified |
| Camera, Studio, editing | Existing tools retained; Photo/Quote Save & Exit, reload recovery, quota failure/retry and discard verified | Implemented locally; physical capture and some editing paths untested |
| Public media uploads | S3 adapter validates ownership, expected size/type, file signatures and object versions | Integration code present; intended AWS setup unverified |
| Stories, communities and groups | Visible features remain; much of their state is local | Not a complete multi-user service |
| Messages, notifications and calls | Local state/signaling and existing creative sharing remain | Cross-device delivery incomplete |
| Creator/Business account tools | Authorized professional-account and measured analytics endpoints exist | Partially connected |
| Paid badges and subscriptions | Backend eligibility/entitlement checks have tests; store payment processing is not live | Integration points; no certified purchase service |
| Creator payouts | No live payout service was activated | Deferred / incomplete |
| Reports, moderation, account deletion | Local reports and data-reset controls do not complete server moderation or account deletion; tester could not find a delete action for its generated media post | Missing critical lifecycle functionality |
| Mobile and accessibility | Mobile entry screenshot and existing regression suite pass | Physical iOS/Android, camera permissions and assistive-technology coverage incomplete |
| Security and deployment | Dependency remediation and HTTP hardening verified; comprehensive cross-account and infrastructure audit still required | Improved; not launch-certified |

## Repairs verified in this development workspace

- Removed cached-local-password sign-in and automatic registration after failed API login.
- Added owner/context-scoped creative drafts with media bytes stored atomically, Save & Exit, save/discard/keep-editing choices and reload warnings.
- Preserved pending Carousel captures; Save & Exit in existing edit-to-composer flows commits captured shots to that composer instead of publishing.
- Prevented failed feed requests from automatically retrying on every render; explicit retry remains available.
- Bound online requests and multi-batch legacy imports to the session that started them. Delayed responses cannot fill another account's feed, overwrite its loading/migration state, or invalidate its newer login. Current-session 401 responses clear the session without deleting local posts.
- Fixed chart typing compatibility without changing visual design.
- Added API security headers, explicit production CORS, no-store caching, bounded JSON/form bodies and sanitized exception responses.
- Updated vulnerable dependencies. Replaced the preview tooling's vulnerable glob dependency with a compatible alternative while preserving component discovery.
- Retained the package release-age safety policy. The newest Express release was too new to install under that policy; the mature compatible proxy-address fix was installed instead.

## Tests actually executed

- Workspace type checks: **passed**.
- Web suite: **133/133 passed**, including an isolated mobile-browser regression and six new mocked-request session-isolation checks. Seeded fixtures and deferred request responses are testing-only; they do not certify independent-user backend interactions.
- API suite: **12/12 passed**, including HTTP CORS, security headers, body limits and safe error handling.
- Web, API and component-preview builds: **passed**. Large frontend bundle warnings remain.
- Three managed services restarted successfully; startup logs show all running.
- Live development API: unauthenticated account request rejected with **401**; malformed JSON rejected with **400** and security headers.
- Mobile public sign-in screenshot: correct Oldtime branding; no browser errors reported.
- Initial dependency scan: one critical, four high and three moderate findings. After remediation: **zero known findings**.
- Static-code and privacy-dataflow scans: no findings reported in the initial scan. This is not proof of complete security.
- Camera recovery tester: a continuation **passed** Photo/Quote Save & Exit, reload recovery, exact media-byte retention, previous-draft preservation under simulated quota failure, retry, Keep editing and Discard edit. Own-post IDs remained unchanged throughout the continuation. The Studio button was visible/enabled but was not activated; live capture, Carousel, caption/location/audience changes and non-default transforms were not browser-tested. The white Photo fixture/white text was not visually legible, so that layer's recovery was verified through stored data rather than canvas appearance. Quote recovery was visible.
- The tester's initial stale-reference click accidentally published its own fixture, before that passing continuation. It found no exposed delete control. This remains an identified post-lifecycle gap; no user-owned data was deleted or cleared to bypass it. Transient development resource 502s occurred during reloads and recovered.
- Real two-account social interactions, recovery emails, Cognito, AWS media delivery, payments, account deletion and physical-device journeys: **not certified**.
- Cognito's public discovery endpoint returned **200** and its authorization/token endpoints match the owner's supplied domain. This verifies public pool metadata, not the app client's allowed callbacks, scopes, branding style, or a successful user sign-in.
- Replacement Cognito pool update: new pool discovery and signing-key endpoints returned **200**; **19/19** targeted Cognito configuration/cryptographic tests and **14/14** account/session-isolation tests passed using test keys and mocked provider/API responses. No new-client authorization or real sign-in can be tested until its Client ID is supplied. See [Cognito configuration](cognito-configuration.md).

## Configuration and owner intervention

- Supply the replacement pool's web app client ID, verify its allowed callback/sign-out URLs, OAuth configuration and managed-login style, then live-test the implemented portable Cognito integration before cutover. A Replit AWS connector authorization is not required and does not provide AWS IAM administrative access. Do not provision a duplicate pool or switch existing users prematurely. See [Cognito configuration](cognito-configuration.md).
- Confirm the intended PostgreSQL deployment and existing data/backups. A working development connection does not prove production database readiness.
- Verify the existing S3 bucket, versioning, private ownership permissions, upload CORS and scoped IAM role. Server settings: `MEDIA_OBJECT_BUCKET`, `AWS_REGION`/`AWS_DEFAULT_REGION`, optional `MEDIA_OBJECT_PREFIX` and `S3_ENDPOINT`.
- Set `CORS_ALLOWED_ORIGINS` when the production frontend/API or mobile clients are cross-origin.
- Confirm production domains, TLS, reverse-proxy trust/rate limiting, monitoring, backups and operational ownership.
- Supply approved business/support information and review privacy, terms, age policy, retention and moderation responsibilities.
- No new AWS infrastructure, destructive database migration, live payment/payout activation or publishing was performed. A public Replit deployment exists, but these development changes have **not** been published, and AWS migration is not complete.

## Store-policy concerns

Official policy sources were consulted on 2026-10-09:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): user-generated-content services need objectionable-content filtering, reporting with timely responses, blocking and published contact information.
- [Apple account deletion requirement](https://developer.apple.com/news?id=12m75xbj): account creation must have an in-app account-deletion path; browser data reset is not equivalent.
- [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en): requires an in-app path and a public web resource for account and associated-data deletion.

Native digital-goods billing, regional exceptions, verified receipts, renewals/refunds, safety disclosures and store submissions still require specific review before enabling purchases. No App Store or Google Play approval is claimed.

## Required launch sequence and costs

Complete server persistence and authorization, configure and test the existing AWS services, run real independent-account/privacy/deletion tests, validate backups and failure handling, then review deployment and store requirements with the owner. Publishing the current frontend alone would not resolve these blockers.

AWS costs cannot be responsibly stated until the existing services, region, user volume, media storage/egress, messaging and monitoring requirements are confirmed. No paid infrastructure was provisioned during these repairs.
