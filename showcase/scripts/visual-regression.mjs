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
import pngjs from "pngjs";
import { createServer } from "vite";

const { PNG } = pngjs;
const root = fileURLToPath(new URL("../", import.meta.url));
const base = "http://127.0.0.1:5174";
const reference = join(root, "captures", "a-v3", "reference");
const update = process.argv.includes("--update");
const cases = [
  { width: 320, id: "signal" },
  { width: 390, id: "signal" },
  { width: 390, id: "cartographier" },
  { width: 1440, id: "signal" },
  { width: 1440, id: "cartographier" },
  { width: 1440, id: "agir" },
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
      const path = join(cache, folder, "chrome-win64", "chrome.exe");
      if (existsSync(path)) return path;
    }
  }
  const path = chromium.executablePath();
  if (existsSync(path)) return path;
  throw new Error("Chromium Playwright introuvable.");
}

function changedPixelRatio(actualBuffer, expectedBuffer) {
  const actual = PNG.sync.read(actualBuffer);
  const expected = PNG.sync.read(expectedBuffer);
  assert.equal(actual.width, expected.width, "Reference width changed");
  assert.equal(actual.height, expected.height, "Reference height changed");
  let changed = 0;
  for (let index = 0; index < actual.data.length; index += 4) {
    const delta =
      Math.abs(actual.data[index] - expected.data[index]) +
      Math.abs(actual.data[index + 1] - expected.data[index + 1]) +
      Math.abs(actual.data[index + 2] - expected.data[index + 2]);
    if (delta > 45) changed++;
  }
  return changed / (actual.width * actual.height);
}

let server;
try {
  if (!(await fetch(`${base}/a-v3.html`)).ok) throw new Error("Vite absent");
} catch {
  server = await createServer({ configFile: resolve(root, "vite.config.js") });
  await server.listen();
}
mkdirSync(reference, { recursive: true });
const browser = await chromium.launch({ executablePath: browserPath() });
try {
  for (const { width, id } of cases) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${base}/a-v3.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const actual = await page
      .locator(`#${id}`)
      .screenshot({ animations: "disabled" });
    const filename = `${width}-${id}.png`;
    const path = join(reference, filename);
    if (update) {
      writeFileSync(path, actual);
      console.log(`REFERENCE ${filename}`);
    } else {
      assert.ok(
        existsSync(path),
        `Reference missing: ${filename}; run npm run visual:update after review`,
      );
      const ratio = changedPixelRatio(actual, readFileSync(path));
      assert.ok(
        ratio <= 0.01,
        `${filename}: ${(ratio * 100).toFixed(2)}% visibly changed (limit 1%)`,
      );
      console.log(`PASS ${filename}: ${(ratio * 100).toFixed(3)}% changed`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server?.close();
}
