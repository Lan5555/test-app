# Paid voting backend handoff

## What the frontend implements

- `/pages/votes`: public polls, search, prices and status.
- `/pages/votes/[slug]`: candidates, quantity, receipt email and hosted checkout.
- `/pages/votes/[slug]?candidate=<candidateId>`: shareable link selecting a candidate.
- `/pages/votes/payment?purchaseId=<purchaseId>`: server-verified receipt; provider redirect parameters never prove payment.
- `/pages/admin/votes`: admin poll creation, draft candidate registration, publish/close, verified totals and share links.
- Entry points: login page, student dashboard, admin sidebar.

This repository contains the voting frontend. The backend endpoints below have been reported as implemented, with Flutterwave hosted checkout. The client uses those endpoints; live integration and provider verification still require deployment checks. No local sample candidates, simulated payments or browser-maintained vote totals are used.

The API base is the existing `NEXT_PUBLIC_DATABASE_LINK`. Add `/votes/api` to that base. Do not expose payment secret keys in any `NEXT_PUBLIC_*` setting. Configure allowed frontend origins and the canonical frontend URL on the server.

## Response and authentication contract

Every endpoint returns JSON `{ "success": true, "message": "...", "data": ... }`. `message` may be a string or a string array; the frontend combines validation messages for display. Errors use non-2xx HTTP status and `{ "success": false, "message": "Safe user-facing explanation", "data": null, "code": "OPTIONAL_MACHINE_CODE" }`. Do not return 200 for authorization or provider failures.

The original portal continues to use `POST /users/api/login-admin` and `sessionStorage.adminSession`. Voting administration signs in separately using `POST /votes/api/admin/login` with JSON `{ "password": "<voting-password>" }`, returning envelope data `{ token, name, email, level }`. The frontend preserves the exact voting password, stores only the voting token and display identity, and clears only that voting session on logout or an admin 401/403. No portal or student token is reused for voting.

Public poll reads and guest purchases do not require login. Admin endpoints require `Authorization: Bearer <admin-token>`, taken exclusively from `sessionStorage.votingAdminSession` by this frontend. Validate the signature, expiration, revocation and current admin permissions on EVERY request. The client gate is only navigation UX. Do not accept a student token as an administrator.

Receipt reads require `X-Vote-Receipt-Token: <opaque-secret>` scoped to that purchase. Generate a cryptographically random token, store a hash, compare safely, rate limit, and never expose it through public lists, URLs, logs, or provider metadata. Receipt reads return no payer email. Provide a support process for recovery when the original browser tab/session has been lost. Guest vote purchases may be repeated; this is a paid support system, with multiple votes per candidate, rather than a one-person-one-vote election.

Use 400/422 validation, 401/403 auth, 404 unavailable records, 409 conflicts/closed poll/idempotency mismatch and 429 rate limiting. Messages must distinguish a closed poll, disabled candidate, pending payment and temporary provider failure. Frontend requests use JSON, no caching; support CORS for `Authorization`, `Content-Type`, `Idempotency-Key` and `X-Vote-Receipt-Token` from configured origins.

## Exact data shapes

IDs are opaque strings. All timestamps are ISO 8601 UTC. Monetary amounts are positive integer minor units (kobo), never floating point. This first version supports NGN only.

```ts
type Poll = {
  id: string;
  slug: string;                 // server-generated, unique, immutable, URL-safe
  title: string;
  description: string;
  status: 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED';
  currency: 'NGN';
  votePriceMinor: number;
  maxVotesPerPurchase: number;
  opensAt: string;
  closesAt: string;
  resultsVisible: boolean;
  totalVotes: number | null;
  candidateCount: number;
  imageId: string | null;
  imageUrl: string | null;
};
type Candidate = {
  id: string;
  name: string;
  bio: string;
  photoUrl: string | null;
  photoImageId: string | null;
  active: boolean;
  voteCount: number | null;
};
type PollDetail = { poll: Poll; candidates: Candidate[] };
```

Public `totalVotes`/`voteCount` MUST be `null` when results are hidden, not zero. Do not leak hidden totals in another field. Admin reads return actual totals. Counts represent verified, credited votes minus reversed/refunded votes. Public poll/candidate reads must never include payer information, internal payment details or unpublished drafts.

