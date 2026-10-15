import "./a-v2.css";

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
}

motionToggle.addEventListener("click", () => {
  manualReduction = !manualReduction;
  updateMotion();
});
reduced.addEventListener?.("change", updateMotion);
updateMotion();

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.08, rootMargin: "0px 0px -25px 0px" },
  );
  document
    .querySelectorAll(".reveal")
    .forEach((element) => observer.observe(element));
}

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
