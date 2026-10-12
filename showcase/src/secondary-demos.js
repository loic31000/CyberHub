import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { TextPlugin } from "gsap/TextPlugin";
import { installDemo } from "./product-demos.js";

gsap.registerPlugin(Flip, TextPlugin);

function scene(selector, name, steps, motionAllowed, setup) {
  const section = document.querySelector(selector);
  const $ = (query) => section.querySelector(query);
  const $$ = (query) => [...section.querySelectorAll(query)];
  const handlers = setup({ section, $, $$ });
  return installDemo({ section, name, steps, motionAllowed, ...handlers });
}

function cveDemo(motionAllowed) {
  const demo = scene(
    ".disciplines-section",
    "CVE & KEV",
    [
      "Trois entrées fictives arrivent dans la veille.",
      "La recherche saisit « serveur ».",
      "Le filtre Critique est choisi.",
      "CH-VEILLE-02 remonte dans la liste.",
      "La fiche sélectionnée s'ouvre.",
      "La provenance et les inconnues restent visibles.",
    ],
    motionAllowed,
    ({ $, $$ }) => {
      const shell = $(".cve-shell");
      const index = $(".cve-index");
      const rows = $$(".cve-row");
      const primary = $(".cve-primary");
      const secondary = $$(".cve-secondary");
      const query = $(".cve-query");
      const filter = $(".cve-severity");
      const count = $(".cve-result-count");
      const inspector = $(".cve-inspector");
      const title = inspector.querySelector("h3");
      const fullQuery = query.textContent;
      const text = [
        "Une entrée fictive sert à montrer l'ordre de lecture : qualifier, documenter, puis vérifier la source.",
        "Cette entrée synthétique montre une mise à jour de client sans donnée externe vérifiée.",
        "Cette entrée synthétique montre une configuration serveur à examiner.",
      ];
      function select(row) {
        rows.forEach((item) =>
          item.setAttribute("aria-pressed", String(item === row)),
        );
        title.textContent = `CH-VEILLE-${row.dataset.entry}`;
        inspector.querySelector(".cve-inspector-intro").textContent =
          row === primary
            ? text[0]
            : row.dataset.entry === "01"
              ? text[1]
              : text[2];
      }
      function prepare() {
        gsap.set([shell, rows, inspector], { clearProps: "all" });
        index.append(rows[0], rows[1], rows[2]);
        query.textContent = "";
        filter.setAttribute("aria-pressed", "false");
        filter.firstChild.textContent = "TOUTES SÉVÉRITÉS ";
        count.textContent = "3 entrées illustratives";
        select(primary);
        gsap.set(rows, { autoAlpha: 0, x: -18 });
        gsap.set(inspector, { clipPath: "inset(0 0 0 100%)" });
      }
      function final() {
        gsap.killTweensOf(rows);
        gsap.set([shell, rows, inspector, query, filter], {
          clearProps: "all",
        });
        index.insertBefore(primary, rows[0]);
        gsap.set(secondary, { display: "none" });
        query.textContent = fullQuery;
        filter.setAttribute("aria-pressed", "true");
        filter.firstChild.textContent = "CRITIQUE ";
        count.textContent = "1 entrée illustrative";
        select(primary);
      }
      function build(cue) {
        const tl = gsap.timeline({
          paused: true,
          defaults: { ease: "power2.out" },
        });
        tl.addLabel("index")
          .call(() => cue(0))
          .to(rows, { autoAlpha: 1, x: 0, stagger: 0.12, duration: 0.46 });
        tl.addLabel("search")
          .call(() => cue(1))
          .to(query, { text: fullQuery, duration: 1.0, ease: "none" })
          .to({}, { duration: 0.4 });
        tl.addLabel("severity")
          .call(() => {
            cue(2);
            filter.setAttribute("aria-pressed", "true");
            filter.firstChild.textContent = "CRITIQUE ";
          })
          .fromTo(filter, { scale: 0.92 }, { scale: 1, duration: 0.33 })
          .to({}, { duration: 0.35 });
        tl.addLabel("reorder")
          .call(() => {
            cue(3);
            const state = Flip.getState(rows);
            index.insertBefore(primary, rows[0]);
            Flip.from(state, { duration: 0.65, ease: "power2.inOut" });
          })
          .to(
            secondary,
            {
              autoAlpha: 0,
              height: 0,
              paddingTop: 0,
              paddingBottom: 0,
              duration: 0.5,
              stagger: 0.1,
            },
            "+=0.2",
          )
          .set(secondary, { display: "none" })
          .call(() => {
            count.textContent = "1 entrée illustrative";
          })
          .to({}, { duration: 0.55 });
        tl.addLabel("select")
          .call(() => cue(4))
          .fromTo(primary, { x: -12 }, { x: 0, duration: 0.35 });
        tl.addLabel("provenance")
          .call(() => cue(5))
          .to(inspector, {
            clipPath: "inset(0 0 0 0%)",
            duration: 0.72,
            ease: "power3.inOut",
          })
          .to({}, { duration: 0.75 });
        return tl;
      }
      rows.forEach((row) =>
        row.addEventListener("click", () => {
          demo.finish();
          if (row !== primary) {
            gsap.set(rows, {
              display: "grid",
              autoAlpha: 1,
              height: "auto",
              clearProps: "paddingTop,paddingBottom",
            });
            count.textContent = "3 entrées illustratives";
            filter.setAttribute("aria-pressed", "false");
            filter.firstChild.textContent = "TOUTES SÉVÉRITÉS ";
          }
          select(row);
        }),
      );
      filter.addEventListener("click", () => {
        demo.finish();
        const filtered = filter.getAttribute("aria-pressed") !== "true";
        filter.setAttribute("aria-pressed", String(filtered));
        filter.firstChild.textContent = filtered
          ? "CRITIQUE "
          : "TOUTES SÉVÉRITÉS ";
        gsap.set(secondary, { display: filtered ? "none" : "grid" });
        count.textContent = filtered
          ? "1 entrée illustrative"
          : "3 entrées illustratives";
      });
      return { prepare, final, build };
    },
  );
  return demo;
}