`SCHEDULED` and `OPEN` reflect publication AND server time; transition scheduled polls automatically or derive status when reading. Close published polls automatically at `closesAt`. Check the actual time on purchases even if a scheduler has not run. Public lists include published scheduled/open/closed polls. Public direct reads for a draft return 404. Candidate lists may include inactive candidates with `active: false` and a visible unavailable state; no new purchases can target them.

## Endpoints used by the UI

| Method | Path below `/votes/api` | Body / response `data` |
| --- | --- | --- |
| GET | `/polls` | `Poll[]`, published only, newest first |
| GET | `/polls/:slug` | `PollDetail`, published only |
| GET | `/admin/polls` | `Poll[]`, all statuses, admin only |
| GET | `/admin/polls/:id` | `PollDetail`, admin only |
| POST | `/admin/polls` | Create body below; returns saved `Poll` with `DRAFT` status |
| POST | `/admin/polls/:id/candidates` | `{ name, bio, photoImageId }`; returns saved `Candidate`; legacy `photoUrl` remains supported by the API |
| POST | `/admin/images` | Multipart `purpose` and `file`; returns the saved image metadata described below |
| POST | `/admin/polls/:id/status` | `{ status: "PUBLISHED" \| "CLOSED" }`; returns updated `Poll` |
| POST | `/purchases` | Purchase body below; returns `Checkout` |
| GET | `/purchases/:purchaseId` | Receipt-token header required; returns `VoteReceipt` |

List endpoints return complete arrays in v1; do not silently return only the first page. If volume requires pagination, update the client and contract together.

### Create poll

```json
{
  "title": "Student awards 2026",
  "description": "Support your preferred candidate.",
  "currency": "NGN",
  "votePriceMinor": 10000,
  "maxVotesPerPurchase": 1000,
  "opensAt": "2026-12-01T08:00:00.000Z",
  "closesAt": "2026-12-10T20:00:00.000Z",
  "resultsVisible": true
}
```

Validate trimmed title 1–150 characters, description 1–3000, positive safe integer price, integer maximum 1–100000, valid dates, `closesAt > opensAt`, and future closing time. Set configurable operational maximum amounts compatible with the payment provider. Validate multiplication against integer overflow. Generate IDs/slugs on the server.

Candidate name: trimmed 1–150 characters, bio: trimmed 1–2000. New candidates are active with zero votes. The UI uploads portraits and submits `photoImageId`; the backend resolves the canonical `photoUrl`. The legacy URL input is still supported by the API for approved HTTPS hosts, but is not shown in the new upload form. Never submit both a non-null `photoImageId` and a non-null `photoUrl`.

### Poll covers and candidate portraits

The admin UI sends `POST /votes/api/admin/images` using the separate voting-admin Bearer token. The request is `FormData` with `purpose: 'POLL' | 'CANDIDATE'` and one `file`. The browser supplies `Content-Type` and the multipart boundary. Accepted files are JPEG, PNG, and WebP, non-empty and at most 5 MiB (5,242,880 bytes); the server still validates file signatures and ownership. Uploads allow 60 seconds for transfer and processing and can be cancelled when leaving the form.

The success envelope contains `{ imageId, url, publicId, purpose, width, height, bytes, format }`. Use `url` for preview and retain only `imageId` for attachment. Poll creation adds `imageId: string | null`; candidate registration adds `photoImageId: string | null`. Creation requests remain JSON. Do not send delivery URLs or `publicId` as poll cover inputs. Pending or failed image selections block form submission until upload succeeds or the administrator explicitly continues without an image. Removing an image from an unsaved form does not delete the uploaded asset.

Uploads are not idempotent. The frontend never automatically retries; an explicit retry after an uncertain response can create another asset. There are no image editing or deletion endpoints. Draft-only registration and publication locks remain enforced by the backend.

Public and admin lists/details use `poll.imageUrl` and `candidate.photoUrl`. Missing, unsafe, or broken images fall back to artwork/initials. Native image delivery supports the backend-approved public HTTPS hosts without a browser Cloudinary SDK, secrets, upload preset, or Next.js image-host configuration. No additional frontend environment variable is needed.

