import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TextPlugin } from "gsap/TextPlugin";

gsap.registerPlugin(ScrollTrigger, TextPlugin);

function makeGuide(section, name, steps, finish, replay) {
  const guide = document.createElement("div");
  guide.className = "demo-guide product-guide";
  guide.setAttribute("role", "group");
  guide.setAttribute("aria-label", `Démonstration ${name}`);
  const heading = document.createElement("div");
  heading.className = "demo-guide-heading";
  heading.innerHTML = `<strong>DÉMONSTRATION / ${name}</strong>`;
  const count = document.createElement("span");
  count.className = "demo-guide-count";
  heading.append(count);
  const markers = document.createElement("ol");
  markers.className = "demo-guide-steps";
  markers.setAttribute("aria-hidden", "true");
  steps.forEach((_, index) => {
    const marker = document.createElement("li");
    marker.textContent = String(index + 1).padStart(2, "0");
    markers.append(marker);
  });
  const progress = document.createElement("div");
  progress.className = "demo-guide-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.append(document.createElement("span"));
  const copy = document.createElement("p");
  copy.className = "demo-guide-copy";
  const actions = document.createElement("div");
  actions.className = "demo-guide-actions";
  const skip = document.createElement("button");
  skip.type = "button";
  skip.textContent = "Voir le résultat complet";
  skip.addEventListener("click", finish);
  const again = document.createElement("button");
  again.type = "button";
  again.textContent = "Rejouer ↺";
  again.addEventListener("click", replay);
  actions.append(skip, again);
  guide.append(heading, markers, progress, copy, actions);
  const sectionHead = section.querySelector(".section-head");
  if (sectionHead) sectionHead.after(guide);
  else section.querySelector(".final-stage").before(guide);
  return {
    count,
    markers: [...markers.children],
    progress: progress.firstElementChild,
    copy,
  };
}

export function installDemo({
  section,
  name,
  steps,
  motionAllowed,
  prepare,
  final,
  build,
}) {
  const shell = section.querySelector(".product-shell, .final-stage");
  let timeline;
  let started = false;
  let complete = false;
  let currentCue = 0;

  function syncStatus() {
    const bounds = section.getBoundingClientRect();
    if (
      bounds.top > window.innerHeight * 0.65 ||
      bounds.bottom < window.innerHeight * 0.2
    )
      return;
    document.querySelector(".story-status-title").textContent =
      steps[currentCue];
  }

  function cue(index) {
    currentCue = index;
    section.dataset.productStage = String(index);
    guide.count.textContent = `${String(index + 1).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")}`;
    guide.copy.textContent = steps[index];
    guide.progress.style.width = `${((index + 1) / steps.length) * 100}%`;
    guide.markers.forEach((marker, position) =>
      marker.classList.toggle("is-current", position === index),
    );
    syncStatus();
  }

  function finish() {
    if (complete) return;
    timeline?.kill();
    timeline = undefined;
    final();
    started = true;
    complete = true;
    section.classList.add("product-complete");
    cue(steps.length - 1);
  }

  function reset() {
    timeline?.kill();
    timeline = undefined;
    gsap.killTweensOf(shell.querySelectorAll("*"));
    section.classList.remove("product-complete");
    prepare();
    started = false;
    complete = false;
    cue(0);
  }

  function start() {
    if (started) return;
    if (!motionAllowed()) return finish();
    started = true;
    timeline = build(cue);
    timeline.eventCallback("onComplete", finish);
    timeline.play(0);
  }

  function replay() {
    if (!motionAllowed()) return finish();
    reset();
    start();
  }

  const guide = makeGuide(section, name, steps, finish, replay);
  if (motionAllowed()) reset();
  else {
    prepare();
    finish();
  }

  ScrollTrigger.create({
    trigger: shell,
    endTrigger: section,
    start: "top 84%",
    end: "bottom top",
    onEnter: start,
    onEnterBack: start,
    onLeave: finish,
  });
  window.addEventListener(
    "scroll",
    () => {
      if (!started || complete) return;
      const bounds = section.getBoundingClientRect();
      if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) finish();
    },
    { passive: true },
  );
  window.addEventListener("resize", () => {
    if (started && !complete) finish();
  });
  return { finish, replay, syncStatus };
}