function osintDemo(motionAllowed) {
  const demo = scene(
    ".osint-scene",
    "OSINT RUNNER",
    [
      "Le champ attend un pseudonyme fictif.",
      "« exemple_26 » est saisi localement.",
      "Trois sources distinctes sont parcourues.",
      "Une mention est inspectée, sans attribution.",
    ],
    motionAllowed,
    ({ $, $$ }) => {
      const shell = $(".osint-shell");
      const field = $(".osint-field");
      const query = $(".osint-query");
      const scan = $(".osint-scan-track span");
      const sources = $$(".osint-source");
      const inspector = $(".osint-inspector");
      const fullQuery = query.textContent;
      const details = {
        a: [
          "INSPECTION / SOURCE A",
          "Annuaire illustratif : pseudonyme mentionné. L'origine et la propriété du compte restent à confirmer.",
        ],
        b: [
          "INSPECTION / SOURCE B",
          "Un nom ressemblant apparaît dans l'exemple. Cette ressemblance ne relie pas les comptes entre eux.",
        ],
        c: [
          "INSPECTION / SOURCE C",
          "Source indisponible dans l'exemple. Aucun résultat ni identité ne peut en être déduit.",
        ],
      };
      function select(id) {
        sources.forEach((source) =>
          source.setAttribute(
            "aria-pressed",
            String(source.dataset.source === id),
          ),
        );
        inspector.querySelector(".product-kicker").textContent = details[id][0];
        inspector.querySelector(".osint-source-detail").textContent =
          details[id][1];
      }
      function prepare() {
        gsap.set([shell, field, query, scan, ...sources, inspector], {
          clearProps: "all",
        });
        query.textContent = "";
        select("a");
        gsap.set(scan, { width: "0%" });
        gsap.set(sources, { clipPath: "inset(0 100% 0 0)" });
        gsap.set(inspector, { clipPath: "inset(0 0 100% 0)" });
      }
      function final() {
        gsap.set([shell, field, query, scan, ...sources, inspector], {
          clearProps: "all",
        });
        query.textContent = fullQuery;
        select("a");
      }
      function build(cue) {
        const tl = gsap.timeline({
          paused: true,
          defaults: { ease: "power2.out" },
        });
        tl.addLabel("open")
          .call(() => cue(0))
          .to(field, {
            borderColor: "#6be2ec",
            backgroundColor: "#163543",
            duration: 0.55,
          });
        tl.addLabel("query")
          .call(() => cue(1))
          .to(query, { text: fullQuery, duration: 0.9, ease: "none" });
        tl.addLabel("sources")
          .call(() => cue(2))
          .to(scan, { width: "100%", duration: 1.2, ease: "none" })
          .to(
            sources,
            { clipPath: "inset(0 0% 0 0)", stagger: 0.16, duration: 0.48 },
            "<",
          );
        tl.addLabel("inspect")
          .call(() => cue(3))
          .to(inspector, {
            clipPath: "inset(0 0 0% 0)",
            duration: 0.75,
            ease: "power3.inOut",
          })
          .to(
            field,
            {
              borderColor: "#3c596b",
              backgroundColor: "#101b27",
              duration: 0.35,
            },
            "<",
          );
        return tl;
      }
      sources.forEach((source) =>
        source.addEventListener("click", () => {
          demo.finish();
          select(source.dataset.source);
        }),
      );
      return { prepare, final, build };
    },
  );
  return demo;
}

