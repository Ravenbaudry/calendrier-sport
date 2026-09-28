import { Router } from 'express';
import { query } from '../db.js';
import { notFound } from '../middleware/errors.js';
import { listValidatedWorkoutIds, loadWorkouts } from '../services/workouts.js';
import { estimateOneRepMax, round } from '../utils/math.js';
import { paginationSchema, updateProfileSchema, username as usernameSchema } from '../validation.js';

export const usersRouter = Router();

// Liste des membres de l'instance.
usersRouter.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.username, u.bio, u.created_at,
            COUNT(w.id)::int AS workouts_count,
            MAX(w.workout_date) AS last_workout_date
     FROM users u
     LEFT JOIN workouts w ON w.user_id = u.id AND w.status = 'validated'
     GROUP BY u.id
     ORDER BY last_workout_date DESC NULLS LAST, lower(u.username)`,
  );
  res.json({ items: rows });
});

usersRouter.patch('/me', async (req, res) => {
  const { bio } = updateProfileSchema.parse(req.body);
  const { rows } = await query(
    'UPDATE users SET bio = $2 WHERE id = $1 RETURNING id, username, bio, created_at',
    [req.user.id, bio],
  );
  res.json({ user: rows[0] });
});

// Profil + statistiques personnelles.
usersRouter.get('/:username', async (req, res) => {
  const user = await findUser(req.params.username);

  const [stats, weeks, weekly, records, muscleSplit] = await Promise.all([
    query(
      `SELECT
         COUNT(*)::int                                                          AS workouts_count,
         COUNT(*) FILTER (WHERE w.workout_date > CURRENT_DATE - 7)::int         AS workouts_7d,
         COUNT(*) FILTER (WHERE w.workout_date > CURRENT_DATE - 30)::int        AS workouts_30d,
         COALESCE(SUM(t.volume), 0)                                             AS total_volume,
         COALESCE(SUM(t.volume) FILTER (WHERE w.workout_date > CURRENT_DATE - 30), 0) AS volume_30d,
         COALESCE(SUM(t.sets), 0)::int                                          AS total_sets,
         COALESCE(SUM(t.reps), 0)::int                                          AS total_reps,
         MIN(w.workout_date)                                                    AS first_workout_date,
         MAX(w.workout_date)                                                    AS last_workout_date,
         (SELECT COUNT(*)::int FROM kudos k JOIN workouts kw ON kw.id = k.workout_id
          WHERE kw.user_id = $1)                                                AS kudos_received
       FROM workouts w
       CROSS JOIN LATERAL (
         SELECT SUM(sets * reps * weight_kg) AS volume, SUM(sets) AS sets, SUM(sets * reps) AS reps
         FROM workout_exercises WHERE workout_id = w.id
       ) t
       WHERE w.user_id = $1 AND w.status = 'validated'`,
      [user.id],
    ),
    // Semaines actives (lundi) pour calculer la série de semaines consécutives
    query(
      `SELECT DISTINCT date_trunc('week', workout_date)::date AS week_start,
              date_trunc('week', CURRENT_DATE)::date AS current_week
       FROM workouts
       WHERE user_id = $1 AND status = 'validated' AND workout_date <= CURRENT_DATE
       ORDER BY week_start DESC
       LIMIT 520`,
      [user.id],
    ),
    // Volume hebdomadaire sur les 12 dernières semaines (semaines vides incluses)
    query(
      `SELECT gs::date AS week_start,
              COUNT(DISTINCT w.id)::int AS workouts,
              COALESCE(SUM(we.sets * we.reps * we.weight_kg), 0) AS volume
       FROM generate_series(date_trunc('week', CURRENT_DATE) - interval '11 weeks',
                            date_trunc('week', CURRENT_DATE), interval '1 week') AS gs
       LEFT JOIN workouts w
              ON w.user_id = $1 AND w.status = 'validated'
             AND w.workout_date >= gs::date AND w.workout_date < (gs + interval '1 week')::date
       LEFT JOIN workout_exercises we ON we.workout_id = w.id
       GROUP BY gs
       ORDER BY gs`,
      [user.id],
    ),
    // Record de charge par exercice (meilleur poids, puis meilleur nombre de reps à ce poids)
    query(
      `SELECT DISTINCT ON (we.exercise_id)
              we.exercise_id, e.name, e.muscle_group,
              we.weight_kg, we.reps, w.workout_date, w.id AS workout_id
       FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       JOIN exercise_catalog e ON e.id = we.exercise_id
       WHERE w.user_id = $1 AND w.status = 'validated' AND we.weight_kg > 0
       ORDER BY we.exercise_id, we.weight_kg DESC, we.reps DESC, w.workout_date`,
      [user.id],
    ),
    // Répartition des séries par groupe musculaire sur 30 jours
    query(
      `SELECT e.muscle_group, SUM(we.sets)::int AS sets
       FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       JOIN exercise_catalog e ON e.id = we.exercise_id
       WHERE w.user_id = $1 AND w.status = 'validated' AND w.workout_date > CURRENT_DATE - 30
       GROUP BY e.muscle_group
       ORDER BY sets DESC`,
      [user.id],
    ),
  ]);

  const s = stats.rows[0];
  res.json({
    user: { id: user.id, username: user.username, bio: user.bio, created_at: user.created_at },
    is_me: user.id === req.user.id,
    stats: {
      ...s,
      total_volume: round(s.total_volume),
      volume_30d: round(s.volume_30d),
      week_streak: weekStreak(weeks.rows),
    },
    weekly: weekly.rows.map((w) => ({ ...w, volume: round(w.volume) })),
    records: records.rows
      .map((r) => ({ ...r, estimated_1rm: estimateOneRepMax(r.weight_kg, r.reps) }))
      .sort((a, b) => b.weight_kg - a.weight_kg),
    muscle_split_30d: muscleSplit.rows,
  });
});

// Historique paginé des séances validées d'un membre.
usersRouter.get('/:username/workouts', async (req, res) => {
  const user = await findUser(req.params.username);
  const { limit, before } = paginationSchema.parse(req.query);
  const { ids, nextCursor } = await listValidatedWorkoutIds({
    userId: user.id,
    before,
    limit,
    orderBy: 'workout_date',
  });
  res.json({ items: await loadWorkouts(ids, req.user.id), nextCursor });
});

async function findUser(rawUsername) {
  const parsed = usernameSchema.safeParse(rawUsername);
  if (!parsed.success) throw notFound('Membre introuvable');
  const { rows } = await query(
    'SELECT id, username, bio, created_at FROM users WHERE lower(username) = lower($1)',
    [parsed.data],
  );
  if (!rows[0]) throw notFound('Membre introuvable');
  return rows[0];
}

// Nombre de semaines consécutives avec au moins une séance validée.
// La semaine en cours ne casse pas la série tant qu'elle n'est pas terminée.
function weekStreak(rows) {
  if (rows.length === 0) return 0;
  const WEEK = 7 * 86_400_000;
  const toTime = (date) => Date.parse(`${date}T00:00:00Z`);
  const currentWeek = toTime(rows[0].current_week);

  let expected = toTime(rows[0].week_start);
  if (expected !== currentWeek && expected !== currentWeek - WEEK) return 0;

  let streak = 0;
  for (const row of rows) {
    if (toTime(row.week_start) !== expected) break;
    streak += 1;
    expected -= WEEK;
  }
  return streak;
}
