import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import test from "node:test";
import { evidence, signals } from "../src/fixtures.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

function contrast(foreground, background) {
  const luminance = (hex) => {
    const [red, green, blue] = hex
      .match(/../g)
      .map((part) => parseInt(part, 16) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("A V1 et ses données synthétiques restent disponibles", () => {
  const html = read("a.html");
  for (const anchor of ["signal", "comprendre", "cartographier", "console"])
    assert.match(html, new RegExp(`id="${anchor}"`));
  for (const heading of [
    "<h1",
    "<h2",
    "DONNÉES FICTIVES",
    "motion-toggle",
    "data-evidence",
  ])
    assert.ok(html.includes(heading), `A V1 manque ${heading}`);
  assert.match(read("index.html"), /href="\.\/a\.html"/);
  assert.equal(evidence.length, 3);
  assert.equal(signals.length, 3);
  assert.equal(new Set(evidence.map((item) => item.id)).size, evidence.length);
});

test("A V2 garde son scénario fictif et ses quatre actes", () => {
  const html = read("a-v2.html");
  for (const anchor of ["signal", "comprendre", "cartographier", "agir"])
    assert.match(html, new RegExp(`id="${anchor}"`));
  assert.match(read("index.html"), /href="\.\/a-v2\.html"/);
  assert.match(html, /198\.51\.100\.42/g);
  assert.match(html, /Note A \+ Note B/);
  assert.match(html, /DÉMONSTRATION FICTIVE/);
  assert.match(html, /class="map-list"/);
  assert.match(html, /class="relation-map"/);
});

test("A V3 garde son parcours et son style sans JavaScript", () => {
  const html = read("a-v3.html");
  for (const anchor of ["signal", "comprendre", "cartographier", "agir"])
    assert.match(html, new RegExp(`id="${anchor}"`));
  assert.match(read("index.html"), /href="\.\/a-v3\.html"/);
  assert.match(html, /198\.51\.100\.42/g);
  assert.match(html, /href="\/src\/a-v3\.css"/);
  assert.match(html, /class="reading-track"/);
  assert.match(html, /class="map-list"/);
});

test("le laboratoire ne référence plus les explorations rejetées", () => {
  for (const path of [
    "index.html",
    "a.html",
    "a-v2.html",
    "a-v3.html",
    "vite.config.js",
    "package.json",
  ])
    assert.doesNotMatch(
      read(path),
      /b\.html|atelier-traces|topologie-indices|test:directions/i,
      path,
    );
});

test("le code public et le build ne contiennent pas de client ou route privée", () => {
  const sources = [
    "index.html",
    "a.html",
    "a-v2.html",
    "a-v3.html",
    "src/lab.css",
    "src/main.js",
    "src/a-v2.js",
    "src/a-v3.js",
    "src/fixtures.js",
    "src/styles.css",
    "src/a-v2.css",
    "src/a-v3.css",
    "terminal-story.html",
    "src/terminal-story.js",
    "src/terminal-story.css",
    "src/motion.js",
    "src/story-engine.js",
  ];
  const built = readdirSync(join(root, "dist/assets"))
    .filter((name) => /\.(css|js)$/.test(name))
    .map((name) => `dist/assets/${name}`);
  for (const path of [
    ...sources,
    ...built,
    "dist/index.html",
    "dist/a.html",
    "dist/a-v2.html",
    "dist/a-v3.html",
    "dist/terminal-story.html",
  ]) {
    assert.doesNotMatch(
      read(path),
      /\/api(?:\/|\b)|cyber_hub_token|Authorization|localhost:7743|fetch\(['"]https?:/i,
      path,
    );
  }
  for (const script of [
    "src/main.js",
    "src/a-v2.js",
    "src/a-v3.js",
    "src/terminal-story.js",
  ])
    assert.doesNotMatch(
      read(script),
      /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/,
      script,
    );
  for (const css of [
    "src/lab.css",
    "src/styles.css",
    "src/a-v2.css",
    "src/a-v3.css",
    "src/terminal-story.css",
  ])
    assert.doesNotMatch(read(css), /https?:\/\//, css);
});

test("le récit terminal conserve ses six étapes et ses alternatives textuelles", () => {
  const html = read("terminal-story.html");
  assert.match(read("index.html"), /href="\.\/terminal-story\.html"/);
  for (const id of [
    "terminal",
    "ioc",
    "relations",
    "disciplines",
    "investigation",
    "decouvrir",
  ])
    assert.match(html, new RegExp(`id="${id}"`));
  const plainText = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  for (const text of [
    "198.51.100.42",
    "transcription",
    "Simulation illustrative",
    "aucune commande réellement exécutée",
    "aucune API privée",
  ])
    assert.ok(plainText.includes(text), `mention absente: ${text}`);
  assert.match(html, /<noscript\b/);
  assert.match(read("src/terminal-story.css"), /prefers-reduced-motion/);
});

test("les couleurs structurantes de A V1 gardent le contraste AA", () => {
  const css = read("src/styles.css");
  const color = (token) => {
    const match = css.match(new RegExp(`${token}:\\s*#([0-9a-f]{6})`, "i"));
    assert.ok(match, `token ${token} absent`);
    return match[1];
  };
  for (const [foreground, background] of [
    [color("--paper"), color("--ink")],
    [color("--copper"), color("--ink")],
    [color("--mist"), color("--ink")],
  ])
    assert.ok(contrast(foreground, background) >= 4.5);
});
