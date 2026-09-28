import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { LEADERBOARD_PERIODS, LEADERBOARD_TYPES } from '../constants.js';

export const leaderboardRouter = Router();

const leaderboardQuery = z.object({
  type: z.enum(LEADERBOARD_TYPES).default('volume'),
  period: z.coerce
    .number()
    .refine((value) => LEADERBOARD_PERIODS.includes(value), 'Période : 7 ou 30 jours')
    .default(7),
});

// Critère de classement (liste blanche : jamais d'entrée utilisateur dans le SQL).
const METRICS = {
  // Somme de (séries × répétitions × poids) des séances validées de la période
  volume: { column: 'volume', tieBreak: 'workouts_count' },
  // Nombre de séances validées sur la période
  consistency: { column: 'workouts_count', tieBreak: 'volume' },
};

// GET /api/leaderboard?type=volume|consistency&period=7|30
// Période glissante : les N derniers jours, aujourd'hui inclus. Tous les membres apparaissent.
leaderboardRouter.get('/', async (req, res) => {
  const { type, period } = leaderboardQuery.parse(req.query);
  const metric = METRICS[type];

  const { rows } = await query(
    `WITH bounds AS (
       SELECT (CURRENT_DATE - ($1::int - 1)) AS start_date, CURRENT_DATE AS end_date
     ),
     per_workout AS (
       SELECT w.id, w.user_id, w.workout_date,
              COALESCE(SUM(we.sets * we.reps * we.weight_kg), 0) AS volume
       FROM workouts w
       CROSS JOIN bounds b
       LEFT JOIN workout_exercises we ON we.workout_id = w.id
       WHERE w.status = 'validated'
         AND w.workout_date BETWEEN b.start_date AND b.end_date
       GROUP BY w.id
     ),
     per_user AS (
       SELECT u.id AS user_id, u.username,
              COUNT(pw.id)::int                        AS workouts_count,
              COUNT(DISTINCT pw.workout_date)::int     AS active_days,
              COALESCE(SUM(pw.volume), 0)              AS volume
       FROM users u
       LEFT JOIN per_workout pw ON pw.user_id = u.id
       GROUP BY u.id
     )
     SELECT p.*, RANK() OVER (ORDER BY p.${metric.column} DESC)::int AS rank,
            b.start_date, b.end_date
     FROM per_user p CROSS JOIN bounds b
     ORDER BY rank, p.${metric.tieBreak} DESC, lower(p.username)`,
    [period],
  );

  res.json({
    type,
    period,
    start_date: rows[0]?.start_date ?? null,
    end_date: rows[0]?.end_date ?? null,
    entries: rows.map((row) => ({
      rank: row.rank,
      user: { id: row.user_id, username: row.username },
      value: type === 'volume' ? Math.round(row.volume * 100) / 100 : row.workouts_count,
      volume: Math.round(row.volume * 100) / 100,
      workouts_count: row.workouts_count,
      active_days: row.active_days,
      is_me: row.user_id === req.user.id,
    })),
  });
});
