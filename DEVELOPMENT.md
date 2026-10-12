# Développement local Windows avec Docker et Vite

Le backend Go et SQLite tournent dans Docker sur `http://localhost:7743`. En développement, Vite sert React sur `http://localhost:5173` et transmet `/api` au backend (`frontend/vite.config.ts`). Les modifications React/CSS apparaissent via HMR sans reconstruire l'image Docker. Le build embarqué dans Docker reste disponible sur le port 7743.

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


## Prototypes 2026 isolés (non intégrés à `main`)

Les prototypes 2026 sont développés sur des branches distinctes uniquement pour la conception et les validations visuelles. **La cible de l'application personnelle CyberHub est un seul frontend React** regroupant landing, Dashboard et modules existants, avec backend Go/SQLite local. Il n'est pas prévu de service SaaS ou d'hébergement public de la Console. Leurs commandes n'existent pas nécessairement sur `main` :

- Landing / Showcase : branche `feat/cyberhub-2026-design`, dossier `showcase/`, commandes expliquées dans `showcase/README.md` de cette branche.
- Dashboard / Terminal Overview : branche `feat/console-2026-dashboard-prototype`, dossier `frontend/prototypes/dashboard-2026/`, commandes expliquées dans le README du prototype.

Pour les inspecter sans perturber un autre travail local non commité, privilégier des worktrees séparés après `git fetch origin`. Ne pas fusionner ces branches uniquement pour prévisualiser les laboratoires. Leur intégration future dans le frontend React de `main` dépendra des validations de compatibilité, d'accessibilité, de sécurité et de licences décrites dans [la feuille de route](docs/cyberhub-2026/implementation-roadmap.md). La landing et le Dashboard ne deviennent pas deux applications autonomes dans la cible retenue.
