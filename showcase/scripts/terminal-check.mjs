import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = "http://127.0.0.1:5174";
const modules = [
  "Outils",
  "Writeups",
  "CVE & KEV",
  "Playbooks",
  "MITRE ATT&CK",
  "Layers ATT&CK",
  "LOLBins",
  "CLOAK OpSec",
  "IOC Manager",
  "Corrélation",
  "OSINT Runner",
  "Investigations",
  "Notes",
  "Cheatsheets",
  "Encoder/Decoder",
  "RevShell Gen",
  "BGP Lookup",
  "BGP Historian",
];

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
const failures = [];
function watch(page) {
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("request", (request) => {
    if (/\/api(?:\/|\b)/.test(request.url()))
      failures.push(`API privée : ${request.url()}`);
    if (!request.url().startsWith(`${base}/`))
      failures.push(`Requête externe : ${request.url()}`);
  });
}
async function axe(page, label) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map(({ target }) => target),
    })),
    [],
    `${label} : violations axe-core`,
  );
}
async function wordmarkFits(page) {
  await page.evaluate(() => document.fonts.ready);
  const { stage, word, clip } = await page
    .locator(".final-wordmark")
    .evaluate((node) => ({
      stage: node.closest(".final-stage").getBoundingClientRect().toJSON(),
      word: node.getBoundingClientRect().toJSON(),
      clip: getComputedStyle(node).clipPath,
    }));
  assert.equal(clip, "none");
  assert.ok(word.left >= stage.left + 12 && word.right <= stage.right - 12);
}

try {
  for (const width of [320, 390, 768, 936, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    watch(page);
    await page.goto(`${base}/terminal-story.html`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator("main > section").count(), 8);
    assert.deepEqual(
      await page.locator(".final-name").allTextContents(),
      modules,
    );
    assert.deepEqual(
      await page.locator(".final-module-details li").allTextContents(),
      modules,
    );
    assert.equal(
      await page.locator(".final-module-details").getAttribute("open"),
      null,
    );
    assert.equal(await page.locator(".ioc-target").isVisible(), true);
    assert.equal(await page.locator(".final-wordmark").isVisible(), true);
    await wordmarkFits(page);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    if ([390, 1440].includes(width))
      await axe(page, `${width}px, mouvement réduit`);
    if (width === 320) {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await axe(page, "320px, texte à 200 %");
    }
    await context.close();
    console.log(`PASS responsive ${width}px`);
  }

  const animated = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await animated.newPage();
  watch(page);
  await page.goto(`${base}/terminal-story.html`, { waitUntil: "networkidle" });
  await axe(page, "animation initiale");
  const pilot = page.locator(".pilot-guide .demo-guide-actions button");
  await pilot.first().click();
  assert.equal(
    await page.locator(".handoff-track").getAttribute("data-pilot-state"),
    "complete",
  );
  assert.match(
    await page.locator(".typed-command").textContent(),
    /198\.51\.100\.42/,
  );
  assert.match(await page.locator(".ioc-facts").textContent(), /non établis/);
  await pilot.last().click();
  await page.waitForFunction(() => {
    const length = document.querySelector(".typed-command").textContent.length;
    return length > 3 && length < 36;
  });
  assert.equal(await page.locator(".terminal-window").isVisible(), true);
  await page
    .locator(".handoff-track[data-pilot-state='complete']")
    .waitFor({ timeout: 25000 });
  assert.equal(
    await page
      .locator(".pilot-shared-chip")
      .evaluate((node) => node.parentElement.className),
    "ioc-value-line",
  );
  await pilot.last().click();
  await pilot.first().click();
  assert.equal(await page.locator(".ioc-target").isVisible(), true);
  console.log(
    "PASS pilote GSAP : frappe, transfert, fin, rejeu et interruption",
  );

  const final = page.locator(".final-section .demo-guide-actions button");
  await final.first().click();
  await wordmarkFits(page);
  await final.last().click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.final-name[data-wave="0"]')].every(
      (node) => Number(getComputedStyle(node).opacity) > 0.95,
    ),
  );
  assert.equal(await page.locator('.final-name[data-wave="0"]').count(), 6);
  await final.first().click();
  await wordmarkFits(page);
  await page.locator(".final-module-details summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator(".final-module-details").getAttribute("open"),
    "",
  );
  await page.waitForFunction(() =>
    [".story-status-title", '.bgp-snapshot[data-snapshot="t0"]'].every(
      (selector) =>
        Number(getComputedStyle(document.querySelector(selector)).opacity) >=
        0.99,
    ),
  );
  await axe(page, "résultat final");
  console.log("PASS final GSAP : 18 noms, rejeu, interruption et axe-core");
  await animated.close();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  watch(mobile);
  await mobile.goto(`${base}/terminal-story.html`, {
    waitUntil: "networkidle",
  });
  await mobile.keyboard.press("Tab");
  assert.equal(
    await mobile.locator(":focus").getAttribute("class"),
    "skip-link",
  );
  await mobile.locator(".menu-control").focus();
  await mobile.keyboard.press("Enter");
  assert.equal(
    await mobile.locator(".menu-control").getAttribute("aria-expanded"),
    "true",
  );
  await mobile.locator('#mobile-nav a[href="#disciplines"]').click();
  assert.equal(
    await mobile.locator(".menu-control").getAttribute("aria-expanded"),
    "false",
  );
  await mobile.close();

  const noJS = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noJS.newPage();
  await staticPage.goto(`${base}/terminal-story.html`);
  assert.equal(await staticPage.locator(".terminal-window").isVisible(), true);
  assert.equal(await staticPage.locator(".ioc-workspace").isVisible(), true);
  assert.equal(await staticPage.locator(".final-wordmark").isVisible(), true);
  await staticPage.locator(".final-module-details summary").click();
  assert.deepEqual(
    await staticPage.locator(".final-module-details li").allTextContents(),
    modules,
  );
  await noJS.close();
  assert.deepEqual(
    failures,
    [],
    "Erreurs JavaScript ou requêtes externes/privées",
  );
  console.log("PASS clavier, sans JavaScript et sans API privée");
} finally {
  await browser.close();
  if (server) await server.close();
}
