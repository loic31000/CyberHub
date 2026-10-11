import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = "http://127.0.0.1:5174";
const output = join(root, "captures", "terminal-story");
mkdirSync(output, { recursive: true });
function browserPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const cache = join(process.env.LOCALAPPDATA || "", "ms-playwright");
  if (existsSync(cache))
    for (const folder of readdirSync(cache)
      .filter((name) => name.startsWith("chromium-"))
      .sort()
      .reverse()) {
      const executable = join(cache, folder, "chrome-win64", "chrome.exe");
      if (existsSync(executable)) return executable;
    }
  if (existsSync(chromium.executablePath())) return chromium.executablePath();
  throw new Error("Chromium Playwright introuvable");
}
let server;
try {
  if (!(await fetch(`${base}/terminal-story.html`)).ok)
    throw new Error("Vite absent");
} catch {
  server = await createServer({ configFile: resolve(root, "vite.config.js") });
  await server.listen();
}
const browser = await chromium.launch({ executablePath: browserPath() });
const report = { widths: [], axe: {}, interaction: {}, motion: {}, errors: [] };
async function violations(page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return result.violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    targets: nodes.map(({ target }) => target),
  }));
}
try {
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      report.errors.push(`${width}: ${error.message}`),
    );
    page.on("request", (request) => {
      if (!request.url().startsWith(`${base}/`))
        report.errors.push(`${width}: external ${request.url()}`);
      if (/\/api(?:\/|\b)/.test(request.url()))
        report.errors.push(`${width}: private API ${request.url()}`);
    });
    await page.goto(`${base}/terminal-story.html`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator("main > section").count(), 5); // Terminal and IOC share one semantic scene.
    for (const id of [
      "terminal",
      "ioc",
      "relations",
      "disciplines",
      "investigation",
      "decouvrir",
    ])
      assert.equal(
        await page.locator(`#${id}`).count(),
        1,
        `${width}: missing ${id}`,
      );
    const dimensions = await page.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    report.widths.push({ width, ...dimensions });
    assert.ok(
      dimensions.document <= width + 1 && dimensions.body <= width + 1,
      `${width}: horizontal overflow ${JSON.stringify(dimensions)}`,
    );
    if ([320, 390, 768, 1440].includes(width)) {
      report.axe[width] = await violations(page);
      assert.deepEqual(
        report.axe[width],
        [],
        `${width}: axe violations ${JSON.stringify(report.axe[width])}`,
      );
    }
    if (width === 320) {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      const enlarged = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      report.text200 = enlarged;
      assert.ok(
        enlarged.document <= width + 1 && enlarged.body <= width + 1,
        `200% text overflow: ${JSON.stringify(enlarged)}`,
      );
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "";
      });
    }
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: join(output, `${width}-full.png`),
        fullPage: true,
      });
    await context.close();
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
    recordVideo: { dir: output, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    report.errors.push(`motion: ${error.message}`),
  );
  await page.goto(`${base}/terminal-story.html`, { waitUntil: "networkidle" });
  report.axe.motion = await violations(page);
  assert.deepEqual(report.axe.motion, []);
  await page.locator("#replay-command").click();
  await page.waitForTimeout(2200);
  const handoff = async (fraction) =>
    page.evaluate((value) => {
      const el = document.querySelector(".handoff-track");
      window.scrollTo({
        top: el.offsetTop + (el.offsetHeight - innerHeight) * value,
        behavior: "instant",
      });
    }, fraction);
  await handoff(0.55);
  await page.waitForTimeout(150);
  report.motion.mid = await page
    .locator(".handoff-track")
    .evaluate((el) => Number(el.style.getPropertyValue("--handoff")));
  report.motion.tokenVisible = await page
    .locator(".handoff-token")
    .evaluate((el) => Number(getComputedStyle(el).opacity) > 0);
  await handoff(1);
  await page.waitForTimeout(150);
  report.motion.end = await page
    .locator(".handoff-track")
    .evaluate((el) => Number(el.style.getPropertyValue("--handoff")));
  await handoff(0);
  await page.waitForTimeout(150);
  report.motion.back = await page
    .locator(".handoff-track")
    .evaluate((el) => Number(el.style.getPropertyValue("--handoff")));
  assert.ok(
    report.motion.mid > 0.3 &&
      report.motion.mid < 0.8 &&
      report.motion.end > 0.9 &&
      report.motion.back < 0.1,
    JSON.stringify(report.motion),
  );
  assert.equal(report.motion.tokenVisible, true);
  await handoff(0.9);
  await handoff(0.2);
  await handoff(0.8);
  await page.waitForTimeout(100);
  report.motion.rapid = await page
    .locator(".handoff-track")
    .evaluate((el) => Number(el.style.getPropertyValue("--handoff")));
  assert.ok(report.motion.rapid > 0.7 && report.motion.rapid < 0.9);
  await page.locator(".motion-control").click();
  report.motion.stopped = await page
    .locator(".motion-control")
    .getAttribute("aria-pressed");
  assert.equal(report.motion.stopped, "true");
  assert.equal(
    await page
      .locator(".result-one")
      .evaluate((el) => getComputedStyle(el).opacity),
    "1",
  );
  report.axe.stopped = await violations(page);
  assert.deepEqual(report.axe.stopped, []);
  await page.locator(".motion-control").click();
  await page.locator("#relations").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.locator("#disciplines").scrollIntoViewIfNeeded();
  await page.locator('[data-discipline="osint"]').focus();
  await page.keyboard.press("Space");
  assert.match(
    await page.locator("#discipline-transcript").textContent(),
    /trois pistes/,
  );
  await page.locator('[data-discipline="bgp"]').click();
  assert.equal(await page.locator(".bgp-graphic").getAttribute("hidden"), null);
  report.interaction.bgp = true;
  await page.locator("#investigation").scrollIntoViewIfNeeded();
  await page.locator(".attach-source").click();
  assert.equal(
    await page.locator(".attach-source").getAttribute("aria-pressed"),
    "true",
  );
  await page.locator(".case-details summary").click();
  assert.equal(await page.locator(".case-details").getAttribute("open"), "");
  await page.locator(".playbook summary").first().click();
  assert.equal(
    await page.locator(".playbook details").first().getAttribute("open"),
    "",
  );
  report.interaction.caseAndPlaybook = true;
  for (const id of ["relations", "disciplines", "investigation", "decouvrir"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(360);
  }
  await page.waitForTimeout(600);
  const video = page.video();
  await context.close();
  await video.saveAs(join(output, "journey.webm"));

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${base}/terminal-story.html`, {
    waitUntil: "networkidle",
  });
  await mobilePage.keyboard.press("Tab");
  assert.equal(
    await mobilePage.locator(":focus").getAttribute("class"),
    "skip-link",
  );
  await mobilePage.locator(".menu-control").focus();
  await mobilePage.keyboard.press("Enter");
  assert.equal(
    await mobilePage.locator(".menu-control").getAttribute("aria-expanded"),
    "true",
  );
  await mobilePage.locator('#mobile-nav a[href="#disciplines"]').click();
  assert.equal(
    await mobilePage.locator(".menu-control").getAttribute("aria-expanded"),
    "false",
  );
  report.interaction.menu = true;
  report.axe.mobileMenu = await violations(mobilePage);
  assert.deepEqual(report.axe.mobileMenu, []);
  await mobile.close();

  const noJS = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
  });
  const staticPage = await noJS.newPage();
  await staticPage.goto(`${base}/terminal-story.html`);
  assert.equal(await staticPage.locator(".terminal-window").isVisible(), true);
  assert.equal(await staticPage.locator(".ioc-workspace").isVisible(), true);
  assert.equal(
    await staticPage.locator(".static-transcript").isVisible(),
    true,
  );
  report.interaction.noJS = true;
  await noJS.close();
  assert.deepEqual(report.errors, []);
  console.log("Terminal story browser PASS", JSON.stringify(report));
} finally {
  writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  if (server) await server.close();
}
