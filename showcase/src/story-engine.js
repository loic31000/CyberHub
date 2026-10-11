import { clamp } from "./motion.js";

// Order, copy and destinations are intentionally declared together. The visual
// thread is illustrative; references outside the case are never attributed to it.
export const STORY_STATES = Object.freeze([
  {
    id: "terminal-found",
    anchor: ".source-ip",
    scene: "terminal",
    caption: "Une ligne a été trouvée.",
    detail: "Deux mentions synthétiques ; la source reste visible.",
  },
  {
    id: "ioc-imported",
    anchor: ".ioc-target",
    scene: "terminal",
    caption: "Une valeur devient un indicateur documenté.",
    detail: "Type, provenance, contexte et inconnues sont conservés.",
  },
  {
    id: "correlation-linked",
    anchor: ".relation-center strong",
    scene: "relations",
    caption: "Deux observations. Un point commun.",
    detail: "Le rapprochement ne prouve ni cause ni attribution.",
  },
  {
    id: "references-explored",
    anchor: null,
    scene: "mitre",
    caption: "Un référentiel se consulte à part.",
    detail: "MITRE n'est pas déduit de l'adresse du terminal.",
  },
  {
    id: "investigation-attached",
    anchor: ".case-ip-value",
    scene: "investigation",
    caption: "La piste devient une investigation.",
    detail:
      "L'adresse, ses deux lignes et la provenance entrent dans un dossier fictif.",
  },
  {
    id: "playbook-reviewed",
    anchor: ".playbook-ip",
    scene: "investigation",
    caption: "Une prochaine question devient possible.",
    detail: "Le playbook organise la vérification ; rien n'est exécuté.",
  },
  {
    id: "disciplines-explored",
    anchor: null,
    scene: "disciplines",
    caption: "Changer de domaine, garder les limites.",
    detail: "CVE, OSINT et BGP montrent des exemples indépendants.",
  },
  {
    id: "cyberhub-revealed",
    anchor: ".final-thread-target",
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

export function interpolatePoint(from, to, progress) {
  const value = clamp(progress);
  const smooth = value * value * (3 - 2 * value);
  return {
    x: from.x + (to.x - from.x) * smooth,
    y: from.y + (to.y - from.y) * smooth,
  };
}

export function projectAnchor(rect, viewport, railX) {
  const centerY = rect.top + rect.height / 2;
  const upper = Math.max(
    viewport.topInset ?? 0,
    viewport.height < 700 ? 122 : 145,
  );
  const lower = Math.max(upper, viewport.height - 100);
  const within = centerY >= upper && centerY <= lower;
  return {
    x: within ? rect.left + rect.width / 2 : railX,
    y: clamp(centerY, upper, lower),
  };
}