function correlationDemo(motionAllowed) {
  const section = document.querySelector(".relations-section");
  const $ = (selector) => section.querySelector(selector);
  const shell = $(".correlation-shell");
  const field = $(".correlation-field");
  const value = $(".correlation-value");
  const run = $(".correlation-run");
  const loading = $(".correlation-loading");
  const results = $(".correlation-results");
  const rows = [...section.querySelectorAll(".correlation-row")];
  const inspector = $(".correlation-inspector");
  const inspectorDetails = [
    ...inspector.querySelectorAll("dl > div, .correlation-limit"),
  ];
  const status = $(".correlation-module-status");
  const fullValue = value.textContent;

  function selectLine(line) {
    rows.forEach((row) =>
      row.setAttribute(
        "aria-pressed",
        String(row.dataset.line === String(line)),
      ),
    );
    $(".correlation-selected-line").textContent = `LIGNE ${line}`;
    $(".correlation-selected-time").textContent =
      line === 14 ? "09:14 · ligne 14" : "11:32 · ligne 31";
  }

  const nodes = [
    shell,
    field,
    value,
    run,
    loading,
    results,
    ...rows,
    inspector,
    ...inspectorDetails,
    status,
  ];
  function prepare() {
    gsap.set(nodes, { clearProps: "all" });
    value.textContent = "";
    selectLine(14);
    rows.forEach((row) => row.setAttribute("aria-pressed", "false"));
    gsap.set(shell, { clipPath: "inset(0 100% 0 0)" });
    gsap.set(results, { autoAlpha: 0, height: 0, overflow: "hidden" });
    gsap.set(rows, { autoAlpha: 0, x: -18 });
    gsap.set(inspector, { autoAlpha: 0, x: 28 });
    gsap.set(inspectorDetails, { autoAlpha: 0, y: 10 });
    gsap.set(status, { autoAlpha: 0 });
    gsap.set(loading, { display: "none", autoAlpha: 0 });
  }
  function final() {
    gsap.set(nodes, { clearProps: "all" });
    value.textContent = fullValue;
    selectLine(14);
    gsap.set(loading, { display: "none" });
    gsap.set(results, { height: "auto", overflow: "visible", autoAlpha: 1 });
  }
  function build(cue) {
    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: "power2.out" },
    });
    tl.addLabel("open")
      .call(() => cue(0))
      .to(shell, {
        clipPath: "inset(0 0% 0 0)",
        duration: 0.95,
        ease: "power3.inOut",
      });
    tl.addLabel("focus")
      .call(() => cue(1))
      .to(field, {
        borderColor: "#5de8f4",
        backgroundColor: "#132a38",
        duration: 0.35,
      });
    tl.addLabel("type")
      .call(() => cue(2))
      .to(value, { text: fullValue, duration: 1.4, ease: "none" })
      .to({}, { duration: 0.4 });
    tl.addLabel("analyze")
      .call(() => cue(3))
      .to(run, { scale: 0.96, duration: 0.13, yoyo: true, repeat: 1 })
      .set(loading, { display: "flex" })
      .to(loading, { autoAlpha: 1, duration: 0.3 })
      .to($(".product-spinner"), {
        rotation: 220,
        duration: 0.72,
        ease: "none",
      });
    tl.addLabel("results")
      .call(() => cue(4))
      .to(loading, { autoAlpha: 0, duration: 0.22 })
      .set(loading, { display: "none" })
      .to(results, { height: "auto", autoAlpha: 1, duration: 0.7 })
      .to(
        rows,
        { autoAlpha: 1, x: 0, stagger: 0.28, duration: 0.55 },
        "<+=0.14",
      )
      .to({}, { duration: 0.55 });
    tl.addLabel("select")
      .call(() => {
        selectLine(14);
        cue(5);
      })
      .fromTo(
        rows[0],
        { x: 0 },
        { x: 6, duration: 0.22, yoyo: true, repeat: 1 },
      );
    tl.addLabel("inspect")
      .call(() => cue(6))
      .to(inspector, { autoAlpha: 1, x: 0, duration: 0.7, ease: "power3.out" })
      .to(
        inspectorDetails,
        { autoAlpha: 1, y: 0, stagger: 0.18, duration: 0.38 },
        "<+=0.2",
      );
    tl.addLabel("limits")
      .call(() => cue(7))
      .to(status, { autoAlpha: 1, duration: 0.55 })
      .to(
        field,
        { borderColor: "#324e5f", backgroundColor: "#101b27", duration: 0.4 },
        "<",
      )
      .to({}, { duration: 0.7 });
    return tl;
  }
  const demo = installDemo({
    section,
    name: "CORRÉLATION",
    motionAllowed,
    prepare,
    final,
    build,
    steps: [
      "L'analyse ouvre son champ IP.",
      "Le champ IP est sélectionné.",
      "L'adresse de documentation est saisie.",
      "Le même journal est examiné.",
      "Deux mentions du fichier sont retrouvées.",
      "La ligne 14 est sélectionnée.",
      "Source et heure entrent dans l'inspecteur.",
      "Aucun lien externe n'est déduit.",
    ],
  });
  run.addEventListener("click", demo.finish);
  rows.forEach((row) =>
    row.addEventListener("click", () => {
      demo.finish();
      selectLine(Number(row.dataset.line));
    }),
  );
  return demo;
}

