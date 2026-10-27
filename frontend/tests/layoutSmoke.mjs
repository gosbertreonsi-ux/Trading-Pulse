/**
 * Real Chromium smoke test for the shell regression reported in a local
 * screenshot: navigation consumed the whole first viewport because tp-app
 * lacked display:grid. Requires "npm install --no-save playwright" in CI.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const port = 3147;
const origin = "http://127.0.0.1:" + port;
let output = "";
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
app.stdout.on("data", value => { output += value.toString(); });
app.stderr.on("data", value => { output += value.toString(); });
let browser;

async function waitUntilReady() {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (app.exitCode !== null) throw new Error("Next.js exited: " + output.slice(-2000));
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return;
    } catch {
      // Expected while the server starts.
    }
    await delay(500);
  }
  throw new Error("Next.js did not serve the page: " + output.slice(-2000));
}

async function inspectPage(viewport, screenshot) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  try {
    const response = await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 30000 });
    assert.equal(response?.status(), 200, "Home page should serve 200");
    await page.locator(".br-head h1").waitFor({ state: "visible", timeout: 15000 });
    await page.locator(".br-chart-canvas").waitFor({ state: "visible", timeout: 15000 });

    const result = await page.evaluate(() => {
      const locate = selector => {
        const element = document.querySelector(selector);
        if (!element) throw new Error("Missing " + selector);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, display: style.display };
      };
      return {
        app: locate(".tp-app"),
        sidebar: locate(".tp-sidebar"),
        main: locate(".tp-app-main"),
        heading: locate(".br-head h1"),
        chart: locate(".br-chart-canvas"),
        bodyWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });

    assert.equal(result.app.display, "grid", "App shell MUST use grid, otherwise sidebar fills the screen");
    assert.ok(result.heading.y < viewport.height * 0.65, "Dashboard title must appear in the first viewport: " + JSON.stringify(result));
    assert.ok(result.chart.width > Math.min(300, viewport.width * .7), "Chart must have usable width: " + JSON.stringify(result));
    assert.ok(result.chart.y < viewport.height * 1.1, "Chart must not be buried below an oversized sidebar");
    assert.ok(result.bodyWidth <= result.viewportWidth + 6, "No horizontal overflow: " + JSON.stringify(result));

    if (viewport.width >= 900) {
      assert.ok(result.sidebar.width >= 60 && result.sidebar.width <= 110, "Desktop navigation must be a narrow rail");
      assert.ok(result.main.x >= result.sidebar.width - 5 && result.main.x < viewport.width * .20,
        "Main content must start beside the rail: " + JSON.stringify(result));
      assert.ok(result.chart.width > 400, "Desktop center chart must dominate the workstation");
    } else {
      assert.ok(result.main.x >= 0 && result.main.x < 6, "Mobile main must use full width");
      assert.ok(result.chart.width >= viewport.width - 48, "Mobile chart must fit nearly entire screen");
    }

    await page.screenshot({ path: screenshot, fullPage: true });
    console.log("PASS " + JSON.stringify({ viewport, headingY: result.heading.y, chartWidth: result.chart.width, screenshot }));
  } finally {
    await page.close();
  }
}

try {
  await waitUntilReady();
  browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
  await inspectPage({ width: 1390, height: 780 }, "broker-desktop.png");
  await inspectPage({ width: 390, height: 844 }, "broker-mobile.png");
} finally {
  if (browser) await browser.close();
  app.kill("SIGTERM");
}