Deployment still requires the backend image migration (`docs/sql/voting-cloudinary-images.sql` or registered TypeORM migrations), configured Cloudinary settings, suitable proxy multipart limits, and a live authenticated upload/delivery check. Those operational steps were not performed by this frontend integration.

Candidate creation is allowed only for drafts. Publish requires at least one active candidate and a future closing time; returns `SCHEDULED` if opening is future, otherwise `OPEN`. Lock poll configuration and candidates after publishing. Closing is terminal and stops new purchases immediately. Reject publish-after-close and any public attempt to set status or count fields. Implement draft creation, registration and publish/close in separate existing backend domain modules/services rather than combining them with quiz logic.

### Start/resume a purchase

Header: `Idempotency-Key: <UUID>`.

```json
{
  "pollId": "opaque-poll-id",
  "candidateId": "opaque-candidate-id",
  "quantity": 10,
  "email": "voter@example.com"
}
```

```ts
type Checkout = {
  purchaseId: string;
  receiptToken: string;
  checkoutUrl: string;          // HTTPS hosted payment URL
  amountMinor: number;         // derived from saved price * quantity
  currency: 'NGN';
  quantity: number;
};
type VoteReceipt = {
  purchaseId: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REVIEW' | 'REFUNDED';
  candidateName: string;
  pollTitle: string;
  quantity: number;
  amountMinor: number;
  currency: 'NGN';
  creditedVotes: number;
};
```

Validate email and positive integer quantity within the saved maximum, candidate belongs to the specified poll and is active, and poll is published/open by server time. Ignore/reject client prices, currencies, count fields, payment states and return URLs. Derive amount and provider reference from server records. Send only necessary metadata to the provider; use a configured provider and server-held secrets. Whitelist hosted checkout domains server-side. Provider selection and credentials are backend deployment decisions; the frontend does not initialize a provider SDK.

Store the request hash and idempotency key with a UNIQUE constraint before contacting the provider. Identical retries return the SAME purchase, receipt capability and existing checkout; different bodies with the same key return 409. Concurrent identical requests must converge on one purchase. Recover provider initialization timeouts using the same merchant reference before retrying initialization. Do not create another charge after an uncertain network result. Preserve an encrypted replayable receipt token or another safe mechanism so idempotent responses can return the same capability without storing a raw token in ordinary application tables/logs.

The frontend persists the attempt's exact body/key before the network request and locks candidate/quantity/email until a terminal receipt has been checked. It retains the purchase ID and receipt token in sessionStorage before leaving for checkout. It offers manual rechecks and does not assume cancellation on browser back. A pending/review purchase is not cleared. Browser refresh and retries must preserve the purchase; receipt tokens never grant admin access.

For a definitive pre-creation rejection, return a non-2xx envelope with `code: "PURCHASE_NOT_CREATED"`. This guarantees there is NO accepted purchase or provider charge under that key and allows the UI to unlock the form for corrections. Look up existing idempotency keys before validating current poll status; never return this code for an existing/uncertain purchase, provider timeout, verification error or generic infrastructure failure. Other errors retain the original attempt for safe retry.

Set the provider return URL on the server to the configured canonical origin plus `/pages/votes/payment?purchaseId=<id>`. Provider-added `status`, `reference` or `transaction_id` parameters are untrusted; the frontend only reads `purchaseId`. Hosted checkout must return in the same browser tab to retain the stored guest capability. Send server-generated receipts to the supplied email after crediting; a recovery flow requiring verified email ownership is a future extension.

## Payment verification and vote accounting

The provider-only webhook is `POST /votes/api/webhooks/flutterwave`. The frontend never calls it. Follow the provider's current signature/secret verification contract, using raw bytes if required. Verify transaction details through the provider's server API, not the webhook payload alone. Match merchant account, unique merchant reference, provider transaction ID, amount, NGN currency and successful settled/captured status to the immutable purchase snapshot. Do not count partial/mismatched/unknown payments; place mismatches in `REVIEW` for reconciliation.

Webhook and receipt verification call the SAME idempotent domain service. In a database transaction, lock the purchase, insert a uniquely constrained credit ledger entry, mark it paid, and update aggregates atomically. A unique provider transaction ID cannot fund two purchases. A second webhook, return visit or concurrent verifier MUST NOT add votes twice. Vote quantity is the server-saved purchase quantity, never supplied by the webhook/client. Never mutate vote counts through general candidate update endpoints.

