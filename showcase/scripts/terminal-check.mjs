import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
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
const report = {
  widths: [],
  axe: {},
  interaction: {},
  motion: {},
  story: [],
  errors: [],
};
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
    assert.equal(await page.locator("main > section").count(), 6); // Terminal and IOC share one semantic scene.
    for (const id of [
      "terminal",
      "ioc",
      "relations",
      "mitre",
      "investigation",
      "disciplines",
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
      await page.waitForTimeout(120);
      const enlarged = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        controls: [
          ...document.querySelectorAll(".motion-control, .menu-control"),
        ].map((node) => {
          const rect = node.getBoundingClientRect();
          return { left: rect.left, right: rect.right, bottom: rect.bottom };
        }),
        statusTop: document
          .querySelector(".story-status")
          .getBoundingClientRect().top,
        offenders: [...document.querySelectorAll("body *")]
          .map((node) => ({
            name: node.tagName.toLowerCase(),
            className: String(node.getAttribute("class") ?? ""),
            parent: String(node.parentElement?.getAttribute("class") ?? ""),
            text: node.textContent?.trim().slice(0, 30),
            right: Math.round(node.getBoundingClientRect().right),
            width: Math.round(node.getBoundingClientRect().width),
          }))
          .filter((item) => item.right > innerWidth + 2 && item.width > 0)
          .slice(0, 12),
      }));
      report.text200 = enlarged;
      assert.ok(
        enlarged.document <= width + 1 && enlarged.body <= width + 1,
        `200% text overflow: ${JSON.stringify(enlarged)}`,
      );
      assert.ok(
        enlarged.controls.every(
          (rect) =>
            rect.left >= 0 &&
            rect.right <= width + 1 &&
            rect.bottom <= enlarged.statusTop + 1,
        ),
        `200% controls clipped or overlapped: ${JSON.stringify(enlarged)}`,
      );
      report.axe.text200 = await violations(page);
      assert.deepEqual(report.axe.text200, []);
      await page.screenshot({ path: join(output, "320-text200.png") });
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
  page.on("request", (request) => {
    if (!request.url().startsWith(`${base}/`))
      report.errors.push(`motion: external ${request.url()}`);
    if (/\/api(?:\/|\b)/.test(request.url()))
      report.errors.push(`motion: private API ${request.url()}`);
  });
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
  const goTo = async (selector) => {
    await page.evaluate((query) => {
      const element = document.querySelector(query);
      window.scrollTo({
        top: element.getBoundingClientRect().top + scrollY - innerHeight * 0.52,
        behavior: "instant",
      });
    }, selector);
    await page.waitForTimeout(300);
  };
  const capture = async (name, state) => {
    const current = await page.locator("body").getAttribute("data-story-state");
    assert.equal(current, state, `${name}: state ${current}`);
    const caption = await page.locator(".story-status-title").textContent();
    const token = await page.locator(".handoff-token").boundingBox();
    report.story.push({
      name,
      state,
      caption,
      token: token && { x: Math.round(token.x), y: Math.round(token.y) },
    });
    await page.screenshot({ path: join(output, `state-${name}.png`) });
  };
  const dockDistance = async (selector) =>
    page.evaluate((query) => {
      const value = document.querySelector(query).getBoundingClientRect();
      const token = document
        .querySelector(".handoff-token")
        .getBoundingClientRect();
      return Math.hypot(
        value.left + value.width / 2 - (token.left + token.width / 2),
        value.top + value.height / 2 - (token.top + token.height / 2),
      );
    }, selector);

  await handoff(0.72);
  await page.waitForTimeout(300);
  await capture("ioc", "ioc-imported");
  await goTo(".relations-canvas");
  await capture("correlation", "correlation-linked");
  assert.equal(
    await page.locator(".story-status").getAttribute("aria-hidden"),
    "true",
  );
  assert.match(
    await page.locator(".story-status-title").textContent(),
    /Deux observations/,
  );
  report.motion.correlationDockPx = await dockDistance(
    ".relation-center strong",
  );
  assert.ok(
    report.motion.correlationDockPx < 30,
    `correlation dock ${report.motion.correlationDockPx}`,
  );
  report.axe.correlation = await violations(page);
  assert.deepEqual(report.axe.correlation, []);
  await goTo(".mitre-strip");
  await page.locator(".mitre-demo .demo-guide-actions button").first().click();
  await page.locator('[data-technique="t1053"]').click();
  assert.match(
    await page.locator("#mitre-detail").textContent(),
    /Persistance/,
  );
  await capture("mitre", "references-explored");
  assert.equal(
    await page.locator(".handoff-token").getAttribute("data-role"),
    "thread",
  );
  await goTo(".discipline-machine");
  await page.locator('[data-demo-step="cve:source"]').click();
  assert.match(
    await page.locator('[data-demo="cve"] .demo-detail').textContent(),
    /NVD/,
  );
  await capture("cve", "disciplines-explored");
  await page.locator('[data-discipline="osint"]').focus();
  await page.keyboard.press("Space");
  await page.locator('[data-demo-step="osint:b"]').click();
  assert.match(
    await page.locator("#discipline-transcript").textContent(),
    /trois pistes/,
  );
  await capture("osint", "disciplines-explored");
  await page.locator('[data-discipline="bgp"]').click();
  await page.locator('[data-demo-step="bgp:t1"]').click();
  assert.equal(await page.locator(".bgp-graphic").getAttribute("hidden"), null);
  assert.match(
    await page.locator('[data-demo="bgp"] .demo-detail').textContent(),
    /instantané fictif/,
  );
  await capture("bgp", "disciplines-explored");
  report.interaction.modules = true;
  report.axe.modules = await violations(page);
  assert.deepEqual(report.axe.modules, []);
  await goTo(".investigation-work");
  await page
    .locator(".investigation-section .demo-guide-actions button")
    .first()
    .click();
  await capture("investigation", "investigation-attached");
  assert.match(
    await page.locator(".story-status-title").textContent(),
    /investigation/,
  );
  report.motion.caseDockPx = await dockDistance(".case-ip-value");
  assert.ok(
    report.motion.caseDockPx < 30,
    `case dock ${report.motion.caseDockPx}`,
  );
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
  await goTo(".playbook");
  await capture("playbook", "playbook-reviewed");
  await goTo(".final-constellation");
  await capture("final", "cyberhub-revealed");
  await goTo(".relations-canvas");
  await capture("reverse-correlation", "correlation-linked");
  const sampleBoundary = async (selector) => {
    const marker = await page.evaluate((query) => {
      const node = document.querySelector(query);
      return node.getBoundingClientRect().top + scrollY - innerHeight * 0.52;
    }, selector);
    const centers = [];
    for (const offset of [-3, 3]) {
      await page.evaluate(
        (top) => window.scrollTo({ top, behavior: "instant" }),
        marker + offset,
      );
      await page.waitForTimeout(100);
      centers.push(
        await page.locator(".handoff-token").evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            opacity: Number(getComputedStyle(node).opacity),
          };
        }),
      );
    }
    const distance = Math.hypot(
      centers[0].x - centers[1].x,
      centers[0].y - centers[1].y,
    );
    assert.ok(
      distance < 25 && centers.every((point) => point.opacity > 0),
      `${selector}: discontinuity ${distance}`,
    );
    return Math.round(distance * 10) / 10;
  };
  report.motion.boundaryPx = {
    correlation: await sampleBoundary(".relations-canvas"),
    investigation: await sampleBoundary(".investigation-work"),
  };
  await page.setViewportSize({ width: 1024, height: 760 });
  await goTo(".relations-canvas");
  assert.equal(
    await page.locator("body").getAttribute("data-story-state"),
    "correlation-linked",
  );
  report.motion.resize = await page.locator(".handoff-token").boundingBox();
  assert.ok(report.motion.resize.x >= 0 && report.motion.resize.x < 1024);
  await page.setViewportSize({ width: 390, height: 844 });
  await goTo(".relations-canvas");
  report.motion.mobileChip = await page.locator(".handoff-token").boundingBox();
  assert.ok(
    report.motion.mobileChip.x >= 0 && report.motion.mobileChip.x < 390,
  );
  await page.screenshot({ path: join(output, "390-motion-relation.png") });
  await page.setViewportSize({ width: 1440, height: 900 });
  await goTo(".relations-canvas");
  await page.locator(".motion-control").click();
  assert.equal(await page.locator(".handoff-token").isVisible(), false);
  assert.equal(await page.locator(".relation-center strong").isVisible(), true);
  await page.locator(".motion-control").click();
  await handoff(0);
  await page.waitForTimeout(600);
  const video = page.video();
  await context.close();
  await video.saveAs(join(output, "journey.webm"));
  report.videoBytes = statSync(join(output, "journey.webm")).size;
  assert.ok(
    report.videoBytes > 500_000,
    `video too short: ${report.videoBytes} bytes`,
  );

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
  assert.equal(await staticPage.locator(".module-demo").count(), 3);
  assert.equal(await staticPage.locator('[data-demo="bgp"]').isVisible(), true);
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
