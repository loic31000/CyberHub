import {
  clamp,
  motion,
  motionAllowed,
  prefersReducedMotion,
  sectionProgress,
} from "./motion.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const body = document.body;
const stage = $(".handoff-track");
const sticky = $(".handoff-sticky");
const token = $(".handoff-token");
const source = $(".source-ip");
const target = $(".ioc-target");
const command = $(".typed-command");
const results = $$(".terminal-result");
const replay = $("#replay-command");
const motionControl = $(".motion-control");
let sequence = [];
let scrollFrame = 0;

function cancelSequence() {
  sequence.forEach((item) => {
    if (typeof item === "number") clearTimeout(item);
    else item.cancel();
  });
  sequence = [];
}

function playTerminal() {
  cancelSequence();
  command.style.clipPath = "";
  results.forEach((item) => (item.style.opacity = ""));
  if (!motionAllowed()) return;

  const writing = command.animate(
    [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
    {
      duration: motion.type,
      easing: `steps(${command.textContent.length}, end)`,
    },
  );
  sequence.push(writing);
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
  writing.onfinish = () => writing.cancel();
}

function positionToken(progress) {
  if (!motionAllowed() || progress < 0.12 || progress > 0.89 || !sticky) {
    token.style.opacity = "0";
    return;
  }
  const frame = sticky.getBoundingClientRect();
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const travel = clamp((progress - 0.12) / 0.77);
  const smooth = travel * travel * (3 - 2 * travel);
  const left = from.left + (to.left - from.left) * smooth - frame.left;
  const top =
    from.top +
    (to.top - from.top) * smooth -
    frame.top -
    4 -
    Math.sin(travel * Math.PI) * 24;
  token.style.transform = `translate(${left}px,${top}px)`;
  token.style.opacity = String(clamp(Math.min(travel * 10, (1 - travel) * 10)));
}

function updateScroll() {
  scrollFrame = 0;
  const progress = clamp(
    -stage.getBoundingClientRect().top /
      Math.max(1, stage.offsetHeight - window.innerHeight),
  );
  const moving = motionAllowed();
  stage.style.setProperty("--handoff", moving ? progress.toFixed(3) : "1");
  $("#stage-label").textContent =
    progress > 0.55 ? "02 / qualifier" : "01 / repérer";
  positionToken(progress);
  $(".relations-section").style.setProperty(
    "--relations-progress",
    moving ? sectionProgress($(".relations-section")).toFixed(3) : "1",
  );
  $(".investigation-timeline").style.setProperty(
    "--investigation-progress",
    moving ? sectionProgress($(".investigation-section")).toFixed(3) : "1",
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
  $$("#discipline-svg > g").forEach((group) => {
    group.toggleAttribute(
      "hidden",
      !group.classList.contains(`${name}-graphic`),
    );
  });
  const visual = $(".discipline-visual");
  if (motionAllowed())
    visual.animate(
      [
        { opacity: 0.35, transform: "scale(.985)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: motion.switch, easing: motion.ease },
    );
}

function setMotionState(stopped) {
  body.classList.toggle("motion-stopped", stopped);
  motionControl.setAttribute("aria-pressed", String(stopped));
  motionControl.textContent = stopped
    ? "Reprendre les animations"
    : "Arrêter les animations";
  if (stopped) {
    cancelSequence();
    command.style.clipPath = "";
    results.forEach((item) => (item.style.opacity = "1"));
  } else playTerminal();
  requestScroll();
}

body.classList.add("story-enhanced");
if (!prefersReducedMotion()) playTerminal();
replay.addEventListener("click", () => {
  if (motionAllowed()) playTerminal();
});
motionControl.addEventListener("click", () =>
  setMotionState(!body.classList.contains("motion-stopped")),
);
window
  .matchMedia("(prefers-reduced-motion: reduce)")
  .addEventListener("change", () => {
    cancelSequence();
    command.style.clipPath = "";
    results.forEach((item) => (item.style.opacity = "1"));
    if (motionAllowed()) playTerminal();
    requestScroll();
  });
window.addEventListener("scroll", requestScroll, { passive: true });
window.addEventListener("resize", requestScroll);
$$(".discipline-tab").forEach((button) =>
  button.addEventListener("click", () =>
    selectDiscipline(button.dataset.discipline),
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
requestScroll();
