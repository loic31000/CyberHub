import {
  clamp,
  motion,
  motionAllowed,
  prefersReducedMotion,
  sectionProgress,
} from "./motion.js";
import {
  STORY_STATES,
  interpolatePoint,
  projectAnchor,
  resolveStory,
} from "./story-engine.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const body = document.body;
const stage = $(".handoff-track");
const token = $(".handoff-token");
const command = $(".typed-command");
const results = $$(".terminal-result");
const motionControl = $(".motion-control");
let sequence = [];
let scrollFrame = 0;
let waypoints = [];
let activeState = -1;
let captionAnimations = [];

function cancelSequence() {
  sequence.forEach((item) =>
    typeof item === "number" ? clearTimeout(item) : item.cancel(),
  );
  sequence = [];
}

function showTerminalResult() {
  command.style.clipPath = "";
  results.forEach((item) => {
    item.style.opacity = "1";
  });
}

function playTerminal() {
  cancelSequence();
  showTerminalResult();
  if (!motionAllowed()) return;
  const writing = command.animate(
    [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
    {
      duration: motion.type,
      easing: `steps(${command.textContent.length}, end)`,
    },
  );
  sequence.push(writing);
  writing.onfinish = () => writing.cancel();
  results.forEach((item, index) => {
    item.style.opacity = "0";
    const timer = setTimeout(
      () => {
        const reveal = item.animate(
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: motion.result, easing: motion.ease, fill: "forwards" },
        );
        sequence.push(reveal);
        reveal.onfinish = () => {
          item.style.opacity = "1";
          reveal.cancel();
        };
      },
      motion.type + 100 + index * 480,
    );
    sequence.push(timer);
  });
}

function documentTop(selector) {
  return $(selector).getBoundingClientRect().top + window.scrollY;
}

function measureWaypoints() {
  const height = window.innerHeight;
  const stageRange = Math.max(1, stage.offsetHeight - height);
  const points = [
    0,
    documentTop(".handoff-track") + stageRange * 0.72,
    documentTop(".relations-canvas") - height * 0.52,
    documentTop(".mitre-strip") - height * 0.52,
    documentTop(".discipline-machine") - height * 0.52,
    documentTop(".investigation-work") - height * 0.52,
    documentTop(".playbook") - height * 0.52,
    documentTop(".final-constellation") - height * 0.52,
  ];
  const ordered = [];
  points.forEach((point, index) =>
    ordered.push(Math.max(index ? ordered[index - 1] + 1 : 0, point)),
  );
  waypoints = ordered;
}

function anchorPoint(state) {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    topInset:
      $(".story-header").offsetHeight + $(".story-status").offsetHeight + 18,
  };
  const mobile = viewport.width <= 760;
  const railX = viewport.width - (mobile ? 78 : 118);
  if (!state.anchor)
    return { x: railX, y: mobile ? 147 : viewport.height * 0.48 };
  return projectAnchor(
    $(state.anchor).getBoundingClientRect(),
    viewport,
    railX,
  );
}

function updateToken(story) {
  if (!motionAllowed()) {
    token.style.opacity = "0";
    delete body.dataset.tokenDock;
    return;
  }
  const from = anchorPoint(STORY_STATES[story.from]);
  const to = anchorPoint(STORY_STATES[story.to]);
  const point = interpolatePoint(from, to, story.progress);
  const thread = story.active >= 3 && story.active <= 4;
  token.dataset.role = thread ? "thread" : "case";
  token.style.transform = `translate3d(${Math.round(point.x - token.offsetWidth / 2)}px, ${Math.round(point.y - token.offsetHeight / 2)}px, 0)`;
  const started = window.scrollY > waypoints[0] + 35;
  token.style.opacity = String(started ? 1 : 0);
  const dockIndex =
    story.progress < 0.08 ? story.from : story.progress > 0.92 ? story.to : -1;
  const dockState = STORY_STATES[dockIndex];
  body.dataset.tokenDock = started && dockState?.anchor ? dockState.id : "";
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
  $$("main > section").forEach((section) =>
    section.toggleAttribute("data-scene-active", section.id === state.scene),
  );
}

