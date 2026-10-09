---
name: Old Time creator and Blue Badge roadmap
description: Build social and creator features separately from creator earnings; Blue Badge billing must use Apple and Google stores.
---

The user corrected the earlier blanket monetization removal. Their attached Old Time creator-ecosystem notes remain the roadmap, with these explicit changes:

- Build the Blue Badge membership system and creator ecosystem. The user explicitly clarified that the restriction applies to creator earnings and external payment/payout connections, not this implementation.
- An approved creator must keep a valid membership.
- Use Apple and Google in-app purchases for Blue Badge memberships. Do not use Stripe or another external subscription checkout.
- Defer creator monetization and payouts until Old Time is earning money and the user connects the payout/payment infrastructure.
- Never simulate a purchase or entitlements. Validate membership with the relevant store before granting or retaining member benefits.
- Preserve payment records and do not cancel subscriptions or remove secrets as part of code changes.

The notes distinguish Creator Program approval from permission to receive money, describe creator eligibility and progression, and say Blue Badge payment must not bypass creator eligibility. Preserve that distinction alongside the user's membership requirement for approved creators.

**Why:** the user clarified that the earlier request meant removing creator monetization and Stripe—not abandoning the Blue Badge or creator roadmap—and explicitly chose store billing for the badge.

**How to apply:** continue authorized creator-ecosystem work while deferring creator earnings and payout connections. Keep store purchases honestly unavailable until native Apple/Google billing is connected.
