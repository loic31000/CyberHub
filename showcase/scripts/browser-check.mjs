import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = "http://127.0.0.1:5174";
const captures = join(root, "captures");

function findBrowser() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const cache =
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "ms-playwright");
  if (cache && existsSync(cache)) {
    for (const folder of readdirSync(cache)
      .filter((name) => name.startsWith("chromium-"))
      .sort()
      .reverse()) {
      const executable = join(cache, folder, "chrome-win64", "chrome.exe");
      if (existsSync(executable)) return executable;
    }
  }
  const bundled = chromium.executablePath();
  if (existsSync(bundled)) return bundled;
  throw new Error(
    "Chromium introuvable. Installer le navigateur Playwright ou définir PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.",
  );
}

async function ensureServer() {
  try {
    if ((await fetch(base)).ok) return null;
  } catch {
    /* Start Vite below. */
  }
  const server = await createServer({
    configFile: resolve(root, "vite.config.js"),
  });
  await server.listen();
  return server;
}

async function exercisePage(browser, route, name, viewport, mobile = false) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  page.on("request", (request) => {
    if (!request.url().startsWith(`${base}/`))
      failures.push(`Requête externe : ${request.url()}`);
  });
  await page.goto(`${base}/${route}`, { waitUntil: "networkidle" });
  await page.locator("h1").waitFor();
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  assert.ok(
    overflow <= 1,
    `${name} ${viewport.width}px déborde de ${overflow}px`,
  );

  if (name === "a") {
    await page.waitForFunction(() =>
      document.querySelector(".a-signal-scene")?.classList.contains("in-view"),
    );
    assert.match(
      await page
        .locator(".trace-main")
        .evaluate((element) => getComputedStyle(element).animationName),
      /draw-trace/,
    );
    await page.locator('[data-signal="context"]').click();
    assert.equal(
      await page.locator("[data-signal-title]").textContent(),
      "Le contexte change la lecture.",
    );
    await page.locator('.map-list [data-evidence="e2"]').click();
    assert.equal(
      await page.locator(".a-map-detail [data-evidence-code]").textContent(),
      "B—02",
    );
    assert.equal(
      await page.locator(".map-node.node-two").getAttribute("aria-pressed"),
      "true",
    );
  } else {
    const atlas = page.locator('.atlas-graphic [data-evidence="e2"]');
    await atlas.click();
    assert.equal(
      await page.locator(".atlas-selected [data-evidence-code]").textContent(),
      "B—02",
    );
    const ledger = page.locator('.ledger-row[data-evidence="e3"]');
    await ledger.focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await page.locator(".b-open-file [data-evidence-title]").textContent(),
      "Une action documentée",
    );
    assert.match(
      await page
        .locator(".b-open-file")
        .evaluate((element) => getComputedStyle(element).animationName),
      /file-change/,
    );
  }

  await page.locator(".motion-toggle").click();
  assert.equal(
    await page
      .locator("body")
      .evaluate((element) => element.classList.contains("motion-off")),
    true,
  );
  await page.screenshot({
    path: join(captures, `${name}-${mobile ? "mobile" : "desktop"}.png`),
    fullPage: true,
    animations: "disabled",
  });
  assert.deepEqual(
    failures,
    [],
    `${name} ${viewport.width}px : erreurs navigateur`,
  );
  await context.close();
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch({
    executablePath: findBrowser(),
    headless: true,
  });
  mkdirSync(captures, { recursive: true });
  try {
    const apiResponse = await fetch(`${base}/api/auth/status`);
    assert.equal(
      apiResponse.status,
      404,
      "Le Showcase ne doit pas router /api vers Go",
    );

    for (const [route, name] of [
      ["a.html", "a"],
      ["b.html", "b"],
    ]) {
      await exercisePage(browser, route, name, { width: 1440, height: 900 });
      await exercisePage(
        browser,
        route,
        name,
        { width: 390, height: 844 },
        true,
      );
      for (const width of [320, 768]) {
        const reduced = await browser.newContext({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        });
        const page = await reduced.newPage();
        await page.goto(`${base}/${route}`, { waitUntil: "networkidle" });
        assert.equal(
          await page
            .locator("body")
            .evaluate((element) => element.classList.contains("motion-off")),
          true,
        );
        assert.equal(await page.locator(".motion-toggle").isDisabled(), true);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        const offenders = await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter(
              (element) =>
                element.getBoundingClientRect().right > window.innerWidth + 1,
            )
            .slice(0, 8)
            .map(
              (element) =>
                `${element.tagName}.${element.className}=${Math.round(element.getBoundingClientRect().right)}`,
            ),
        );
        assert.ok(
          overflow <= 1,
          `${name} ${width}px déborde de ${overflow}px : ${offenders.join(", ")}`,
        );
        await reduced.close();
      }
    }

    const compare = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await compare.goto(`${base}/`, { waitUntil: "networkidle" });
    await compare.screenshot({
      path: join(captures, "comparison-desktop.png"),
      fullPage: true,
    });
    await compare.close();

    const cssPath = join(root, "src", "styles.css");
    const originalCss = readFileSync(cssPath);
    const hmr = await browser.newPage();
    try {
      await hmr.goto(`${base}/a.html`, { waitUntil: "networkidle" });
      writeFileSync(
        cssPath,
        Buffer.concat([
          originalCss,
          Buffer.from(
            "\n.brand-mark{outline:3px solid rgb(13, 111, 163)!important}\n",
          ),
        ]),
      );
      await hmr.waitForFunction(
        () =>
          getComputedStyle(document.querySelector(".brand-mark"))
            .outlineColor === "rgb(13, 111, 163)",
      );
    } finally {
      writeFileSync(cssPath, originalCss);
      await hmr.close();
    }
    assert.deepEqual(readFileSync(cssPath), originalCss);
    console.log(
      "PASS : A et B à 1440/768/390/320 px, animations, interactions souris/clavier/tactile, mouvement réduit, HMR, aucune requête externe ou API privée.",
    );
    console.log(`Captures : ${captures}`);
  } finally {
    await browser.close();
    await server?.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