function updateScroll() {
  scrollFrame = 0;
  if (!waypoints.length) measureWaypoints();
  const story = resolveStory(window.scrollY, waypoints);
  updateStoryCopy(story.active);
  const moving = motionAllowed();
  const handoff = clamp(
    -stage.getBoundingClientRect().top /
      Math.max(1, stage.offsetHeight - window.innerHeight),
  );
  stage.style.setProperty("--handoff", moving ? handoff.toFixed(3) : "1");
  $("#stage-label").textContent =
    handoff > 0.55 ? "02 / qualifier" : "01 / repérer";
  updateToken(story);
  for (const [selector, property] of [
    [".relations-section", "--relations-progress"],
    [".investigation-section", "--investigation-progress"],
    [".final-section", "--final-progress"],
  ]) {
    const node = $(selector);
    const value = moving ? sectionProgress(node).toFixed(3) : "1";
    node.style.setProperty(property, value);
    if (property === "--investigation-progress")
      $(".investigation-timeline").style.setProperty(property, value);
  }
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

const disciplines = {
  cve: {
    overline: "CVE / veille documentée",
    heading: "Voir la priorité,<br /><em>garder la source.</em>",
    description:
      "La veille CVE locale peut importer des données NVD et afficher les indicateurs CISA KEV et EPSS. Ici, trois entrées sans identifiant réel montrent comment la lecture se hiérarchise.",
    limit: "Exemple fictif · aucun score réel ni vulnérabilité évaluée.",
    transcript:
      "Vue CVE : trois bandes illustratives classées pour examen. CyberHub propose une veille locale et l'import NVD ; les valeurs ici ne proviennent d'aucune source réelle.",
  },
  osint: {
    overline: "OSINT / sources distinctes",
    heading: "Comparer les traces,<br /><em>sans les confondre.</em>",
    description:
      "CyberHub intègre une recherche de présence de pseudonymes avec WhatsMyName et un historique de tâches OSINT. Chaque résultat garde sa source et demande une vérification humaine.",
    limit:
      "Noms et sources dessinés pour la démonstration · aucune recherche lancée.",
    transcript:
      "Vue OSINT : trois pistes provenant de sources illustratives distinctes. Elles ne prouvent pas une identité commune et ne découlent pas de l'adresse du terminal.",
  },
  bgp: {
    overline: "BGP / historique de routage",
    heading: "Lire les chemins,<br /><em>dans le temps.</em>",
    description:
      "Le module BGP permet de rechercher un réseau ou un AS et de consulter son historique. Les deux lignes représentent ici des chemins fictifs à plusieurs instants.",
    limit:
      "AS64512 et AS64513 sont des numéros privés · aucun routage observé.",
    transcript:
      "Vue BGP : deux tracés fictifs évoluent de t0 à t2. Ce graphique explique un historique possible ; il ne représente pas du trafic réel ni un lien avec le terminal.",
  },
};

function selectDiscipline(name) {
  const data = disciplines[name];
  if (!data) return;
  $$(".discipline-tab").forEach((button) => {
    const selected = button.dataset.discipline === name;
    button.setAttribute("aria-pressed", String(selected));
    button.classList.toggle("is-active", selected);
  });
  $("#discipline-overline").textContent = data.overline;
  $("#discipline-heading").innerHTML = data.heading;
  $("#discipline-description").textContent = data.description;
  $("#discipline-limit").textContent = data.limit;
  $("#discipline-transcript").textContent = data.transcript;
  $$("#discipline-svg > g").forEach((group) =>
    group.toggleAttribute(
      "hidden",
      !group.classList.contains(`${name}-graphic`),
    ),
  );
  $$(".module-demo").forEach((node) => {
    node.hidden = node.dataset.demo !== name;
  });
  if (motionAllowed())
    $(".discipline-visual").animate(
      [
        { opacity: 0.35, transform: "scale(.985)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: motion.switch, easing: motion.ease },
    );
  requestScroll();
}

const mitreDetails = {
  t1059: [
    "T1059 · Interpréteur de commandes et de scripts",
    "Tactique : Exécution. Une technique peut être ouverte pour consulter son contexte ; rien dans les deux lignes fictives ne permet de l'attribuer à l'adresse.",
  ],
  t1053: [
    "T1053 · Tâche planifiée",
    "Tactique : Persistance. CyberHub permet de consulter la fiche de technique et les tactiques associées ; cet exemple n'est lié à aucun IOC du récit.",
  ],
  t1082: [
    "T1082 · Informations système",
    "Tactique : Découverte. Ce référentiel décrit des comportements possibles, pas une observation réalisée dans la démonstration.",
  ],
};
function selectTechnique(id) {
  const [title, detail] = mitreDetails[id];
  $$(".mitre-choice").forEach((button) =>
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.technique === id),
    ),
  );
  $("#mitre-detail-title").textContent = title;
  $("#mitre-detail").textContent = detail;
}

const demoDetails = {
  "cve:fiche":
    "Fiche illustrative sans identifiant CVE ni score. CyberHub affiche des fiches CVE détaillées ; cet exemple ne décrit aucune vulnérabilité réelle.",
  "cve:source":
    "Provenance à contrôler : CyberHub peut importer un JSON NVD et ouvrir la référence NVD d'une fiche. Aucune donnée NVD n'est chargée par cette page.",
  "cve:indicateurs":
    "Indicateurs disponibles dans la Console : présence dans CISA KEV et score EPSS quand ces données existent. Aucun score n'est inventé ici.",
  "osint:a":
    "Source A : mention fictive dans un annuaire de démonstration. Un résultat de pseudonyme demande toujours une vérification de provenance ; aucune recherche n'est lancée ici.",
  "osint:b":
    "Source B : variante fictive d'un pseudonyme. Une ressemblance de nom n'établit pas une identité commune.",
  "osint:c":
    "Source C : piste fictive non vérifiée. Le statut reste à confirmer à sa source ; aucune conclusion n'est produite automatiquement.",
  "bgp:t0":
    "t0 : deux chemins illustratifs sont présents pour des ASN privés. Ils ne représentent aucune observation réelle.",
  "bgp:t1":
    "t1 : le second instantané fictif diffère du premier. CyberHub Historian compare des snapshots BGP ; aucun état n'est interrogé ici.",
};
function selectDemoStep(key) {
  const detail = demoDetails[key];
  if (!detail) return;
  const [domain, step] = key.split(":");
  const panel = $(`.module-demo[data-demo="${domain}"]`);
  panel
    .querySelectorAll("button")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.demoStep === key),
      ),
    );
  panel.querySelector(".demo-detail").textContent = detail;
  $(".discipline-machine").dataset[`${domain}Step`] = step;
}

