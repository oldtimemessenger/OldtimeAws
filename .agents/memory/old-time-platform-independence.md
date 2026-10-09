---
name: Old Time platform independence
description: Keep the Old Time app portable across hosting platforms.
---

Do not make Old Time's core app functionality depend on Replit-specific services, APIs, or assumptions.

**Why:** the user asked not to build the app to be dependent on Replit.

**How to apply:** favor standard, portable interfaces and self-hostable infrastructure for app functionality; do not hard-code Replit-only domains or services as runtime requirements. Keep temporary development callbacks separate from production callback settings; do not permanently bind production authentication to a Replit development URL.

Oldtime's intended infrastructure is AWS-first, with Cognito as the intended primary authentication provider. Inspect and reuse existing AWS infrastructure before selecting additional services.

**Why:** the user explicitly requested a real-user production audit and AWS-first implementation, not demo behavior, a superficial UI update or a report-only result.

**How to apply:** preserve the existing design/features and working authentication while preparing a tested transition. Do not claim readiness from a rendering screen, fabricate successful operations, provision expensive services or make destructive database/infrastructure changes without approval.

Do not make connecting Replit's catalog AWS connector a prerequisite for Oldtime's AWS implementation or treat it as AWS administrative access.

**Why:** its inspected setup instructions describe Cognito hosted-UI OAuth, not IAM access. The regional Cognito proxy injects a Bearer header, which does not by itself authorize Cognito user-pool operations or other AWS services. A successful connector authorization does not configure Oldtime's users' authentication or verify its S3/database infrastructure.

**How to apply:** re-check current connector instructions before relying on its capabilities. Implement Oldtime's own portable Cognito integration against the owner's intended user pool/app client; obtain configuration through secure tooling, and verify infrastructure separately without assuming the connector can inspect it.

When diagnosing Cognito's “Login pages unavailable” screen, inspect the initial authorization response's redirect and OAuth error code before attributing the problem to managed-login branding.

**Why:** the generic unavailable screen was served with HTTP 403 after an authorization response had already identified `redirect_mismatch`. The final page alone concealed the actionable failure; it did not prove a missing branding style.

**How to apply:** reproduce the application's exact authorization parameters without signing in, capture the initial response without automatic redirects, and inspect only safe error fields. Verify administrative settings through authorized read-only AWS access before changing them.

The user named **oldtimeaws** as the GitHub repository for the eventual handoff after the web app is finished and the native app is built.

**Why:** the user explicitly said “when you done we will build a native app push it do github oldtimeaws repo and configure the app to be non reliable to replit.”

**How to apply:** preserve that destination and sequence; GitHub/AWS work is not a reason to skip unfinished web launch checks.
