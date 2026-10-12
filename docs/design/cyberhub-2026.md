# CyberHub 2026 - direction artistique figée

> Ce document décrit une direction visuelle validée pour les prototypes, sans signifier que la landing ou le dashboard sont intégrés à `main`.

Référence : `showcase/terminal-story.html` et `showcase/src/terminal-story.css` au commit `276230a`. Le Showcase est la future landing publique ; la Console React reste une application locale et privée. Les simulations du Showcase utilisent des données fictives et n'appellent pas l'API de la Console.

## Couleurs

| Rôle | Valeur actuelle |
| --- | --- |
| Fond graphite | `--ink: #0b1119` |
| Surface principale | `--panel: #111b26` |
| Bordure | `--line: #385166` |
| Texte | `#e9f1f4` |
| Texte secondaire | `--muted: #a7b9c6` |
| Accent CyberHub | `--cyan: #70e2ed` |
| Accent secondaire | `--blue: #5498e9` |
| Focus visible | `#a9f4fa`, contour de `3px` |

Le cyan signale l'identité, les liens actifs et les actions importantes. Les surfaces restent sombres et les bordures fines ; les halos sont réservés aux démonstrations, sans devenir une information indispensable.

## Typographie et échelle

- **DM Sans** : texte courant ; **Manrope** : titres et marque ; **DM Mono** : commandes, valeurs, repères et légendes.
- Les titres utilisent un interlettrage serré (`-0.065em` dans la règle commune). Le titre d'ouverture emploie `clamp(3rem, 7.7vw, 8.7rem)` et le final `clamp(3.1rem, 5.4vw, 6rem)` ; leurs règles mobiles ajustent cette échelle.
- Le texte courant du récit est fluide, par exemple `clamp(1rem, 1.3vw, 1.2rem)` ; ne pas réduire les informations utiles pour imiter une capture.

## Surfaces, rythme et navigation

- En-tête fixe de `76px`, fond `#0b1119ed`, bordure basse `#233546` ; navigation par ancres, avec indication `aria-current` et menu mobile dédié.
- Les sections utilisent des espacements fluides (`clamp(...)`) et des surfaces encadrées. La vitrine peut respirer largement ; une page de la Console doit rester plus dense et orientée travail.
- Boutons et liens : fond sombre `#14222e`, bordure `#486477`, survol `#254454`, accent cyan pour l'action primaire. Le focus clavier a un contour explicite et ne repose pas sur la couleur seule.

## Mouvement et accessibilité

GSAP pilote les séquences illustratives du Showcase ; le défilement reste natif. Chaque scène peut être rejouée ou passée jusqu'au résultat complet. Le contenu statique et les transcriptions restent lisibles sans JavaScript. `prefers-reduced-motion: reduce` affiche l'état final et supprime les transitions non essentielles. La Console emploiera des micro-interactions brèves, adaptées à un usage quotidien.

Ce document consigne les valeurs existantes, sans certifier la conformité WCAG 2.2 AA. Une revue manuelle du clavier, du zoom, des lecteurs d'écran et des contrastes dans les états réels reste nécessaire.
