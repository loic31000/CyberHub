import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "captures", "vision-break");
mkdirSync(output, { recursive: true });

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
  throw new Error("Chromium Playwright introuvable");
}

const browser = await chromium.launch({ executablePath: browserPath() });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
  for (const name of ["vision-board", "vision-storyboard"]) {
    await page.goto(`http://127.0.0.1:5174/research/${name}.svg`);
    await page.screenshot({ path: join(output, `${name}.png`), timeout: 90000 });
  }
  console.log("Research boards captured in captures/vision-break");
} finally {
  await browser.close();
}
