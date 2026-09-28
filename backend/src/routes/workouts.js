import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { badRequest, forbidden, notFound } from '../middleware/errors.js';
import { canView, loadWorkout, loadWorkouts } from '../services/workouts.js';
import { dateRangeSchema, idParam, workoutSchema } from '../validation.js';

export const workoutsRouter = Router();

// Mes séances (validées + brouillons) sur une plage de dates : alimente la vue calendrier.
// GET /api/workouts?from=2025-01-01&to=2025-01-31
workoutsRouter.get('/', async (req, res) => {
  const { from, to } = dateRangeSchema.parse(req.query);
  const { rows } = await query(
    `SELECT id FROM workouts
     WHERE user_id = $1 AND workout_date BETWEEN $2 AND $3
     ORDER BY workout_date, id`,
    [req.user.id, from, to],
  );
  res.json({ items: await loadWorkouts(rows.map((r) => r.id), req.user.id) });
});

workoutsRouter.get('/:id', async (req, res) => {
  const workout = await loadWorkout(idParam.parse(req.params.id), req.user.id);
  if (!canView(workout, req.user.id)) throw notFound('Séance introuvable');
  res.json({ workout });
});

workoutsRouter.post('/', async (req, res) => {
  const data = workoutSchema.parse(req.body);
  await assertValidWorkout(data);

  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO workouts (user_id, workout_date, title, notes, status, validated_at)
       VALUES ($1, $2, $3, $4, $5::varchar, CASE WHEN $5::varchar = 'validated' THEN now() END)
       RETURNING id`,
      [req.user.id, data.workout_date, data.title, data.notes, data.status],
    );
    await insertLines(client, rows[0].id, data.exercises);
    return rows[0].id;
  });

  res.status(201).json({ workout: await loadWorkout(id, req.user.id) });
});

// Remplace entièrement la séance (métadonnées + lignes).
workoutsRouter.put('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = workoutSchema.parse(req.body);
  await assertOwner(id, req.user.id);
  await assertValidWorkout(data);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE workouts
       SET workout_date = $2, title = $3, notes = $4, status = $5::varchar,
           validated_at = CASE WHEN $5::varchar = 'validated' THEN COALESCE(validated_at, now()) END,
           updated_at = now()
       WHERE id = $1`,
      [id, data.workout_date, data.title, data.notes, data.status],
    );
    await client.query('DELETE FROM workout_exercises WHERE workout_id = $1', [id]);
    await insertLines(client, id, data.exercises);
  });

  res.json({ workout: await loadWorkout(id, req.user.id) });
});

workoutsRouter.delete('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  await assertOwner(id, req.user.id);
  await query('DELETE FROM workouts WHERE id = $1', [id]);
  res.status(204).end();
});

async function assertOwner(workoutId, userId) {
  const { rows } = await query('SELECT user_id FROM workouts WHERE id = $1', [workoutId]);
  if (!rows[0]) throw notFound('Séance introuvable');
  if (rows[0].user_id !== userId) throw forbidden('Tu ne peux modifier que tes propres séances');
}

async function assertValidWorkout(data) {
  const exerciseIds = [...new Set(data.exercises.map((line) => line.exercise_id))];
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM exercise_catalog WHERE id = ANY($1::int[])) AS known_exercises,
       $2::date > CURRENT_DATE + 1 AS is_future`,
    [exerciseIds, data.workout_date],
  );
  if (rows[0].known_exercises !== exerciseIds.length) {
    throw badRequest('Exercice inconnu dans la séance');
  }
  // Tolérance d'un jour pour les décalages de fuseau horaire entre client et serveur.
  if (data.status === 'validated' && rows[0].is_future) {
    throw badRequest('Une séance future ne peut pas être validée : enregistre-la comme planifiée');
  }
}

async function insertLines(client, workoutId, lines) {
  if (lines.length === 0) return;
  // Insertion groupée via unnest (une seule requête quel que soit le nombre de lignes).
  await client.query(
    `INSERT INTO workout_exercises
       (workout_id, exercise_id, position, sets, reps, weight_kg, rest_seconds)
     SELECT $1, *
     FROM unnest($2::int[], $3::smallint[], $4::smallint[], $5::smallint[],
                 $6::numeric[], $7::smallint[])`,
    [
      workoutId,
      lines.map((l) => l.exercise_id),
      lines.map((_, index) => index),
      lines.map((l) => l.sets),
      lines.map((l) => l.reps),
      lines.map((l) => l.weight_kg),
      lines.map((l) => l.rest_seconds),
    ],
  );
}
