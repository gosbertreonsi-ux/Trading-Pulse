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

    // The requested news-style typography must flow through the entire app:
    // headings, body text and native form controls, on desktop and mobile.
    const fonts = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      heading: getComputedStyle(document.querySelector(".br-head h1")).fontFamily,
      button: getComputedStyle(document.querySelector("button")).fontFamily,
    }));
    for (const [element, family] of Object.entries(fonts)) {
      assert.match(family, /Trebuchet MS/, element + " should inherit the news-style font");
    }

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

    // Confirm the full monochrome appearance is interactive and persistent,
    // without changing the previously repaired responsive grid geometry.
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    const darkColors = await page.evaluate(() => ({
      background: getComputedStyle(document.querySelector(".br-chart-canvas")).backgroundColor,
      panel: getComputedStyle(document.querySelector(".br-watchlist")).backgroundColor,
      text: getComputedStyle(document.querySelector(".br-head h1")).color,
    }));
    assert.equal(darkColors.background, "rgb(24, 24, 24)");
    assert.equal(darkColors.panel, "rgb(24, 24, 24)");
    const darkTrading = await page.evaluate(() => ({
      bullish: getComputedStyle(document.querySelector(".br-chart-key i.positive")).backgroundColor,
      bearish: getComputedStyle(document.querySelector(".br-chart-key i.negative")).backgroundColor,
    }));
    assert.deepEqual(darkTrading, { bullish: "rgb(24, 198, 122)", bearish: "rgb(224, 91, 82)" });
    await page.screenshot({ path: screenshot, fullPage: true });

    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    assert.equal(await page.getByRole("button", { name: "Switch to dark mode" }).count(), 1);
    const lightColors = await page.evaluate(() => ({
      background: getComputedStyle(document.querySelector(".br-chart-canvas")).backgroundColor,
      panel: getComputedStyle(document.querySelector(".br-watchlist")).backgroundColor,
      page: getComputedStyle(document.body).backgroundColor,
      chart: document.querySelector(".br-chart-canvas").getBoundingClientRect().width,
    }));
    assert.equal(lightColors.background, "rgb(255, 255, 255)");
    assert.equal(lightColors.panel, "rgb(255, 255, 255)");
    const lightTrading = await page.evaluate(() => ({
      bullish: getComputedStyle(document.querySelector(".br-chart-key i.positive")).backgroundColor,
      bearish: getComputedStyle(document.querySelector(".br-chart-key i.negative")).backgroundColor,
    }));
    assert.deepEqual(lightTrading, { bullish: "rgb(15, 143, 87)", bearish: "rgb(200, 75, 69)" });
    assert.ok(lightColors.chart > Math.min(300, viewport.width * .7), "Theme change must preserve chart width");
    const lightScreenshot = screenshot.replace(".png", "-light.png");
    await page.screenshot({ path: lightScreenshot, fullPage: true });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    assert.equal(await page.getByRole("button", { name: "Switch to dark mode" }).count(), 1, "Theme must survive reload");
    assert.equal(await page.locator(".br-head h1").isVisible(), true);
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    console.log("PASS " + JSON.stringify({ viewport, headingY: result.heading.y, chartWidth: result.chart.width, darkColors, lightColors, screenshots: [screenshot, lightScreenshot] }));
  } finally {
    await page.close();
  }
}

async function inspectConnectedWatchlist() {
  const page = await browser.newPage({ viewport: { width: 1390, height: 780 } });
  try {
    // Mock a correctly authenticated server response without introducing
    // a browser token or requiring a database in the frontend Chrome job.
    await page.route("**/api/markets", async route => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        success: true,
        window: "last-24-ticks",
        quotes: [
          { symbol: "BTCUSDT", price: 62000, changePercent: 3.333, spark: [60000, 62000], lastUpdated: "2026-10-27T12:30:02Z" },
          { symbol: "ETHUSDT", price: 2490, changePercent: -0.4, spark: [2500, 2490], lastUpdated: "2026-10-27T12:30:02Z" },
          { symbol: "SOLUSDT", price: null, changePercent: null, spark: [], lastUpdated: null },
        ],
      }) });
    });
    const response = await page.goto(origin, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await page.waitForFunction(() => {
      const prices = Array.from(document.querySelectorAll(".br-asset-value strong")).map(x => x.textContent);
      return prices.includes("62,000.00") && prices.includes("2,490.00");
    }, { timeout: 15000 });
    const rows = page.locator(".br-asset");
    assert.equal(await rows.count(), 3);
    assert.equal(await rows.nth(0).locator(".br-asset-value strong").textContent(), "62,000.00");
    assert.equal(await rows.nth(1).locator(".br-asset-value strong").textContent(), "2,490.00");
    assert.equal(await rows.nth(2).locator(".br-asset-value strong").textContent(), "—", "No trades means no fabricated SOL quote");
    assert.equal(await rows.nth(0).locator(".br-asset-value small").textContent(), "+3.33%");
    assert.equal(await rows.nth(1).locator(".br-asset-value small").textContent(), "-0.40%");
    assert.equal(await page.locator(".br-watchlist-note").textContent().then(text => text.includes("not 24h")), true);
    console.log("PASS authenticated watchlist rows and empty-market integrity");
  } finally {
    await page.close();
  }
}

