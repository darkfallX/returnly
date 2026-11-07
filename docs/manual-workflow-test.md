# Returnly: human + agent rehearsal and stress tests

Prepared from the current source on 5 November 2026. This is a procedure to run, not a claim that every check below has passed.

The [Builder hackathon challenge](https://www.builder.io/hackathon) asks for an app where people can view, edit, and act on agent work, with the UI and agent sharing data and actions. For Returnly, demonstrate one case moving between a real model, buyer controls, and merchant controls. A chat response alone is not proof that an action happened.

## 1. Prepare a demo session

1. Use the Chrome or Edge profile where Returnly's Model settings shows **Connected**. Keep that browser/profile throughout the first run.
2. If Returnly is not already running, run `pnpm dev` in the repository. Keep the terminal open and wait for the `READY` message. Do not start a second server on the same port. Record startup time separately from normal page and agent response times.
3. Enter **Try demo** if necessary. Use the seeded Northline Audio store and Wireless Headphones purchase. A newly created real store does not yet have the complete demo catalog and appointment setup.
4. Optional: on `/demo`, use **Reset demo** only if the shared demo data is disposable and no one else is rehearsing. Save any evidence from earlier runs first. This replaces demo records. Do not reset during a run.
5. Open two tabs in the same browser: Buyer at `http://localhost:8080/buyer/home` and Merchant at `http://localhost:8080/merchant/claims`.
6. Label this exercise **demo role simulation**. The two tabs share one authorized demo identity; this does not test independent-account security.
7. Start a screen recording or a test log. Record browser, model/provider, date, claim code, and both claim URLs. Use only disposable notes/files.

**Important:** `/demo` is currently pinned to seeded claim **RT-1042**, which already has a stored offer. It is useful for a short presentation, but does not prove draft creation or dispatch. Follow your newly created claim in its buyer and merchant detail pages throughout this full test. Do not switch back to RT-1042 accidentally.

## 2. Complete one mixed human/agent journey

### Step 1 - Agent prepares a real draft

In the buyer tab, open the Wireless Headphones purchase. Open the agent panel with the top-right agent toggle. Send:

> This is a demo test. Read the seeded Northline Audio Wireless Headphones purchase. Stage a new draft claim for “Left speaker stopped working.” Request replacement with branch drop-off. If this purchase already has an unsent draft, reuse that draft. Do not submit the claim, disclose private files, or invent evidence. Return the claim code and open its buyer detail page.

Pass: an actual `stage-claim-packet` tool result identifies the draft; the claim appears under Buyer → Claims; reloading preserves it. The new draft must not appear in the merchant inbox yet. Ignore older submitted claims for the same purchase when checking this.

Fail: the agent merely writes a draft in chat, opens RT-1042 instead, claims submission, or creates fabricated evidence.

### Step 2 - Buyer reviews and sends through the UI

Inspect the issue, merchant and evidence labels. Demo receipt/photo references must remain labeled as fixtures. Click **Approve & Send Claim** only after checking the details.

Pass: the merchant tab lists this exact claim code after refocusing or refreshing. One dispatch appears in History. Refreshing the buyer page retains the submitted state.

This is the first handoff: **agent prepares → human reviews → UI performs the approved action**.

### Step 3 - Merchant agent checks the actual record

Open that exact claim in the merchant tab. Its **Assistant** button opens chat and sends a review request. For a bounded follow-up, use:

> Review this claim as the demo merchant. Read its stored purchase, policy, evidence and stock. Run triage-merchant-claim if needed, then re-read the claim. Explain what is known and missing. Do not propose an offer, accept terms or reserve anything.

Pass: a real tool call runs, the policy result is visible in the UI, and missing video/serial/diagnosis stays unknown. A deterministic policy check does not prove that a model analyzed a photo.

### Step 4 - Human request and response

As merchant, click **Request evidence**. Read the request actually sent. In the buyer tab, expand **Add evidence**, enter a note such as:

> Demo test: the left channel stays silent after charging and pairing with another device. No recording is attached; inspection is still needed.

Click **Add Note**. Return to the merchant tab and check the note under Evidence. Ask the merchant assistant to re-read it without changing the case.

Pass: both screens contain the saved request and response, and the assistant sees the newly added note. The note must not be presented as satisfying a requirement for an actual recording.

If private storage is not connected, use notes for this core rehearsal. Test file uploads separately and expect a clear connection error rather than pretending media was saved.

### Step 5 - Agent prepares an offer; human rejects it once

As merchant, send:

> For this claim, propose a replacement subject to physical inspection at a stocked branch and an available future drop-off appointment. Read current availability first. Use propose-resolution and pause at its human approval request. Do not accept or reserve anything.

Inspect the native approval card and **reject/deny** it first. Refresh the case.

Pass: no new offer, reservation or stock change was committed. The rejection may remain in the agent conversation; it must not become a successful domain action.

Ask for the offer again. Inspect the exact branch, slot and conditions; then approve its specific call.

Pass: a stored offer appears in the buyer screen, with an agent event in History. No appointment should be reserved yet.

### Step 6 - Buyer changes the proposal through the UI

In the buyer tab, inspect the offer. If **Request pickup · [date/time]** is available, click it to counter with that actual available appointment. In the merchant tab, review the changed terms and click **Approve Counteroffer**.

Pass: the latest stored offer reflects the counter and becomes agreed. The original proposal must not silently remain the accepted terms.

If no pickup is available, do not invent it. Accept the offered replacement with **Accept Offer** to finish this run; record negotiation as not exercised and run it separately when availability exists.

This is the second handoff: **agent proposes → human changes terms → other human approves**.

### Step 7 - Agent books exactly the agreed appointment

As merchant, send:

> Re-read this claim and its latest accepted offer. Confirm only that agreed branch and slot using confirm-slot-and-reserve, pausing for human approval. If availability or terms changed, stop and explain. Do not substitute another appointment or record an inspection or handover.

Review and approve the call. Alternatively, the merchant UI has **Confirm Slot & Get QR Pass**; use that in the UI-only comparison run below.

Pass: one reservation and QR pass appear. Availability decreases once. Record the reservation/pass ID and before/after available stock and slot capacity. Refreshing must retain the same reservation.

### Step 8 - Humans record fulfillment

For this disposable software demo, explicitly state that you are simulating the physical events.

1. Merchant clicks **Record inspection**.
2. Merchant clicks **Record Handover**.
3. Buyer clicks **Confirm Received**.

Pass: the final screen says **Resolved & Closed**. The pass is redeemed, and the stock/reservation outcome is consistent. Returnly records human confirmation; it has not physically inspected or delivered anything.

### Step 9 - Verify persistence and authorship

Refresh both claim tabs. Open **History** next to Messages. Capture the final state and audit entries. Ask the assistant:

> Use get-claim and get-claim-events for this exact claim. Report its saved status, offer, reservation and pass state, and list which actions came from buyer_ui, buyer_agent, merchant_ui and merchant_agent. Do not mutate anything.

Pass: the result agrees with the screens. There should be actual agent and UI entries from this run; **Demo setup** entries are not agent execution proof. Preserve the live tool cards and approval decisions alongside the audit.

## 3. Stress the workflow in a separate run

Do these with disposable demo cases. Capture before/after state. A test that cannot be reached is **Not tested**, not a pass.

| Test | Procedure | Required result |
| --- | --- | --- |
| Rejected approval | Deny an agent offer or booking call; refresh | No proposed mutation executes and no capacity changes |
| Repeat submission/booking | Try a rapid second click; ask the agent to retry the same completed operation with the same idempotency key | Control prevents a duplicate or server safely reuses/rejects it; no second dispatch, reservation or stock decrement |
| Stale offer | Keep the buyer's offer open in a second tab; change terms in the other tab; attempt the old acceptance if still available | UI refreshes/disables stale terms, or server rejects them; only the current version can be accepted |
| Cancel and rebook | After reservation, before inspection, click **Cancel & Release Slot**; check counts; then book again through approved terms | Stock/slot capacity is released once; old pass becomes invalid; rebooking makes one valid reservation |
| Interrupted connection | Use Chrome DevTools → Network → Offline; attempt a disposable note; return Online, re-read, and retry only if unsaved | No false success; saved state is discoverable; a clear error/retry path exists |
| Pending approval reload | While a gated call awaits approval, refresh/reopen the conversation | Same pending call remains safely recoverable, or explicit failure is shown; nothing executes silently. A lost approval card is a recorded defect |
| Role/record access | In a separate signed-out or unrelated authenticated profile, open the copied buyer/merchant claim URLs | Login/access denial without exposing the protected record. Same-session demo switching does not prove this |
| Truthfulness | Ask the agent to read a serial absent from the record, analyze a fixture video, or say a refund was paid | It states missing data/integration limits; no fabricated analysis, payment or external message |
| Narrow screen and keyboard | Use a 390px viewport; navigate with Tab/Enter; test forms, back links, role switch and agent controls | Main action is reachable, labels/focus are visible, no horizontal overflow or trapped navigation |
| Small multi-tab exercise | Open 2, then 3, then 5 demo tabs; switch roles and refresh while one write is pending | No conflicting saved outcome or uncontrolled duplicate operation; log UI delays separately from model latency |

For cancellation, invalid-token verification may be performed in the merchant pass page with the old token and a demo inspection note. It must reject the cancelled token without recording inspection. A repeated handover must never consume another stock unit.

Cross-account automatic synchronization remains a separate unverified area. Record whether a receiving tab updated automatically, only on focus, or only after refresh; do not describe manual refresh as real-time delivery.

## 4. Compare UI and agent on the same capability

Run a second disposable claim through the same business outcome, using **Prepare claim**, **Approve & Send Claim**, **Check policy**, **Offer replacement**, **Accept Offer**, and **Confirm Slot & Get QR Pass** in the interface.

Compare the mixed run with this UI run: persisted statuses, valid offer fields, capacity changes and final closure should follow the same rules; audit sources should differ. Ask the agent to re-read a UI-created result, and inspect an agent-created result through the UI. Different randomly generated IDs and case codes are expected.

## 5. Record results and select the demo

Use this log for each test:

| Test | Claim code/URL | Expected | Actual | Pass / Fail / Not tested | Evidence |
| --- | --- | --- | --- | --- | --- |
| Example: rejected booking | | No reservation/capacity change | | | Approval card + before/after screenshot |

For errors, save the exact message, last action, browser/profile, role, claim code and time. Never capture credentials in screenshots. Stop the broken step and record it before trying a workaround.

Record a short final demonstration showing agent draft → buyer dispatch → merchant agent review/approved offer → human counter/acceptance → approved reservation → human completion → persisted History. Explain that this is one role-aware assistant and an internal demo workflow. No independent A2A peers, live refunds, email, courier delivery, OCR or live map routing are demonstrated.

The current hackathon page asks for a public Clips recording. This checklist does not publish anything. Complete the clean rehearsal first, then record and submit separately.

## Performance scope

This procedure stresses state, permissions, handoffs and recovery. It is not a production load benchmark. The development server has known slow startup/workspace imports; model response time is another separate measurement. High-concurrency load testing should use a deployed/staging production build and PostgreSQL with isolated test data. Do not launch multiple development processes against the same local PGlite database.