function bgpDemo(motionAllowed) {
  const demo = scene(
    ".bgp-scene",
    "BGP HISTORIAN",
    [
      "AS64512 est recherché dans cet exemple local.",
      "Deux instants fictifs prennent place sur l'axe.",
      "Un chemin disparaît ; un autre apparaît.",
    ],
    motionAllowed,
    ({ $, $$ }) => {
      const shell = $(".bgp-shell");
      const lookup = $(".bgp-lookup");
      const axis = $(".bgp-time-axis");
      const snapshots = $$(".bgp-snapshot");
      const diff = $(".bgp-diff");
      const diffEmpty = $(".bgp-diff-empty");
      function resetComparison() {
        snapshots.forEach((snapshot) =>
          snapshot.setAttribute("aria-pressed", "true"),
        );
        diff.classList.remove("is-hidden");
        diffEmpty.hidden = true;
      }
      function prepare() {
        gsap.set([shell, lookup, axis, ...snapshots, diff], {
          clearProps: "all",
        });
        resetComparison();
        gsap.set(lookup, { autoAlpha: 0, x: -24 });
        gsap.set(axis, { scaleX: 0, transformOrigin: "left center" });
        gsap.set(snapshots, { autoAlpha: 0 });
        gsap.set(snapshots[0], { x: -22 });
        gsap.set(snapshots[1], { x: 22 });
        gsap.set(diff, { clipPath: "inset(0 100% 0 0)" });
      }
      function final() {
        gsap.set([shell, lookup, axis, ...snapshots, diff], {
          clearProps: "all",
        });
        resetComparison();
      }
      function build(cue) {
        const tl = gsap.timeline({
          paused: true,
          defaults: { ease: "power2.out" },
        });
        tl.addLabel("lookup")
          .call(() => cue(0))
          .to(lookup, { autoAlpha: 1, x: 0, duration: 0.68 });
        tl.addLabel("snapshots")
          .call(() => cue(1))
          .to(axis, { scaleX: 1, duration: 0.5 })
          .to(
            snapshots,
            { autoAlpha: 1, x: 0, stagger: 0.22, duration: 0.62 },
            "<+0.15",
          );
        tl.addLabel("diff")
          .call(() => cue(2))
          .to(diff, {
            clipPath: "inset(0 0% 0 0)",
            duration: 0.78,
            ease: "power3.inOut",
          })
          .fromTo(
            diff.querySelectorAll(".bgp-diff-line"),
            { x: -12 },
            { x: 0, stagger: 0.18, duration: 0.35 },
            "<+0.2",
          );
        return tl;
      }
      snapshots.forEach((item) =>
        item.addEventListener("click", () => {
          demo.finish();
          item.setAttribute(
            "aria-pressed",
            String(item.getAttribute("aria-pressed") !== "true"),
          );
          const incomplete = snapshots.some(
            (node) => node.getAttribute("aria-pressed") !== "true",
          );
          diff.classList.toggle("is-hidden", incomplete);
          diffEmpty.hidden = !incomplete;
        }),
      );
      return { prepare, final, build };
    },
  );
  return demo;
}

