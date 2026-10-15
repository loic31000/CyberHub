import "./styles.css";
import { evidence, signals } from "./fixtures.js";

const body = document.body;
const reducedPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const motionButton = document.querySelector(".motion-toggle");
let manuallyReduced = false;

function applyMotionPreference() {
  const reduced = reducedPreference.matches || manuallyReduced;
  body.classList.toggle("motion-off", reduced);
  motionButton?.setAttribute("aria-pressed", String(reduced));
  if (motionButton) {
    motionButton.textContent = reducedPreference.matches
      ? "Effets réduits par le système"
      : reduced
        ? "Réactiver les effets"
        : "Réduire les effets";
    motionButton.disabled = reducedPreference.matches;
  }
  if (reduced) body.classList.remove("motion-ready");
  else if ("IntersectionObserver" in window) body.classList.add("motion-ready");
}

motionButton?.addEventListener("click", () => {
  manuallyReduced = !manuallyReduced;
  applyMotionPreference();
});
reducedPreference.addEventListener?.("change", applyMotionPreference);
applyMotionPreference();

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
  );
  document
    .querySelectorAll(".reveal")
    .forEach((element) => observer.observe(element));
}

function writeField(field, value) {
  document.querySelectorAll(`[data-${field}]`).forEach((element) => {
    element.textContent = value;
  });
}

function selectEvidence(id) {
  const item = evidence.find((candidate) => candidate.id === id);
  if (!item) return;
  document.querySelectorAll("[data-evidence]").forEach((button) => {
    const active = button.dataset.evidence === id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  for (const key of [
    "code",
    "kind",
    "title",
    "detail",
    "source",
    "confidence",
    "links",
  ]) {
    writeField(`evidence-${key}`, item[key]);
  }
  const openFile = document.querySelector(".b-open-file");
  if (openFile && !body.classList.contains("motion-off")) {
    openFile.classList.remove("file-enter");
    void openFile.offsetWidth;
    openFile.classList.add("file-enter");
  }
}

document.querySelectorAll("[data-evidence]").forEach((button) => {
  button.addEventListener("click", () =>
    selectEvidence(button.dataset.evidence),
  );
});

function selectSignal(id) {
  const item = signals.find((candidate) => candidate.id === id);
  if (!item) return;
  document.querySelectorAll("[data-signal]").forEach((button) => {
    const active = button.dataset.signal === id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  writeField("signal-label", item.label);
  for (const key of ["title", "detail", "source", "relation"]) {
    writeField(`signal-${key}`, item[key]);
  }
}

document.querySelectorAll("[data-signal]").forEach((button) => {
  button.addEventListener("click", () => selectSignal(button.dataset.signal));
});
