document.body.classList.add("js-enabled");

const details = {
  a: {
    index: "01 / NOTE A",
    title: "La première mention.",
    text: "À 09:14, une note fictive consigne 198.51.100.42. Cette observation seule ne permet aucune conclusion.",
    source: "Carnet fictif A, 09:14",
    relation: "La note A cite l’adresse ; elle ne décrit pas sa cause.",
    edges: ["a"],
  },
  b: {
    index: "02 / NOTE B",
    title: "Une seconde mention.",
    text: "À 11:32, la note B cite la même adresse. Son contexte reste partiel ; comparer les notes peut éclairer la piste.",
    source: "Carnet fictif B, 11:32",
    relation: "La note B cite l’adresse ; aucun lien causal n’est établi.",
    edges: ["b"],
  },
  address: {
    index: "FIL COMMUN / 021",
    title: "Une adresse partagée.",
    text: "198.51.100.42 apparaît dans les deux notes fictives. Cette répétition mérite un examen, mais ne dit rien à elle seule de la cause.",
    source: "Notes A et B, créées pour cette démonstration",
    relation: "Mention commune, sans attribution",
    edges: ["a", "b"],
  },
  hypothesis: {
    index: "03 / HYPOTHÈSE",
    title: "Une question, pas un verdict.",
    text: "Les deux notes décrivent-elles le même événement ? Il faut d’abord comparer leur provenance et leur période.",
    source: "Question formulée à partir des notes A et B",
    relation: "Hypothèse ouverte, à vérifier manuellement",
    edges: ["hypothesis"],
  },
};

const body = document.body;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const motionToggle = document.querySelector(".motion-toggle");
let manualReduction = false;

function updateMotion() {
  const off = reduced.matches || manualReduction;
  body.classList.toggle("motion-off", off);
  body.classList.toggle(
    "motion-ready",
    !off && "IntersectionObserver" in window,
  );
  motionToggle.setAttribute("aria-pressed", String(off));
  motionToggle.textContent = reduced.matches
    ? "Effets réduits par le système"
    : off
      ? "Réactiver les effets"
      : "Réduire les effets";
  motionToggle.disabled = reduced.matches;
  scheduleReadingUpdate();
}

motionToggle.addEventListener("click", () => {
  manualReduction = !manualReduction;
  updateMotion();
});
reduced.addEventListener?.("change", updateMotion);

// A single scroll frame updates the decorative reading line and each scene.
// The story, labels and controls remain in the DOM without this enhancement.
const scenes = [...document.querySelectorAll("main section[id]")];
const mapPaths = [...document.querySelectorAll(".map-edges path")];
const consolePath = document.querySelector(".console-trace-active");
const progressPaths = [...mapPaths, consolePath];
const pathLengths = new Map(
  progressPaths.map((path) => [path, path.getTotalLength()]),
);
for (const path of progressPaths) {
  const length = pathLengths.get(path);
  path.style.strokeDasharray = `${length} ${length}`;
}
let framePending = false;
function clamp(value) {
  return Math.min(1, Math.max(0, value));
}
function updateReading() {
  framePending = false;
  const motionOff = body.classList.contains("motion-off");
  const available = Math.max(
    1,
    document.documentElement.scrollHeight - innerHeight,
  );
  const reading = motionOff ? 1 : clamp(scrollY / available);
  body.style.setProperty("--read-progress", reading.toFixed(3));
  for (const scene of scenes) {
    const box = scene.getBoundingClientRect();
    const progress = motionOff
      ? 1
      : clamp(
          (innerHeight * 0.82 - box.top) /
            (box.height * 0.72 + innerHeight * 0.18),
        );
    scene.style.setProperty("--scene-progress", progress.toFixed(3));
    if (scene.id === "cartographier") {
      for (const path of mapPaths)
        path.style.strokeDashoffset = String(
          pathLengths.get(path) * (1 - progress),
        );
    }
    if (scene.id === "agir")
      consolePath.style.strokeDashoffset = String(
        pathLengths.get(consolePath) * (1 - progress),
      );
  }
  const hero = scenes[0].getBoundingClientRect();
  const evidence = motionOff
    ? 1
    : clamp((innerHeight * 0.72 - hero.top) / Math.max(1, hero.height * 0.7));
  body.style.setProperty("--evidence-progress", evidence.toFixed(3));
}
function scheduleReadingUpdate() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(updateReading);
}
addEventListener("scroll", scheduleReadingUpdate, { passive: true });
addEventListener("resize", scheduleReadingUpdate);
updateMotion();

const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".site-nav");
function closeMenu(restoreFocus = false) {
  navigation.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  if (restoreFocus) menuToggle.focus();
}
menuToggle.addEventListener("click", () => {
  const open = navigation.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
navigation
  .querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", () => closeMenu()));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && navigation.classList.contains("is-open"))
    closeMenu(true);
});
window
  .matchMedia("(min-width: 801px)")
  .addEventListener?.("change", (event) => {
    if (event.matches) closeMenu();
  });

function selectNode(id) {
  const item = details[id];
  if (!item) return;
  for (const key of ["index", "title", "text", "source", "relation"]) {
    document.querySelector(`[data-detail-${key}]`).textContent = item[key];
  }
  document.querySelectorAll("[data-node]").forEach((element) => {
    const active = element.dataset.node === id;
    element.setAttribute("aria-pressed", String(active));
    element.classList.toggle("is-active", active);
  });
  document
    .querySelectorAll("[data-edge]")
    .forEach((edge) =>
      edge.classList.toggle(
        "is-highlighted",
        item.edges.includes(edge.dataset.edge),
      ),
    );
  document.querySelector("[data-selection-status]").textContent =
    `${item.title} ${item.relation}`;
}
document.querySelectorAll("[data-node]").forEach((element) => {
  element.addEventListener("click", () => selectNode(element.dataset.node));
  if (element.namespaceURI === "http://www.w3.org/2000/svg") {
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectNode(element.dataset.node);
    });
  }
});

const methodButton = document.querySelector(".console-action");
const methodPanel = document.querySelector("#method-panel");
methodButton.addEventListener("click", () => {
  const open = methodPanel.hidden;
  methodPanel.hidden = !open;
  methodButton.setAttribute("aria-expanded", String(open));
  methodButton.firstChild.textContent = open
    ? "Masquer la méthode "
    : "Voir la méthode ";
});
