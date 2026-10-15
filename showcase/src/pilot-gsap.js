import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TextPlugin } from "gsap/TextPlugin";

gsap.registerPlugin(Flip, ScrollTrigger, TextPlugin);

const narration = [
  "Un terminal fictif s'ouvre ; aucune commande n'est exécutée.",
  "La recherche s'écrit dans le journal d'exemple.",
  "Deux lignes apparaissent, chacune avec sa provenance.",
  "L'adresse de documentation est sélectionnée.",
  "Un curseur illustre la copie de la valeur.",
  "IOC Manager s'ouvre à côté du terminal.",
  "La même valeur traverse les deux interfaces.",
  "Une validation fictive reconnaît le type IPv4.",
  "Source et contexte complètent la fiche.",
  "Les inconnues restent visibles dans la fiche finale.",
];

function makeGuide(stage, onSkip, onReplay) {
  const guide = document.createElement("div");
  guide.className = "demo-guide pilot-guide";
  guide.setAttribute("role", "group");
  guide.setAttribute("aria-label", "Démonstration Terminal vers IOC Manager");

  const heading = document.createElement("div");
  heading.className = "demo-guide-heading";
  const name = document.createElement("strong");
  name.textContent = "DÉMONSTRATION / TERMINAL → IOC MANAGER";
  const count = document.createElement("span");
  count.className = "demo-guide-count";
  heading.append(name, count);

  const markers = document.createElement("ol");
  markers.className = "demo-guide-steps";
  markers.setAttribute("aria-hidden", "true");
  narration.forEach((_, index) => {
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
  skip.addEventListener("click", onSkip);
  const replay = document.createElement("button");
  replay.type = "button";
  replay.textContent = "Rejouer ↺";
  replay.addEventListener("click", onReplay);
  actions.append(skip, replay);
  guide.append(heading, markers, progress, copy, actions);
  stage.querySelector(".hero-heading").after(guide);

  return {
    count,
    copy,
    markers: [...markers.children],
    progress: progress.firstElementChild,
  };
}

export function createPilot({ motionAllowed }) {
  const stage = document.querySelector(".handoff-track");
  const terminal = stage.querySelector(".terminal-window");
  const ioc = stage.querySelector(".ioc-workspace");
  const command = stage.querySelector(".typed-command");
  const commandText = command.textContent;
  const caret = stage.querySelector(".terminal-caret");
  const results = [...stage.querySelectorAll(".terminal-result")];
  const source = stage.querySelector(".source-ip");
  const copyNote = stage.querySelector(".terminal-copy-note");
  const terminalEnd = stage.querySelector(".terminal-end");
  const placeholder = stage.querySelector(".ioc-placeholder");
  const field = stage.querySelector(".ioc-value-line");
  const target = stage.querySelector(".ioc-target");
  const confirm = stage.querySelector(".ioc-confirm");
  const save = stage.querySelector(".ioc-save");
  const type = stage.querySelector(".ioc-type");
  const facts = [...stage.querySelectorAll(".ioc-facts > div")];
  const footnote = stage.querySelector(".ioc-footnote");

  // The value is one real DOM node. Flip moves it between the source and the
  // IOC field; the original source and accessible IOC text stay in the HTML.
  const chip = document.createElement("span");
  chip.className = "pilot-shared-chip";
  chip.textContent = source.textContent;
  chip.setAttribute("aria-hidden", "true");
  source.append(chip);

  const pointer = document.createElement("span");
  pointer.className = "pilot-pointer";
  pointer.setAttribute("aria-hidden", "true");
  pointer.innerHTML =
    '<svg viewBox="0 0 34 42" focusable="false"><path d="M3 2v31l8-8 6 14 6-3-6-13h12z"/><path d="M3 2v31l8-8 6 14 6-3-6-13h12z"/></svg>';
  document.body.append(pointer);

  let timeline;
  let flip;
  let started = false;
  let complete = false;
  let finishing = false;
  let guide;
  let currentCue = 0;

  function syncStatus() {
    const bounds = stage.getBoundingClientRect();
    if (bounds.top >= window.innerHeight || bounds.bottom <= 0) return;
    document.querySelector(".story-status-title").textContent =
      narration[currentCue];
  }

  function cue(index, label) {
    currentCue = index;
    stage.dataset.pilotState = label;
    guide.count.textContent = `${String(index + 1).padStart(2, "0")} / ${narration.length}`;
    guide.copy.textContent = narration[index];
    guide.progress.style.width = `${((index + 1) / narration.length) * 100}%`;
    guide.markers.forEach((marker, position) =>
      marker.classList.toggle("is-current", position === index),
    );
    syncStatus();
  }

  guide = makeGuide(stage, finish, replay);

  const point = (node, horizontal = 0.5, vertical = 0.5) => {
    const box = node.getBoundingClientRect();
    return {
      x: box.left + box.width * horizontal,
      y: box.top + box.height * vertical,
    };
  };
  const resetNodes = [
    terminal,
    ioc,
    command,
    caret,
    ...results,
    source,
    copyNote,
    terminalEnd,
    placeholder,
    target,
    confirm,
    save,
    type,
    ...facts,
    footnote,
    chip,
    pointer,
  ];

  function stopAnimations() {
    finishing = true;
    timeline?.kill();
    flip?.kill();
    gsap.killTweensOf(resetNodes);
    timeline = undefined;
    flip = undefined;
  }

  function prepare() {
    stopAnimations();
    if (chip.parentNode !== source) source.append(chip);
    gsap.set(resetNodes, { clearProps: "all" });
    command.textContent = "";
    gsap.set(terminal, { autoAlpha: 0, y: 42, scale: 0.95, rotation: -2 });
    gsap.set(ioc, { autoAlpha: 0, x: 56, scale: 0.94 });
    gsap.set([...results, copyNote, terminalEnd], { autoAlpha: 0, y: 12 });
    gsap.set([target, confirm, save, type, ...facts, footnote], {
      autoAlpha: 0,
      y: 10,
    });
    gsap.set(placeholder, { display: "inline", autoAlpha: 1 });
    gsap.set(chip, { autoAlpha: 0 });
    gsap.set(pointer, { autoAlpha: 0 });
    document.body.classList.remove("pilot-complete");
    cue(0, "ready");
    started = false;
    complete = false;
    finishing = false;
  }

  function showFinal() {
    stopAnimations();
    if (chip.parentNode !== field) field.insertBefore(chip, target);
    gsap.set(resetNodes, { clearProps: "all" });
    command.textContent = commandText;
    gsap.set(placeholder, { display: "none" });
    gsap.set([chip, pointer], { autoAlpha: 0 });
    gsap.set(
      [
        terminal,
        ioc,
        ...results,
        copyNote,
        terminalEnd,
        target,
        confirm,
        save,
        type,
        ...facts,
        footnote,
      ],
      {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1,
      },
    );
    gsap.set(source, { clearProps: "backgroundColor,color,boxShadow" });
    stage.dataset.pilotState = "complete";
    document.body.classList.add("pilot-complete");
    cue(narration.length - 1, "complete");
    started = true;
    complete = true;
  }

  function finish() {
    if (!complete) showFinal();
  }

  function makeTimeline() {
    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: "power2.out" },
      onComplete: () => {
        complete = true;
        document.body.classList.add("pilot-complete");
        gsap.set([pointer, chip], { autoAlpha: 0 });
        cue(narration.length - 1, "complete");
      },
    });

    tl.addLabel("terminal")
      .call(() => cue(0, "terminal"))
      .to(terminal, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        rotation: -1,
        duration: 0.9,
        ease: "power3.out",
      });

    tl.addLabel("typing")
      .call(() => cue(1, "typing"))
      .to(
        command,
        { text: commandText, duration: 1.85, ease: "none" },
        "typing+=0.12",
      )
      .to(
        caret,
        { opacity: 0.2, duration: 0.17, repeat: 5, yoyo: true },
        "typing",
      );

    tl.addLabel("results")
      .call(() => cue(2, "results"))
      .to(results[0], { autoAlpha: 1, y: 0, duration: 0.52 })
      .to(results[1], { autoAlpha: 1, y: 0, duration: 0.52 }, "+=0.24")
      .to(terminalEnd, { autoAlpha: 1, y: 0, duration: 0.35 }, "<");

    tl.addLabel("selection")
      .call(() => cue(3, "selection"))
      .fromTo(
        pointer,
        {
          autoAlpha: 0,
          x: () => point(terminal, 0.83, 0.08).x,
          y: () => point(terminal, 0.83, 0.08).y,
        },
        {
          autoAlpha: 1,
          x: () => point(source, 0.85, 0.5).x,
          y: () => point(source, 0.85, 0.5).y,
          duration: 0.82,
          ease: "power2.inOut",
        },
      )
      .to(source, {
        backgroundColor: "#b8fdff",
        color: "#091922",
        boxShadow: "0 0 0 3px #3a8799",
        duration: 0.25,
      })
      .to(chip, { autoAlpha: 1, duration: 0.2 }, "<");

    tl.addLabel("copy")
      .call(() => cue(4, "copy"))
      .to(pointer, { scale: 0.8, duration: 0.12, repeat: 1, yoyo: true })
      .to(copyNote, { autoAlpha: 1, y: 0, duration: 0.38 });

    tl.addLabel("ioc")
      .call(() => cue(5, "ioc"))
      .to(ioc, {
        autoAlpha: 1,
        x: 0,
        scale: 1,
        duration: 0.95,
        ease: "power3.out",
      })
      .to(terminal, { x: -12, scale: 0.98, duration: 0.75 }, "<");

    tl.addLabel("transfer")
      .call(() => cue(6, "transfer"))
      .to(placeholder, { autoAlpha: 0, duration: 0.18 })
      .call(() => {
        const state = Flip.getState(chip);
        field.insertBefore(chip, target);
        tl.pause();
        flip = Flip.from(state, {
          absolute: true,
          scale: true,
          duration: 1.1,
          ease: "power2.inOut",
          onComplete: () => {
            flip = undefined;
            if (!finishing) tl.resume();
          },
        });
      })
      .to(chip, { autoAlpha: 0, duration: 0.22 })
      .to(target, { autoAlpha: 1, y: 0, duration: 0.28 }, "<");

    tl.addLabel("validation")
      .call(() => cue(7, "validation"))
      .to(pointer, {
        x: () => point(confirm).x,
        y: () => point(confirm).y,
        duration: 0.6,
        ease: "power2.inOut",
      })
      .to(pointer, { scale: 0.82, duration: 0.12, repeat: 1, yoyo: true })
      .to(confirm, { autoAlpha: 1, y: 0, scale: 1.2, duration: 0.28 })
      .to(confirm, { scale: 1, duration: 0.24 })
      .to([type, facts[0], save], {
        autoAlpha: 1,
        y: 0,
        stagger: 0.2,
        duration: 0.48,
      });

    tl.addLabel("context")
      .call(() => cue(8, "context"))
      .to([facts[1], facts[2]], {
        autoAlpha: 1,
        y: 0,
        stagger: 0.38,
        duration: 0.5,
      });

    tl.addLabel("complete")
      .call(() => cue(9, "complete"))
      .to([facts[3], footnote], {
        autoAlpha: 1,
        y: 0,
        stagger: 0.24,
        duration: 0.52,
      })
      .to(pointer, { autoAlpha: 0, duration: 0.25 }, "<")
      .to(terminal, { x: 0, scale: 1, duration: 0.58 }, "<");

    return tl;
  }

  function start() {
    if (started) return;
    if (!motionAllowed()) {
      finish();
      return;
    }
    started = true;
    timeline = makeTimeline();
    timeline.play(0);
  }

  function replay() {
    if (!motionAllowed()) {
      finish();
      return;
    }
    prepare();
    start();
  }

  document.body.classList.add("pilot-enhanced");
  if (motionAllowed()) prepare();
  else showFinal();

  ScrollTrigger.create({
    trigger: terminal,
    endTrigger: stage,
    start: "top 85%",
    end: "bottom top",
    onEnter: start,
    onEnterBack: start,
    onLeave: finish,
  });
  window.addEventListener(
    "scroll",
    () => {
      if (!started || complete) return;
      const bounds = stage.getBoundingClientRect();
      if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) finish();
    },
    { passive: true },
  );
  window.addEventListener("resize", () => {
    if (started && !complete) finish();
  });

  return {
    start,
    replay,
    finish,
    syncStatus,
    get complete() {
      return complete;
    },
  };
}
