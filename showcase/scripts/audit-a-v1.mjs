import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "captures", "a-v1-audit");
mkdirSync(output, { recursive: true });
const cache = join(process.env.LOCALAPPDATA || "", "ms-playwright");
const installed = existsSync(cache)
  ? readdirSync(cache)
      .filter((name) => name.startsWith("chromium-"))
      .sort()
      .reverse()
      .map((name) => join(cache, name, "chrome-win64", "chrome.exe"))
      .find(existsSync)
  : undefined;
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  installed ||
  chromium.executablePath();
if (!existsSync(executablePath))
  throw new Error("Chromium Playwright introuvable.");
const browser = await chromium.launch({ executablePath });
const report = [];
for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://127.0.0.1:5174/a.html", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.body.classList.add("motion-off");
    document
      .querySelectorAll(".reveal")
      .forEach((el) => el.classList.add("in-view"));
  });
  await page.addStyleTag({
    content: ".skip-link:not(:focus){visibility:hidden}",
  });
  const sections = [];
  for (const id of ["signal", "comprendre", "cartographier", "console"]) {
    const locator = page.locator(`#${id}`);
    const metrics = await locator.evaluate((el) => {
      const rect = (selector) => {
        const target = el.querySelector(selector);
        if (!target) return null;
        const r = target.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          y: Math.round(r.y + scrollY),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      };
      const bounds = el.getBoundingClientRect();
      return {
        bounds: {
          x: Math.round(bounds.x),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
        },
        heading: rect("h1,h2"),
        visual: rect(".a-signal-scene,.signal-explanation,.a-map,.a-console"),
      };
    });
    sections.push({ id, ...metrics });
    if (width === 390 || width === 1440)
      await locator.screenshot({
        path: join(output, `${width}-${id}.png`),
        animations: "disabled",
      });
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: join(output, `${width}-full.png`),
    fullPage: true,
    animations: "disabled",
  });
  report.push({
    width,
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
    sections,
  });
  await page.close();
}
writeFileSync(join(output, "metrics.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