function mitreDemo(motionAllowed) {
  const section = document.querySelector(".mitre-demo");
  const $ = (selector) => section.querySelector(selector);
  const shell = $(".mitre-lab");
  const search = $(".mitre-search-box");
  const query = $(".mitre-query");
  const platforms = [...section.querySelectorAll(".mitre-platform")];
  const tactics = $(".mitre-tactic-active");
  const cards = [...section.querySelectorAll(".mitre-card")];
  const filtered = [...section.querySelectorAll(".mitre-filtered")];
  const count = $(".mitre-result-count");
  const detail = $(".mitre-detail");
  const detailParts = [
    ...detail.querySelectorAll(
      ".mitre-detail-intro, dl > div, .mitre-detail-limit",
    ),
  ];
  const fullQuery = query.textContent;
  const nodes = [
    shell,
    search,
    query,
    tactics,
    ...platforms,
    ...cards,
    count,
    detail,
    ...detailParts,
  ];

  function selectPowerShell() {
    cards[0].setAttribute("aria-pressed", "true");
    platforms.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.platform === "Windows"),
      ),
    );
  }
  function prepare() {
    gsap.set(nodes, { clearProps: "all" });
    query.textContent = "";
    count.textContent = "3 techniques dans l'extrait";
    platforms.forEach((button) => button.setAttribute("aria-pressed", "false"));
    cards[0].setAttribute("aria-pressed", "false");
    gsap.set(shell, {
      autoAlpha: 0,
      scale: 0.94,
      x: -26,
      transformOrigin: "20% 30%",
    });
    gsap.set(cards, { autoAlpha: 0, y: 14 });
    gsap.set(detail, { autoAlpha: 0, x: 32 });
    gsap.set(detailParts, { autoAlpha: 0, y: 10 });
  }
  function final() {
    gsap.set(nodes, { clearProps: "all" });
    query.textContent = fullQuery;
    count.textContent = "1 résultat pour PowerShell";
    selectPowerShell();
    gsap.set(filtered, { display: "none" });
  }
  function build(cue) {
    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: "power2.out" },
    });
    tl.addLabel("open")
      .call(() => cue(0))
      .to(shell, {
        autoAlpha: 1,
        scale: 1,
        x: 0,
        duration: 0.9,
        ease: "power3.out",
      });
    tl.addLabel("browse")
      .call(() => cue(1))
      .to(cards, { autoAlpha: 1, y: 0, stagger: 0.16, duration: 0.48 })
      .to({}, { duration: 0.55 });
    tl.addLabel("focus")
      .call(() => cue(2))
      .to(search, {
        borderColor: "#5de8f4",
        backgroundColor: "#132a38",
        duration: 0.35,
      });
    tl.addLabel("type")
      .call(() => cue(3))
      .to(query, { text: fullQuery, duration: 1.15, ease: "none" });
    tl.addLabel("filter")
      .call(() => cue(4))
      .to(filtered, {
        autoAlpha: 0,
        height: 0,
        paddingTop: 0,
        paddingBottom: 0,
        margin: 0,
        stagger: 0.12,
        duration: 0.48,
      })
      .set(filtered, { display: "none" })
      .call(() => {
        count.textContent = "1 résultat pour PowerShell";
      })
      .to({}, { duration: 0.55 });
    tl.addLabel("platform")
      .call(() => {
        selectPowerShell();
        cue(5);
      })
      .fromTo(platforms[0], { scale: 0.94 }, { scale: 1, duration: 0.28 });
    tl.addLabel("select")
      .call(() => cue(6))
      .fromTo(
        cards[0],
        { x: 0 },
        { x: 7, duration: 0.22, yoyo: true, repeat: 1 },
      );
    tl.addLabel("detail")
      .call(() => cue(7))
      .to(detail, { autoAlpha: 1, x: 0, duration: 0.72, ease: "power3.out" })
      .to(
        detailParts,
        { autoAlpha: 1, y: 0, stagger: 0.15, duration: 0.36 },
        "<+=0.18",
      )
      .to(
        search,
        { borderColor: "#324e5f", backgroundColor: "#101b27", duration: 0.4 },
        "<",
      )
      .to({}, { duration: 0.75 });
    return tl;
  }
  const demo = installDemo({
    section,
    name: "MITRE ATT&CK",
    motionAllowed,
    prepare,
    final,
    build,
    steps: [
      "La matrice des tactiques s'ouvre.",
      "La famille T1059 présente ses sous-techniques.",
      "La recherche est sélectionnée.",
      "PowerShell est saisi.",
      "La matrice ne garde que T1059.001.",
      "La plateforme Windows est retenue.",
      "PowerShell est sélectionné.",
      "La fiche distingue tactique, plateforme et source.",
    ],
  });
  cards[0].addEventListener("click", demo.finish);
  platforms.forEach((button) =>
    button.addEventListener("click", () => {
      demo.finish();
      const selected = button.dataset.platform;
      platforms.forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
      gsap.set([cards[0], detail], {
        display: selected === "Windows" ? "grid" : "none",
      });
      if (selected === "Windows") gsap.set(detail, { display: "block" });
      count.textContent =
        selected === "Windows"
          ? "1 résultat pour PowerShell"
          : `Aucun résultat pour PowerShell sur ${selected}`;
    }),
  );
  return demo;
}

export function createProductDemos({ motionAllowed }) {
  const demos = [correlationDemo(motionAllowed), mitreDemo(motionAllowed)];
  return {
    finish: () => demos.forEach((demo) => demo.finish()),
    syncStatus: () => demos.forEach((demo) => demo.syncStatus()),
  };
}
