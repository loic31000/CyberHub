const body = document.body;
body.classList.add("js-enabled");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const motionSwitch = document.querySelector(".motion-switch");
let manualReduction = false;

function updateMotion() {
  const off = reduced.matches || manualReduction;
  body.classList.toggle("motion-off", off);
  motionSwitch.setAttribute("aria-pressed", String(off));
  motionSwitch.textContent = reduced.matches
    ? "Effets réduits par le système"
    : off
      ? "Réactiver les effets"
      : "Réduire les effets";
  motionSwitch.disabled = reduced.matches;
}
motionSwitch.addEventListener("click", () => {
  manualReduction = !manualReduction;
  updateMotion();
});
reduced.addEventListener?.("change", updateMotion);
updateMotion();

// Decorative connections follow the chapter currently being read. Text and
// controls remain present even when JavaScript or motion is unavailable.
if ("IntersectionObserver" in window) {
  const chapterObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        entry.target.classList.toggle("is-active", entry.isIntersecting);
    },
    { rootMargin: "-12% 0px -30% 0px", threshold: 0 },
  );
  document
    .querySelectorAll(".observations, .relations, .dossier")
    .forEach((chapter) => chapterObserver.observe(chapter));
}

const menuSwitch = document.querySelector(".menu-switch");
const links = document.querySelector(".site-links");
function closeMenu(returnFocus = false) {
  links.classList.remove("is-open");
  menuSwitch.setAttribute("aria-expanded", "false");
  if (returnFocus) menuSwitch.focus();
}
menuSwitch.addEventListener("click", () => {
  const open = links.classList.toggle("is-open");
  menuSwitch.setAttribute("aria-expanded", String(open));
});
links
  .querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", () => closeMenu()));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && links.classList.contains("is-open"))
    closeMenu(true);
});
matchMedia("(min-width: 781px)").addEventListener?.("change", (event) => {
  if (event.matches) closeMenu();
});

const mapNodes = [...document.querySelectorAll("[data-map-node]")];
for (const node of mapNodes) {
  node.addEventListener("click", () => {
    const title = node.dataset.detailTitle;
    for (const candidate of mapNodes) {
      const selected = candidate.dataset.detailTitle === title;
      candidate.setAttribute("aria-pressed", String(selected));
      candidate.classList.toggle("is-selected", selected);
    }
    for (const key of ["title", "source", "relation"]) {
      document.querySelector(`[data-selected-${key}]`).textContent =
        node.dataset[`detail${key[0].toUpperCase()}${key.slice(1)}`];
    }
  });
}

const methodSwitch = document.querySelector(".method-toggle");
if (methodSwitch) {
  const panel = document.getElementById(
    methodSwitch.getAttribute("aria-controls"),
  );
  methodSwitch.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    methodSwitch.setAttribute("aria-expanded", String(!panel.hidden));
  });
}

for (const sample of document.querySelectorAll("[data-kit-select]")) {
  sample.addEventListener("click", () => {
    const selected = sample.getAttribute("aria-pressed") !== "true";
    sample.setAttribute("aria-pressed", String(selected));
    sample.classList.toggle("is-selected", selected);
  });
}
