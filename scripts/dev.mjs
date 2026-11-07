import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const READY_HEADING = "We can help you resolve this";

async function assertPortFree(port) {
  const probe = createServer();
  await new Promise((ok, fail) => {
    probe.once("error", fail);
    probe.listen(port, "127.0.0.1", () => probe.close(ok));
  });
}

export async function startDev({ port = 8080, open = false, reportPath, timeoutMs = 600_000, quiet = false, env = {} } = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local development port.");
  await assertPortFree(port).catch(() => { throw new Error(`Port ${port} is already in use. Stop the existing Returnly server first; no alternate port was opened.`); });
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const url = `http://localhost:${port}/`;
  const abort = new AbortController();
  let stopping = false;
  let exited = false;
  const report = { startedAt, port, pid: null, viteReadyMs: null, htmlReadyMs: null, probes: [], heading: READY_HEADING };
  const child = spawn(process.execPath, [resolve(root, "node_modules/@agent-native/core/bin/agent-native.js"), "dev", "--port", String(port), "--strictPort"], {
    cwd: root, env: { ...process.env, ...env }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  report.pid = child.pid;
  const exit = new Promise((done) => {
    child.once("exit", (code) => { exited = true; done(code ?? 1); });
    child.once("error", () => { exited = true; done(1); });
  });
  const consume = (stream, target) => stream.on("data", (chunk) => {
    const text = chunk.toString();
    if (report.viteReadyMs === null && /ready in|listening on/.test(text)) report.viteReadyMs = Math.round(performance.now() - started);
    if (!quiet) target.write(text);
  });
  consume(child.stdout, process.stdout);
  consume(child.stderr, process.stderr);
  async function stop() {
    if (stopping) return exit;
    stopping = true;
    abort.abort();
    if (!exited && child.pid) {
      if (process.platform === "win32") {
        await new Promise((done) => {
          const kill = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
          kill.once("exit", done); kill.once("error", done);
        });
      } else child.kill("SIGTERM");
    }
    await exit;
  }
  const ready = (async () => {
    if (!quiet) console.log(`[returnly] Starting ${url} - waiting for onboarding HTML before opening a browser.`);
    const heartbeat = setInterval(() => {
      if (!quiet) console.log(`[returnly] Still starting (${Math.round((performance.now() - started) / 1000)}s). Waiting for the onboarding page; keep this terminal open.`);
    }, 15_000);
    try {
      while (!stopping && performance.now() - started < timeoutMs) {
        if (exited) throw new Error("The development server exited before onboarding was ready. See its error above.");
        // Give Vite time to bind and finish dependency scanning before asking Nitro to render.
        if (report.viteReadyMs !== null || performance.now() - started > 5_000) {
          const atMs = Math.round(performance.now() - started);
          try {
            const response = await fetch(url, { redirect: "manual", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(45_000)]) });
            const html = await response.text();
            const headingPresent = /<h1\b[^>]*>\s*We can help you resolve this/.test(html);
            report.probes.push({ atMs, status: response.status, headingPresent });
            if (response.status === 200 && headingPresent) {
              report.htmlReadyMs = Math.round(performance.now() - started);
              if (reportPath) {
                await mkdir(dirname(resolve(reportPath)), { recursive: true });
                await writeFile(reportPath, JSON.stringify(report, null, 2));
              }
              if (!quiet) console.log(`[returnly] READY ${url} (${report.htmlReadyMs} ms; onboarding HTML verified).`);
              if (open) {
                const [command, args] = process.platform === "win32"
                  ? ["rundll32.exe", ["url.dll,FileProtocolHandler", url]]
                  : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
                const browser = spawn(command, args, { windowsHide: true, stdio: "ignore" });
                browser.on("error", () => console.log(`[returnly] Open ${url} in your browser.`));
              }
              return report;
            }
          } catch (error) {
            if (stopping) throw error;
            report.probes.push({ atMs, error: error.name });
          }
        }
        await new Promise((done) => setTimeout(done, 500));
      }
      throw new Error("Startup did not finish within 10 minutes. See the server output; readiness was not claimed.");
    } finally { clearInterval(heartbeat); }
  })();
  return { child, ready, stop, exit, report };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let server;
  const shutdown = async () => { if (server) await server.stop(); process.exit(0); };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  try {
    const portArg = process.argv.find((arg) => arg.startsWith("--port="));
    server = await startDev({ port: portArg ? Number(portArg.split("=")[1]) : 8080, open: !process.argv.includes("--no-open"), reportPath: ".artifacts/startup-last.json" });
    await server.ready;
    process.exitCode = await server.exit;
  } catch (error) {
    console.error(`[returnly] ${error.message}`);
    if (server) await server.stop();
    process.exitCode = 1;
  }
}