function investigationDemo(motionAllowed) {
  return scene(
    ".investigation-section",
    "INVESTIGATION",
    [
      "Le dossier fictif s'ouvre.",
      "Indicateur et source y sont rattachés.",
      "Deux événements entrent dans la chronologie.",
      "Une question reste à vérifier.",
      "Le playbook guide la lecture, sans exécution.",
    ],
    motionAllowed,
    ({ $, $$ }) => {
      const shell = $(".investigation-work");
      const caseFile = $(".case-envelope");
      const indicator = $(".case-ip");
      const slip = $(".case-source-slip");
      const events = $$(".investigation-timeline li");
      const question = $(".case-question");
      const playbook = $(".playbook");
      const attach = $(".attach-source");
      const sourceStatus = $("#source-status");
      function setAttached(attached) {
        attach.setAttribute("aria-pressed", String(attached));
        sourceStatus.textContent = attached
          ? "Source ajoutée au dossier fictif dans cette page seulement. Aucune donnée enregistrée."
          : "Démonstration locale · aucune donnée enregistrée.";
      }
      const nodes = [
        shell,
        caseFile,
        indicator,
        slip,
        ...events,
        question,
        playbook,
      ];
      function prepare() {
        gsap.set(nodes, { clearProps: "all" });
        setAttached(false);
        gsap.set(caseFile, {
          rotateY: -12,
          scale: 0.96,
          transformOrigin: "left center",
        });
        gsap.set([indicator, slip, ...events, question, playbook], {
          autoAlpha: 0,
        });
        gsap.set(indicator, { x: -28 });
        gsap.set(slip, { x: -50 });
        gsap.set(events, { y: 16 });
        gsap.set(playbook, { x: 32 });
      }
      function final() {
        gsap.set(nodes, { clearProps: "all" });
        setAttached(true);
      }
      function build(cue) {
        const tl = gsap.timeline({
          paused: true,
          defaults: { ease: "power2.out" },
        });
        tl.addLabel("open")
          .call(() => cue(0))
          .to(caseFile, {
            rotateY: 0,
            scale: 1,
            duration: 0.82,
            ease: "power3.out",
          });
        tl.addLabel("indicator")
          .call(() => cue(1))
          .to(indicator, { autoAlpha: 1, x: 0, duration: 0.55 })
          .to(slip, { autoAlpha: 1, x: 0, duration: 0.5 }, "<+0.15")
          .to(attach, { scale: 0.96, duration: 0.13, yoyo: true, repeat: 1 })
          .call(() => setAttached(true))
          .to({}, { duration: 0.5 });
        tl.addLabel("events")
          .call(() => cue(2))
          .to(events.slice(0, 2), {
            autoAlpha: 1,
            y: 0,
            stagger: 0.23,
            duration: 0.45,
          })
          .to({}, { duration: 0.45 });
        tl.addLabel("question")
          .call(() => cue(3))
          .to(events[2], { autoAlpha: 1, y: 0, duration: 0.42 })
          .to(question, { autoAlpha: 1, duration: 0.38 }, "<")
          .to({}, { duration: 0.55 });
        tl.addLabel("playbook")
          .call(() => cue(4))
          .to(playbook, { autoAlpha: 1, x: 0, duration: 0.7 })
          .to({}, { duration: 0.75 });
        return tl;
      }
      return { prepare, final, build };
    },
  );
}

