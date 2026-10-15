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
const moduleNames = [
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
async function assertWordmarkFits(page) {
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page
    .locator(".final-wordmark")
    .evaluate((wordmark) => {
      const stage = wordmark.closest(".final-stage").getBoundingClientRect();
      const word = wordmark.getBoundingClientRect();
      const hub = wordmark.querySelector("span").firstChild;
      const lastLetter = document.createRange();
      lastLetter.setStart(hub, hub.textContent.length - 1);
      lastLetter.setEnd(hub, hub.textContent.length);
      return {
        stage: stage.toJSON(),
        word: word.toJSON(),
        b: lastLetter.getBoundingClientRect().toJSON(),
        clipPath: getComputedStyle(wordmark).clipPath,
      };
    });
  assert.equal(geometry.clipPath, "none", "Le mot ne doit plus être découpé");
  assert.ok(
    geometry.word.left >= geometry.stage.left + 12 &&
      geometry.word.right <= geometry.stage.right - 12 &&
      geometry.b.right <= geometry.stage.right - 12,
    `CYBERHUB déborde : ${JSON.stringify(geometry)}`,
  );
}
try {
  for (const width of [390, 768, 936, 1440]) {
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
    assert.equal(await page.locator(".final-name").count(), 18);
    assert.deepEqual(
      await page.locator(".final-name").allTextContents(),
      moduleNames,
    );
    assert.deepEqual(
      await page.locator(".final-module-details li").allTextContents(),
      moduleNames,
    );
    assert.equal(
      await page.locator(".final-module-details").getAttribute("open"),
      null,
    );
    assert.equal(
      await page.locator(".final-section .demo-guide-heading").isVisible(),
      false,
    );
    assert.equal(await page.locator(".final-wordmark").isVisible(), true);
    assert.equal(await page.locator(".final-signature").isVisible(), true);
    await assertWordmarkFits(page);
    await page.locator(".final-module-details summary").click();
    assert.equal(
      await page.locator(".final-module-details").getAttribute("open"),
      "",
    );
    await page
      .locator(".final-section .demo-guide-actions button")
      .last()
      .click();
    assert.equal(
      await page.locator(".final-section").getAttribute("data-product-stage"),
      "0",
    );
    assert.equal(await page.locator(".final-wordmark").isVisible(), false);
    assert.equal(await page.locator(".final-signature").isVisible(), false);
    assert.equal(
      await page.locator(".final-module-details").getAttribute("open"),
      null,
    );
    await page
      .locator(".final-section .demo-guide-actions button")
      .first()
      .click();
    assert.equal(await page.locator(".final-wordmark").isVisible(), true);
    assert.equal(await page.locator(".final-signature").isVisible(), true);
    await assertWordmarkFits(page);
    await page
      .locator(".final-section .demo-guide-actions button")
      .last()
      .click();
    assert.equal(
      await page.locator(".final-section").getAttribute("data-product-stage"),
      "0",
    );
    if (width === 390 || width === 936) {
      for (const wave of [0, 1, 2]) {
        await page.waitForFunction(
          (index) =>
            [
              ...document.querySelectorAll(`.final-name[data-wave="${index}"]`),
            ].every(
              (name) =>
                Number.parseFloat(getComputedStyle(name).opacity) > 0.98,
            ),
          wave,
        );
        const metrics = await page
          .locator(`.final-name[data-wave="${wave}"]`)
          .evaluateAll((names) =>
            names.map((name) => ({
              fontSize: Number.parseFloat(getComputedStyle(name).fontSize),
              box: name.getBoundingClientRect().toJSON(),
            })),
          );
        assert.equal(metrics.length, 6);
        assert.ok(
          metrics.every(
            ({ fontSize }) => fontSize >= (width === 390 ? 16 : 24),
          ),
        );
        for (let i = 0; i < metrics.length; i += 1) {
          for (let j = i + 1; j < metrics.length; j += 1) {
            const a = metrics[i].box;
            const b = metrics[j].box;
            assert.ok(
              a.right <= b.left ||
                b.right <= a.left ||
                a.bottom <= b.top ||
                b.bottom <= a.top,
              `Les noms ${i + 1} et ${j + 1} se chevauchent dans la vague ${wave + 1}`,
            );
          }
        }
      }
      await page
        .locator(".final-section.product-complete")
        .waitFor({ timeout: 12000 });
      await assertWordmarkFits(page);
    }
    await page.evaluate(() =>
      document.querySelector(".motion-control").click(),
    );
    assert.equal(
      await page.locator(".final-section").getAttribute("data-product-stage"),
      "6",
    );
    assert.equal(await page.locator(".final-wordmark").isVisible(), true);
    assert.equal(await page.locator(".final-signature").isVisible(), true);
    await assertWordmarkFits(page);
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
  assert.equal(await reduced.locator(".final-name").count(), 18);
  assert.equal(await reduced.locator(".final-wordmark").isVisible(), true);
  assert.equal(await reduced.locator(".final-signature").isVisible(), true);
  assert.equal(
    await reduced.locator(".final-module-details").getAttribute("open"),
    null,
  );
  await assertWordmarkFits(reduced);
  await reduced.locator(".final-module-details summary").focus();
  await reduced.keyboard.press("Enter");
  assert.equal(
    await reduced.locator(".final-module-details").getAttribute("open"),
    "",
  );
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
  assert.equal(await staticPage.locator(".final-name").count(), 18);
  assert.equal(await staticPage.locator(".final-wordmark").isVisible(), true);
  assert.equal(await staticPage.locator(".final-signature").isVisible(), true);
  assert.equal(
    await staticPage.locator(".final-module-details").getAttribute("open"),
    null,
  );
  await staticPage.locator(".final-module-details summary").click();
  assert.equal(
    await staticPage.locator(".final-module-details").getAttribute("open"),
    "",
  );
  assert.deepEqual(
    await staticPage.locator(".final-module-details li").allTextContents(),
    moduleNames,
  );
  await staticPage.close();
  console.log("PASS contenu statique sans JavaScript");
} finally {
  await browser.close();
}
