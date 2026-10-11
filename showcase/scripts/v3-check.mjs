import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = "http://127.0.0.1:5174";
const captures = join(root, "captures", "a-v3");
mkdirSync(captures, { recursive: true });

function browserPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const cache = join(process.env.LOCALAPPDATA || "", "ms-playwright");
  if (existsSync(cache)) {
    for (const folder of readdirSync(cache)
      .filter((name) => name.startsWith("chromium-"))
      .sort()
      .reverse()) {
      const executable = join(cache, folder, "chrome-win64", "chrome.exe");
      if (existsSync(executable)) return executable;
    }
  }
  const executable = chromium.executablePath();
  if (existsSync(executable)) return executable;
  throw new Error(
    "Chromium introuvable ; installer Chromium Playwright ou définir PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.",
  );
}

let server;
try {
  if (!(await fetch(`${base}/a-v3.html`)).ok) throw new Error("Vite absent");
} catch {
  server = await createServer({ configFile: resolve(root, "vite.config.js") });
  await server.listen();
}
const browser = await chromium.launch({ executablePath: browserPath() });
const report = { widths: [], axe: {}, motion: {} };
async function axeViolations(page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return result.violations.map((item) => ({
    id: item.id,
    impact: item.impact,
    nodes: item.nodes.map((node) => ({
      target: node.target,
      summary: node.failureSummary,
    })),
  }));
}
try {
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    const mobile = width <= 390;
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (!request.url().startsWith(`${base}/`))
        errors.push(`External request: ${request.url()}`);
      if (/\/api(?:\/|\b)/.test(request.url()))
        errors.push(`Private API request: ${request.url()}`);
    });
    await page.goto(`${base}/a-v3.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    if ([320, 390, 768, 1440].includes(width)) {
      report.axe[width] = { initial: await axeViolations(page) };
    }
    const typography = await page.evaluate(() => {
      const [first, second] = document.querySelectorAll(".title-words > span");
      const a = first.getBoundingClientRect();
      const b = second.getBoundingClientRect();
      const overlap =
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const labels = [
        ".eyebrow",
        ".visual-top",
        ".note-head",
        ".map-toolbar",
        ".detail-index",
      ];
      const sizes = labels.map((selector) => ({
        selector,
        px: parseFloat(
          getComputedStyle(document.querySelector(selector)).fontSize,
        ),
      }));
      return { wordOverlapArea: overlap, sizes };
    });
    assert.equal(
      typography.wordOverlapArea,
      0,
      `V3 ${width}px title words collide`,
    );
    for (const item of typography.sizes)
      assert.ok(item.px >= 12, `${width}px ${item.selector} is ${item.px}px`);
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.className),
      "skip-link",
    );
    assert.equal(
      await page
        .locator(".skip-link")
        .evaluate((el) => getComputedStyle(el).opacity),
      "1",
    );
    await page.keyboard.press("Enter");
    assert.equal(new URL(page.url()).hash, "#main");
    await page.evaluate(() => document.activeElement?.blur());
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(
      await page.locator(".motion-toggle").getAttribute("aria-pressed"),
      "true",
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    assert.ok(
      overflow <= 1,
      `V3 ${width}px horizontal overflow: ${overflow}px`,
    );
    for (const id of ["signal", "comprendre", "cartographier", "agir"]) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      if (width === 390 || width === 1440) {
        await page.locator(`#${id}`).screenshot({
          path: join(captures, `${width}-${id}.png`),
          animations: "disabled",
        });
      }
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: join(captures, `${width}-full.png`),
      fullPage: true,
      animations: "disabled",
    });
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: join(captures, `reduced-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    if (width >= 768) {
      const geometry = await page.evaluate(() => {
        const svg = document.querySelector(".relation-map");
        const center = (id) => {
          const node = svg.querySelector(`[data-node="${id}"]`);
          const point = svg.createSVGPoint();
          point.x = 0;
          point.y = 0;
          const result = point.matrixTransform(node.getCTM());
          return { x: result.x, y: result.y };
        };
        const path = svg.querySelector('[data-edge="a"]');
        const start = path.getPointAtLength(0).matrixTransform(path.getCTM());
        const end = path
          .getPointAtLength(path.getTotalLength())
          .matrixTransform(path.getCTM());
        return {
          a: center("a"),
          address: center("address"),
          start: { x: start.x, y: start.y },
          end: { x: end.x, y: end.y },
        };
      });
      assert.ok(
        Math.hypot(
          geometry.a.x - geometry.start.x,
          geometry.a.y - geometry.start.y,
        ) < 1,
      );
      assert.ok(
        Math.hypot(
          geometry.address.x - geometry.end.x,
          geometry.address.y - geometry.end.y,
        ) < 1,
      );
    }
    if (mobile) await page.locator('.map-list [data-node="b"]').tap();
    else await page.locator('.map-list [data-node="b"]').click();
    assert.match(
      await page.locator("[data-detail-title]").textContent(),
      /seconde mention/,
    );
    assert.equal(
      await page
        .locator('.map-list [data-node="b"]')
        .getAttribute("aria-pressed"),
      "true",
    );
    if (width >= 768) {
      await page.locator('.relation-map [data-node="hypothesis"]').focus();
      await page.keyboard.press("Enter");
      assert.match(
        await page.locator("[data-detail-title]").textContent(),
        /question/,
      );
    }
    if (mobile) {
      await page.locator(".menu-toggle").click();
      assert.equal(
        await page.locator(".menu-toggle").getAttribute("aria-expanded"),
        "true",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator(".menu-toggle").getAttribute("aria-expanded"),
        "false",
      );
      assert.equal(
        await page.evaluate(() => document.activeElement?.className),
        "menu-toggle",
      );
      await page.locator(".menu-toggle").click();
      await page.locator('.site-nav a[href="#agir"]').click();
      assert.equal(
        await page.locator(".menu-toggle").getAttribute("aria-expanded"),
        "false",
      );
    }
    await page.locator(".console-action").click();
    assert.equal(await page.locator("#method-panel").isVisible(), true);
    assert.equal(
      await page.locator(".console-action").getAttribute("aria-expanded"),
      "true",
    );
    assert.deepEqual(errors, []);
    report.widths.push({ width, overflow, errors: errors.length });
    if (width === 390 || width === 1440)
      report.axe[width].interactive = await axeViolations(page);
    await context.close();
  }

  const staticContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    javaScriptEnabled: false,
  });
  const staticPage = await staticContext.newPage();
  await staticPage.goto(`${base}/a-v3.html`, { waitUntil: "networkidle" });
  assert.equal(await staticPage.locator("main section").count(), 4);
  assert.match(
    await staticPage.locator("#relation-detail").textContent(),
    /Mention commune/,
  );
  assert.equal(
    await staticPage
      .locator(".signal-draw")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  report.staticWithoutJS = {
    sections: 4,
    stylesheetLoaded: await staticPage
      .locator("body")
      .evaluate(
        (el) => getComputedStyle(el).backgroundColor !== "rgba(0, 0, 0, 0)",
      ),
  };
  assert.equal(report.staticWithoutJS.stylesheetLoaded, true);
  await staticPage.screenshot({
    path: join(captures, "static-no-js.png"),
    fullPage: true,
  });
  await staticContext.close();

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
    recordVideo: { dir: captures, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto(`${base}/a-v3.html`, { waitUntil: "networkidle" });
  report.motion.heroAnimation = await page
    .locator(".signal-draw")
    .evaluate((el) => getComputedStyle(el).animationName);
  assert.match(report.motion.heroAnimation, /draw/);
  await page.screenshot({ path: join(captures, "motion-hero-start.png") });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(captures, "motion-hero-progress.png") });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(captures, "motion-hero-complete.png") });
  assert.notDeepEqual(
    readFileSync(join(captures, "motion-hero-start.png")),
    readFileSync(join(captures, "motion-hero-progress.png")),
  );
  assert.notDeepEqual(
    readFileSync(join(captures, "motion-hero-progress.png")),
    readFileSync(join(captures, "motion-hero-complete.png")),
  );
  for (const id of ["comprendre", "cartographier", "agir"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1100);
    await page.screenshot({ path: join(captures, `motion-${id}.png`) });
  }
  await page.locator('.map-list [data-node="hypothesis"]').click();
  await page.waitForTimeout(550);
  await page.locator("#agir").scrollIntoViewIfNeeded();
  await page.locator(".console-action").click();
  await page.waitForTimeout(800);
  const forwardReading = await page.evaluate(() =>
    parseFloat(
      getComputedStyle(document.body).getPropertyValue("--read-progress"),
    ),
  );
  await page.locator("#cartographier").scrollIntoViewIfNeeded();
  await page.waitForTimeout(650);
  const forwardMapOffset = await page
    .locator('.map-edges [data-edge="a"]')
    .evaluate((el) => parseFloat(el.style.strokeDashoffset));
  await page.screenshot({ path: join(captures, "motion-return-map.png") });
  await page.locator("#comprendre").scrollIntoViewIfNeeded();
  await page.waitForTimeout(550);
  await page.locator("#signal").scrollIntoViewIfNeeded();
  await page.waitForTimeout(650);
  const reverseReading = await page.evaluate(() =>
    parseFloat(
      getComputedStyle(document.body).getPropertyValue("--read-progress"),
    ),
  );
  const reverseMapOffset = await page
    .locator('.map-edges [data-edge="a"]')
    .evaluate((el) => parseFloat(el.style.strokeDashoffset));
  assert.ok(reverseReading < forwardReading, "reading track did not reverse");
  assert.ok(
    reverseMapOffset > forwardMapOffset,
    "map connection did not reverse",
  );
  report.motion.reverse = {
    forwardReading,
    reverseReading,
    forwardMapOffset: Math.round(forwardMapOffset),
    reverseMapOffset: Math.round(reverseMapOffset),
  };
  await page.screenshot({ path: join(captures, "motion-return-hero.png") });
  await page.locator(".motion-toggle").click();
  assert.equal(
    await page.locator(".motion-toggle").getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page
      .locator(".signal-pulse")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await page.screenshot({ path: join(captures, "motion-paused.png") });
  await page.locator(".motion-toggle").click();
  assert.equal(
    await page.locator(".motion-toggle").getAttribute("aria-pressed"),
    "false",
  );
  assert.match(
    await page
      .locator(".signal-pulse")
      .evaluate((el) => getComputedStyle(el).animationName),
    /v3-breathe/,
  );
  const video = page.video();
  await context.close();
  await video.saveAs(join(captures, "parcours-a-v3.webm"));
  unlinkSync(await video.path());
  report.motion.video = "parcours-a-v3.webm";

  const performancePage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  await performancePage.goto(`${base}/a-v3.html`, {
    waitUntil: "domcontentloaded",
  });
  report.motion.frameTiming = await performancePage.evaluate(
    () =>
      new Promise((resolve) => {
        const intervals = [];
        let previous;
        function sample(now) {
          if (previous !== undefined) intervals.push(now - previous);
          previous = now;
          if (intervals.length < 100) requestAnimationFrame(sample);
          else {
            intervals.sort((a, b) => a - b);
            resolve({
              medianMs: Math.round(intervals[50]),
              p95Ms: Math.round(intervals[95]),
            });
          }
        }
        requestAnimationFrame(sample);
      }),
  );
  assert.ok(
    report.motion.frameTiming.p95Ms < 50,
    "Hero animation frame timing p95 exceeds 50 ms in local Chromium",
  );
  async function measureScrollFrames() {
    await performancePage.evaluate(() =>
      scrollTo({ top: 0, behavior: "instant" }),
    );
    return performancePage.evaluate(
      () =>
        new Promise((resolve) => {
          const intervals = [];
          const max = document.documentElement.scrollHeight - innerHeight;
          let previous;
          function sample(now) {
            if (previous !== undefined) intervals.push(now - previous);
            previous = now;
            scrollTo({
              top: max * (intervals.length / 100),
              behavior: "instant",
            });
            if (intervals.length < 100) requestAnimationFrame(sample);
            else {
              intervals.sort((a, b) => a - b);
              resolve({
                medianMs: Math.round(intervals[50]),
                p95Ms: Math.round(intervals[95]),
              });
            }
          }
          requestAnimationFrame(sample);
        }),
    );
  }
  report.motion.scrollFrameTiming = await measureScrollFrames();
  const cdp = await performancePage.context().newCDPSession(performancePage);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  report.motion.scrollFrameTimingCpu4x = await measureScrollFrames();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await performancePage.close();

  const reflow = await browser.newPage({
    viewport: { width: 640, height: 900 },
    reducedMotion: "reduce",
  });
  await reflow.goto(`${base}/a-v3.html`, { waitUntil: "networkidle" });
  await reflow.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  report.textResize200 = await reflow.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    width: innerWidth,
  }));
  assert.ok(
    report.textResize200.overflow <= 1,
    `200% text resize overflows by ${report.textResize200.overflow}px`,
  );
  await reflow.close();
  const zoomPage = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  await zoomPage.goto(`${base}/a-v3.html`, { waitUntil: "networkidle" });
  const beforeZoom = await zoomPage.evaluate(() => innerWidth);
  for (let index = 0; index < 6; index++)
    await zoomPage.keyboard.press("Control+Equal");
  const afterZoom = await zoomPage.evaluate(() => innerWidth);
  report.nativeZoom = {
    beforeZoom,
    afterZoom,
    supported: afterZoom < beforeZoom,
  };
  if (afterZoom < beforeZoom) {
    report.nativeZoom.overflow = await zoomPage.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    assert.ok(report.nativeZoom.overflow <= 1);
  }
  await zoomPage.close();
  for (const [width, states] of Object.entries(report.axe))
    for (const [state, violations] of Object.entries(states))
      assert.deepEqual(violations, [], `axe ${width}px ${state} violations`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  writeFileSync(
    join(captures, "check-report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  await server?.close();
}