Purchases accepted before closing can be paid until a fixed server-saved checkout expiration. Lock poll and purchase acceptance to avoid close-vs-purchase races. Provider-confirmed successful payments within that purchase window are credited even if the poll has since closed. Payments outside that window, after manual disqualification, or with inconsistent timestamps go to `REVIEW`; do not silently drop money. Define and document the review/refund resolution process before launch. Report results as provisional while accepted purchases remain unresolved. Do not mark a payment failed/expired based solely on a redirect or browser cancellation. Reconcile provider state first.

Use a background reconciliation job for pending purchases, missed webhooks, delayed success and initialization failures. Receipt reads may trigger rate-limited server verification; return `PENDING` while uncertain. `PAID` means the ledger credit committed successfully; return matching `creditedVotes`. Record refunds/chargebacks as immutable compensating ledger entries and reverse counts exactly once. `REFUNDED` means a full refund/reversal with zero credited votes in this v1 contract; partial refunds need a contract extension. Keep reconciliation, provider errors and admin audit events without leaking email/token/secret values into public logs.

## Suggested database records and constraints

- `voting_polls`: UUID primary key, unique immutable slug, configuration, publication state, UTC opening/closing dates, creator, timestamps, optional aggregate. Positive price and maximum checks; close > open; currency NGN.
- `voting_candidates`: UUID, poll foreign key, name/bio/photo URL, active flag, timestamps; index poll ID. Composite uniqueness `(poll_id, id)` supports purchase membership integrity.
- `vote_purchases`: UUID, poll/candidate foreign keys (enforce candidate membership), quantity, immutable price/amount/currency snapshots, payer email, unique idempotency key, canonical request hash, unique provider reference, unique provider transaction ID when known, receipt token hash and protected replay material, status, accepted/expiry/paid timestamps, checkout details. Never expose this table publicly.
- `vote_ledger`: UUID, purchase foreign key, signed vote delta, credit/reversal type, immutable event reference, timestamp; unique `(purchase_id, entry_type)` for one credit and one full reversal.
- `payment_webhook_events`: provider/event uniqueness, verification/processing status, retry metadata, retention policy; avoid retaining unnecessary sensitive raw payloads.
- `voting_admin_audit`: actor, action, entity, timestamp, sanitized configuration changes.

Add migrations, indexes and database constraints; do not rely only on application checks. Derive totals from the ledger or update cached aggregates in the same transaction, with periodic reconciliation. Retain financial records; do not hard-delete paid polls/candidates/purchases. Rate limit public reads, purchase initialization, verification and admin mutations. Add provider timeouts, request tracing and alerts for unresolved purchases.

## Acceptance checklist before enabling real payments

1. Run migrations and configure canonical frontend origin, CORS, admin authorization and provider credentials/webhook URL on the backend.
2. Create a draft through admin, register candidates, publish, and open a copied candidate link without being logged in. Drafts must remain private; ordinary user tokens must fail all admin endpoints.
3. Confirm hidden results are null publicly, real in admin, and no payer details or receipt capabilities appear in public responses.
4. Test valid NGN payment, decline, cancellation, pending, delayed webhook, duplicate/out-of-order webhook, invalid signature, mismatched amount/currency/account/reference, initialization timeout, concurrent retries and idempotency body mismatch.
5. Reload/back/resume checkout, confirm the same purchase/reference is recovered, and verify one paid purchase credits exactly its quantity once. Retry after a lost initialization response must not charge twice.
6. Test scheduled opening, natural close, manual close racing a purchase, checkout expiry, late payment review and refund reversal. Test candidate membership tampering and quantity/amount overflow.
7. Confirm redirect query manipulation cannot credit votes; invalid/missing receipt tokens cannot disclose purchase information; receipt refresh does not double-credit.
8. Run provider sandbox integration, then a controlled production payment/refund with ledger reconciliation. Frontend type checking alone does not prove provider or database operation.

Out of scope for this first screen set: poll editing/deletion, candidate self-registration/upload, partial refunds, admin payment-review screens, CSV exports, email ownership recovery and final-results certification. The backend still needs operational handling for review/refund/reconciliation before launch.
