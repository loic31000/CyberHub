import { clamp } from "./motion.js";

// Narrative states drive copy and navigation; each scene owns its own motion.
export const STORY_STATES = Object.freeze([
  {
    id: "terminal-found",
    scene: "terminal",
    caption: "Une ligne a été trouvée.",
    detail: "Deux mentions synthétiques ; la source reste visible.",
  },
  {
    id: "ioc-imported",
    scene: "terminal",
    caption: "Une valeur devient un indicateur documenté.",
    detail: "Type, provenance, contexte et inconnues sont conservés.",
  },
  {
    id: "correlation-linked",
    scene: "relations",
    caption: "Deux observations. Un point commun.",
    detail: "Le rapprochement ne prouve ni cause ni attribution.",
  },
  {
    id: "references-explored",
    scene: "mitre",
    caption: "Un référentiel se consulte à part.",
    detail: "MITRE n'est pas déduit de l'adresse du terminal.",
  },
  {
    id: "investigation-attached",
    scene: "investigation",
    caption: "La piste devient une investigation.",
    detail:
      "L'adresse, ses deux lignes et la provenance entrent dans un dossier fictif.",
  },
  {
    id: "playbook-reviewed",
    scene: "investigation",
    caption: "Une prochaine question devient possible.",
    detail: "Le playbook organise la vérification ; rien n'est exécuté.",
  },
  {
    id: "disciplines-explored",
    scene: "disciplines",
    caption: "Lire la veille, garder la provenance.",
    detail: "Une entrée synthétique illustre recherche, sévérité et fiche.",
  },
  {
    id: "osint-explored",
    scene: "osint-scene",
    caption: "Une piste OSINT reste une piste.",
    detail: "Les sources fictives ne prouvent aucune identité commune.",
  },
  {
    id: "bgp-compared",
    scene: "bgp-scene",
    caption: "Deux instantanés rendent le changement lisible.",
    detail: "Les chemins illustratifs ne proviennent d'aucune collecte.",
  },
  {
    id: "cyberhub-revealed",
    scene: "decouvrir",
    caption: "Rendre visible l'invisible.",
    detail: "Un fil de lecture, des modules distincts, des sources conservées.",
  },
]);

export function resolveStory(scrollY, waypoints) {
  if (waypoints.length !== STORY_STATES.length)
    throw new Error("Story waypoint count mismatch");
  let index = 0;
  while (index < waypoints.length - 1 && scrollY >= waypoints[index + 1])
    index++;
  const next = Math.min(index + 1, waypoints.length - 1);
  const distance = Math.max(1, waypoints[next] - waypoints[index]);
  const progress =
    next === index ? 1 : clamp((scrollY - waypoints[index]) / distance);
  const active = progress >= 0.5 ? next : index;
  return { from: index, to: next, active, progress };
}
