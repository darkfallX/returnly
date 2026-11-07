# Agent verification and truthful demonstration

Returnly has one role-aware assistant using shared actions. It is not two independently deployed A2A agents. A domain test with `caller: "tool"` checks audit routing; it does not prove that a model ran.

## Capability boundaries

| Capability | What the app does |
| --- | --- |
| Claim dispatch | Persists an approved claim in the participating merchant's internal inbox. No email is sent. |
| Receipt ingestion | Accepts buyer-confirmed metadata. New uploads require configured private blob storage; SQL stores references. OCR is **Not connected**. Missing facts stay unknown. |
| Evidence | Stores written notes and, when private storage is configured, owned/disclosure-checked media references. Without that connection, upload fails clearly. Seeded references are fixtures, not analyzed media. |
| Policy check | Deterministically reads stored policy, purchase date, evidence references and matching product stock. The assistant may interpret the results. It does not diagnose a defect. |
| Offers | Stores versioned proposals and acceptance by the other party. Monetary values use integer minor units. No payment or refund is executed. |
| Appointment | Merchant confirms the accepted branch and slot. One transaction reserves matching product stock, slot capacity and an app-issued check-in pass. Retries reuse the reservation. |
| QR pass | Encodes an opaque token. Authenticated merchant validation, recorded inspection, handover and buyer confirmation are separate actions. It is not a carrier label or shipment booking. |
| Map | Existing seeded branch presentation. No geocoding, directions or live routing is connected; map redesign is deferred. |

## Dependable internal journey

Use a dedicated demo session. Resetting demo data replaces the shared seeded scenario; do not reset somebody else's active demonstration.

1. Enter demo mode. RT-1042 starts with a stored replacement offer; use the headphones purchase **Prepare claim** form when demonstrating draft creation and dispatch.
2. Inspect the draft and explicitly approve **Send claim** as buyer. Check that it appears in the merchant inbox.
3. As merchant, **Check policy** and **Request details**. As buyer, enter a written diagnostic note and **Add note**. Any recording requirement in the stored policy remains unresolved without a real recording; arrange inspection rather than inventing a video.
4. Merchant proposes replacement at a stocked branch. Buyer can counter the branch/slot or accept. The other party accepts the latest offer.
5. Merchant confirms the agreed appointment. Verify available stock drops by one and retrying does not reserve twice. Booking before acceptance or with changed terms must fail without changing stock/capacity.
6. Present the QR pass. Merchant records the inspection, then records physical handover. In a software demonstration explicitly say this represents a human recording the physical steps; no real inspection was conducted by the app.
7. Buyer confirms receipt. Reload and check the closed claim and chronological action audit.

## Proving a real model run

Connect a model through `/settings/model`. If Builder's Firebase sign-in popup closes in the embedded browser, open the same local page in Chrome or Edge and finish the connection there. Never paste credentials into chat or commit them.

From the claim's **Assistant** button, request an actual action, then inspect the tool cards and persisted state. A useful bounded request is: “Read this claim, run the stored policy check, then re-read it and explain the missing information. Do not submit, propose, accept or reserve anything.” Record the model/provider, tool names, claim ID, event IDs and a reload confirming the write. Do not call a provider connection or a text-only answer a successful agent workflow.

For a gated write, the agent must display the specific proposed call and stop for human approval. Rejecting it must leave the domain state unchanged. Approval must bind to that exact call; do not use CLI `--approved` to bypass the person.

The native CLI uses real `.ts` imports for local domain modules, matching the installed framework's `allowImportingTsExtensions` configuration. Run only one process against local PGlite at a time. Stop the development server before using a CLI process against that same database; use a separate database for automated tests.

## Repeatable checks

```powershell
$env:DATABASE_URL = 'pglite:./.tmp/agent-audit-test-db'
pnpm test -- --testTimeout=60000 --maxWorkers=1
Remove-Item Env:DATABASE_URL
pnpm typecheck
pnpm agent-native:doctor
pnpm build
```

The tests exercise simulated HTTP/tool callers, privacy, missing metadata, the persisted golden path, retries, stale offers and pass redemption. They do not substitute for a recorded live model run. Migration 2 makes unknown purchase age nullable instead of inventing a number.

QR rendering uses [qrcode.react](https://github.com/zpao/qrcode.react), MIT licensed. Returnly's QR payload contains only the app-issued token.

## Recorded local proof

`RT-3345` (`5ad1e460-cae2-4b27-a2f8-57bbb150dbd0`) completed the internal journey. GPT-6 Luna through the connected Builder.io provider staged it, executed the user's approved submission, then ran merchant policy triage. Browser actions completed written details, offer, acceptance, reservation, inspection recording, handover recording and buyer closure. A fresh authenticated read returned `closed`, a redeemed reservation/pass and Central Branch stock `onHand: 0, reserved: 0`. Eleven persisted audit events identify both agent and UI sources. An independent decoder recovered the stored token from the actual rendered QR screenshot.

See [the verification evidence](../.artifacts/AGENT-VERIFICATION.md). The physical steps were simulated demo records. The split demo uses one signed-in identity authorized for seeded roles. Cross-tab refresh is enabled on resolution routes; cross-identity resource broadcasting is not wired or verified. This is one role-aware assistant, not independently deployed A2A peers.

Observed limits: a transient provider-readiness error on an approval revision; a restored conversation lost its live approval card and a fresh conversation was required; WebMCP exceeded the embedded browser's supported limits and UI controls were used. See the current audit and startup measurements for current checks. Appointment labels derive from stored timestamps. Map geometry remains illustrative; redesign is deferred.
