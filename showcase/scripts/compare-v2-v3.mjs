import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("../", import.meta.url));
const captureRoot = join(root, "captures");

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

const browser = await chromium.launch({ executablePath: browserPath() });
try {
  for (const [width, scene] of [
    [1440, "signal"],
    [390, "signal"],
    [1440, "cartographier"],
  ]) {
    const isMobile = width === 390;
    const cardWidth = isMobile ? 390 : 720;
    const sources = ["a-v2", "a-v3"].map((version) => {
      const data = readFileSync(
        join(captureRoot, version, `${width}-${scene}.png`),
      ).toString("base64");
      return `<figure><figcaption>${version.toUpperCase()} · ${width} px · ${scene}</figcaption><img src="data:image/png;base64,${data}" alt="Capture ${version} ${scene}" /></figure>`;
    });
    const page = await browser.newPage({
      viewport: { width: cardWidth * 2 + 72, height: 900 },
      deviceScaleFactor: 1,
    });
    await page.setContent(`<!doctype html><html lang="fr"><style>
      *{box-sizing:border-box}body{margin:0;padding:24px;background:#d9d3c6;color:#102023;font:700 16px Arial,sans-serif}
      main{display:grid;grid-template-columns:repeat(2,${cardWidth}px);gap:24px}
      figure{margin:0;background:#faf7ef;box-shadow:0 2px 12px #10202330}
      figcaption{padding:14px 18px;letter-spacing:.12em;text-transform:uppercase}
      img{display:block;width:100%;height:auto}
    </style><main>${sources.join("")}</main></html>`);
    await page.locator("main").screenshot({
      path: join(captureRoot, "a-v3", `comparison-v2-v3-${width}-${scene}.png`),
    });
    await page.close();
    console.log(`PASS comparison ${width} ${scene}`);
  }
} finally {
  await browser.close();
}
