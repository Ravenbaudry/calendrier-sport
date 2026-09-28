# Calendrier Sport 🏋️

**Le « Strava de la musculation », auto-hébergé pour un groupe d'amis.**
Journal d'entraînement en vue calendrier, fil d'actualité avec kudos et commentaires,
classements volume / régularité — le tout dans un conteneur LXC Proxmox, accessible
uniquement via votre VPN (Tailscale ou WireGuard).

- **Frontend** : SPA React 19 + Vite + Tailwind CSS 4, thème sombre, pensée mobile (installable en PWA)
- **Backend** : Node.js 22 + Express 5, API REST, JWT + bcrypt, validation zod
- **Base de données** : PostgreSQL 16 (volume Docker persistant)
- **Déploiement** : Docker Compose (3 services, un seul port exposé)

## Fonctionnalités

| Domaine | Détail |
| --- | --- |
| Authentification | Inscription / connexion (JWT, bcrypt), code d'invitation optionnel, anti brute-force, changement de mot de passe (révoque les autres sessions) |
| Profil | Pseudo, bio, séances totales / 30 jours, volume cumulé, série de semaines consécutives, kudos reçus, volume hebdomadaire (12 semaines), répartition par groupe musculaire, records personnels avec 1RM estimé |
| Exercices | Catalogue de 80 exercices prédéfinis (13 groupes musculaires), recherche insensible aux accents, exercices personnalisés partagés, progression par exercice (charge max, 1RM estimé, volume) et meilleures charges du groupe |
| Journal / calendrier | Vue mois avec séances validées, planifiées et records ; saisie d'une séance à une date (aujourd'hui par défaut) : séries, répétitions, poids (kg), repos, notes ; pré-remplissage avec la dernière performance ; sauvegarde locale automatique de la saisie en cours ; séances planifiées (brouillons privés) validables le jour J ; « Refaire » une séance |
| Social | Fil chronologique des dernières séances validées de tous les membres, kudos (like), commentaires, badges 🏆 record personnel |
| Classements | Volume total (Σ séries × répétitions × poids) et régularité (nombre de séances validées), sur 7 ou 30 jours glissants |

## Architecture

```
 Navigateur (mobile / desktop) ── VPN ──►  LXC Proxmox (Docker Compose)
                                           ┌─────────────────────────────────────────────┐
                                           │ web : nginx                                  │
                                           │  ├─ /        → SPA React (fichiers statiques)│
                                           │  └─ /api/*   → api:3000                      │
                                           │ api : Node.js / Express 5 (REST, JWT)        │
                                           │ db  : PostgreSQL 16 (réseau interne, volume) │
                                           └─────────────────────────────────────────────┘
```

- nginx est le seul service publié (port `APP_PORT`, 8080 par défaut) ; il sert la SPA et
  relaie `/api` vers l'API. Même origine : pas de CORS à gérer.
- La base est sur un réseau Docker `internal` : seule l'API peut la joindre.
- Le JWT est envoyé dans l'en-tête `Authorization: Bearer …`. Il contient une
  `token_version` vérifiée à chaque requête, ce qui permet de révoquer les sessions.

## Arborescence

```
calendrier-sport/
├── docker-compose.yml            # db + api + web
├── .env.example                  # configuration à copier en .env
├── database/
│   └── init/
│       ├── 01-schema.sql         # tables, contraintes, index, vue workout_totals
│       └── 02-seed-exercises.sql # catalogue de 80 exercices
├── backend/                      # API REST Node.js / Express 5
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── server.js             # démarrage + arrêt propre (SIGTERM)
│   │   ├── app.js                # middlewares, montage des routes
│   │   ├── config.js             # variables d'environnement
│   │   ├── db.js                 # pool pg, transactions, parseurs de types
│   │   ├── constants.js          # catégories, groupes musculaires…
│   │   ├── validation.js         # schémas zod
│   │   ├── middleware/
│   │   │   ├── auth.js           # signature / vérification JWT
│   │   │   └── errors.js         # erreurs HTTP + gestionnaire global
│   │   ├── routes/
│   │   │   ├── auth.js           # inscription, connexion, /me, mot de passe
│   │   │   ├── users.js          # membres, profil + statistiques
│   │   │   ├── exercises.js      # catalogue, exercices perso, progression
│   │   │   ├── workouts.js       # CRUD des séances (calendrier)
│   │   │   ├── social.js         # fil, kudos, commentaires
│   │   │   └── leaderboard.js    # classements volume / régularité
│   │   ├── services/workouts.js  # chargement groupé des séances, records
│   │   └── utils/math.js
│   └── test/api.test.js          # tests d'intégration (node:test + PostgreSQL)
├── frontend/                     # SPA React + Vite + Tailwind
│   ├── Dockerfile                # build Vite puis image nginx
│   ├── nginx/                    # vhost (SPA + proxy /api) et en-têtes de sécurité
│   ├── index.html
│   ├── public/                   # favicon, manifest PWA
│   └── src/
│       ├── main.jsx, App.jsx     # React Query, routeur, routes protégées
│       ├── api/client.js         # fetch + JWT
│       ├── context/AuthContext.jsx
│       ├── lib/                  # dates, formatage FR, helpers séances
│       ├── components/           # Layout, WorkoutCard, KudosButton, CommentsSection,
│       │                         # ExercisePicker, graphiques SVG, UI
│       └── pages/                # Fil, Calendrier, Saisie, Détail, Classements,
│                                 # Profil, Exercices, Membres, Réglages, Connexion
├── scripts/
│   ├── backup.sh                 # pg_dump compressé + rotation
│   └── restore.sh
└── docs/
    └── DEPLOIEMENT-PROXMOX.md    # LXC, Docker, Tailscale / WireGuard, sauvegardes
```

