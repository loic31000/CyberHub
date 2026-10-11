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

test("deux parcours distincts exposent toutes les scènes demandées", () => {
  for (const page of ["a.html", "b.html"]) {
    const html = read(page);
    const anchors =
      page === "a.html"
        ? ["signal", "comprendre", "cartographier", "console"]
        : ["dossier", "recouper", "atlas", "console"];
    for (const anchor of anchors)
      assert.match(html, new RegExp(`id="${anchor}"`));
    for (const heading of [
      "<h1",
      "<h2",
      "DONNÉES FICTIVES",
      "motion-toggle",
      "data-evidence",
    ]) {
      assert.ok(html.includes(heading), `${page} manque ${heading}`);
    }
  }
  assert.match(read("index.html"), /href="\.\/a\.html"/);
  assert.match(read("index.html"), /href="\.\/b\.html"/);
  assert.equal(evidence.length, 3);
  assert.equal(signals.length, 3);
  assert.deepEqual(
    new Set(evidence.map((item) => item.id)).size,
    evidence.length,
  );
});

test("le code public et le build ne contiennent pas de client ou route privée", () => {
  const sources = [
    "index.html",
    "a.html",
    "b.html",
    "src/main.js",
    "src/fixtures.js",
    "src/styles.css",
  ];
  const built = readdirSync(join(root, "dist/assets"))
    .filter((name) => /\.(css|js)$/.test(name))
    .map((name) => `dist/assets/${name}`);
  for (const path of [
    ...sources,
    ...built,
    "dist/index.html",
    "dist/a.html",
    "dist/b.html",
  ]) {
    const text = read(path);
    assert.doesNotMatch(
      text,
      /\/api(?:\/|\b)|cyber_hub_token|Authorization|localhost:7743|fetch\(['"]https?:/i,
      path,
    );
  }
  assert.doesNotMatch(
    read("src/main.js"),
    /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/,
  );
  assert.doesNotMatch(read("src/styles.css"), /https?:\/\//);
});

test("les couleurs de texte principales atteignent le contraste AA de base", () => {
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
    [color("--b-ink"), color("--b-paper")],
    [color("--b-red"), color("--b-paper")],
    [color("--b-blue"), color("--b-paper")],
  ]) {
    assert.ok(
      contrast(foreground, background) >= 4.5,
      `${foreground} sur ${background}`,
    );
  }
});
