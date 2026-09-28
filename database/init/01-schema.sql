-- =============================================================================
-- Calendrier Sport — Schéma PostgreSQL
-- -----------------------------------------------------------------------------
-- Exécuté automatiquement par l'image officielle postgres au PREMIER démarrage
-- (répertoire /docker-entrypoint-initdb.d, volume de données vide).
-- Pour réappliquer : docker compose down -v  (⚠ efface toutes les données).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- users : membres de l'instance (tous les inscrits sont « amis »)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username       VARCHAR(30)  NOT NULL,
    password_hash  TEXT         NOT NULL,                -- hash bcrypt
    bio            VARCHAR(280),
    token_version  INTEGER      NOT NULL DEFAULT 0,      -- incrémenté => révoque les JWT existants
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT users_username_format CHECK (username ~ '^[A-Za-z0-9_.-]{3,30}$')
);
-- Unicité insensible à la casse : « Raph » et « raph » ne peuvent coexister.
CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));

-- -----------------------------------------------------------------------------
-- exercise_catalog : exercices prédéfinis (created_by NULL) + personnalisés
-- -----------------------------------------------------------------------------
CREATE TABLE exercise_catalog (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(80)  NOT NULL,
    category      VARCHAR(30)  NOT NULL,                 -- type de matériel
    muscle_group  VARCHAR(30)  NOT NULL,                 -- groupe musculaire principal
    created_by    INTEGER      REFERENCES users (id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT exercise_category_check CHECK (category IN (
        'Barre', 'Haltères', 'Machine', 'Poulie', 'Poids du corps', 'Kettlebell', 'Cardio', 'Autre'
    )),
    CONSTRAINT exercise_muscle_group_check CHECK (muscle_group IN (
        'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Avant-bras',
        'Quadriceps', 'Ischio-jambiers', 'Fessiers', 'Mollets', 'Abdominaux',
        'Corps entier', 'Cardio'
    )),
    CONSTRAINT exercise_name_not_blank CHECK (length(btrim(name)) >= 2)
);
CREATE UNIQUE INDEX exercise_catalog_name_lower_key ON exercise_catalog (lower(name));
CREATE INDEX exercise_catalog_muscle_group_idx ON exercise_catalog (muscle_group);

-- -----------------------------------------------------------------------------
-- workouts : une séance = un utilisateur + une date
--   status 'draft'     : brouillon / séance planifiée, visible par son auteur seul
--   status 'validated' : séance validée => fil d'actualité + classements
-- -----------------------------------------------------------------------------
CREATE TABLE workouts (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workout_date  DATE         NOT NULL DEFAULT CURRENT_DATE,
    title         VARCHAR(100),
    notes         TEXT,
    status        VARCHAR(10)  NOT NULL DEFAULT 'validated',
    validated_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT workouts_status_check CHECK (status IN ('draft', 'validated')),
    CONSTRAINT workouts_validated_at_check CHECK ((status = 'validated') = (validated_at IS NOT NULL)),
    CONSTRAINT workouts_notes_length CHECK (notes IS NULL OR length(notes) <= 5000)
);
CREATE INDEX workouts_user_date_idx ON workouts (user_id, workout_date DESC);
-- Fil d'actualité : dernières séances validées
CREATE INDEX workouts_feed_idx ON workouts (validated_at DESC, id DESC) WHERE status = 'validated';
-- Classements : séances validées sur une période
CREATE INDEX workouts_leaderboard_idx ON workouts (workout_date, user_id) WHERE status = 'validated';

-- -----------------------------------------------------------------------------
-- workout_exercises : lignes d'une séance (« 4 × 8 @ 80 kg, repos 2 min »)
-- Un même exercice peut apparaître plusieurs fois (ex. montée en charge).
-- Volume d'une ligne = sets × reps × weight_kg
-- -----------------------------------------------------------------------------
CREATE TABLE workout_exercises (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workout_id    INTEGER       NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    exercise_id   INTEGER       NOT NULL REFERENCES exercise_catalog (id) ON DELETE RESTRICT,
    position      SMALLINT      NOT NULL DEFAULT 0,      -- ordre d'affichage dans la séance
    sets          SMALLINT      NOT NULL,
    reps          SMALLINT      NOT NULL,
    weight_kg     NUMERIC(6, 2) NOT NULL DEFAULT 0,      -- 0 = poids du corps
    rest_seconds  SMALLINT,                              -- repos entre séries
    CONSTRAINT workout_exercises_sets_check   CHECK (sets BETWEEN 1 AND 100),
    CONSTRAINT workout_exercises_reps_check   CHECK (reps BETWEEN 1 AND 1000),
    CONSTRAINT workout_exercises_weight_check CHECK (weight_kg >= 0 AND weight_kg <= 1000),
    CONSTRAINT workout_exercises_rest_check   CHECK (rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 3600)
);
CREATE INDEX workout_exercises_workout_idx ON workout_exercises (workout_id, position);
CREATE INDEX workout_exercises_exercise_idx ON workout_exercises (exercise_id);

-- -----------------------------------------------------------------------------
-- kudos : un « like » par utilisateur et par séance
-- -----------------------------------------------------------------------------
CREATE TABLE kudos (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workout_id  INTEGER     NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    user_id     INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT kudos_unique UNIQUE (workout_id, user_id)
);
CREATE INDEX kudos_user_idx ON kudos (user_id);

-- -----------------------------------------------------------------------------
-- comments : discussion sous une séance
-- -----------------------------------------------------------------------------
CREATE TABLE comments (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workout_id  INTEGER     NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    user_id     INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT comments_content_length CHECK (length(btrim(content)) BETWEEN 1 AND 1000)
);
CREATE INDEX comments_workout_idx ON comments (workout_id, created_at);

-- -----------------------------------------------------------------------------
-- Vue utilitaire : totaux par séance (volume, séries, répétitions)
-- -----------------------------------------------------------------------------
CREATE VIEW workout_totals AS
SELECT
    w.id                                                      AS workout_id,
    w.user_id,
    w.workout_date,
    w.status,
    COUNT(we.id)::int                                         AS exercise_lines,
    COUNT(DISTINCT we.exercise_id)::int                       AS exercise_count,
    COALESCE(SUM(we.sets), 0)::int                            AS total_sets,
    COALESCE(SUM(we.sets * we.reps), 0)::int                  AS total_reps,
    COALESCE(SUM(we.sets * we.reps * we.weight_kg), 0)::numeric(12, 2) AS total_volume
FROM workouts w
LEFT JOIN workout_exercises we ON we.workout_id = w.id
GROUP BY w.id;

COMMIT;
