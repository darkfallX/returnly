# Returnly

Report a faulty purchase. The store reviews policy and stock. You approve the outcome and receive an app-issued check-in pass.

Returnly uses the Agent-Native Chat template, React Router, TypeScript, Tailwind, Drizzle and PGlite. One role-aware assistant and the UI use the same typed actions. It is not an independently deployed A2A pair.

## Run locally

Requires Node **22.22 or newer** and pnpm. `.npmrc` selects Node **22.23.4** for pnpm commands; the computer's separate `node` command can be older.

```powershell
pnpm install
pnpm dev
```

Keep the terminal open. The launcher prints compilation progress and opens `http://localhost:8080/` only after that URL returns HTTP 200 with the real onboarding heading. Wait for:

```text
[returnly] READY http://localhost:8080/ (... ms; onboarding HTML verified).
```

A fresh dependency optimization can take several minutes on this machine. The h3 `preMerge ... falling back to plain compilation` warning is not by itself a startup failure. Ctrl+C and `Terminate batch job` stop the server. The launcher fails explicitly on an occupied port instead of silently switching to 8081/8082.

To start without opening a browser:

```powershell
pnpm dev -- --no-open
```

See [measured startup results and limits](docs/startup.md). HTTP readiness and browser interactivity are measured separately; local development numbers are not production latency measurements.

## Demo

Complete the three onboarding steps and choose **Try demo**. The default seeded claim is **RT-1042**, awaiting acceptance of a stored replacement offer. If earlier work left an empty fixture, **Start demo** initializes it. Seeded history is labeled **Demo setup** and is not proof of a live model run. **Reset demo** returns those fixtures to that starting point; it is not a way to erase other customers' cases. A reset is rejected while non-fixture cases hold active reservations in the demo store.

Demo personas:

- Buyer: **Maya Lin**, `maya.demo@returnly.local`.
- Merchant: **Northline Audio staff**, `resolve@northline-demo.local`.

These are seeded personas, not passwords or a substitute for authentication. The sidebar's **Demo preview** changes presentation. It cannot change the authenticated identity or grant access to a real merchant's records. The split demo uses one authenticated session with scoped permission to simulate the seeded roles; separate signed-in account synchronization remains a distinct verification task.

## One agent-assisted resolution

1. Open the seeded claim and use **Assistant** on the buyer side. Ask: **Accept the store's replacement offer.** The assistant should read the stored offer and prepare `accept-resolution` with its actual ID/version and a retry key.
2. Review the framework's **Approve / Deny** card. Deny must leave the claim unchanged. Approve must accept once. The case-page offer buttons are normal UI decisions; they are not a restored agent approval card.
3. On the merchant side, ask the assistant to **reserve the accepted Central Branch appointment**. `confirm-slot-and-reserve` requires merchant authority and its own human approval. A real buyer cannot reserve merchant stock by approving their own offer acceptance. The authorized demo merchant preview may perform this step only on seeded records.
4. After approval, both panes show the same stored QR check-in token. Check **Audit**: agent events use `buyer_agent` / `merchant_agent`; clicks use `buyer_ui` / `merchant_ui`.
5. Merchant records inspection and handover; buyer uses **Confirm Received**. In a software demo these are simulated human records, not a hardware diagnosis or an actual exchange performed by software.

The current UI journey and QR have been browser-verified; the latest live Approve/Deny/recovery check remains unfinished because the isolated session cannot see the connection reported in the user’s usual browser. See the audit for the exact limits.

The shorter combined request, “Accept the store's replacement offer and reserve the Central Branch slot,” still requires the two authorities and approvals above. Do not silently broaden buyer permissions to make it pass. Native approval recovery after refresh must be verified against the real conversation; synthetic domain hints do not prove recovery.

## Data and integrations

- Local PGlite is the development fallback. `DATABASE_URL` selects an already provisioned PostgreSQL database. Run one process against a given PGlite directory; use a separate database for tests.
- A new real merchant must enter its contact, branch address and policy. Setup does not invent stock, coordinates, verification or appointments.
- New file bytes go through the framework's configured **private blob storage**; SQL stores references and disclosure metadata. If private storage is not connected, use a written diagnostic note. Existing legacy uploads remain readable for compatibility. Upload limits and ownership/disclosure checks run on the server.
- Receipt fields require buyer confirmation. **OCR is not connected.** An uploaded file is not proof that extraction or defect analysis occurred.
- QR rendering encodes an opaque app token. It is not a shipping label. The branch layout is illustrative; live maps, geocoding and directions are not connected.
- Email delivery, carrier booking, live payments/refunds and independent A2A peers are not connected. Internal case messages and monetary proposals do not perform those external operations.
- A live assistant needs a model connected at `/settings/model`. Enter credentials in the app, not in chat or source. If Builder sign-in fails in an embedded browser, use the same local URL in Chrome or Edge.

`.env.example` lists `DATABASE_URL`, `BETTER_AUTH_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY`. Provider connections should use the app's scoped settings flow. A production deployment requires a stable `BETTER_AUTH_SECRET` and persistent PostgreSQL; a successful build alone does not verify deployment health.

## Checks

```powershell
$env:DATABASE_URL = 'pglite:./.tmp/returnly-test-db'
pnpm test -- --testTimeout=90000 --maxWorkers=1
Remove-Item Env:DATABASE_URL
pnpm typecheck
pnpm agent-native:doctor
pnpm build
```

For real process restarts plus browser interactivity checks:

```powershell
pnpm exec node scripts/measure-startup.mjs --runs=3
```

Stop the existing server first. The benchmark retains the optimizer cache, starts a fresh server and browser context for each run, and awaits full process-tree shutdown. It records readiness probes, runtime errors, HTTP shell timings and actual onboarding button interaction in `.artifacts/startup/`. A redirected page or HTTP 200 alone is not a passing UI test.

See [the workflow rehearsal](docs/manual-workflow-test.md) and [agent verification boundaries](docs/agent-verification.md). No public deployment or Clips upload is claimed here.

## Source attribution

Built from the official Agent-Native Chat template with its shared auth, chat, action and approval runtime. Interface dependencies include Lucide, Framer Motion, Plus Jakarta Sans / Inter and `qrcode.react` (MIT). Existing button adaptations are attributed in `app/styles/buttons.css`. See `THIRD_PARTY_NOTICES.md`. Reference brand artwork is not used as an app asset.
