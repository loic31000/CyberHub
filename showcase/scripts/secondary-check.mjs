import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const root = new URL("../", import.meta.url);
const base = "http://127.0.0.1:5174/terminal-story.html";
const cache = join(process.env.LOCALAPPDATA || "", "ms-playwright");
const executable =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  readdirSync(cache)
    .filter((name) => name.startsWith("chromium-"))
    .sort()
    .reverse()
    .map((name) => join(cache, name, "chrome-win64", "chrome.exe"))
    .find(existsSync);
assert.ok(executable, "Chromium Playwright introuvable");
assert.ok((await fetch(base)).ok, "Le serveur Vite doit être lancé sur 5174");

const browser = await chromium.launch({ executablePath: executable });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    const privateCalls = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/\/api\//.test(request.url())) privateCalls.push(request.url());
    });
    await page.goto(base);
    for (const selector of [
      ".mitre-demo",
      ".investigation-section",
      ".disciplines-section",
      ".osint-scene",
      ".bgp-scene",
      ".final-section",
    ]) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await page
        .locator(`${selector} .demo-guide-actions button`)
        .first()
        .click();
      assert.equal(
        (await page.locator(selector).getAttribute("data-product-stage")) !==
          null,
        true,
      );
    }
    assert.equal(await page.locator(".cve-primary").isVisible(), true);
    assert.equal(
      await page
        .locator(".investigation-section .attach-source")
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await page.locator(".cve-secondary").first().isVisible(),
      false,
    );
    await page
      .locator(".disciplines-section .demo-guide-actions button")
      .last()
      .click();
    assert.equal(
      await page
        .locator(".disciplines-section")
        .getAttribute("data-product-stage"),
      "0",
    );
    await page
      .locator(".disciplines-section .demo-guide-actions button")
      .first()
      .click();
    await page.locator(".cve-severity").click();
    assert.equal(
      await page.locator(".cve-secondary").first().isVisible(),
      true,
    );
    await page.locator('.osint-source[data-source="b"]').click();
    assert.match(
      await page.locator(".osint-source-detail").textContent(),
      /ressemblance/,
    );
    await page.locator('.bgp-snapshot[data-snapshot="t0"]').click();
    assert.equal(
      await page
        .locator(".bgp-diff")
        .evaluate((node) => node.classList.contains("is-hidden")),
      true,
    );
    assert.equal(await page.locator(".bgp-diff-empty").isVisible(), true);
    assert.equal(await page.locator(".final-constellation").count(), 0);
    assert.equal(await page.locator(".final-view").count(), 3);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(privateCalls, []);
    await page.close();
    console.log(
      `PASS Chromium ${width}px: scènes, interactions, API, débordement`,
    );
  }

  const reduced = await browser.newPage({ reducedMotion: "reduce" });
  await reduced.goto(base);
  assert.equal(await reduced.locator(".cve-inspector").isVisible(), true);
  assert.equal(await reduced.locator(".final-view-main").isVisible(), true);
  await reduced.keyboard.press("Tab");
  assert.ok(
    await reduced.evaluate(() => document.activeElement !== document.body),
  );
  await reduced.close();
  console.log("PASS mouvement réduit et navigation clavier");

  const staticPage = await browser.newPage({ javaScriptEnabled: false });
  await staticPage.goto(base);
  assert.match(
    await staticPage.locator(".cve-inspector").textContent(),
    /Provenance/,
  );
  assert.match(await staticPage.locator(".bgp-diff").textContent(), /AS64514/);
  assert.match(
    await staticPage.locator(".final-stage").getAttribute("aria-label"),
    /CyberHub/,
  );
  await staticPage.close();
  console.log("PASS contenu statique sans JavaScript");
} finally {
  await browser.close();
}
