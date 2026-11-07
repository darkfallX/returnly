import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { startDev } from "./dev.mjs";

const count = Number(process.argv.find((arg) => arg.startsWith("--runs="))?.split("=")[1] ?? 3);
const results = [];
await mkdir(".artifacts/startup", { recursive: true });
await writeFile(".artifacts/startup/results.json", "[]");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (let run = 1; run <= count; run++) {
    const started = performance.now();
    const server = await startDev({ reportPath: `.artifacts/startup/run-${run}-server.json` });
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const responses503 = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => { if (response.status() === 503) responses503.push(response.url()); });
    try {
      const ready = await server.ready;
      await page.goto("http://localhost:8080/", { waitUntil: "domcontentloaded", timeout: 240_000 });
      await page.getByRole("heading", { level: 1, name: "We can help you resolve this.", exact: true }).waitFor({ timeout: 240_000 });
      const next = page.getByRole("button", { name: /get started|continue|next/i }).first();
      await expect(next).toBeEnabled({ timeout: 240_000 });
      const interactiveMs = Math.round(performance.now() - started);
      await next.click();
      await page.getByRole("heading", { name: "How resolution works", exact: true }).waitFor({ timeout: 30_000 });
      await next.click();
      await page.getByRole("heading", { name: "Choose your workspace", exact: true }).waitFor({ timeout: 30_000 });
      await page.screenshot({ path: `.artifacts/startup/run-${run}-onboarding.png` });
      const routes = [];
      for (const path of ["/buyer/home", "/merchant/home", "/demo"]) {
        const at = performance.now();
        const response = await context.request.get(`http://localhost:8080${path}`, { timeout: 180_000, maxRedirects: 0 });
        const html = await response.text();
        routes.push({ path, ms: Math.round(performance.now() - at), status: response.status(), hasHtml: html.includes("<html"), note: "HTTP shell only; not workspace interactivity" });
      }
      results.push({ run, cache: "Existing optimizer cache retained; process and browser context restarted", server: ready, interactiveMs, onboardingStepsPassed: true, browser503: responses503, browserErrors: errors, routes });
      await writeFile(".artifacts/startup/results.json", JSON.stringify(results, null, 2));
      console.log(JSON.stringify({ run, htmlReadyMs: ready.htmlReadyMs, interactiveMs, browser503: responses503.length, errors: errors.length }));
    } catch (error) {
      results.push({ run, error: error.message, server: server.report, browser503: responses503, browserErrors: errors });
      await writeFile(".artifacts/startup/results.json", JSON.stringify(results, null, 2));
      throw error;
    } finally {
      await context.close();
      await server.stop();
    }
  }
} finally { await browser.close(); }