## Démarrage rapide (production)

```bash
cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
docker compose up -d --build
```

Puis ouvrir `http://<ip-du-serveur>:8080` et créer le premier compte.
👉 Guide complet pour Proxmox (LXC, Docker, VPN, HTTPS, sauvegardes) :
[docs/DEPLOIEMENT-PROXMOX.md](docs/DEPLOIEMENT-PROXMOX.md)

## Schéma de la base

| Table | Colonnes principales |
| --- | --- |
| `users` | `id`, `username` (unique, insensible à la casse), `password_hash` (bcrypt), `bio`, `token_version`, `created_at` |
| `exercise_catalog` | `id`, `name` (unique), `category` (matériel), `muscle_group`, `created_by` (NULL = prédéfini) |
| `workouts` | `id`, `user_id`, `workout_date`, `title`, `notes`, `status` (`draft` / `validated`), `validated_at`, `created_at`, `updated_at` |
| `workout_exercises` | `id`, `workout_id`, `exercise_id`, `position`, `sets`, `reps`, `weight_kg`, `rest_seconds` |
| `kudos` | `id`, `workout_id`, `user_id`, `created_at` — unique (`workout_id`, `user_id`) |
| `comments` | `id`, `workout_id`, `user_id`, `content`, `created_at` |

Le volume d'une ligne vaut `sets × reps × weight_kg` (0 kg = poids du corps). Seules les
séances **validées** apparaissent dans le fil et comptent dans les classements.
Détail complet (contraintes `CHECK`, index, vue) : [`database/init/01-schema.sql`](database/init/01-schema.sql).

## API REST

Toutes les routes sont préfixées par `/api` et, sauf mention contraire, exigent
`Authorization: Bearer <jwt>`. Les erreurs ont la forme `{ "error": "message", "details"?: [...] }`.

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/health` | Santé de l'API et de la base (public) |
| GET | `/auth/config` | `{ inviteRequired }` (public) |
| POST | `/auth/register` | `{ username, password, inviteCode? }` → `{ token, user }` (public) |
| POST | `/auth/login` | `{ username, password }` → `{ token, user }` (public) |
| GET | `/auth/me` | Utilisateur connecté |
| PUT | `/auth/password` | `{ currentPassword, newPassword }` → nouveau jeton |
| GET | `/users` | Membres de l'instance |
| PATCH | `/users/me` | `{ bio }` |
| GET | `/users/:username` | Profil + statistiques, volume hebdo, records, répartition musculaire |
| GET | `/users/:username/workouts` | Historique paginé (`?limit=&before=`) |
| GET | `/exercises` | Catalogue + `my_uses` + dernière performance (`last`) |
| POST | `/exercises` | Exercice personnalisé `{ name, category, muscle_group }` |
| DELETE | `/exercises/:id` | Par son créateur, s'il n'est pas utilisé |
| GET | `/exercises/:id` | Progression (`?user=`) et meilleures charges du groupe |
| GET | `/workouts?from=&to=` | Mes séances (validées + planifiées) sur une période |
| POST | `/workouts` | `{ workout_date, title?, notes?, status, exercises: [{ exercise_id, sets, reps, weight_kg, rest_seconds? }] }` |
| GET / PUT / DELETE | `/workouts/:id` | Détail / remplacement / suppression (propriétaire) |
| GET | `/feed` | Fil des séances validées (`?limit=&before=<id>`) |
| POST / DELETE | `/workouts/:id/kudos` | Donner / retirer un kudos |
| GET / POST | `/workouts/:id/comments` | Lister / ajouter `{ content }` |
| DELETE | `/comments/:id` | Par l'auteur ou le propriétaire de la séance |
| GET | `/leaderboard?type=volume\|consistency&period=7\|30` | Classement de tous les membres |

## Développement local

Prérequis : Node.js ≥ 22.22, PostgreSQL 16.

```bash
# Base de données
createdb calendrier
psql -d calendrier -f database/init/01-schema.sql -f database/init/02-seed-exercises.sql

# API (http://localhost:3000)
cd backend
cp .env.example .env        # adapter DATABASE_URL / JWT_SECRET
npm install
npm run dev

# Frontend (http://localhost:5173, /api relayé vers :3000)
cd frontend
npm install
npm run dev
```

### Tests

Les tests d'intégration de l'API utilisent une vraie base PostgreSQL, **entièrement
réinitialisée** à chaque lancement (son nom doit contenir `test`) :

```bash
createdb calendrier_test
cd backend
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/calendrier_test npm test
```

## Licence

Projet personnel — à adapter librement pour votre groupe.