function setMotionState(stopped) {
  body.classList.toggle("motion-stopped", stopped);
  motionControl.setAttribute("aria-pressed", String(stopped));
  motionControl.textContent = stopped
    ? "Reprendre les animations"
    : "Arrêter les animations";
  if (stopped) {
    cancelSequence();
    showTerminalResult();
    captionAnimations.forEach((animation) => animation.cancel());
  } else playTerminal();
  refreshLayout();
}

body.classList.add("story-enhanced");
selectDiscipline("cve");
if (!prefersReducedMotion()) playTerminal();
$("#replay-command").addEventListener("click", () => {
  if (motionAllowed()) playTerminal();
});
motionControl.addEventListener("click", () =>
  setMotionState(!body.classList.contains("motion-stopped")),
);
window
  .matchMedia("(prefers-reduced-motion: reduce)")
  .addEventListener("change", () => {
    cancelSequence();
    showTerminalResult();
    if (motionAllowed()) playTerminal();
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
$$(".discipline-tab").forEach((button) =>
  button.addEventListener("click", () =>
    selectDiscipline(button.dataset.discipline),
  ),
);
$$(".mitre-choice").forEach((button) =>
  button.addEventListener("click", () =>
    selectTechnique(button.dataset.technique),
  ),
);
$$("[data-demo-step]").forEach((button) =>
  button.addEventListener("click", () =>
    selectDemoStep(button.dataset.demoStep),
  ),
);
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
