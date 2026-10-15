import {
  clamp,
  motion,
  motionAllowed,
  prefersReducedMotion,
  sectionProgress,
} from "./motion.js";
import { STORY_STATES, resolveStory } from "./story-engine.js";
import { createPilot } from "./pilot-gsap.js";
import { createProductDemos } from "./product-demos.js";
import { createSecondaryDemos } from "./secondary-demos.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const body = document.body;
const stage = $(".handoff-track");
const motionControl = $(".motion-control");
let scrollFrame = 0;
let waypoints = [];
let activeState = -1;
let captionAnimations = [];

function documentTop(selector) {
  return $(selector).getBoundingClientRect().top + window.scrollY;
}

function measureWaypoints() {
  const height = window.innerHeight;
  const stageRange = Math.max(1, stage.offsetHeight - height);
  const points = [
    0,
    documentTop(".handoff-track") + stageRange * 0.72,
    documentTop(".correlation-shell") - height * 0.52,
    documentTop(".mitre-demo") - height * 0.52,
    documentTop(".investigation-work") - height * 0.52,
    documentTop(".playbook") - height * 0.52,
    documentTop(".cve-shell") - height * 0.52,
    documentTop(".osint-shell") - height * 0.52,
    documentTop(".bgp-shell") - height * 0.52,
    documentTop(".final-stage") - height * 0.52,
  ];
  const ordered = [];
  points.forEach((point, index) =>
    ordered.push(Math.max(index ? ordered[index - 1] + 1 : 0, point)),
  );
  waypoints = ordered;
}

function updateStoryCopy(index) {
  if (activeState === index) return;
  activeState = index;
  const state = STORY_STATES[index];
  body.dataset.storyState = state.id;
  $(".story-status-step").textContent =
    `${String(index + 1).padStart(2, "0")} / ${String(STORY_STATES.length).padStart(2, "0")}`;
  $(".story-status-title").textContent = state.caption;
  $(".story-status-detail").textContent = state.detail;
  captionAnimations.forEach((animation) => animation.cancel());
  captionAnimations = [];
  if (motionAllowed())
    for (const node of [$(".story-status-title"), $(".story-status-detail")])
      captionAnimations.push(
        node.animate(
          [
            { opacity: 0.45, transform: "translateY(7px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: motion.switch, easing: motion.ease },
        ),
      );
  $$(".story-nav a, .mobile-nav a").forEach((link) => {
    if (link.getAttribute("href") === `#${state.scene}`)
      link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  $$(".domain-nav a").forEach((link) => {
    if (link.getAttribute("href") === `#${state.scene}`)
      link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  $$("main > section").forEach((section) =>
    section.toggleAttribute("data-scene-active", section.id === state.scene),
  );
}

function updateScroll() {
  scrollFrame = 0;
  if (!waypoints.length) measureWaypoints();
  const story = resolveStory(window.scrollY, waypoints);
  updateStoryCopy(story.active);
  pilot.syncStatus();
  productDemos.syncStatus();
  secondaryDemos.syncStatus();
  const moving = motionAllowed();
  const handoff = clamp(
    -stage.getBoundingClientRect().top /
      Math.max(1, stage.offsetHeight - window.innerHeight),
  );
  stage.style.setProperty("--handoff", moving ? handoff.toFixed(3) : "1");
  $("#stage-label").textContent =
    handoff > 0.55 ? "02 / qualifier" : "01 / repérer";
  $(".investigation-timeline").style.setProperty(
    "--investigation-progress",
    "1",
  );
  $$(".section-head").forEach((node) =>
    node.style.setProperty(
      "--scene-progress",
      moving ? sectionProgress(node).toFixed(3) : "1",
    ),
  );
  const scrollable = Math.max(
    1,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  document.documentElement.style.setProperty(
    "--page-progress",
    `${Math.round((window.scrollY / scrollable) * 100)}%`,
  );
}

function requestScroll() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
}
function refreshLayout() {
  document.documentElement.style.setProperty(
    "--story-header-height",
    `${$(".story-header").offsetHeight}px`,
  );
  document.documentElement.style.setProperty(
    "--story-status-height",
    `${$(".story-status").offsetHeight}px`,
  );
  measureWaypoints();
  requestScroll();
}

function setMotionState(stopped) {
  body.classList.toggle("motion-stopped", stopped);
  motionControl.setAttribute("aria-pressed", String(stopped));
  motionControl.textContent = stopped
    ? "Reprendre les animations"
    : "Arrêter les animations";
  if (stopped) {
    pilot.finish();
    productDemos.finish();
    captionAnimations.forEach((animation) => animation.cancel());
    secondaryDemos.finish();
  }
  refreshLayout();
}

body.classList.add("story-enhanced");
const pilot = createPilot({ motionAllowed });
const productDemos = createProductDemos({ motionAllowed });
const secondaryDemos = createSecondaryDemos({ motionAllowed });

$("#replay-command").addEventListener("click", pilot.replay);
motionControl.addEventListener("click", () =>
  setMotionState(!body.classList.contains("motion-stopped")),
);
window
  .matchMedia("(prefers-reduced-motion: reduce)")
  .addEventListener("change", () => {
    if (prefersReducedMotion()) {
      pilot.finish();
      productDemos.finish();
      secondaryDemos.finish();
    }
    refreshLayout();
  });
window.addEventListener("scroll", requestScroll, { passive: true });
window.addEventListener("resize", refreshLayout);
window.addEventListener("orientationchange", refreshLayout);
document.fonts.ready.then(refreshLayout);
if ("ResizeObserver" in window) {
  const layoutObserver = new ResizeObserver(refreshLayout);
  for (const selector of ["main", ".story-header", ".story-status"])
    layoutObserver.observe($(selector));
}
$(".attach-source").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const attached = button.getAttribute("aria-pressed") !== "true";
  button.setAttribute("aria-pressed", String(attached));
  $("#source-status").textContent = attached
    ? "Source ajoutée au dossier fictif dans cette page seulement. Aucune donnée enregistrée."
    : "Source retirée du dossier fictif. Aucune donnée enregistrée.";
});
const menu = $(".menu-control");
menu.addEventListener("click", () => {
  const opened = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(opened));
  $("#mobile-nav").hidden = !opened;
});
$$("#mobile-nav a").forEach((link) =>
  link.addEventListener("click", () => {
    menu.setAttribute("aria-expanded", "false");
    $("#mobile-nav").hidden = true;
  }),
);
refreshLayout();