async function inspectHistoricalAnalytics(viewport) {
  const page = await browser.newPage({ viewport });
  try {
    await page.route("**/api/analytics?*", async route => {
      const url = new URL(route.request().url());
      const symbol = url.searchParams.get("symbol");
      const empty = symbol === "SOLUSDT";
      const values = [
        { timestamp: "2026-10-27T12:30:00.000Z", open: 100, high: 110, low: 99, close: 108, volume: 2 },
        { timestamp: "2026-10-27T12:31:00.000Z", open: 108, high: 109, low: 95, close: 98, volume: 3 },
      ];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        success: true, symbol, granularity: "completed-1m",
        requestedBars: Number(url.searchParams.get("limit")),
        summary: empty ? {
          candleCount: 0, firstAt: null, lastAt: null,
          firstOpen: null, lastClose: null, rangeChangePercent: null,
          periodHigh: null, periodLow: null, totalVolume: null,
          averageVolume: null, bullishCount: 0, bearishCount: 0,
          unchangedCount: 0, maxCloseDrawdownPercent: null,
        } : {
          candleCount: 2, firstAt: values[0].timestamp, lastAt: values[1].timestamp,
          firstOpen: 100, lastClose: 98, rangeChangePercent: -2,
          periodHigh: 110, periodLow: 95, totalVolume: 5,
          averageVolume: 2.5, bullishCount: 1, bearishCount: 1,
          unchangedCount: 0, maxCloseDrawdownPercent: (10 / 108) * 100,
        },
        candles: empty ? [] : values,
      }) });
    });
    const response = await page.goto(origin + "/analytics", { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await page.getByRole("heading", { name: "Historical analytics." }).waitFor({ state: "visible" });
    await page.locator(".ha-summary-top").waitFor({ state: "visible" });
    assert.equal(await page.locator(".ha-table tbody tr").count(), 2);
    assert.equal(await page.locator(".ha-summary-top>div").nth(0).locator("strong").textContent(), "2");
    assert.equal(await page.locator(".ha-summary-top>div").nth(1).locator("strong").textContent(), "-2.00%");
    assert.equal(await page.locator(".ha-chart svg").count(), 1);
    assert.equal(await page.locator(".ha-volume-bars span").count(), 2);
    const geometry = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth, width: innerWidth,
    }));
    assert.ok(geometry.scroll <= geometry.width + 6, "Analytics must not overflow on mobile: " + JSON.stringify(geometry));
    await page.locator("#ha-symbol").selectOption("SOLUSDT");
    await page.getByText("No completed candles have been stored for this market.").waitFor();
    assert.equal(await page.locator(".ha-table tbody tr").count(), 0);
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    const panel = await page.locator(".ha-card").first().evaluate(element => getComputedStyle(element).backgroundColor);
    assert.equal(panel, "rgb(255, 255, 255)");
    console.log("PASS historical analytics " + JSON.stringify({ viewport, panel, geometry }));
  } finally {
    await page.close();
  }
}

