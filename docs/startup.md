# Local startup measurements

Measured on this Windows workspace using pnpm-managed Node 22.23.4, Core 0.222.2, Vite 8.1.0 and an isolated headless Edge context. These are development timings, not production or edge latency.

## Before this audit

The saved reference run in `.artifacts/gemini-audit-baseline-server.log` took **383,252 ms** from process launch to a complete HTTP 200 response containing the onboarding heading. Vite reported about **299 seconds**. Dependency installation had invalidated that run's optimizer cache, so it is not a controlled percentage comparison with retained-cache runs below. A separate browser reference reached usable onboarding in **107,865 ms after navigation to an already running server**; that is not process-start time.

Gemini's previous report mixed requests to a persistent server with real restarts and claimed unmeasured production latency. Those claims have been removed.

## Three independent restarts

Command: `pnpm exec node scripts/measure-startup.mjs --runs=3`.

Each run started a new server process and fresh browser context, then shut the entire owned server tree down before the next. Existing dependency caches were retained. Source code was unchanged during these three runs. Times are milliseconds from launch, except the route columns, which time a later individual HTTP request.

| Measure | Run 1 | Run 2 | Run 3 |
| --- | ---: | ---: | ---: |
| Process launch UTC, 4 November 2026 | 23:46:40 | 23:49:50 | 23:51:22 |
| Vite/listening log seen | 13,558 | 8,921 | 11,444 |
| Complete `/` HTML, HTTP 200 plus real h1 | 152,746 | 59,132 | 68,909 |
| Onboarding controls usable in browser | 173,631 | 80,877 | 87,451 |
| All three onboarding steps, in order | Passed | Passed | Passed |
| Browser 503 responses / uncaught errors | 0 / 0 | 0 / 0 | 0 / 0 |
| Internal readiness-probe 503 responses | 0 | 1 | 1 |
| First `/buyer/home` HTTP shell | 11,335 | 9,259 | 8,926 |
| First `/merchant/home` HTTP shell | 4,355 | 170 | 151 |
| First `/demo` HTTP shell | 53 | 61 | 59 |

Evidence: `.artifacts/startup/results.json`, per-run server JSON, onboarding screenshots, and `.artifacts/gemini-audit-startup-final.log`.

“Usable” means the real heading is visible and the hydrated button is enabled; the test then clicks through both transitions. It is a functional browser measurement, not a performance-API first-paint metric. Workspace HTTP shell timings do not prove authenticated workspace interactivity.

## What changed

- A stable Vite define value preserves cache validity; entry scanning starts at the public screen instead of every route/component. The existing incompatible style-to-js exclusion remains.
- Public entry and intro avoid workspace providers, chat, voice and command-menu modules. Existing screen implementations load through lazy route wrappers. Both the public screen and product sidebar use Lucide.
- Authentication uses Core's supported createAuthPlugin renderer, as shown in its official starter patch, avoiding Toolkit's eager React sign-in dependency graph. Authentication and server-side action checks remain enabled.
- The launcher uses the official dev CLI with strict port 8080, prints progress, and opens the browser only after a complete successful onboarding HTML response. Ctrl+C shuts its process tree down.
- Private storage runtime is loaded on upload/read, rather than through the initial domain import.

## Remaining limits

Startup is still too slow: retained-cache restarts took 81–174 seconds to usable onboarding. Nitro emitted a slow-reload warning during these runs. The h3 overlapping route-rules message uses its plain-compilation fallback and is not a fatal exception. Internal probes still encountered initialization 503s; the stronger requirement of zero 503s from the server itself is **not met**. The readiness gate prevents these from becoming the browser's initial page.

An SSR externalization experiment was not promoted: it broke Nitro's acknowledged PGlite cleanup during restart. No framework auth or database cleanup was bypassed, and no installed dependencies were edited.

## Reproduce

Stop the current server. Run `pnpm dev` and wait for `[returnly] READY http://localhost:8080/`. Keep that terminal open. Do not terminate after the Vite or h3 log; compilation may still be in progress. `pnpm dev -- --no-open` runs the same readiness gate without opening a browser.

For three fresh server processes, run the benchmark command above. Use pnpm's Node, not an older global node executable. Do not run a separate CLI process against the live local PGlite directory. Use an isolated DATABASE_URL for tests.

The three-run set above predates the final workspace-only hydration boundary correction found during authenticated browser testing. That later fix leaves the public onboarding branch in place and removed the observed signed-in SSR abort; no repeated three-start measurement of that last patch is claimed. See the audit for final browser and build results.
