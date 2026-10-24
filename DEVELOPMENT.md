# Développement local Windows avec Docker et Vite

L'installation locale officielle utilise le backend Go et SQLite dans Docker, exposé sur `127.0.0.1:7743` (`compose.yaml`). Vite sur `http://localhost:5173` est facultatif : démarrez-le seulement pour le développement React avec HMR; il transmet alors `/api` au backend (`frontend/vite.config.ts`). Sans Vite, le frontend construit et embarqué dans Docker reste servi sur le port 7743.

## Avant de démarrer

Dans PowerShell, depuis la racine du dépôt :

```powershell
docker compose config
docker compose ps -a
docker volume ls
Get-NetTCPConnection -LocalPort 7743,5173 -State Listen -ErrorAction SilentlyContinue
```

Vérifier le **nom exact du volume** dans `docker compose config`. Le nom dépend du projet Compose. Un ancien conteneur nommé `cyber-hub` peut appartenir à un autre projet et monter un autre volume, même si les noms se ressemblent. Ne pas le supprimer pour résoudre un conflit : inspecter son état et ses montages (`docker inspect cyber-hub`). Ce dépôt laisse désormais Compose attribuer un nom de conteneur propre à son projet.

Si les données existantes sont dans un autre volume, ne pas démarrer une base vide en pensant les avoir retrouvées. Arrêter les écritures, conserver l'ancien conteneur et son volume, faire un instantané SQLite cohérent incluant le WAL (commande `.backup`), vérifier `PRAGMA integrity_check` et une restauration sur une copie, puis seulement initialiser le volume de destination. Ne jamais copier seulement le fichier `.db` d'une base active. Ne pas utiliser `docker compose down -v`, `docker volume prune` ni supprimer le volume historique.

## Mode développement : Docker + Vite

```powershell
# Terminal 1, racine du dépôt : utiliser l'image Docker déjà construite.
docker compose up -d --no-build
docker compose ps

# Terminal 2 : serveur Vite au premier plan.
cd frontend
# Exécuter npm ci uniquement si node_modules est absent.
npm run dev
```

Ouvrir **http://localhost:5173**. Se connecter avec le compte de la base montée dans Docker. Les appels `/api` passent par le proxy Vite vers le port 7743; aucune donnée de la console n'est copiée dans Vite. Une modification React ou CSS est rechargée par Vite. Les modifications du **backend** demandent une nouvelle image Docker; Vite ne recharge pas Go.

Si le port 5173 est déjà utilisé, vérifier quel processus l'écoute avant de lancer un second Vite. Arrêter Vite avec `Ctrl+C` dans son terminal. Le backend peut rester lancé; pour l'arrêter sans supprimer son volume :

```powershell
docker compose stop
```

## Exécution locale avec frontend embarqué

```powershell
# Après une modification du backend ou pour embarquer un nouveau build React :
docker compose up -d --build

# Aux démarrages suivants, si l'image n'a pas besoin d'être reconstruite :
docker compose up -d --no-build
```

Ouvrir **http://localhost:7743**. Le `Dockerfile` construit React avec Node 24, place le résultat dans `backend/web`, puis compile le serveur Go qui l'embarque. Le volume `/data` persiste lors d'une reconstruction ou d'un redémarrage du conteneur. `build.ps1` produit séparément le binaire Windows et utilise ce même dossier `backend/web`; il ne sert pas à démarrer le mode Vite.

## Contrôles rapides

```powershell
docker compose ps -a
docker compose logs --tail 50
Invoke-RestMethod http://localhost:7743/api/auth/status
Invoke-RestMethod http://localhost:5173/api/auth/status
```

Les deux dernières commandes doivent rendre le même état de configuration. Une route protégée doit demander une authentification; le test de connexion complète nécessite le mot de passe du compte existant. Les sauvegardes SQLite, le WAL et les fichiers de la base restent dans le volume monté sur `/data`, pas dans le dossier `frontend/`.


## Console 2026 et laboratoires historiques

Depuis la [PR #27](https://github.com/loic31000/CyberHub/pull/27), le Dashboard 2026 et les modules modernisés font partie du frontend principal (`frontend/src/`) : `npm run dev` et `npm run build` dans `frontend/` les servent comme le reste de la Console. Aucune commande de prototype n'est nécessaire.

État au 24 octobre 2026 (`main` : `0575f35c`) : BGP Lookup est présent et Historian 2.0 ([PR #39](https://github.com/loic31000/CyberHub/pull/39)), CVE & KEV 2026 ([PR #41](https://github.com/loic31000/CyberHub/pull/41)) et Investigations 2026 ([PR #43](https://github.com/loic31000/CyberHub/pull/43)) sont intégrés. Dashboard Performance ([PR #42](https://github.com/loic31000/CyberHub/pull/42)) est intégré ; la restauration visuelle C est proposée par la [PR #44 ouverte, non fusionnée](https://github.com/loic31000/CyberHub/pull/44). Elle ne prouve pas que le coût des 218 animations actives est résolu. Playbooks 2026 est encore en développement. La Landing / Showcase reste séparée dans `feat/cyberhub-2026-design` ([PR #25 en brouillon](https://github.com/loic31000/CyberHub/pull/25)); sa démo utilise exclusivement des données fictives, sans appel aux API privées.

Vérifications usuelles dans `frontend/` : `npx tsc --noEmit`, `npm test` (Vitest) et `npm run build`. Ce dernier écrit dans `backend/web` ; pour un build de contrôle sans toucher ce dossier, utiliser comme la CI `npm run build -- --outDir <dossier-temporaire> --emptyOutDir`. Dans `backend/`, `go test ./...` nécessite un build frontend préalable, car `backend/web` est embarqué par `go:embed`.

Branches de laboratoire :

- Landing / Showcase : branche `feat/cyberhub-2026-design`, dossier `showcase/`, commandes expliquées dans `showcase/README.md` de cette branche. **Pas encore intégrée** au frontend principal.
- Dashboard / Terminal Overview : branche `feat/console-2026-dashboard-prototype`, dossier `frontend/prototypes/dashboard-2026/`. Conservée comme **référence historique** ; son contenu a été intégré par la PR #27.

Pour inspecter ces branches sans perturber un travail local non commité, privilégier des worktrees séparés après `git fetch origin`. Ne pas les fusionner uniquement pour prévisualiser les laboratoires. La cible reste **un seul frontend React** ; l'intégration de la landing dépendra des validations décrites dans [la feuille de route](docs/cyberhub-2026/implementation-roadmap.md).
