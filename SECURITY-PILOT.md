# État du pilote de sécurité

## Démarrage et données

- CyberHub utilise `cyber-hub.lock` dans le répertoire de la base. Le fichier peut rester après un arrêt brutal : le verrou du système est libéré automatiquement. Une seconde instance s'arrête avec une erreur et aucun PID enregistré n'est utilisé pour tuer un processus.
- Une base SQLite déjà présente est sauvegardée avec `VACUUM INTO` avant les migrations. Les écritures du WAL font partie de l'instantané. Si cette sauvegarde échoue, l'initialisation s'arrête avant toute migration. Les sauvegardes au démarrage et quotidiennes journalisent leur succès ou leur échec.
- La migration de `osint_jobs` retire la colonne historique `tool` avec `ALTER TABLE DROP COLUMN`, sans copier la table. Elle ajoute ensuite seulement les colonnes et index manquants. Si un index ou une contrainte dépend encore de `tool`, la migration échoue sans supprimer les données ; la sauvegarde pré-migration permet la restauration.
- Les sauvegardes automatiques `cyber-hub-auto-*.db.bak` conservent les 14 dernières par défaut (`CYBER_HUB_AUTO_BACKUP_KEEP`, minimum 1). Les instantanés `cyber-hub-pre-migration-*.db.bak` en conservent au moins 3 (`CYBER_HUB_PRE_MIGRATION_BACKUP_KEEP`, minimum 3). La sauvegarde manuelle `cyber-hub-manual-*.db.bak` et les anciens noms ne sont jamais nettoyés automatiquement. Chaque nouvel instantané est vérifié avec `PRAGMA integrity_check` avant le nettoyage.
- Le conteneur se construit avec Node.js 24 et s'exécute sans privilèges root. Docker Compose publie le port 7743 sur `127.0.0.1`.

## Avis de dépendances encore ouverts

`npm audit` signale **7 entrées** (5 élevées, 2 modérées), toutes liées à Tailwind CSS 3 et à ses dépendances de développement : `braces`, `chokidar`, `fast-glob`, `micromatch`, `postcss-nested` et `postcss-selector-parser`. `npm audit --omit=dev` ne signale aucun avis pour les dépendances embarquées à l'exécution.

Les correctifs proposés par npm imposent Tailwind CSS 4. Le projet utilise la configuration et les directives CSS de Tailwind 3, notamment `@tailwind` et `@apply`. Une migration vers Tailwind 4 nécessite une vérification visuelle des pages et des classes personnalisées. Les avis restent visibles dans l'audit ; aucun contrôle n'a été désactivé.

`govulncheck` ne trouve aucune vulnérabilité atteignable dans le code Go. Il relève encore [GO-2026-5932](https://pkg.go.dev/vuln/GO-2026-5932) pour `golang.org/x/crypto/openpgp`, paquet non importé par CyberHub et sans version corrigée connue.
