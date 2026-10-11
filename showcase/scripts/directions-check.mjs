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
const captures = join(root, "captures", "directions");
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
      const path = join(cache, folder, "chrome-win64", "chrome.exe");
      if (existsSync(path)) return path;
    }
  }
  const path = chromium.executablePath();
  if (existsSync(path)) return path;
  throw new Error("Chromium Playwright introuvable.");
}

let server;
try {
  if (!(await fetch(`${base}/atelier-traces.html`)).ok)
    throw new Error("Vite absent");
} catch {
  server = await createServer({ configFile: resolve(root, "vite.config.js") });
  await server.listen();
}

const browser = await chromium.launch({ executablePath: browserPath() });
const report = {
  widths: {},
  axe: {},
  interaction: {},
  static: {},
  textResize: {},
};
const directions = [
  {
    name: "atelier",
    page: "atelier-traces.html",
    kit: "atelier-traces-kit.html",
  },
  {
    name: "topologie",
    page: "topologie-indices.html",
    kit: "topologie-indices-kit.html",
  },
];
const widths = [320, 390, 768, 1024, 1440, 1920];

async function axe(page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return result.violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    count: nodes.length,
    targets: nodes.map((node) => node.target),
  }));
}

try {
  for (const direction of directions) {
    report.widths[direction.name] = [];
    report.axe[direction.name] = {};
    const pages = [direction.page, direction.kit];
    for (const file of pages) {
      for (const width of widths) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        const errors = [];
        const external = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("request", (request) => {
          if (!request.url().startsWith(base)) external.push(request.url());
        });
        await page.goto(`${base}/${file}`, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(
          () =>
            Math.max(
              document.documentElement.scrollWidth,
              document.body.scrollWidth,
            ) - innerWidth,
        );
        assert.ok(overflow <= 1, `${file} ${width}px overflow ${overflow}`);
        assert.deepEqual(errors, [], `${file} ${width}px JS errors`);
        assert.deepEqual(external, [], `${file} ${width}px external requests`);
        assert.equal(
          await page.locator("body.motion-off").count(),
          1,
          `${file} ${width}px reduced motion`,
        );
        report.widths[direction.name].push({ file, width, overflow, errors });
        if (width === 390 || width === 1440) {
          const id = file === direction.page ? "journey" : "kit";
          report.axe[direction.name][`${id}-${width}`] = await axe(page);
          await page.evaluate(() => document.activeElement?.blur());
          await page.screenshot({
            path: join(captures, `${direction.name}-${id}-${width}.png`),
            fullPage: true,
            animations: "disabled",
          });
          if (file === direction.page) {
            for (const section of ["observations", "relations", "dossier"]) {
              await page.locator(`#${section}`).screenshot({
                path: join(
                  captures,
                  `${direction.name}-${section}-${width}.png`,
                ),
                animations: "disabled",
              });
            }
          }
        }
        await context.close();
      }
    }

    report.textResize[direction.name] = [];
    for (const file of pages) {
      const context = await browser.newContext({
        viewport: { width: 640, height: 900 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(`${base}/${file}`, { waitUntil: "networkidle" });
      await page.evaluate(async () => {
        document.documentElement.style.fontSize = "200%";
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      });
      const overflow = await page.evaluate(
        () =>
          Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
          ) - innerWidth,
      );
      const protruding =
        overflow > 1
          ? await page.evaluate(() =>
              [...document.querySelectorAll("body *")]
                .filter(
                  (element) =>
                    element.getBoundingClientRect().right > innerWidth + 1,
                )
                .slice(0, 12)
                .map((element) => ({
                  selector:
                    element.tagName.toLowerCase() + "." + element.className,
                  right: Math.round(element.getBoundingClientRect().right),
                })),
            )
          : [];
      assert.ok(
        overflow <= 1,
        `${file}: 200% text overflow ${overflow}; ${JSON.stringify(protruding)}`,
      );
      report.textResize[direction.name].push({ file, width: 640, overflow });
      await page.screenshot({
        path: join(
          captures,
          `${direction.name}-${file === direction.page ? "journey" : "kit"}-text200.png`,
        ),
        fullPage: true,
        animations: "disabled",
      });
      await context.close();
    }

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: captures, size: { width: 1440, height: 900 } },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${base}/${direction.page}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: join(captures, `${direction.name}-motion-start.png`),
    });
    await page.waitForTimeout(450);
    await page.screenshot({
      path: join(captures, `${direction.name}-motion-mid.png`),
    });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: join(captures, `${direction.name}-motion-end.png`),
    });
    assert.notDeepEqual(
      readFileSync(join(captures, `${direction.name}-motion-start.png`)),
      readFileSync(join(captures, `${direction.name}-motion-end.png`)),
      `${direction.name}: animated hero frames`,
    );
    await page.keyboard.press("Tab");
    assert.match(
      await page.evaluate(() => document.activeElement?.className),
      /skip/,
      `${direction.name}: skip link focus`,
    );
    await page.evaluate(() => document.activeElement?.blur());
    for (const id of ["observations", "relations", "dossier"]) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await page.waitForFunction(
        (chapter) =>
          document.getElementById(chapter).classList.contains("is-active"),
        id,
      );
      await page.waitForTimeout(420);
    }
    await page.locator("[data-map-node]").nth(1).focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await page.locator("[data-map-node]").nth(1).getAttribute("aria-pressed"),
      "true",
    );
    assert.ok(
      (await page.locator("[data-selected-title]").textContent()).length > 0,
    );
    await page.locator(".method-toggle").click();
    assert.equal(
      await page.locator(".method-toggle").getAttribute("aria-expanded"),
      "true",
    );
    assert.equal(await page.locator(".method-panel").isVisible(), true);
    report.axe[direction.name].interactive = await axe(page);
    await page.screenshot({
      path: join(captures, `${direction.name}-interaction.png`),
    });
    await page.locator(".motion-switch").click();
    assert.equal(
      await page.locator(".motion-switch").getAttribute("aria-pressed"),
      "true",
    );
    await page.locator(".hero").scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => !document.getElementById("dossier").classList.contains("is-active"),
    );
    await page.waitForTimeout(350);
    const video = page.video();
    await context.close();
    await video.saveAs(join(captures, `${direction.name}-interactions.webm`));
    unlinkSync(await video.path());
    report.interaction[direction.name] = {
      keyboard: true,
      map: true,
      method: true,
      pause: true,
      video: true,
    };

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${base}/${direction.page}`, {
      waitUntil: "networkidle",
    });
    await mobilePage.locator(".menu-switch").tap();
    assert.equal(
      await mobilePage.locator(".menu-switch").getAttribute("aria-expanded"),
      "true",
    );
    report.axe[direction.name].mobileMenu = await axe(mobilePage);
    await mobilePage.keyboard.press("Escape");
    assert.equal(
      await mobilePage.locator(".menu-switch").getAttribute("aria-expanded"),
      "false",
    );
    await mobilePage.locator("[data-map-node]").last().tap();
    assert.equal(
      await mobilePage
        .locator("[data-map-node]")
        .last()
        .getAttribute("aria-pressed"),
      "true",
    );
    await mobile.close();

    const noJs = await browser.newContext({
      viewport: { width: 390, height: 844 },
      javaScriptEnabled: false,
      reducedMotion: "reduce",
    });
    const staticPage = await noJs.newPage();
    await staticPage.goto(`${base}/${direction.page}`, {
      waitUntil: "networkidle",
    });
    report.static[direction.name] = {
      sections: await staticPage.locator("main section").count(),
      stylesheetLoaded: await staticPage.evaluate(
        () =>
          getComputedStyle(document.body).backgroundColor !==
          "rgba(0, 0, 0, 0)",
      ),
    };
    assert.ok(report.static[direction.name].sections >= 4);
    assert.ok(report.static[direction.name].stylesheetLoaded);
    await noJs.close();
  }

  for (const [name, states] of Object.entries(report.axe)) {
    for (const [state, violations] of Object.entries(states))
      assert.deepEqual(violations, [], `${name} ${state} axe violations`);
  }
  writeFileSync(
    join(captures, "check-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  writeFileSync(
    join(captures, "check-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  throw error;
} finally {
  await browser.close();
  await server?.close();
}
