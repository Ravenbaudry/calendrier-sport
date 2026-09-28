import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { CATEGORIES, MUSCLE_GROUPS } from '../constants.js';
import { conflict, forbidden, notFound } from '../middleware/errors.js';
import { estimateOneRepMax, round } from '../utils/math.js';
import { exerciseSchema, idParam, username } from '../validation.js';

export const exercisesRouter = Router();

// Catalogue complet (~80 entrées : filtrage/recherche faits côté client).
//   my_uses : nombre de mes séances validées contenant l'exercice (favoris en premier)
//   last    : ma dernière performance (ligne la plus lourde de la dernière séance),
//             utilisée pour pré-remplir la saisie.
exercisesRouter.get('/', async (req, res) => {
  const { rows } = await query(
    `WITH mine AS (
       SELECT we.exercise_id, COUNT(DISTINCT we.workout_id) AS uses
       FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       WHERE w.user_id = $1 AND w.status = 'validated'
       GROUP BY we.exercise_id
     ),
     last AS (
       SELECT DISTINCT ON (we.exercise_id)
              we.exercise_id, we.sets, we.reps, we.weight_kg, we.rest_seconds, w.workout_date
       FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       WHERE w.user_id = $1 AND w.status = 'validated'
       ORDER BY we.exercise_id, w.workout_date DESC, w.id DESC, we.weight_kg DESC
     )
     SELECT e.id, e.name, e.category, e.muscle_group,
            e.created_by IS NOT NULL AS is_custom,
            u.username AS created_by_username,
            (e.created_by = $1) IS TRUE AS can_delete,
            COALESCE(mine.uses, 0)::int AS my_uses,
            CASE WHEN last.exercise_id IS NOT NULL THEN json_build_object(
              'sets', last.sets, 'reps', last.reps, 'weight_kg', last.weight_kg,
              'rest_seconds', last.rest_seconds, 'workout_date', last.workout_date
            ) END AS last
     FROM exercise_catalog e
     LEFT JOIN users u ON u.id = e.created_by
     LEFT JOIN mine ON mine.exercise_id = e.id
     LEFT JOIN last ON last.exercise_id = e.id
     ORDER BY array_position($2::text[], e.muscle_group::text), e.name`,
    [req.user.id, MUSCLE_GROUPS],
  );
  res.json({ items: rows, categories: CATEGORIES, muscle_groups: MUSCLE_GROUPS });
});

// Ajout d'un exercice personnalisé (partagé avec tous les membres).
exercisesRouter.post('/', async (req, res) => {
  const data = exerciseSchema.parse(req.body);
  try {
    const { rows } = await query(
      `INSERT INTO exercise_catalog (name, category, muscle_group, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, category, muscle_group`,
      [data.name, data.category, data.muscle_group, req.user.id],
    );
    res.status(201).json({
      exercise: {
        ...rows[0],
        is_custom: true,
        created_by_username: req.user.username,
        can_delete: true,
        my_uses: 0,
        last: null,
      },
    });
  } catch (err) {
    if (err.code === '23505') throw conflict('Cet exercice existe déjà dans le catalogue');
    throw err;
  }
});

// Suppression d'un exercice personnalisé par son créateur, s'il n'est utilisé dans aucune séance.
exercisesRouter.delete('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const { rows } = await query('SELECT created_by FROM exercise_catalog WHERE id = $1', [id]);
  if (!rows[0]) throw notFound('Exercice introuvable');
  if (rows[0].created_by !== req.user.id) {
    throw forbidden('Seul le créateur peut supprimer un exercice personnalisé');
  }
  try {
    await query('DELETE FROM exercise_catalog WHERE id = $1', [id]);
  } catch (err) {
    if (err.code === '23503') throw conflict('Exercice utilisé dans des séances : suppression impossible');
    throw err;
  }
  res.status(204).end();
});

// Détail : progression d'un membre (moi par défaut) + meilleures charges du groupe.
// GET /api/exercises/:id?user=pseudo
exercisesRouter.get('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const { user: targetUsername } = z.object({ user: username.optional() }).parse(req.query);

  const { rows: exerciseRows } = await query(
    `SELECT e.id, e.name, e.category, e.muscle_group,
            e.created_by IS NOT NULL AS is_custom, u.username AS created_by_username
     FROM exercise_catalog e LEFT JOIN users u ON u.id = e.created_by
     WHERE e.id = $1`,
    [id],
  );
  if (!exerciseRows[0]) throw notFound('Exercice introuvable');

  let target = { id: req.user.id, username: req.user.username };
  if (targetUsername) {
    const { rows } = await query(
      'SELECT id, username FROM users WHERE lower(username) = lower($1)',
      [targetUsername],
    );
    if (!rows[0]) throw notFound('Membre introuvable');
    target = rows[0];
  }

  const [history, groupBest] = await Promise.all([
    // 100 dernières séances contenant l'exercice, renvoyées dans l'ordre chronologique
    query(
      `SELECT * FROM (
         SELECT w.id AS workout_id, w.workout_date,
                MAX(we.weight_kg) AS max_weight,
                SUM(we.sets)::int AS sets,
                SUM(we.sets * we.reps)::int AS reps,
                SUM(we.sets * we.reps * we.weight_kg) AS volume,
                MAX(CASE WHEN we.reps <= 1 THEN we.weight_kg
                         ELSE we.weight_kg * (1 + we.reps / 30.0) END) AS best_e1rm
         FROM workout_exercises we
         JOIN workouts w ON w.id = we.workout_id
         WHERE w.user_id = $1 AND we.exercise_id = $2 AND w.status = 'validated'
         GROUP BY w.id
         ORDER BY w.workout_date DESC, w.id DESC
         LIMIT 100
       ) h
       ORDER BY workout_date, workout_id`,
      [target.id, id],
    ),
    query(
      `SELECT DISTINCT ON (w.user_id)
              u.id AS user_id, u.username, we.weight_kg, we.reps, w.workout_date
       FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       JOIN users u ON u.id = w.user_id
       WHERE we.exercise_id = $1 AND w.status = 'validated' AND we.weight_kg > 0
       ORDER BY w.user_id, we.weight_kg DESC, we.reps DESC, w.workout_date`,
      [id],
    ),
  ]);

  const points = history.rows.map((row) => ({
    ...row,
    volume: round(row.volume),
    best_e1rm: round(row.best_e1rm, 1),
  }));
  const best = points.reduce((acc, p) => (!acc || p.max_weight > acc.max_weight ? p : acc), null);

  res.json({
    exercise: exerciseRows[0],
    user: target,
    history: points,
    personal_best: best && {
      weight_kg: best.max_weight,
      workout_date: best.workout_date,
      workout_id: best.workout_id,
      best_e1rm: Math.max(...points.map((p) => p.best_e1rm)),
    },
    group_best: groupBest.rows
      .map((row) => ({
        user: { id: row.user_id, username: row.username },
        weight_kg: row.weight_kg,
        reps: row.reps,
        workout_date: row.workout_date,
        estimated_1rm: estimateOneRepMax(row.weight_kg, row.reps),
      }))
      .sort((a, b) => b.weight_kg - a.weight_kg || b.reps - a.reps),
  });
});