function finalDemo(motionAllowed) {
  return scene(
    ".final-section",
    "CYBERHUB",
    [
      "Outils, recherche et veille entrent en scène.",
      "Les modules d'analyse et d'investigation suivent.",
      "Les ressources et outils pratiques complètent l'ensemble.",
      "Les 18 noms convergent vers un même symbole.",
      "L'emblème CyberHub prend forme.",
      "CYBERHUB réunit ces modules dans un même espace.",
      "Rendre visible l'invisible. Explorer CyberHub.",
    ],
    motionAllowed,
    ({ $, $$ }) => {
      const stage = $(".final-stage");
      const names = $$(".final-name");
      const waves = [
        names.slice(0, 6),
        names.slice(6, 12),
        names.slice(12, 18),
      ];
      const frame = $(".final-emblem-frame");
      const pulse = $(".final-pulse");
      const wordmark = $(".final-wordmark");
      const title = $("#final-title");
      const intro = $(".final-intro");
      const signature = $(".final-signature");
      const disclaimer = $(".final-disclaimer");
      const actions = $(".final-actions");
      const details = $(".final-module-details");
      const nodes = [
        ...names,
        frame,
        pulse,
        wordmark,
        title,
        intro,
        signature,
        disclaimer,
        actions,
        details,
      ];
      const entryY = [-30, 22, 28, -24, -22, 30];
      const entryRotation = [-7, 5, -5, 6, -4, 5];

      function fitWordmark() {
        wordmark.style.removeProperty("font-size");
        const baseSize = Number.parseFloat(getComputedStyle(wordmark).fontSize);
        const available =
          stage.clientWidth - Math.max(36, stage.clientWidth * 0.08);
        const naturalWidth = wordmark.scrollWidth;
        if (naturalWidth > available) {
          wordmark.style.fontSize = `${(baseSize * available) / naturalWidth}px`;
        }
      }
      new ResizeObserver(fitWordmark).observe(stage);
      document.fonts?.ready.then(fitWordmark);

      function prepare() {
        gsap.set(nodes, { clearProps: "all" });
        details.open = false;
        fitWordmark();
        gsap.set(names, {
          autoAlpha: 0,
          x: (index) =>
            (index % 2 === 0 ? -1 : 1) *
            (stage.clientWidth < 600 ? 50 : 105 + Math.floor(index / 6) * 14),
          y: (index) => entryY[index % 6],
          rotation: (index) => entryRotation[index % 6],
          scale: 0.75,
        });
        gsap.set(frame, { autoAlpha: 0, scale: 0.62, rotation: -9 });
        gsap.set(wordmark, {
          autoAlpha: 0,
          y: 18,
          scale: 0.89,
        });
        gsap.set([title, intro, signature, disclaimer, actions, details], {
          autoAlpha: 0,
          y: 18,
        });
        gsap.set(pulse, { autoAlpha: 0, scale: 0.35 });
      }

      function final() {
        gsap.set(nodes, { clearProps: "all" });
        gsap.set(names, { autoAlpha: 0 });
        fitWordmark();
      }

      function build(cue) {
        fitWordmark();
        const tl = gsap.timeline({
          paused: true,
          defaults: { ease: "power3.out" },
        });
        waves.forEach((wave, waveIndex) => {
          tl.addLabel(`wave-${waveIndex + 1}`)
            .call(() => cue(waveIndex))
            .to(wave, {
              autoAlpha: 1,
              x: 0,
              y: 0,
              rotation: 0,
              scale: 1,
              duration: 0.45,
              stagger: 0.08,
            })
            .to({}, { duration: 0.55 });
          if (waveIndex === 2) {
            tl.addLabel("convergence").call(() => cue(3));
          }
          tl.to(wave, {
            x: (index, name) =>
              stage.clientWidth / 2 - (name.offsetLeft + name.offsetWidth / 2),
            y: (index, name) =>
              stage.clientHeight * 0.42 -
              (name.offsetTop + name.offsetHeight / 2),
            rotation: 0,
            scale: 0.12,
            autoAlpha: 0,
            stagger: 0.02,
            duration: 0.72,
            ease: "power3.inOut",
          });
        });
        tl.to(
          pulse,
          { autoAlpha: 0.85, scale: 1.15, duration: 0.45 },
          "<+0.36",
        );
        tl.addLabel("emblem")
          .call(() => cue(4))
          .to(frame, { autoAlpha: 1, rotation: 0, scale: 1, duration: 0.58 })
          .to(pulse, { autoAlpha: 0, scale: 1.8, duration: 0.58 }, "<");
        tl.addLabel("name")
          .call(() => cue(5))
          .to(wordmark, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: "power3.inOut",
          })
          .to({}, { duration: 0.3 });
        tl.addLabel("invitation")
          .call(() => cue(6))
          .to(title, { autoAlpha: 1, y: 0, duration: 0.6 })
          .to(
            [intro, signature, disclaimer],
            { autoAlpha: 1, y: 0, stagger: 0.11, duration: 0.5 },
            "<+0.18",
          )
          .to(
            [actions, details],
            {
              autoAlpha: 1,
              y: 0,
              stagger: 0.12,
              duration: 0.5,
            },
            "<+0.22",
          )
          .to({}, { duration: 0.35 });
        return tl;
      }
      return { prepare, final, build };
    },
  );
}

export function createSecondaryDemos({ motionAllowed }) {
  const demos = [
    investigationDemo(motionAllowed),
    cveDemo(motionAllowed),
    osintDemo(motionAllowed),
    bgpDemo(motionAllowed),
    finalDemo(motionAllowed),
  ];
  return {
    finish: () => demos.forEach((demo) => demo.finish()),
    syncStatus: () => demos.forEach((demo) => demo.syncStatus()),
  };
}
