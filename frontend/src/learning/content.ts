import type { LearningEntry } from './types'

/*
 * Versioned Learning content. Only the concepts displayed by #78 are written:
 * CVE, CVSS, KEV, EPSS, ATT&CK technique / sub-technique / association,
 * correlation, LOLBin / GTFOBin and CLOAK. Bump LEARNING_VERSION when an
 * entry's meaning changes.
 * Wording rules: CVSS ≠ KEV ≠ EPSS; an association, a correlation, a LOLBin's
 * presence or a CLOAK entry is never presented as an observed activity or a
 * compromise.
 */

export const LEARNING_VERSION = 1

const entries = {
  cve: {
    id: 'cve', label: 'CVE',
    essential: 'Vulnérabilité publique identifiée — ne dit pas si vos actifs sont exposés.',
    what: 'Identifiant public d’une vulnérabilité connue, attribué par le programme CVE.',
    why: 'Il désigne une faiblesse précise et partagée : produits, correctifs et alertes s’y réfèrent sans ambiguïté.',
    limit: 'Une fiche CVE décrit une faiblesse publique ; elle ne dit pas si vos actifs sont concernés ni exposés.',
    next: ['Identifier les actifs qui utilisent les produits concernés.', 'Vérifier l’exposition et la disponibilité d’un correctif.'],
  },
  cvss: {
    id: 'cvss', label: 'CVSS',
    essential: 'Gravité technique de 0 à 10 — n’indique pas une exploitation.',
    what: 'Score de gravité technique, de 0 à 10, calculé à partir des caractéristiques de la vulnérabilité.',
    why: 'Il permet de comparer rapidement l’impact potentiel de deux vulnérabilités.',
    limit: 'Un CVSS élevé ne signifie pas que la vulnérabilité est exploitée, ni qu’elle l’est chez vous.',
    next: ['Croiser avec KEV et EPSS avant de prioriser.', 'Ajuster la priorité selon l’exposition réelle de l’actif.'],
  },
  kev: {
    id: 'kev', label: 'CISA KEV',
    essential: 'Exploitation connue publiquement (CISA) — pas observée par CyberHub.',
    what: 'Catalogue de la CISA recensant les vulnérabilités dont l’exploitation est connue publiquement.',
    why: 'La présence dans KEV est un signal fort de priorisation : des attaquants ont déjà utilisé cette faille.',
    limit: 'KEV signale une exploitation connue dans le monde ; ce n’est pas une exploitation observée par CyberHub ni sur vos systèmes.',
    next: ['Vérifier l’échéance et l’action requise indiquées par la CISA.', 'Contrôler si un actif concerné est exposé.'],
  },
  epss: {
    id: 'epss', label: 'EPSS',
    essential: 'Probabilité d’exploitation (FIRST) — ce n’est pas une preuve.',
    what: 'Estimation statistique (FIRST) de la probabilité qu’une vulnérabilité soit exploitée dans les 30 prochains jours.',
    why: 'Elle aide à départager de nombreuses vulnérabilités de gravité comparable.',
    limit: 'Une probabilité, même élevée, n’est pas une preuve : elle ne signifie ni exploitation confirmée ni exploitation observée.',
    next: ['Utiliser EPSS avec CVSS et KEV, jamais seul.'],
  },
  'attack-technique': {
    id: 'attack-technique', label: 'Technique ATT&CK',
    essential: 'Manière d’atteindre un objectif (tactique) — décrit un comportement possible, pas observé.',
    what: 'Une technique ATT&CK décrit une manière dont un adversaire atteint un objectif. La tactique est cet objectif, la plateforme le système visé.',
    why: 'Elle offre un vocabulaire commun pour relier détection, renseignement et couverture défensive.',
    limit: 'La fiche décrit un comportement possible ; elle ne dit pas qu’un adversaire l’a utilisé dans votre environnement.',
    next: ['Vérifier que les sources de données nécessaires à la détection sont collectées.', 'Contrôler si la technique est couverte par un layer ou une règle de détection.'],
  },
  'attack-subtechnique': {
    id: 'attack-subtechnique', label: 'Sous-technique ATT&CK',
    essential: 'Variante précise de sa technique parente — comportement possible, pas observé.',
    what: 'Une sous-technique précise une variante concrète de sa technique parente, avec ses propres détections.',
    why: 'Elle permet une détection et une couverture plus fines que la technique générale.',
    limit: 'La fiche décrit un comportement possible ; elle ne dit pas qu’un adversaire l’a utilisé dans votre environnement.',
    next: ['Consulter la technique parente pour le contexte général.', 'Vérifier les sources de données propres à cette variante.'],
  },
  'attack-association': {
    id: 'attack-association', label: 'Association ATT&CK',
    essential: 'Lien vers une technique réalisable — ce n’est pas une activité observée.',
    what: 'Une association relie un élément (binaire, indicateur, résultat) à une technique ATT&CK qu’il peut servir à réaliser.',
    why: 'Elle oriente l’analyse vers les comportements plausibles et les détections à vérifier.',
    limit: 'Une association n’est pas une observation : elle ne signifie pas qu’un adversaire a exécuté cette technique.',
    next: ['Rechercher des traces de ce comportement dans les journaux avant de conclure.'],
  },
  correlation: {
    id: 'correlation', label: 'Corrélation',
    essential: 'Liens trouvés dans les bases locales — pas une preuve de compromission.',
    what: 'Rapprochement entre l’indicateur analysé et les connaissances déjà présentes dans CyberHub (techniques, CVE, investigations, notes…).',
    why: 'CyberHub affiche ce résultat parce que des éléments de ses bases locales correspondent à cet indicateur.',
    limit: 'Une corrélation n’est pas une preuve de compromission. La confiance mesure les liens trouvés localement, pas un niveau de menace.',
    next: [],
  },
  lolbin: {
    id: 'lolbin', label: 'LOLBin / GTFOBin',
    essential: 'Binaire légitime détournable — sa présence ne prouve aucun usage malveillant.',
    what: 'Un binaire ou outil légitime du système qui peut être détourné pour réaliser certaines actions. LOLBAS recense ceux de Windows, GTFOBins ceux des systèmes Unix et Linux.',
    why: 'CyberHub le référence parce que certaines de ses commandes ou fonctions légitimes apparaissent aussi dans des chaînes d’abus ou de contournement.',
    limit: 'La présence de ce binaire sur une machine ne signifie pas un usage malveillant, et sa présence dans LOLBAS ou GTFOBins n’est pas une preuve de compromission.',
    next: ['Vérifier le contexte d’exécution et la commande réellement utilisée.', 'Identifier l’utilisateur et le processus parent.', 'Consulter les techniques ATT&CK liées et les événements associés, s’ils existent.'],
  },
  cloak: {
    id: 'cloak', label: 'CLOAK',
    essential: 'Doctrine d’anonymat et d’OpSec référencée — pas une activité observée.',
    what: 'Une entrée du référentiel CLOAK (Concealment Layers for Online Anonymity and Knowledge) : une technique ou sous-technique qu’un adversaire peut employer pour atteindre un objectif d’anonymat ou d’OpSec — la tactique —, avec les procédures (outils, services) qui la mettent en œuvre.',
    why: 'Elle aide à comprendre comment un adversaire peut se dissimuler, et à préparer les vérifications ou contre-mesures adaptées.',
    limit: 'Une entrée CLOAK décrit une connaissance référencée ; elle ne prouve pas que cette technique a été observée dans votre environnement.',
    next: ['Consulter les procédures listées et, s’il existe, l’annotation de l’analyste.', 'Examiner la technique parente ou les sous-techniques liées.', 'Croiser avec les observations réellement disponibles dans CyberHub.'],
  },
} satisfies Record<string, LearningEntry>

export type LearningId = keyof typeof entries
export const LEARNING: Record<LearningId, LearningEntry> = entries