async function inspectLiquidity(viewport) {
  const page = await browser.newPage({ viewport });
  try {
    await page.route("**/api/liquidity?*", async route => {
      const symbol = new URL(route.request().url()).searchParams.get("symbol");
      const empty = symbol === "SOLUSDT";
      const bids = empty ? [] : Array.from({ length: 10 }, (_, i) => ({
        price: 99 - i, quantity: 2 + i / 10, cumulativeQuantity: (i + 1) * 2,
      }));
      const asks = empty ? [] : Array.from({ length: 10 }, (_, i) => ({
        price: 101 + i, quantity: 1 + i / 10, cumulativeQuantity: (i + 1),
      }));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        success: true, symbol,
        modelType: "EDUCATIONAL_SYNTHETIC_DEPTH",
        basedOn: "LAST_PERSISTED_SIMULATOR_TRADES",
        observedWindow: "last-48-simulator-trades",
        observed: {
          sampleCount: empty ? 0 : 2, lastPrice: empty ? null : 100,
          lastTradeAt: empty ? null : "2026-10-27T12:34:06Z",
          buyQuantity: empty ? 0 : 3, sellQuantity: empty ? 0 : 1,
        },
        assumptions: {
          tickSize: 1, depthLevels: 10,
          quantityModel: "Deterministic illustrative sizes, not actual resting orders.",
          limitations: "No executable bids or asks.",
        },
        bids, asks,
        bestBid: empty ? null : 99, bestAsk: empty ? null : 101,
        spread: empty ? null : 2,
        modeledBidQuantity: empty ? null : 20,
        modeledAskQuantity: empty ? null : 10,
        modeledImbalancePercent: empty ? null : 33.33,
      }) });
    });
    const response = await page.goto(origin + "/liquidity", { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await page.getByRole("heading", { name: "Liquidity model." }).waitFor({ state: "visible" });
    await page.locator(".lq-summary").waitFor({ state: "visible" });
    await page.getByText("EDUCATIONAL MODEL — NOT REAL ORDER-BOOK LIQUIDITY").waitFor();
    assert.equal(await page.locator(".lq-bid .lq-book-row").count(), 10);
    assert.equal(await page.locator(".lq-ask .lq-book-row").count(), 10);
    assert.equal(await page.locator(".lq-flow-stats strong").nth(0).textContent(), "3.0000");
    assert.equal(await page.locator(".lq-flow-stats strong").nth(1).textContent(), "1.0000");
    const geom = await page.evaluate(() => ({
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(geom.scrollWidth <= geom.width + 6, "Liquidity page must not overflow: " + JSON.stringify(geom));
    await page.locator("#lq-market").selectOption("SOLUSDT");
    await page.getByText("No stored simulator trades for this market and tenant.").waitFor({
      timeout: 12000,
    }).catch(async () => { // The guidance sentence includes an additional newline in JSX.
      await page.locator(".lq-feedback").last().waitFor();
    });
    assert.equal(await page.locator(".lq-bid .lq-book-row").count(), 0);
    assert.equal(await page.locator(".lq-ask .lq-book-row").count(), 0);
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    const panel = await page.locator(".lq-card").first().evaluate(element => getComputedStyle(element).backgroundColor);
    assert.equal(panel, "rgb(255, 255, 255)");
    console.log("PASS educational liquidity " + JSON.stringify({ viewport, geom, panel }));
  } finally {
    await page.close();
  }
}

async function inspectAlerts() {
  const page = await browser.newPage({ viewport: { width: 1390, height: 780 } });
  try {
    const response = await page.goto(origin + "/alerts", { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await page.getByRole("heading", { name: "Price alerts." }).waitFor({ state: "visible" });
    assert.equal(await page.getByRole("button", { name: /Create price alert/ }).count(), 1);
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    const panel = await page.locator(".pa-card").first().evaluate(element => getComputedStyle(element).backgroundColor);
    assert.equal(panel, "rgb(255, 255, 255)");
    await page.screenshot({ path: "alerts-desktop-light.png", fullPage: true });
    console.log("PASS alerts " + JSON.stringify({ panel }));
  } finally {
    await page.close();
  }
}

async function inspectStudio() {
  const page = await browser.newPage({ viewport: { width: 1390, height: 780 } });
  try {
    const response = await page.goto(origin + "/studio", { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await page.locator(".tp-prompt-input").waitFor({ state: "visible" });
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    const darkPanel = await page.locator(".tp-studio-panel").first().evaluate(
      element => getComputedStyle(element).backgroundColor,
    );
    assert.equal(darkPanel, "rgb(24, 24, 24)", "Studio panel should inherit the dark monochrome palette");
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    const lightPanel = await page.locator(".tp-studio-panel").first().evaluate(
      element => getComputedStyle(element).backgroundColor,
    );
    assert.equal(lightPanel, "rgb(255, 255, 255)", "Studio panel should inherit the light monochrome palette");
    await page.screenshot({ path: "studio-desktop-light.png", fullPage: true });
    console.log("PASS studio " + JSON.stringify({ darkPanel, lightPanel }));
  } finally {
    await page.close();
  }
}

try {
  await waitUntilReady();
  browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
  await inspectPage({ width: 1390, height: 780 }, "broker-desktop.png");
  await inspectPage({ width: 390, height: 844 }, "broker-mobile.png");
  await inspectStudio();
  await inspectAlerts();
  await inspectConnectedWatchlist();
  await inspectHistoricalAnalytics({ width: 1390, height: 780 });
  await inspectHistoricalAnalytics({ width: 390, height: 844 });
  await inspectLiquidity({ width: 1390, height: 780 });
  await inspectLiquidity({ width: 390, height: 844 });
} finally {
  if (browser) await browser.close();
  app.kill("SIGTERM");
}
