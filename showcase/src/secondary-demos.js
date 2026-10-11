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
      "La veille locale s'ouvre sur trois entrées synthétiques.",
      "La recherche illustrative saisit « serveur ».",
      "Le filtre Critique est choisi.",
      "L'entrée concernée remonte dans la liste ; les autres s'écartent.",
      "CH-VEILLE-02 est sélectionnée et sa fiche s'ouvre.",
      "La provenance et les données absentes restent visibles.",
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
        gsap.set(shell, { autoAlpha: 0, y: 34 });
        gsap.set(inspector, { autoAlpha: 0, x: 42 });
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
          .to(shell, { autoAlpha: 1, y: 0, duration: 0.8 });
        tl.addLabel("search")
          .call(() => cue(1))
          .to(query, { text: fullQuery, duration: 1.0, ease: "none" });
        tl.addLabel("severity")
          .call(() => {
            cue(2);
            filter.setAttribute("aria-pressed", "true");
            filter.firstChild.textContent = "CRITIQUE ";
          })
          .fromTo(filter, { scale: 0.92 }, { scale: 1, duration: 0.33 });
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
          });
        tl.addLabel("select")
          .call(() => cue(4))
          .fromTo(primary, { x: -12 }, { x: 0, duration: 0.35 });
        tl.addLabel("provenance")
          .call(() => cue(5))
          .to(inspector, { autoAlpha: 1, x: 0, duration: 0.7 });
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
      "Le module présente un champ de pseudonyme et des sources séparées.",
      "« exemple_26 » est saisi dans une recherche simulée.",
      "Trois pistes illustratives apparaissent, avec leurs limites.",
      "La source A est inspectée ; aucune identité n'est attribuée.",
    ],
    motionAllowed,
    ({ $, $$ }) => {
      const shell = $(".osint-shell");
      const query = $(".osint-query");
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
        gsap.set([shell, ...sources, inspector], { clearProps: "all" });
        query.textContent = "";
        select("a");
        gsap.set(shell, { autoAlpha: 0, y: 30 });
        gsap.set(sources, { autoAlpha: 0, x: -18 });
        gsap.set(inspector, { autoAlpha: 0, x: 28 });
      }
      function final() {
        gsap.set([shell, ...sources, inspector, query], { clearProps: "all" });
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
          .to(shell, { autoAlpha: 1, y: 0, duration: 0.7 });
        tl.addLabel("query")
          .call(() => cue(1))
          .to(query, { text: fullQuery, duration: 0.9, ease: "none" });
        tl.addLabel("sources")
          .call(() => cue(2))
          .to(sources, { autoAlpha: 1, x: 0, stagger: 0.18, duration: 0.44 });
        tl.addLabel("inspect")
          .call(() => cue(3))
          .to(inspector, { autoAlpha: 1, x: 0, duration: 0.65 });
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
      "Un AS privé et un préfixe de documentation entrent dans Lookup.",
      "Deux instantanés fictifs sont placés côte à côte.",
      "La comparaison signale un chemin retiré et un chemin ajouté.",
    ],
    motionAllowed,
    ({ $, $$ }) => {
      const shell = $(".bgp-shell");
      const lookup = $(".bgp-lookup");
      const snapshots = $$(".bgp-snapshot");
      const diff = $(".bgp-diff");
      function prepare() {
        gsap.set([shell, lookup, ...snapshots, diff], { clearProps: "all" });
        gsap.set(shell, { autoAlpha: 0, y: 28 });
        gsap.set(lookup, { autoAlpha: 0, x: -24 });
        gsap.set(snapshots, { autoAlpha: 0, y: 22 });
        gsap.set(diff, { autoAlpha: 0, x: 30 });
      }
      function final() {
        gsap.set([shell, lookup, ...snapshots, diff], { clearProps: "all" });
      }
      function build(cue) {
        const tl = gsap.timeline({
          paused: true,
          defaults: { ease: "power2.out" },
        });
        tl.addLabel("lookup")
          .call(() => cue(0))
          .to(shell, { autoAlpha: 1, y: 0, duration: 0.7 })
          .to(lookup, { autoAlpha: 1, x: 0, duration: 0.4 }, "<+0.1");
        tl.addLabel("snapshots")
          .call(() => cue(1))
          .to(snapshots, { autoAlpha: 1, y: 0, stagger: 0.25, duration: 0.55 });
        tl.addLabel("diff")
          .call(() => cue(2))
          .to(diff, { autoAlpha: 1, x: 0, duration: 0.65 })
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
          diff.classList.toggle(
            "is-hidden",
            snapshots.some(
              (node) => node.getAttribute("aria-pressed") !== "true",
            ),
          );
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
      "Un dossier conceptuel s'ouvre.",
      "L'indicateur et la provenance entrent dans le dossier.",
      "Deux événements datés construisent la chronologie.",
      "La question de vérification est inscrite.",
      "Un playbook propose trois étapes ; aucune n'est exécutée.",
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
        gsap.set(shell, { autoAlpha: 0, y: 30 });
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
      }
      function build(cue) {
        const tl = gsap.timeline({
          paused: true,
          defaults: { ease: "power2.out" },
        });
        tl.addLabel("open")
          .call(() => cue(0))
          .to(shell, { autoAlpha: 1, y: 0, duration: 0.75 })
          .fromTo(
            caseFile,
            { rotateY: -7 },
            { rotateY: 0, duration: 0.55 },
            "<",
          );
        tl.addLabel("indicator")
          .call(() => cue(1))
          .to(indicator, { autoAlpha: 1, x: 0, duration: 0.55 })
          .to(slip, { autoAlpha: 1, x: 0, duration: 0.5 }, "<+0.15");
        tl.addLabel("events")
          .call(() => cue(2))
          .to(events.slice(0, 2), {
            autoAlpha: 1,
            y: 0,
            stagger: 0.23,
            duration: 0.45,
          });
        tl.addLabel("question")
          .call(() => cue(3))
          .to(events[2], { autoAlpha: 1, y: 0, duration: 0.42 })
          .to(question, { autoAlpha: 1, duration: 0.38 }, "<");
        tl.addLabel("playbook")
          .call(() => cue(4))
          .to(playbook, { autoAlpha: 1, x: 0, duration: 0.7 });
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
      "Les vues précédentes reviennent dans un même espace.",
      "IOC, MITRE et Investigation forment une vue du produit.",
      "Le cadre recule et révèle l'ensemble de CyberHub.",
      "Rendre visible l'invisible : découvrir le projet.",
    ],
    motionAllowed,
    ({ $, $$ }) => {
      const stage = $(".final-stage");
      const camera = $(".final-camera");
      const views = $$(".final-view");
      const title = $("#final-title");
      const actions = $(".final-actions");
      const nodes = [stage, camera, ...views, title, actions];
      function prepare() {
        gsap.set(nodes, { clearProps: "all" });
        gsap.set(camera, { scale: 1.18, rotateX: 4, y: 40, autoAlpha: 0 });
        gsap.set(views.slice(1), { autoAlpha: 0, x: 80 });
        gsap.set(title, { autoAlpha: 0, y: 24 });
        gsap.set(actions, { autoAlpha: 0, y: 16 });
      }
      function final() {
        gsap.set(nodes, { clearProps: "all" });
      }
      function build(cue) {
        const tl = gsap.timeline({
          paused: true,
          defaults: { ease: "power3.out" },
        });
        tl.addLabel("return")
          .call(() => cue(0))
          .to(camera, { autoAlpha: 1, y: 0, duration: 0.9 });
        tl.addLabel("compose")
          .call(() => cue(1))
          .to(views.slice(1), {
            autoAlpha: 1,
            x: 0,
            stagger: 0.26,
            duration: 0.8,
          });
        tl.addLabel("reveal")
          .call(() => cue(2))
          .to(camera, { scale: 1, rotateX: 0, duration: 1.1 });
        tl.addLabel("title")
          .call(() => cue(3))
          .to(title, { autoAlpha: 1, y: 0, duration: 0.7 })
          .to(actions, { autoAlpha: 1, y: 0, duration: 0.58 }, "<+0.3");
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
