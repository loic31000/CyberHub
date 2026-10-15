// Fictional, deterministic editorial examples. Never import Console data here.
export const signals = [
  {
    id: "trace",
    label: "01 · Trace",
    title: "Une adresse réapparaît.",
    detail:
      "Deux notes d’enquête fictives mentionnent le même indicateur. Le rapprochement est présenté comme une piste à vérifier.",
    source: "Journal fictif / observation S-01",
    relation: "Mention commune, pas une attribution",
  },
  {
    id: "context",
    label: "02 · Contexte",
    title: "Le contexte change la lecture.",
    detail:
      "Une référence CVE et une observation ne prouvent pas, à elles seules, qu’un système est vulnérable.",
    source: "Fiche fictive / référence C-02",
    relation: "Lien documentaire à confirmer",
  },
  {
    id: "decision",
    label: "03 · Décision",
    title: "La décision garde sa trace.",
    detail:
      "La note conserve l’hypothèse, son origine et la prochaine vérification. Aucun scan ni alerte réelle n’est déclenché.",
    source: "Carnet fictif / décision D-03",
    relation: "Hypothèse documentée",
  },
];

export const evidence = [
  {
    id: "e1",
    code: "A—01",
    kind: "Observation",
    title: "Une trace à examiner",
    detail:
      "L’indice apparaît dans une note locale de démonstration. Sa présence seule ne permet aucune conclusion.",
    source: "Carnet synthétique / entrée 01",
    confidence: "Statut : à confirmer",
    links: "Relié à B—02 par une référence de dossier commune.",
  },
  {
    id: "e2",
    code: "B—02",
    kind: "Source",
    title: "Une référence recoupée",
    detail:
      "Une seconde fiche fictive décrit le contexte. Le recoupement rend la piste plus lisible, sans en faire une certitude.",
    source: "Bibliothèque de démonstration / fiche 02",
    confidence: "Statut : contexte partiel",
    links: "Relié à A—01 et C—03 par des notes explicites.",
  },
  {
    id: "e3",
    code: "C—03",
    kind: "Hypothèse",
    title: "Une action documentée",
    detail:
      "La décision proposée est de vérifier la source et de compléter la chronologie avant d’agir.",
    source: "Journal de démonstration / décision 03",
    confidence: "Statut : non validé",
    links: "Découle des deux fiches précédentes.",
  },
];
